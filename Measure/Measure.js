var to_id = "obheeflpdipmaefcoefhimnaihmhpkao";
var buttonDisabledAtRunStart = false;
var loggingServerWebsocket = null;
var serverDOM = null;
var eventQueue = [];
var logging_server = null;

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('files').addEventListener('change', handleFileSelect, false);
  document.getElementById('run').addEventListener('click', runMeasurement, false);

  serverDOM = $('#loggingServer');

  logging_server = $('#loggingServer').val();
  $('#loggingServer').on('input', function() {
    logging_server = $('#loggingServer').val();
    if (loggingServerWebsocket !== null) {
      loggingServerWebsocket.close();
    }
  });

  numChunks = $('#numberOfTabs').val();
  $('#numberOfTabs').on('input', function() {
    numChunks = $('#numberOfTabs').val();
  });

  repeatRuns = $('#sequential').val();
  $('#sequential').on('input', function() {
    repeatRuns = $('#sequential').val();
  });
  
  notes = $('#notes').val();
  $('#notes').on('input', function() {
    notes = $('#notes').val();
    console.log(notes);
  });

  initializeWebsocket();
});

chrome.tabs.onRemoved.addListener(function(tabid, removeInfo) {
  if (urls != null) {
    tabsClosed++;
    document.getElementById('tabsClosed').innerHTML = tabsClosed + '/' + (urls.length*2);
  }
});

function initializeWebsocket() {
  try { 
    loggingServerWebsocket = new WebSocket(logging_server); 
    loggingServerWebsocket.onclose = ws_onclose;
    loggingServerWebsocket.onerror = ws_onerror;
    loggingServerWebsocket.onmessage = ws_onmessage;
    loggingServerWebsocket.onopen = ws_onopen;
  } catch (e) {
    console.error('Exception initializing websocket:' + e);
    ws_onerror();
    ws_onclose();
  }
}

var aliveLoop = null;
function ws_onopen(event) {
  console.log('[websocket] Successfully opened a websocket to ' + logging_server);
  loggingServerWebsocket.send(JSON.stringify({'messageType': 'alive'}));
  aliveLoop = window.setInterval(function() {
    loggingServerWebsocket.send(JSON.stringify({'messageType': 'alive'}));
  }, 2000);
}

function ws_onmessage(event) {
  var data = JSON.parse(event.data);
  if (data['messageType'] === 'alive') {
    if (data['status'] === 'ok') {
      serverDOM.addClass('available');
      serverDOM.removeClass('down');
      if (!buttonDisabledAtRunStart) {
        $('#run').prop('disabled', false);
      }
    } else {
      console.log('Alive Down');
      serverDOM.addClass('down');
      serverDOM.removeClass('available');
      if (!buttonDisabledAtRunStart) {
        $('#run').prop('disabled', true);
      }
    }
  } else if (data['messageType'] === 'logRunEnd') {
      if (data['status'] === 'ok') {
        console.log('[finalizeRunInfoAtServer] Logged run end to server: ' + run);
        displaySuccess('[finalizeRunInfoAtServer] Logged run end to server.');
        finalizeRunInfoAtServerDeferred.resolve();
        check('#finalizeRunInfoAtServer');
      } else {
        console.log('[finalizeRunInfoAtServer] Failed to log run end to server.');
        displayError('[finalizeRunInfoAtServer] Failed to log run end to server.');

        finalizeRunInfoAtServerDeferred.reject(data);
        bang('#finalizeRunInfoAtServer');
      }
  } else if (data['messageType'] === 'logRunStart') {
      if (data['status'] === 'ok') {
        console.log('[sendRunStartToServer] Logged run start to server: ' + run);
        displaySuccess('[sendRunStartToServer] Logged run start to server.');
        sendRunStartToServerDeferred.resolve();
        check('#sendRunStartToServer');
      } else {
        console.log('[sendRunStartToServer] Failed to log run to server.');
        console.log(data);
        displayError('[sendRunStartToServer] Failed to log run to server.');
        sendRunStartToServerDeferred.reject(data);
        bang('#finalizeRunInfoAtServer');
      }
  }
}

// On close, immediately reopen unless there was an error, in which case wait a sec first.
function ws_onclose(event) {
  window.clearInterval(aliveLoop);
  aliveLoop = null;
  if (websocketError) {
    window.setTimeout(initializeWebsocket, 1000);
    websocketError = false;
  } else {
    initializeWebsocket();
  }

}

var websocketError = false;
function ws_onerror(event) {
  serverDOM.addClass('down');
  serverDOM.removeClass('available');
  if (!buttonDisabledAtRunStart) {
    $('#run').prop('disabled', true);
  }
  websocketError = true;
}

var tabsClosed = 0;
var urls;
var urlChunks;
var numChunks = 1;  
var loadSeconds = 10;
var visitLinks = 0;
var MAX_TABS = 25;
var run_name = null;
var notes = '';
var platformVersion = "";
var platformStats = null;
var repeatRuns = 0;
var currRepeat = 0;
var waybackMode, waybackTime;
var waybackURLs = [];
var sitesNotInWayback = [];

function handleFileSelect(evt) {
  // clear possible messages
  displayError(""); 
  displaySuccess("");
  
  var files = evt.target.files;
  var f = files[0];
  
  if (!f) return;

  // Only process text files.
  if (!f.type.match('text.*')) {
    displayError("Not a text file.");
    return;
  }
  
  var reader = new FileReader();
  
  // Closure to capture the file information.
  reader.onload = (function(theFile) {
    return function(e) {    
      urls = parseFile(e.target.result);    
      displaySuccess('Opened URLs file with ' + urls.length + ' lines.');
    };
  })(f);
  
  reader.readAsText(f);
}

function displayError(str) {
  document.getElementById("error").innerHTML = str;
}

function displaySuccess(str) {
  document.getElementById("success").innerHTML = str;
}

function parseFile(str) {
  var urls = str.split('\n'); 
  urls = urls.filter(function(s) { return s !== ''; });
  return urls;
}

function chunkURLs(urls, numChunks) {
  if (urls === undefined) {
    displayError('Must choose a URLs file.');
    return null;
  }
  if (urls.length <= 0) {
    urlChunks = [];
    return [];
  }
  
  if (numChunks > urls.length) {
    numChunks = urls.length;
  }

  // Divide the URLs into k pieces for k tabs.
  var urlChunks = [];
  for (var i=0; i < numChunks; i++) {
    urlChunks.push([]);
  }
  for (i=0; i < urls.length; i++) {
    urlChunks[i % urlChunks.length].push(urls[i]);
  }
  console.log('[urlChunks]: ');
  console.log(urlChunks);
  return urlChunks;
}

/* Search for the URL minpast from global wayback time */
function searchTimemap(timemap) {
  var TIMESTAMP_INDEX = timemap[0].indexOf('timestamp');
  var bestTimestamp = -1;
  for (var i = 1; i < timemap.length; i++) {
    var currTimestamp = timemap[i][TIMESTAMP_INDEX];
    if (currTimestamp <= waybackTime) {
      bestTimestamp = currTimestamp;
    }
    else {
      break;
    }
  }
  return bestTimestamp;
}

function waybackGet(theUrl, i)
{
  var deferred = Q.defer();

  //console.log(theUrl);
  window.setTimeout(function() {
    $.ajax({url: theUrl,
            error: function(jqXHR, textStatus, errorThrown) {
              if (jqXHR.status != 403) {
                console.warn(jqXHR);
                console.warn(textStatus);
                console.warn(errorThrown);
                deferred.reject("HTTP Code " + jqXHR.status);
              }
              else {
                console.log("Archival blocked for " + theUrl + " status: " + jqXHR.status);
                deferred.resolve(null);
              }
            }, 
            success: function(resp) {
              if (resp.length < 2) {
                console.log("No archive in window for " + theUrl);
                var urlIndex = 'https://web.archive.org/web/timemap/json/yearmodahrmise/'.length;
                var timemapForAllTime = 
		      'https://web.archive.org/web/timemap/json/'
                      + theUrl.substring(urlIndex);
                console.log("Calling GET on " + timemapForAllTime);
		$.ajax({url: timemapForAllTime,
			error: function(jqXHR, textStatus, errorThrown) {
                          if (jqXHR.status != 403) {
                            console.warn(jqXHR);
                            console.warn(textStatus);
                            console.warn(errorThrown);
                            deferred.reject("HTTP Code " + jqXHR.status);
                          }
                          else {
                            console.log("Archival blocked for " + theUrl + " status: " + jqXHR.status);
                            deferred.resolve(null);
                          }
                        },
			success: function(resp2) {
                          console.log("Full timemap rec'vd for" 
				      + timemapForAllTime);
                          if (resp2.length < 2) {
                            deferred.resolve(null);
                          }
                          else {
                            var bestTimestamp = searchTimemap(resp2);
                            if (bestTimestamp == -1) {
                            /*not archived until the future */
                              deferred.resolve(null);
                            }
                            else {
                              deferred.resolve('http://web.archive.org/web/'
					       +bestTimestamp+'/');
                            }
                          }
			},
			dataType: 'json'
                       });
		return deferred.promise;
              }
	      else {
		var bestTimestamp = searchTimemap(resp);
		if (bestTimestamp == -1) {
                  console.log("No archive in window for " + theUrl);
                  var urlIndex = 'https://web.archive.org/web/timemap/json/yearmodahrmise/'.length;
                  var timemapForAllTime = 
		    'https://web.archive.org/web/timemap/json/'
                    + theUrl.substring(urlIndex);
                  console.log("Calling GET on " + timemapForAllTime);
		  $.ajax({url: timemapForAllTime,
			  error: function(jqXHR, textStatus, errorThrown) {
                            if (jqXHR.status != 403) {
                              console.warn(jqXHR);
                              console.warn(textStatus);
                              console.warn(errorThrown);
                              deferred.reject("HTTP Code " + jqXHR.status);
                            }
                            else {
                              console.log("Archival blocked for " + theUrl + " status: " + jqXHR.status);
                              deferred.resolve(null);
                            }
                          },
		          success: function(resp2) {
                            console.log("Full timemap rec'vd for" 
				        + timemapForAllTime);
                            if (resp2.length < 2) {
                              deferred.resolve(null);
                            }
                            else {
                              var bestTimestamp = searchTimemap(resp2);
                              if (bestTimestamp == -1) {
                                /*not archived until the future */
                                deferred.resolve(null);
                              }
                              else {
                                deferred.resolve('http://web.archive.org/web/'
					         +bestTimestamp+'/');
                              }
                            }
			  },
			  dataType: 'json'
                         });
		  return deferred.promise;
		}
		else {
                // resolver will add on the url
                  deferred.resolve('http://web.archive.org/web/'
				   +bestTimestamp+'/');
		}
              }
            },
            dataType: "json"});}, 100*i);
  return deferred.promise;
}

function modifyAndChunkURLs() {
  var deferred = Q.defer();
  spin('#modifyAndChunkURLs');
  displaySuccess('[modifyAndChunkURLs] Starting modify and chunk URLs...');
  console.log('[modifyAndChunkURLs] Starting modify and chunk URLs...');
 
  if (waybackMode) {
    waybackURLs = [];
    sitesNotInWayback = [];
    var returnedURLs = [];

    // subtract window from waybackTime - 1 month backwards
    // timestamp 1-indexes month, but Dates 0-index them
    var month = parseInt(waybackTime.substring(4,6)) - 1;
    var d = new Date(parseInt(waybackTime.substring(0,4)), month);
    d.setMonth(d.getMonth() - 1);
    var newMonthString = "0" + (d.getMonth()+1);
    newMonthString = newMonthString.slice(-2);
    var urlSuffix = "" + d.getFullYear() + newMonthString + waybackTime.substring(6) + "/";
    
    for (var i=0; i < urls.length; i++) {
	var theUrl = "https://web.archive.org/web/timemap/json/" + urlSuffix + urls[i];
	returnedURLs[i] = waybackGet(theUrl, i);
    }
    Promise.all(returnedURLs).then(function(urlList) {
      for (var i=0; i < urlList.length; i++) {
        if (urlList[i] == null) {
          sitesNotInWayback.push(urls[i]);
        }
        else {
          // has the wayback prefix and timestamp but need to add the actual URL
          waybackURLs.push(urlList[i]+urls[i]);
        }
      }
      urlChunks = chunkURLs(waybackURLs, numChunks);
      check('#modifyAndChunkURLs');
      if (urlChunks == null) {
        deferred.reject('No URLs to measure');
      }
      deferred.resolve();
    }).catch(reason => {
      displayError('Error, hopefully transient in acquiring WB urls');
      bang('#modifyAndChunkURLs');
      console.error("Unexpected wayback error, aborting, reason: ");
      console.error(reason);
      deferred.reject();
    });
  }
  else {
    urlChunks = chunkURLs(urls, numChunks);
    check('#modifyAndChunkURLs');
      if (urlChunks == null) {
        deferred.reject('No URLs to measure');
      }
    deferred.resolve();
  }
  return deferred.promise;
}

function clearData() {
  var deferred = Q.defer();
  spin('#clearData');
  console.log('[clearData] Starting clearing data...');
  chrome.runtime.sendMessage(
    to_id,
    { type : 'clearData' },
    function() { 
      console.log('[clearData] Finished clearing data in platform.');
      deferred.resolve(); 
      check('#clearData');
    }
  );
  return deferred.promise;
};

function configureRun() { 
  var deferred = Q.defer();
  spin('#configureRun');
  console.log('[configureRun] Starting configuring run...');
  chrome.runtime.sendMessage(
    to_id,
    { type : 'configureRun', 
      run_name: run_name, 
      logging_server: logging_server  },
      function() { 
        console.log('[configureRun] Finished configuring run in platform.');
        deferred.resolve();
        check('#configureRun');
      }
  );
  $('#runName').text(run_name);
  return deferred.promise;
};

function setFirstPassInPlatform() {
  return setPass(1);
}
function setSecondPassInPlatform() {
  return setPass(2);
}
function setPass(pass) { 
  return function() { 
    var deferred = Q.defer();
    if (pass === 1) {
      spin('#setFirstPassInPlatform');
    } else if (pass === 2) {
      spin('#setSecondPassInPlatform');
    }
    chrome.runtime.sendMessage(
      to_id,
      { type : 'setPass', 
        pass: pass } ,
        function() { 
          console.log('[setPass] Finished setting pass to ' + pass);
          deferred.resolve();
          if (pass === 1) {
            check('#setFirstPassInPlatform');
          } else if (pass === 2) {
            check('#setSecondPassInPlatform');
          }
        }
    );
    return deferred.promise;
  }();
};

function clearPlatformRunName() { 
  var deferred = Q.defer();
  spin('#clearPlatformRunName');
  chrome.runtime.sendMessage(
    to_id,
    { type : 'configureRun', 
      run_name: null,
      logging_server: logging_server  },
      function() { 
        console.log('[clearPlatformRunName] Finished clearing run name in platform.');
        deferred.resolve();
        check('#clearPlatformRunName');
      }
  );
  return deferred.promise;
};

function getStatsFromPlatform() {
  var deferred = Q.defer();
  spin('#getStatsFromPlatform');
  chrome.runtime.sendMessage(
    to_id,
    { type : 'getStats' },
    function(stats) { 
      platformStats = stats;
      console.log('[getStatsFromPlatform] Got stats: ');
      console.log(stats);
      deferred.resolve();
      check('#getStatsFromPlatform');
    }
  );
  return deferred.promise;
}

var finalizeRunInfoAtServerDeferred = null;
function finalizeRunInfoAtServer() { 
  var deferred = Q.defer();
  spin('#finalizeRunInfoAtServer');
  finalizeRunInfoAtServerDeferred = deferred;
  var run = {
    run_name: run_name,
    end_time: new Date().toLocaleString(),
    platform_event_counts: {'pass1': platformStats[run_name][1],
                            'pass2': platformStats[run_name][2]}
  };
  var message = {'content': run, 'messageType': 'logRunEnd'};

  if (loggingServerWebsocket.readyState === loggingServerWebsocket.OPEN) {
    loggingServerWebsocket.send(JSON.stringify(message));
  } else {
    console.error('Cannot send logRunEnd to server -- websocket not open.');
    displayError('Cannot send logRunEnd to server -- websocket not open.');
  }

  return deferred.promise;
};

var sendRunStartToServerDeferred = null;
function sendRunStartToServer() { 
  var deferred = Q.defer();
  spin('#sendRunStartToServer');
  sendRunStartToServerDeferred = deferred;
  var run = {
    run_name: run_name,
    hostname: null,  //???
    notes: notes,
    input: urls,
    input_length: urls.length,
    mode: waybackMode ? "Wayback" : "Normal",
    parallelism: urlChunks.length,
    links_to_visit_per_page: parseInt(visitLinks),
    seconds_to_remain_on_page: parseInt(loadSeconds),
    platform_version: platformVersion,
    measure_addon_version: chrome.runtime.getManifest().version,
    start_time: new Date().toLocaleString(),
    end_time: null,
    wayback_time: waybackTime,
    sites_not_in_wayback: sitesNotInWayback,
    wayback_urls_of_input: waybackURLs
  };
  var message = {'content': run, 'messageType': 'logRunStart'};
  if (loggingServerWebsocket.readyState === loggingServerWebsocket.OPEN) {
    loggingServerWebsocket.send(JSON.stringify(message));
  } else {
    console.error('Cannot send logRunStart to server -- websocket not open.');
    displayError('Cannot send logRunStart to server -- websocket not open.');
  }

  return deferred.promise;
};

function setOptions() {
  var deferred = Q.defer();
  spin('#setOptions');
  console.log('[setOptions] Start...');

 // Zero out a bunch of globals.
  startTime = new Date();
  startTimeSeconds = startTime.getTime() / 1000;
  firstHalfChunksCompleted = 0;
  secondHalfChunksCompleted = 0;
  tabsClosed = 0;
  platformStats = null;

  run_name = 'run:' + new Date().toLocaleString();
  console.log("Starting run" + run_name);
  
  var sec = document.getElementById('seconds').value;
  if (sec && sec > 0) {
    loadSeconds = sec;
  }
  
  var links = document.getElementById('links').value;
  if (links && links > 0) {
    visitLinks = links;
  }

  numChunks = document.getElementById('numberOfTabs').value;
  if (!numChunks || numChunks <= 0) {
    displayError("Need to specify a valid number of tabs. Setting to 1.");
    numChunks = 1;
  } else if (numChunks > MAX_TABS) {
    displayError("Too many tabs requested. Setting to " + MAX_TABS);
    numChunks = MAX_TABS;
  }

  chrome.runtime.sendMessage(
    to_id,
    { type: 'setWaybackMode',
      waybackMode: waybackMode },
    function() {
      deferred.resolve();
      console.log('[setOptions] Done...');
      check('#setOptions');
    }
  );

  return deferred.promise;
}

// Responsible for sending the end time
var POST_DELAY = 30000;
function completeMeasurement() {
  var deferred = Q.defer();
  spin('#completeMeasurement');
  console.log('[completeMeasurement] Start...');
  endTime = new Date();
  var endTimeSeconds = endTime.getTime() / 1000;
  var duration = Math.ceil(endTimeSeconds - startTimeSeconds);
  displaySuccess("Finished automated measurement in " + 
                 duration + " seconds with " + 
                 firstHalfChunksCompleted + 
                 " tabs for the first half and " +
                 secondHalfChunksCompleted +
                 " tabs for the second half completing." +
                 "Waiting " + POST_DELAY + " milliseconds for straggling requests...");

  console.log('[completeMeasurement] Done. Waiting ' + POST_DELAY + ' milliseconds before proceeding.');

  window.setTimeout(function() {
    console.log('Done waiting for requests to finish before clearing run name.');
    deferred.resolve();
    check('#completeMeasurement');
  }, POST_DELAY);

  return deferred.promise;
}

function getPlatformVersion() {
  var deferred = Q.defer();
  spin('#getPlatformVersion');
  chrome.runtime.sendMessage(
    to_id,                              
    { type : 'getPlatformVersion' },
    function(version) {
      platformVersion = version;
      deferred.resolve();
      check('#getPlatformVersion');
    }
  );
  return deferred.promise;
}

function runFirstHalf() {
    var deferred = Q.defer();
    console.log('[runFirstHalf] Start...');
    spin('#runFirstHalf');

    var firstHalfStarted = 0;
    urlChunks.forEach(function(chunk) {
    // for (var i=0; i<urlChunks.length; i++) {
      // Use setTimeout to cascade the opening of windows one per second.
      firstHalfStarted++;
      window.setTimeout(function() { 
        chrome.runtime.sendMessage(
            to_id,                              // Extension ID of TO
            { type : 'browseAutomatically',     // Parameters
              urls : chunk, 
              loadtime : loadSeconds,
              visits : visitLinks },
            function(errorString) {             // Callback
                if (errorString) {
                    displayError(errorString);
                } else {
                  firstHalfChunksCompleted++;
                  var endTimeSeconds = new Date().getTime() / 1000;
                  var duration = Math.ceil(endTimeSeconds - startTimeSeconds);
                  displaySuccess(firstHalfChunksCompleted + 
                                 " automated measurements completed first half in " +
                                 + duration + " seconds.");
                  if (firstHalfChunksCompleted === urlChunks.length) {
                    console.log('[runFirstHalf] Done.');
                    deferred.resolve();
                    check('#runFirstHalf');
                  }
                }
            }
        );
      }, firstHalfStarted * 1000);
    });
    return deferred.promise;
}
function runSecondHalf() {
    var deferred = Q.defer();
    console.log('[runSecondHalf] Start...');
    spin('#runSecondHalf');

    var secondHalfStarted = 0;
    urlChunks.forEach(function(chunk) {
    // for (var i=0; i<urlChunks.length; i++) {
      // Use setTimeout to cascade the opening of windows one per second.
      secondHalfStarted++;
      window.setTimeout(function() { 
        chrome.runtime.sendMessage(
            to_id,                              // Extension ID of TO
            { type : 'browseAutomatically',     // Parameters
              urls : chunk, 
              loadtime : loadSeconds,
              visits : visitLinks },
            function(errorString) {             // Callback
                if (errorString) {
                    displayError(errorString);
                } else {
                  secondHalfChunksCompleted++;
                  displaySuccess(secondHalfChunksCompleted + " Automated measurements completed second half!");
                }
                if (secondHalfChunksCompleted === urlChunks.length) {
                  console.log('[runSecondHalf] Done.');
                  deferred.resolve();
                  check('#runSecondHalf');
                }
            }
        );
      }, secondHalfStarted * 1000);
    });
    
    return deferred.promise;
}

function checkMoreRepeats() {
  if (currRepeat < repeatRuns) {
    currRepeat++;
    console.log("Run " + currRepeat + " will begin shortly.");
    window.setTimeout(function() {
      runMeasurement();      
    }, 60000);
  }
  else {
    currRepeat = 0;
    console.log("Runs complete.");
  }
}


function closeBrowser() {
  chrome.tabs.getCurrent(function(tab) {
    chrome.tabs.remove(tab.id, function() { });
  });
}

var firstHalfChunksCompleted = 0;
var secondHalfChunksCompleted = 0;
var startTime, endTime;
var startTimeSeconds;
function runMeasurement() {
      
  $('.progressIcon').removeClass('fa-check');
  $('.progressIcon').removeClass('fa-exclamation');
  $('.progressIcon').removeClass('fa-spin');
  $('.progressIcon').addClass('fa-cog');
  
  buttonDisabledAtRunStart = true;
  $('#run').prop('disabled', true);
  window.setTimeout(function() {
    buttonDisabledAtRunStart = false;
    $('#run').prop('disabled', false);
  }, 3000);

  waybackMode = document.getElementById('waybackMode').checked;
  var waytime = document.getElementById('waybackTime').value;
  if (waytime && waytime > 0 && waytime.length >= 4) {
    //waybackTime = waytime;
    /* convert times to full wayback timestamps */
    var year = waytime.substring(0, 4);
    var month = waytime.length >= 6 ? waytime.substring(4, 6) : "00";
    var date = waytime.length >= 8 ? waytime.substring(6, 8) : "01";
    var hour = waytime.length >= 10 ? waytime.substring(8, 10) : "00";
    var min = waytime.length >= 12 ? waytime.substring(10, 12) : "00";
    var sec = waytime.length >= 14 ? waytime.substring(12, 14) : "00";
    waybackTime = year+month+date+hour+min+sec;
  }
  else {
    /* in the future this should mean the urls file has wayback times embedded */
    waybackMode = false;
  }
  

  // Let's do this.
  modifyAndChunkURLs()
    .then(setOptions)
    .then(clearData)
    .then(configureRun)
    .then(getPlatformVersion)
    .then(sendRunStartToServer)
    .then(setFirstPassInPlatform)
    .then(runFirstHalf)
    .then(setSecondPassInPlatform)
    .then(runSecondHalf)
    .then(completeMeasurement)
    .then(getStatsFromPlatform)
    .then(finalizeRunInfoAtServer)
    .then(clearPlatformRunName)
    .then(checkMoreRepeats) 
    .then(closeBrowser)
    .catch(function(err) {
      console.log('Failure running measurement with error');
      console.log(err);
    });
   
}

function check(id) {
  var icon = $(id);
  icon.removeClass('fa-spin');
  icon.removeClass('fa-cog');
  icon.addClass('fa-check');
  icon.css('color', 'light-green');
}

function cog(id) {
  var icon = $(id);
  icon.removeClass('fa-spin');
  icon.removeClass('fa-check');
  icon.addClass('fa-cog');
}

function spin(id) {
  var icon = $(id);
  icon.addClass('fa-spin');
}

function bang(id) {
  var icon = $(id);
  icon.addClass('fa-exclamation');
  icon.removeClass('fa-cog');
  icon.removeClass('fa-spin');
  icon.removeClass('fa-check');
}
