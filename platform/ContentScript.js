"use strict";

/*
 * This content script does two things:
 * (1) finds links on a page for the automated browsing/measurement functionality
 * (2) hooks the document.cookie setter and raises an event on programmatic
 * cookie sets for the sake of the platform knowing when cookies are set by scripts.
 */



// Listen for any update messages from the background script.
chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse){
        // Request for linkNum links in this document
        if(request.type === "getlinks") {
            var links = document.links;
            var urls = [];
            if (links.length > 0) {
                var tried_links = [];
                var num_tried = 0;
                for (var x = 0; x < links.length; x++) {
                    tried_links[x] = false;
                }
                for (var x = 0; x < request.linkNum; x++) {
                    var i = Math.floor(Math.random()*links.length);
                    while (tried_links[i]) {
                        i = Math.floor(Math.random()*links.length);
                    }
                    tried_links[i] = true;

                    var link = links[i];
                    if (!badLink(link, true)) {
                        urls.push(link.href);
                    } else {
                        x--; // This was a bad one
                    }

                    num_tried++;
                    if (num_tried == links.length) {
                        break;
                    }
                }
            }
            sendResponse({urls: urls});
        }
    }
);

let waybackRegex = new RegExp('^https?://web.archive.org/web/\\d+[^/]*/(.*)', 'i')
// let waybackPathRegex = new RegExp('^/web/(?P<archiveDate>\\d+)[^/]*/(?P<archivedUrl>.*)', 'i')
//
function getArchivedURLFromWaybackURL(waybackURL) {
  return new URL(waybackRegex.exec(waybackURL)[1]);
}

// Helper function for link finding
// Returns true if link is to a non-web document time
function badLink(linkelem, stayOnDomain) {
    var link = linkelem.href;

    if (stayOnDomain) {
      let currentHostname = psl.parse(getArchivedURLFromWaybackURL(document.URL).hostname);
      let destinationHostname = psl.parse(getArchivedURLFromWaybackURL(link).hostname);

      if (currentHostname.domain !== destinationHostname.domain) {
        consoleLog(`dest: ${destinationHostname.domain} | src: ${currentHostname.domain} | is bad`);
        return true;
      } else {
        consoleLog(`dest: ${destinationHostname.domain} | src: ${currentHostname.domain} |not bad`);
      }
    }
    if (link.indexOf(".pdf") != -1
        || link.indexOf(".exe") != -1
        || link.indexOf(".doc") != -1
        || link.indexOf(".ppt") != -1
        || link.indexOf(".pptx") != -1
        || link.indexOf(".docx") != -1
        || link.indexOf(".xls") != -1
        || link.indexOf(".xlsx") != -1) {
        return true;
    }
    return false;
}

// Inspects the call stack, and notifies the background script of a possible category A tracking situation.
function inspectStackA() {
  var callstack = [];
  var uri_pattern = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?������]))/ig;

  var isCallstackPopulated = false;
  try {
    i.dont.exist += 0; // Will cause exception
  } catch(e) {
      var urls = e.stack.match(uri_pattern);
      return urls;
  }

}


// Monkeypatch document.cookie
// (a real pain due to the above referenced Chrome bug... need to send updated
// cookies to background script to actually set them in Chrome's cookie store,
// and need to keep current cookies in page to make them accessible via JavaScript)

var monkeypatchCookieCode =
    // Need to inject stack trace into page
    inspectStackA.toString() +

    // Event to notify background script when a cookie is set using document.cookie's setter
    'function createCookieEvent(cookieString, urls) { ' +
        'document.dispatchEvent( new CustomEvent("setCookieEvent", {detail: {cookieString : cookieString, stackTrace : urls}})); }'+

    // Actually overwrite document.cookie
    // On set, create event to notify background script
    'var _cookieSetter = document.__lookupSetter__("cookie");' +
    'var _cookieGetter = document.__lookupGetter__("cookie");' +
    'document.__defineSetter__("cookie", function(cookieString) { createCookieEvent(cookieString, inspectStackA()); _cookieSetter.call(document, cookieString); } );' +
    'document.__defineGetter__("cookie", _cookieGetter);' +

    '';

// THIS CODE RUNS WHEN PAGE LOADS:

// Actually inject the code
var scriptDiv = document.createElement('script');
scriptDiv.appendChild(document.createTextNode(monkeypatchCookieCode));
(document.head || document.documentElement).appendChild(scriptDiv);
scriptDiv.parentNode.removeChild(scriptDiv);

// Event that fires when document.cookie's setter is called.
// Send message to background script to actually set the cookie.
document.addEventListener('setCookieEvent',
    function(e) {
        // console.log('set cookie event!');
        var cookieVal = e.detail.cookieString;
        var stackTraceVal = e.detail.stackTrace;

        var scriptURL = null;
        if (stackTraceVal !== null) {
          scriptURL = stackTraceVal[stackTraceVal.length - 1];
        }
        chrome.extension.sendRequest(
            { type:'programmaticCookieSet',
              url: document.URL,
              stackTrace: stackTraceVal,
              scriptURL: scriptURL,
              cookieString: cookieVal }
        );
    });

window.onload = function() {
  // console.log('Window.onload!');
  var domHTML = document.documentElement.outerHTML;
  chrome.extension.sendRequest({
    type: 'DOMContent',
    url: document.URL,
    dom_html: domHTML
  });
}

setTimeout(function closeAfterAWhile() {
  if (document.URL !== 'chrome-extension://bdhnlcnicobibkfiaopokapjfeapojff/Headless.html') {
    chrome.extension.sendRequest({ type: 'closeTab' });
  }
}, 120 * 1000);

function consoleLog(message) {
  chrome.extension.sendRequest({ 
    consoleMessage: message,
    type: 'consoleLog'
  });
}

consoleLog(psl.parse('one.two.roothost.co.uk'));
