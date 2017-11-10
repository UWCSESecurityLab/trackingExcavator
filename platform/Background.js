"use strict";

/* CATEGORIES:
 *      A: analytics
 *      B: vanilla
 *      C: forced
 *      D: referred
 *      E: personal
 *      F: referred analytics
 *      G: fingerprinting (new)
 */

// data storage format:
// domain -> array of Trackers
// each Tracker: {domain, referrer (if category C), time seen}
var sites = {};

// Temporary storage to keep track of fingerprinting candidates (per tab)
var fingerprintCandidates = {};

// Flag for whether we're in Wayback Mode.
var waybackMode = false;

// Keep track of registered add-ons
var registeredAddons = {}; // name --> link map

var run_name = null;
var logging_server = null;
var pass =  -1;

var runEventCounts = {};

var loggingServerWebsocket = null;
var eventQueue = [];

var tabIDToInputSiteMapping = {};


initialize();


/* ***
   INITIALIZATION FUNCTIONS.
   ***
   */

// Read in persistent data and set up all listeners.
function initialize() {

  var keys = ["sites", "registered"];
  chrome.storage.local.get(keys, function(items) {
    var storageSites = items.sites;
    if (storageSites) {
      //console.log(storageSites);
      sites = JSON.parse(storageSites);
    }

    var registered = items.registered;
    if (registered) {
      registeredAddons = JSON.parse(registered);
    }

  });

  chrome.windows.onRemoved.addListener(saveSites);

  chrome.windows.onCreated.addListener(windowRemove);

  chrome.management.onUninstalled.addListener(handleUninstall);
  chrome.management.onDisabled.addListener(handleDisable);

  chrome.webRequest.onErrorOccurred.addListener(onRequestError,
                                                { urls: ["<all_urls>"] });
  chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders,
                                                    { urls: ["<all_urls>"] },
                                                    ["blocking", "requestHeaders"]);
  chrome.webRequest.onCompleted.addListener(onRequestCompleted,
                                            { urls: ["<all_urls>"] },
                                            ["responseHeaders"]);

  chrome.webNavigation.onCompleted.addListener(onNavigationCompleted);
  chrome.webNavigation.onErrorOccurred.addListener(onNavigationError);

  initializeTabListeners();
  initializeMessageListeners();
}

// Handle when another extension is uninstalled or disabled
function handleUninstall(id) {
  delete registeredAddons[id];
}

function handleDisable(info) {
  handleUninstall(info.id);
}

var BASE_FRAME_ID = 0;
var NO_FRAME_ID = -1;
var getWindow = function(windowId) {
  var deferred = Q.defer();
  if (windowId === null) {
    deferred.resolve(null);
  } else{
    chrome.windows.get(windowId, function(w) {
      deferred.resolve(w);
    });
  }
  return deferred.promise;
};
var getFrame = function(windowId, tabId, frameId) {
  var deferred = Q.defer();
  if (tabId === null || frameId === null) {
    deferred.resolve(null);
  } else {
    chrome.webNavigation.getAllFrames({tabId: tabId}, function(frames) {
      if (frames) {
        frames.forEach(function(frame) {
          if (frame.frameId === frameId) {
            deferred.resolve(frame);
            return;
          }
        });
      } else {
        deferred.resolve(null)
      }
    });
  }
  return deferred.promise;
};


function sendConsoleLogToServer(message) {
  event = {};
  event['consoleMessage'] = message;
  eventQueue.push({
    'messageType': 'consoleLog',
    'content': event
  });

}

function logRequestStart(requestDetails, tab, blocked, why_blocked) {
  var windowId = tab ? tab.windowId : null;
  var tabId = tab ? tab.id : null;
  var frameId = requestDetails.frameId;
  Promise.all([getWindow(windowId),
               getFrame(windowId, tabId, frameId)]).then(function(windowAndFrame) {
      var ourWindow = windowAndFrame[0];
      var ourFrame = windowAndFrame[1];
    if (run_name != null) {
      var event = {};

      // console.log(requestDetails);
      event['request_id'] = requestDetails.requestId;
      event['run_name'] = run_name;
      event['type'] = 'request';
      event['request_url'] = requestDetails.url;
      event['resource_type'] = requestDetails.type;
      event['method'] = requestDetails.method;
      event['top_url'] = tab ? tab.url : null;
      event['tab'] = tab;
      event['input_site'] = tab ? tabIDToInputSiteMapping[tab.id] : 'NO TAB';
      event['from_subframe'] = (requestDetails.frameId !== BASE_FRAME_ID);
      event['from_nested_subframe'] = (requestDetails.parentFrameId !== BASE_FRAME_ID &&
                                       requestDetails.parentFrameId !== NO_FRAME_ID);
      event['referer_url'] = getValueFromDictionaryArray(requestDetails.requestHeaders,
                                                         "Referer");
      event['window_type'] = ourWindow ? ourWindow.type : null;
      event['window'] = ourWindow;
      event['frame_url'] = ourFrame ? ourFrame.url : null;
      event['frame'] = ourFrame;
      event['blocked'] = blocked;
      event['why_blocked'] = why_blocked;
      event['request_time'] = requestDetails.timeStamp;
      event['request_headers'] = requestDetails.requestHeaders;
      event['pass'] = pass;

      // REORDERING CAUSES THIS TO OVERWRITE RESPONSES
      //event['response_code'] = null;      // These response fields will be set
      //event['response_time'] = null;      // later on, when onComplete calls to
      //event['response_headers'] = null;   // logEventEnd/
      //event['response_content'] = null;

      eventQueue.push({'messageType': 'logRequestEventStart',
                       'content': event});
    }
  });
}

function logRequestEnd(requestDetails, tab) {
  var event = {};
  event['request_id'] = requestDetails.requestId;
  event['run_name'] = run_name;
  event['response_code'] = requestDetails.statusCode;
  event['response_time'] = requestDetails.timeStamp;
  event['response_headers'] = requestDetails.responseHeaders;
  event['response_content'] = null;

  if (tab) {
    event['tab'] = tab;
    event['top_url'] = tab ? tab.url : null;
  }

  if (waybackMode) {
    clearCookies().then(eventQueue.push({'messageType': 'logRequestEventEnd',
                   'content': event}));
  } else {
    eventQueue.push({'messageType': 'logRequestEventEnd',
                     'content': event});
  }

}


function logNavigationCompleted(navigationDetails) {

  navigationDetails['run_name'] = run_name;
  navigationDetails['pass'] = pass;
  navigationDetails['type'] = 'navigationCompleted';
  navigationDetails['input_site'] = tabIDToInputSiteMapping[navigationDetails.tabId];
  console.log('nav completed logging input site ' + navigationDetails['input_site']);

  eventQueue.push({'messageType': 'logNavigationCompletedEvent',
                   'content': navigationDetails});
}

function logNavigationError(navigationDetails) {

  navigationDetails['run_name'] = run_name;
  navigationDetails['pass'] = pass;
  navigationDetails['type'] = 'navigationError';
  navigationDetails['input_site'] = tabIDToInputSiteMapping[navigationDetails.tabId];
  console.log('nav error logging input site ' + navigationDetails['input_site']);

  eventQueue.push({'messageType': 'logNavigationErrorEvent',
                   'content': navigationDetails});
}

function logRequestError(details) {
  event = {};
  event['run_name'] = run_name;
  event['request_id'] = details.requestId;
  event['input_site'] = tabIDToInputSiteMapping[details.tabId];
  event['error_details'] = details;

  eventQueue.push({'messageType': 'logRequestErrorEvent',
                   'content': event});
}

function runNameAndLoggingServerSet() {
  return ((typeof run_name === 'string' || run_name instanceof String) &&
          (typeof logging_server === 'string' || logging_server instanceof String));

}

function onRequestError(details) {
  if (!runNameAndLoggingServerSet()) {
    return;
  } else if (details.url.startsWith('about:') || details.url.startsWith('chrome://')) {
    return;
  } else if (getHostnameFromUrl(details.url) === getHostnameFromUrl(logging_server)) {
    return;
  }

  var tabId = details.tabId;
  if (tabId >= 0) {
    chrome.tabs.get(tabId, function(tab) {
      if (chrome.runtime.lastError) {
        console.log('Error in chrome.tabs.get: ' + chrome.runtime.lastError.message);
      }
      if (tab) {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return;
        }
      }
      logRequestError(details);
    });
  } else {
    logRequestError(details);
  }
}

function onNavigationError(navigationDetails) {
  if (!runNameAndLoggingServerSet()) {
    return;
  } else if (navigationDetails.url.startsWith('about:') || navigationDetails.url.startsWith('chrome://')) {
    return;
  } else if (getHostnameFromUrl(navigationDetails.url) === getHostnameFromUrl(logging_server)) {
    return;
  }

  var tabId = navigationDetails.tabId;
  if (tabId >= 0) {
    chrome.tabs.get(tabId, function(tab) {
      if (chrome.runtime.lastError) {
        console.log('Error in chrome.tabs.get: ' + chrome.runtime.lastError.message);
      }
      if (tab) {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return;
        }
      }
      logNavigationError(navigationDetails);
    });
  } else {
    logNavigationError(navigationDetails);
  }

}

function onNavigationCompleted(navigationDetails) {
  if (!runNameAndLoggingServerSet()) {
    return;
  } else if (navigationDetails.url.startsWith('about:') || navigationDetails.url.startsWith('chrome://')) {
    return;
  } else if (getHostnameFromUrl(navigationDetails.url) === getHostnameFromUrl(logging_server)) {
    return;
  }

  var tabId = navigationDetails.tabId;
  if (tabId >= 0) {
    chrome.tabs.get(tabId, function(tab) {
      if (tab) {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return;
        }
      }
      logNavigationCompleted(navigationDetails);
    });
  } else {
    logNavigationCompleted(navigationDetails);
  }

}

function onRequestCompleted(requestDetails) {
  if (!runNameAndLoggingServerSet()) {
    return;
  } else if (getHostnameFromUrl(requestDetails.url) === getHostnameFromUrl(logging_server)) {
    return;
  }

  var tabId = requestDetails.tabId;
  if (tabId >= 0) {
    chrome.tabs.get(tabId, function(tab) {
      if (tab) {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return;
        }
      }
      logRequestEnd(requestDetails, tab);
    });
  } else {
    logRequestEnd(requestDetails, null);
  }
}

// Called every time a request is made by the browser, to allow us to inspect
// and/or block the requeset.
function onBeforeSendHeaders(requestDetails) {
  console.log('onbefore');
  if (!runNameAndLoggingServerSet()) {
    return null;
  } else if (getHostnameFromUrl(requestDetails.url) === getHostnameFromUrl(logging_server)) {
    return null;
  }

  console.log('going forward');

  var willBlock = false;
  var blockingReason = '';

  // Block bubble escaping requests in wayback mode.
  if (shouldBlock(requestDetails)) {
    willBlock = true;
    console.log('Will block because bubble escape');
    blockingReason = 'Bubble escape';
  }
  else if (requestDetails.url.endsWith('about:blank')) {
    willBlock = true;
    blockingReason = 'about:blank request';
  }

  // We only check tabId >= 0 in order to avoid causing exceptions whenever
  // it's -1. We still log regardless (tab is just sometimes null).
  var tabId = requestDetails.tabId;
  if (tabId >= 0) {
    chrome.tabs.get(tabId, function(tab) {
      if (tab) {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return;
        }
      }
      // Note that even if the tab is undefined, we still log.
      logRequestStart(requestDetails, tab, willBlock, blockingReason);
    });
  } else {
    logRequestStart(requestDetails, null, willBlock, blockingReason);
  }

  // If the request escapes the Wayback bubble and we're in Wayback Mode,
  // block the request from happening. (Note that we still logged it above!)
  return {cancel: willBlock};
}

function shouldBlock(requestDetails) {
  return waybackMode &&
         !isToArchiveDotOrg(requestDetails) &&
         escapesBubble(requestDetails);
}

// Returns true if the request is to a site outside of the Wayback Machine.
function escapesBubble(requestDetails) {
  var waybackRegex = new RegExp('^(https?://)?web.archive.org/web/\\d+', 'i');
  return !waybackRegex.test(requestDetails.url);

  // Example:
  // http://www.google.com  (TRUE)
  // but not
  // https://web.archive.org/web/20150324001529/http://www.google.com/ (FALSE)
}

// This is a little bit hacky (endsWith instead of some reliable tld/domain extracting)
// but it should mostly work.
function isToArchiveDotOrg(requestDetails) {
  return getHostnameFromUrl(requestDetails.url).endsWith('archive.org');
}

function isPartOfWaybackToolbar(requestDetails) {
  var waybackStaticRE = new RegExp('^(https?://)?web.archive.org/static/', 'i');
  var waybackAnalyticsRE = new RegExp('^(https?://)?analytics.archive.org', 'i');
  var waybackGraphRE = new RegExp('^(https?://)?web.archive.org/web/jsp/graph.jsp', 'i');

  return waybackStaticRE.test(requestDetails.url) ||
         waybackAnalyticsRE.test(requestDetails.url) ||
         waybackGraphRE.test(requestDetails.url);
}

function initializeTabListeners() {

  chrome.tabs.onRemoved.addListener(
    function(tabId, removeInfo) {
      // Remove the tab Id and its current trackers
      delete fingerprintCandidates[tabId];
    }
  );
}

function initializeMessageListeners() {

  // Listen for messages from the content script and popup pages
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if(request.type === 'programmaticCookieSet') {
        if (!runNameAndLoggingServerSet()) {
          return;
        }
        var event = {};
        event['run_name'] = run_name;
        event['type'] = 'programmaticCookieSet';
        event['top_url'] = request.url;
        event['setting_script_url'] = request.scriptURL;
        event['cookie_string'] = request.cookieString;
        event['timestamp'] = Date.now();
        event['pass'] = pass;

        chrome.tabs.getCurrent(function(tab) {
          event['input_site'] = tab ? tabIDToInputSiteMapping[tab.id] : 'NO CURRENT TAB';
          if (waybackMode) {
            clearCookies().then(
              eventQueue.push({'messageType': 'logProgrammaticCookieSetEvent',
                               'content': event}));
          }
          else {
            eventQueue.push({'messageType': 'logProgrammaticCookieSetEvent',
                             'content': event});
          }
        });
      } else if (request.type === 'consoleLog') {
        var consoleMessage = request.consoleMessage;
        var event = {};
        event['consoleMessage'] = consoleMessage;
        eventQueue.push({
          'messageType': 'consoleLog',
          'content': event
        });

      }
      else if (request.type === 'DOMContent') {
        // console.log('DOM Content Event Received!');
        var event = {};
        event['run_name'] = run_name;
        event['pass'] = pass;
        event['type'] = 'DOMContent';
        event['dom_html'] = request.dom_html;
        event['top_url'] = request.url;
        event['sender'] = sender;
        event['tab'] = sender.tab;                    // Duplicated in sender.
        event['input_site'] = sender.tab ? tabIDToInputSiteMapping[sender.tab.id] : 'NO_SENDER_TAB';
        event['frameid'] = sender.frameid;            // Duplicated in sender.
        event['url'] = sender.url;                    // Duplicated in sender.
        event['tlsChannelId'] = sender.tlsChannelId;  // Duplicated in sender.
        event['frame'] = null;
        event['window'] = null;

        if (sender && sender.tab) {
          // console.log('sender and sender.tab');
          var windowId = sender.tab.windowId;
          var tabId = sender.tab.id;
          var frameId = sender.frameId;
          Promise.all([getWindow(windowId),
                      getFrame(windowId, tabId, frameId)]).then(function(windowAndFrame) {
            var ourWindow = windowAndFrame[0];
            var ourFrame = windowAndFrame[1];
            event['frame'] = ourFrame;
            event['window'] = ourWindow;
            eventQueue.push({'messageType': 'logDomContentEvent',
                            'content': event});
          });
        } else {
          eventQueue.push({'messageType': 'logDomContentEvent',
                           'content': event});
        }
      }
      else if(request.type == "fingerprintApiEvent") {
        if (!runNameAndLoggingServerSet()) {
          return;
        }
        var event = {};
        event['run_name'] = run_name;
        event['type'] = 'fingerprintApiEvent';
        event['top_url'] = request.url;
        event['setting_script_url'] = request.sourceUrl;
        event['api_name'] = request.apiName;
        event['timestamp'] = Date.now();
        event['pass'] = pass;
        if (sender && sender.tab) {
          var windowId = sender.tab.windowId;
          var tabId = sender.tab.id;
          var frameId = sender.frameId;
          Promise.all([getWindow(windowId),
                      getFrame(windowId, tabId, frameId)]).then(function(windowAndFrame) {
            var ourWindow = windowAndFrame[0];
            var ourFrame = windowAndFrame[1];
            event['frame'] = ourFrame;
            event['window'] = ourWindow;
            event['input_site'] = tabIDToInputSiteMapping[tabId];
            eventQueue.push({'messageType': 'logFingerprintApiEvent',
                            'content': event});
            });
        } else {
          event['input_site'] = 'NO SENDER AND SENDER TAB';
          eventQueue.push({'messageType': 'logFingerprintApiEvent',
                           'content': event});
        }
      }
      else if (request.type === 'closeTab') {
        console.log('removing tab ' + sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
      }
      else if(request.type == "clearData") {
        clearData();
      }
      else if(request.type == "getRegisteredAddons") {
        sendResponse(registeredAddons);
      }
      else if(request.type == "browseAutomatically") {
        browseAutomatically(request.urls, request.loadtime, request.visits, sendResponse);
      }
    }
  );

  // Listen for messages from other extensions
  // (Expose public APIs here)
  chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
      if (request.type == "registerAddon") {
        console.log("registering: " + "chrome-extension://" + sender.id + "/" + request.link);
        registeredAddons[sender.id] = {};
        registeredAddons[sender.id].name = request.name;
        if (request.link) {
          registeredAddons[sender.id].link = "chrome-extension://" + sender.id + "/" + request.link;
        }
        return true;
      }
      else if(request.type == "clearData") {
        clearData(sendResponse);
        return true;
      }
      else if (request.type == "setWaybackMode") {
        if (request.waybackMode) {
          waybackMode = true;
        } else {
          waybackMode = false;
        }
        console.log('wayback mode: ' + waybackMode);
        sendResponse();
        return true;
      }
      else if (request.type == "getWaybackMode") {
        sendResponse(waybackMode);
        return true;
      }
      else if (request.type === "configureRun") {
        configureRun(request);
        sendResponse({'status': 'ok'});
        return true;
      }
      else if (request.type === "setPass") {
        pass = request['pass'];
        sendResponse({'status': 'ok'});
        return true;
      }
      else if (request.type === "getPlatformVersion") {
        sendResponse(chrome.runtime.getManifest().version);
        return true;
      }
      else if (request.type === 'getStats') {
        sendResponse(runEventCounts);
        return true;
      }
      else if(request.type == "browseAutomatically") {
        browseAutomatically(request.urls, request.loadtime, request.visits, sendResponse);
        return true;
      }
      // else
      return false;
    }
  );
}

function initializeWebsocket() {
  loggingServerWebsocket = new WebSocket(logging_server);
  loggingServerWebsocket.onclose = ws_onclose;
  loggingServerWebsocket.onerror = ws_onerror;
  loggingServerWebsocket.onmessage = ws_onmessage;
  loggingServerWebsocket.onopen = ws_onopen;
}

// Thank goodness Javascript is single threaded, so this consumer/producer model
// is very simple :)
var sendLoop = null;
function ws_onopen(event) {
  console.log('Successfully opened a websocket to ' + logging_server);
  sendLoop = window.setInterval(function() {
    if (eventQueue.length > 0) {
      eventQueue.forEach(function(event) {
        loggingServerWebsocket.send(JSON.stringify(event));
      });
      eventQueue = [];
    }
  }, 100);
}

function ws_onmessage(event) {
  var data = JSON.parse(event.data);
  if (data['status'] === 'ok') {
    if (data['messageType'] === 'logRequestEventStart') {
      runEventCounts[run_name][pass].request_starts++;
    } else if (data['messageType'] === 'logRequestEventEnd') {
      runEventCounts[run_name][pass].request_ends++;
    } else if (data['messageType'] === 'logProgrammaticCookieSetEvent') {
      runEventCounts[run_name][pass].cookie_sets++;
    }
  } else {
    console.error('Error from server.');
    console.error(data);
    if (data['messageType'] === 'logRequestEventStart') {
      runEventCounts[run_name][pass].request_start_failures++;
    } else if (data['messageType'] === 'logRequestEventEnd') {
      runEventCounts[run_name][pass].request_end_failures++;
    } else if (data['messageType'] === 'logProgrammaticCookieSetEvent') {
      runEventCounts[run_name][pass].cookie_set_failures++;
    }
  }
}

// On close, immediately reopen unless there was an error, in which case wait a sec first.
function ws_onclose(event) {
  window.clearInterval(sendLoop);
  sendLoop = null;
  if (websocketError) {
    window.setTimeout(initializeWebsocket, 1000);
    websocketError = false;
  } else {
    initializeWebsocket();
  }

}

var websocketError = false;
function ws_onerror(event) {
  websocketError = true;
}

function configureRun(runDetails) {
  run_name = runDetails['run_name'];
  logging_server = runDetails['logging_server'];
  initializeWebsocket();

  if (run_name != null) {
    runEventCounts[run_name] = [];
    // First pass.
    runEventCounts[run_name][1] = { 'request_starts': 0,
                                    'request_ends': 0,
                                    'request_start_failures': 0,
                                    'request_end_failures': 0,
                                    'api': 0,
                                    'api_failures': 0,
                                    'cookie_sets': 0,
                                    'cookie_set_failures': 0 };
    // Second pass.
    runEventCounts[run_name][2] = { 'request_starts': 0,
                                    'request_ends': 0,
                                    'request_start_failures': 0,
                                    'request_end_failures': 0,
                                    'api': 0,
                                    'api_failures': 0,
                                    'cookie_sets': 0,
                                    'cookie_set_failures': 0 };
  }
}

/* ***
   ACTUAL MEASUREMENT FUNCTIONS.
   ***
   */

// Commented out because it's never called. Possibly useful though.
// function checkTrackingForGeolocation(requestDetails, tab) {
//   if(!tab) return false;

//   // If the originating tab is an extension or chrome page, skip it.
//   if (startsWith(tab.url, "chrome"))
//     return false;

//   var topDomain = getHostnameFromUrl(tab.url);
//   var requestDomain = getHostnameFromUrl(requestDetails.url);
//   var httpReferrer = getValueFromDictionaryArray(
//     requestDetails.requestHeaders, "Referer");

//   var candidates = fingerprintCandidates[tab.id];
//   for (var i in candidates) {
//     var candidate = candidates[i];
//     if (isGeolocationFunction(candidate.apiName) &&
//         (candidate.scriptDomain == requestDomain || candidate.frameDomain == requestDomain)) {
//       if (topDomain == requestDomain) {
//         console.log("first party geolocation: " + topDomain);
//         logTracker(topDomain, requestDomain, 'X', tab.id, null, [candidate.apiName]);
//       } else {
//         console.log("third party geolocation: " + topDomain + " on " + requestDomain);
//         logTracker(topDomain, requestDomain, 'Y', tab.id, null, [candidate.apiName]);
//       }
//     }
//   }
// }

function isGeolocationFunction(apiName) {
  return apiName == 'navigator.geolocation.getCurrentPosition' ||
    apiName == 'navigator.geolocation.watchPosition' ;

}

// Does our heuristic count this as a fingerprinter?
function countAsFingerprinter(apiSet, apiList) {
  if (apiList.length == 0) {
    return false;
  }

  if (apiList.length > 2) {
    return true;
  }
  else if (apiSet["navigator.plugins"] || apiSet["navigator.mimeTypes"]) {
    return true;
  }
  return false;
}

function hasScheme(url) {
  var hasSchemeRE = new RegExp('^\\w+://');
  return hasSchemeRE.test(url);
}

/* ***
   HELPER FUNCTIONS.
   ***
   */

// Get the entire hostname portion of the URL, which is everything that's not
// the scheme, port or path. This includes all subdomains, which is fine, since
// we can ignore or not ignore them as desired in analysis.
function getHostnameFromUrl(fullUrl) {
  // If there's no scheme, we need to prepend a scheme, since relative URLs will
  // be interpreted as relative to the current page. We'll prepend http://, since
  // it doesn't really matter what it is.
  if (!hasScheme(fullUrl)) {
    fullUrl = 'http://' + fullUrl;
  }
  return (new URL(fullUrl)).hostname;
}
  // Leaving this code here as reference for things that the old code used to
  // think about with regard to which subdomains should be counted separately.

  // // Because googleusercontent and amazonaws domains are used to host websites that
  // // are actually separate, we don't want to conflate all URLs on these domains.
  // if (split[split.length-2] == "googleusercontent" || split[split.length-2] == "amazonaws") {
  //   return fullUrl;
  // }

  // // Hacky custom handling for 3-part domains.
  // var domain = split[split.length-2] + '.' + split[split.length-1];
  // if (split[split.length-2] == "co" || split[split.length-2] == "com" || split[split.length-2] == "ne") {
  //   domain = split[split.length-3] + '.' + split[split.length-2] + '.' + split[split.length-1];
  // }
  // if (split[split.length-2] == "go" && split.length > 2) {
  //   // Don't conflate espn.go.com and abcnews.go.com
  //   domain = split[split.length-3] + '.' + split[split.length-2] + '.' + split[split.length-1];
  // }
  // return domain;
// }

function getValueFromDictionaryArray(array, key) {
  if (key === undefined) {
    return null;
  }
  for (var i = 0; i < array.length; i += 1) {
    var item = array[i];

    if (item.name === key)
      return item.value;
  }

  return null; // key not found in array
}

/* ***
   Closing popup windows.
   ***
*/
function windowRemove(window) {
  if (window.WindowType == 'popup') {
    setTimeout(function () {
      chrome.windows.remove(window.id);
    }, 300*1000); /* 5 minutes */
  }
}


/* ***
   PERSISTENT STORAGE FUNCTIONS.
   ***
   */

// Save to local storage
function saveSites() {
  chrome.storage.local.set({"sites": JSON.stringify(sites)}, function() { /*console.log("sites saved");*/ } );
  chrome.storage.local.set({"registered": JSON.stringify(registeredAddons)}, function() {} );
}

function clearData(sendResponse) {
  sites = {};
  runEventCounts = {};
  //registeredAddons = {};
  saveSites(); // Don't wait for browser to close to save this
  clearCookies().then(sendResponse);
}

function clearCookies() {
  var deferred = Q.defer();
  if (!chrome.cookies) {
    chrome.cookies = chrome.experimental.cookies;
  }

  var cookiesProcessed = 0;
  var cookiesToProcess;

  var removeCookie = function (cookie) {
    var url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path;
    chrome.cookies.remove({"url": url, "name": cookie.name},
                          function(details) {
                            cookiesProcessed++;
                            if (cookiesProcessed === cookiesToProcess) {
                              deferred.resolve({'status': 'ok'});
                            }
                            if (details !== null) {
                              console.log('Removed cookie.');
                            } else {
                              console.error('Failed to remove cookie.');
                            }
                          });
  };

  chrome.cookies.getAll({}, function (all_cookies) {
    var count = all_cookies.length;
    if (count === 0) {
      console.log('Clearing 0 cookies.');
      deferred.resolve({'status': 'ok'});
    }
    cookiesToProcess = count;
    for (var i = 0; i < count; i++) {
      removeCookie(all_cookies[i]);
    }
  });

  return deferred.promise;
};



/* ***
   API FUNCTIONS.
   For use by Graph, RawData, and other apps.
   ***
   */

// Functions to browse automatically
// urls: list of URLs to visit
// loadTime: how long to wait before loading the next page
// linkNum: number of links on each page in the url list to visit
function browseAutomatically(urls, loadTime, linkNum, sendResponse) {
  if (!urls) {
    sendResponse("Must provide URL file.");
    return;
  }

  // chrome.tabs.create({active: false, selected: false, url: "about:blank"}, function(tab) {
  setTimeout(function() {
    browseToNext(urls, urls.length, 0, loadTime, linkNum, null, sendResponse);
  }, 1000);
  // });
}

// Helper function called recursively during automated measurement
function browseToNext(urls, originalListLength, index, loadTime, linkNum, tabId, sendResponse) {
  // Select linkNum random links on the previously loaded page to add to the URL list
  // (as long as we're still considering URLs on the original list)
  if (index > 0 && index <= originalListLength && linkNum > 0) {
    // Need to ask the content script to do find URLs
    chrome.tabs.sendRequest(tabId, {type: "getlinks", linkNum: linkNum}, function (response) {
      if(response) {
        urls = urls.concat(response.urls);
      }
      setUpBrowseToNext(urls, originalListLength, index, loadTime, linkNum, tabId, sendResponse);
    });
  } else {
    setUpBrowseToNext(urls, originalListLength, index, loadTime, linkNum, tabId, sendResponse);
  }

}

function eventFailuresSoFarThisRunAndPass() {
  return runEventCounts[run_name][pass].request_start_failures +
         runEventCounts[run_name][pass].request_end_failures +
         runEventCounts[run_name][pass].cookie_set_failures;
}

function setUpBrowseToNext(urls, originalListLength, index, loadTime, linkNum, tabId, sendResponse) {
  if (index >= urls.length || !urls[index]) {
    chrome.tabs.remove(tabId);
    sendResponse("");
    return;
  }

  // Remove the last tab
  if (tabId) {
    chrome.tabs.remove(tabId);
  }

  sendConsoleLogToServer(`Browsing to ${index}/${originalListLength} (pass ${pass})`);

  // Navigate to the next URL in the list (in a new tab)
  var newurl = urls[index];
  if (!newurl.startsWith("http")) {
    newurl = "http://" + urls[index];
  }
  console.log('Browsing to next URL: ' + newurl +
              '. Event send failures so far this run and pass: ' +
              eventFailuresSoFarThisRunAndPass() +
              '. Queue length: ' +
              eventQueue.length);
  chrome.tabs.create({ active: false,
                       selected:false,
                       url: newurl }, function(tab) {
                         if (tabIDToInputSiteMapping[tab.id]) {
                           console.log('Danger! TabID ' + tab.id + ' already in mapping');
                         } else {
                           tabIDToInputSiteMapping[tab.id] = newurl;
                           console.log('Mapping ' + tab.id + ' to ' + newurl);
                         }
                         // Let it load for the specified number of seconds before continuing
                         setTimeout(function() {
                           browseToNext(urls,
                                        originalListLength,
                                        index+1,
                                        loadTime,
                                        linkNum,
                                        tab.id,
                                        sendResponse);
                         }, loadTime * 1000);
                       });
}
