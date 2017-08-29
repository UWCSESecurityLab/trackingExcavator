var loggingServer = {
  websocket:null,
  eventQueue:[],
  error:false
};

var runState = {
  run_name:cfg.run_name,
  tabsClosed:0,
  urlChunks:[],
  platformVersion:'',
  platformStats:null,
  currRepeat:0,
  waybackURLs:[],
  sitesNotInWayback:[],
  firstHalfChunksCompleted:0,
  secondHalfChunksCompleted:0,
  running:false,
};

function initializeWebsocket() {
  try { 
    var websocket = new WebSocket(cfg.loggingServerName); 
    websocket.onclose = ws_onclose;
    websocket.onerror = ws_onerror;
    websocket.onmessage = ws_onmessage;
    websocket.onopen = ws_onopen;
    loggingServer.websocket = websocket;
  } catch (e) {
    console.error('Exception initializing websocket:' + e);
    ws_onerror();
    ws_onclose();
  }
}

var aliveLoop = null;
function ws_onopen(event) {
  console.log('[websocket] Successfully opened a websocket to ' + cfg.loggingServerName);
  loggingServer.websocket.send(JSON.stringify({'messageType': 'alive'}));
  aliveLoop = window.setInterval(function() {
    loggingServer.websocket.send(JSON.stringify({'messageType': 'alive'}));
  }, 2000);
}

function ws_onmessage(event) {
  var data = JSON.parse(event.data);
  if (data['messageType'] === 'alive') {
    if (data['status'] === 'ok') {
      console.log('Alive Up');
    } else {
      console.log('Alive Down');
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
  if (loggingServer.error) {
    window.setTimeout(initializeWebsocket, 1000);
    loggingServer.error = false;
  } else {
    initializeWebsocket();
  }

}

function ws_onerror(event) {
  if (!buttonDisabledAtRunStart) {
    $('#run').prop('disabled', true);
  }
  loggingServer.error = true;
}

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
      cfg.urls = parseFile(e.target.result);    
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
  console.log(urls);
  console.log(numChunks);
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
    if (currTimestamp <= cfg.waybackTime) {
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

  var fullTimeMap = function fullTimeMap(theUrl) {
  var urlIndex = 'https://web.archive.org/web/timemap/json/yearmodahrmise/'.length;
  var timemapForAllTime = 'https://web.archive.org/web/timemap/json/' + theUrl.substring(urlIndex);
  console.log("Calling GET on " + timemapForAllTime);
  $.ajax({url: timemapForAllTime,
	  error: function(err) {
            console.log("Error querying availability for outside window "+ theUrl);
            deferred.resolve(null);
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
                deferred.resolve('http://web.archive.org/web/'+bestTimestamp+'/');
              }
            }
	  },
	  dataType: 'json'
         });
  return deferred.promise;
  };
  
  //console.log(theUrl);
  window.setTimeout(function() {
    $.ajax({url: theUrl,
            error: function(jqXHR, textStatus, errorThrown) {
              if (jqXHR.status != 403) {
                console.warn("Unknown error startus not 403:");
                console.warn(jqXHR);
                console.warn(textStatus);
                console.warn(errorThrown);
                deferred.reject();
              }
	      console.log("Archival blocked for " + theUrl + " status: " + jqXHR.status);
              deferred.resolve(null);
            }, 
            success: function(resp) {
              if (resp.length < 2) {
                console.log("No archive in window for " + theUrl);
                fullTimeMap(theUrl, deferred);
              }
	      else {
		var bestTimestamp = searchTimemap(resp);
		if (bestTimestamp == -1) {
                  console.log("No archive in window for " + theUrl);
                  fullTimeMap(theUrl, deferred);
		}
		else {
                // resolver will add on the url
                  deferred.resolve('http://web.archive.org/web/'+bestTimestamp+'/');
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
 
  if (cfg.waybackMode) {
    cfg.waybackURLs = [];
    runState.sitesNotInWayback = [];
    var returnedURLs = [];

    // subtract window from waybackTime - 1 month backwards
    // timestamp 1-indexes month, but Dates 0-index them
    var month = parseInt(cfg.waybackTime.substring(4,6)) - 1;
    var d = new Date(parseInt(cfg.waybackTime.substring(0,4)), month);
    d.setMonth(d.getMonth() - 1);
    var newMonthString = "0" + (d.getMonth()+1);
    newMonthString = newMonthString.slice(-2);
    var urlSuffix = "" + d.getFullYear() + newMonthString + cfg.waybackTime.substring(6) + "/";
    
    for (var i=0; i < cfg.urls.length; i++) {
      var theUrl = "https://web.archive.org/web/timemap/json/" + urlSuffix + cfg.urls[i];
      returnedURLs[i] = waybackGet(theUrl, i);
    }
    Promise.all(returnedURLs).then(function(urlList) {
      for (var i=0; i < urlList.length; i++) {
        if (urlList[i] == null) {
          runState.sitesNotInWayback.push(cfg.urls[i]);
        }
        else {
          // has the wayback prefix and timestamp but need to add the actual URL
          runState.waybackURLs.push(urlList[i]+cfg.urls[i]);
        }
      }
      runState.urlChunks = chunkURLs(runState.waybackURLs, cfg.numChunks);
      check('#modifyAndChunkURLs');
      if (runState.urlChunks == null) {
        deferred.reject('No URLs to measure');
      }
      deferred.resolve();
    });
  }
  else {
    runState.urlChunks = chunkURLs(cfg.urls, cfg.numChunks);
    check('#modifyAndChunkURLs');
      if (runState.urlChunks == null) {
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
    cfg.toId,
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

  if (cfg.add_date_to_run_name) {
    runState.run_name = cfg.run_name + ':' + new Date().toLocaleString();
  }
    
  startTime = new Date();
  runState.startTimeSeconds = startTime.getTime() / 1000;

  chrome.runtime.sendMessage(
    cfg.toId,
    { type: 'setWaybackMode',
      waybackMode: cfg.waybackMode },
    function() {
      deferred.resolve();
      console.log('[setOptions] Done...');
      check('#setOptions');
    }
  );

  console.log(runState.run_name);
  chrome.runtime.sendMessage(
    cfg.toId,
    { type : 'configureRun', 
      run_name: runState.run_name, 
      logging_server: cfg.loggingServerName  },
      function() { 
        console.log('[configureRun] Finished configuring run in platform.');
        deferred.resolve();
        check('#configureRun');
      }
  );
  return deferred.promise;
};

function setPass(cfg, pass) { 
  return function() { 
    var deferred = Q.defer();
    if (pass === 1) {
      spin('#setFirstPassInPlatform');
    } else if (pass === 2) {
      spin('#setSecondPassInPlatform');
    }
    chrome.runtime.sendMessage(
      cfg.toId,
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
    cfg.toId,
    { type : 'configureRun', 
      run_name: null,
      logging_server: cfg.loggingServerName  },
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
    cfg.toId,
    { type : 'getStats' },
    function(stats) { 
      runState.platformStats = stats;
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
  console.log(runState);
  console.log(runState.platformStats);


  var run = {
    run_name: runState.run_name,
    end_time: new Date().toLocaleString(),
    platform_event_counts: {'pass1': runState.platformStats[runState.run_name][1],
                            'pass2': runState.platformStats[runState.run_name][2]}
  }; 
  var message = {'content': run, 'messageType': 'logRunEnd'};

  if (loggingServer.websocket.readyState === loggingServer.websocket.OPEN) {
    loggingServer.websocket.send(JSON.stringify(message));
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
    run_name: runState.run_name,
    hostname: null,  //???
    notes: cfg.notes,
    input: cfg.urls,
    input_length: cfg.urls.length,
    mode: cfg.waybackMode ? "Wayback" : "Normal",
    parallelism: runState.urlChunks.length,
    links_to_visit_per_page: parseInt(cfg.links),
    seconds_to_remain_on_page: parseInt(cfg.loadtime),
    platform_version: runState.platformVersion,
    measure_addon_version: chrome.runtime.getManifest().version,
    start_time: new Date().toLocaleString(),
    end_time: null,
    wayback_time: cfg.waybackTime,
    sites_not_in_wayback: runState.sitesNotInWayback,
    wayback_urls_of_input: runState.waybackURLs
  };
  var message = {'content': run, 'messageType': 'logRunStart'};
  if (loggingServer.websocket.readyState === loggingServer.websocket.OPEN) {
    console.log(loggingServer);
    loggingServer.websocket.send(JSON.stringify(message));
  } else {
    console.error('Cannot send logRunStart to server -- websocket not open.');
    displayError('Cannot send logRunStart to server -- websocket not open.');
  }

  return deferred.promise;
};

// Responsible for sending the end time
var POST_DELAY = 30000;
function completeMeasurement() {
  var deferred = Q.defer();
  spin('#completeMeasurement');
  console.log('[completeMeasurement] Start...');
  endTime = new Date();
  var endTimeSeconds = endTime.getTime() / 1000;
  var duration = Math.ceil(endTimeSeconds - runState.startTimeSeconds);
  displaySuccess("Finished automated measurement in " + 
                 duration + " seconds with " + 
                 runState.firstHalfChunksCompleted + 
                 " tabs for the first half and " +
                 runState.secondHalfChunksCompleted +
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
    cfg.toId,                              
    { type : 'getPlatformVersion' },
    function(version) {
      runState.platformVersion = version;
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
    runState.urlChunks.forEach(function(chunk) {
    // for (var i=0; i<urlChunks.length; i++) {
      // Use setTimeout to cascade the opening of windows one per second.
      firstHalfStarted++;
      window.setTimeout(function() { 
        chrome.runtime.sendMessage(
            cfg.toId,                              // Extension ID of TO
            { type : 'browseAutomatically',     // Parameters
              urls : chunk, 
              loadtime : cfg.loadtime,
              visits : cfg.links },
            function(errorString) {             // Callback
                if (errorString) {
                    displayError(errorString);
                } else {
                  runState.firstHalfChunksCompleted++;
                  var endTimeSeconds = new Date().getTime() / 1000;
                  var duration = Math.ceil(endTimeSeconds - runState.startTimeSeconds);
                  displaySuccess(runState.firstHalfChunksCompleted + 
                                 " automated measurements completed first half in " +
                                 + duration + " seconds.");
                  if (runState.firstHalfChunksCompleted === runState.urlChunks.length) {
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
    runState.urlChunks.forEach(function(chunk) {
    // for (var i=0; i<urlChunks.length; i++) {
      // Use setTimeout to cascade the opening of windows one per second.
      secondHalfStarted++;
      window.setTimeout(function() { 
        chrome.runtime.sendMessage(
            cfg.toId,                              // Extension ID of TO
            { type : 'browseAutomatically',     // Parameters
              urls : chunk, 
              loadtime : cfg.loadtime,
              visits : cfg.links },
            function(errorString) {             // Callback
                if (errorString) {
                    displayError(errorString);
                } else {
                  runState.secondHalfChunksCompleted++;
                  displaySuccess(runState.secondHalfChunksCompleted + " Automated measurements completed second half!");
                }
                if (runState.secondHalfChunksCompleted === runState.urlChunks.length) {
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

function closeBrowser() {
  chrome.tabs.getCurrent(function(tab) {
    chrome.tabs.remove(tab.id, function() { });
  });
  chrome.windows.getAll(function(w) {
    chrome.windows.remove(w.id);
  });
}

function checkMoreRepeats() {
  if (runState.currRepeat < cfg.repeatRuns) {
    runState.currRepeat++;
    console.log("Run " + runState.currRepeat + " will begin shortly.");
    console.log(cfg);
    console.log(runState);
    runState.run_name = cfg.run_name;
    runState.firstHalfChunksCompleted = 0;
    runState.secondHalfChunksCompleted = 0;
    window.setTimeout(function() {
      runMeasurement();      
    }, 60000);
  }
  else {
    cfg.currRepeat = 0;
    console.log("Runs complete.");
    closeBrowser();
  }
}

function setFirstPassInPlatform() {
  return setPass(1, cfg);
}
function setSecondPassInPlatform() {
  return setPass(2, cfg);
}
function setPass(pass, cfg, runState) { 
  return function() { 
    var deferred = Q.defer();
    if (pass === 1) {
      spin('#setFirstPassInPlatform');
    } else if (pass === 2) {
      spin('#setSecondPassInPlatform');
    }
    chrome.runtime.sendMessage(
      cfg.toId,
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

function runMeasurement() {
  runState.running = true;

  console.log("runMeasurement");
  if (cfg.waybackMode && !cfg.waybackTime) {
    console.log('Wayback mode requested with no timestamp. Aborting.');
    return;
  }
  if (cfg.waybackTime && cfg.waybackTime > 0 && cfg.waybackTime.length >= 4) {
    /* convert times to full wayback timestamps */
    var year = cfg.waybackTime.substring(0, 4);
    var month = cfg.waybackTime.length >= 6 ? cfg.waybackTime.substring(4, 6) : "00";
    var date = cfg.waybackTime.length >= 8 ? cfg.waybackTime.substring(6, 8) : "01";
    var hour = cfg.waybackTime.length >= 10 ? cfg.waybackTime.substring(8, 10) : "00";
    var min = cfg.waybackTime.length >= 12 ? cfg.waybackTime.substring(10, 12) : "00";
    var sec = cfg.waybackTime.length >= 14 ? cfg.waybackTime.substring(12, 14) : "00";
    cfg.waybackTime = year+month+date+hour+min+sec;
    var waybackTime = cfg.waybackTime;
  }
  

  // Let's do this.
  if (cfg.secondPass) {
    modifyAndChunkURLs()
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
    .catch(function(err) {
      console.log('Failure running measurement with error');
      console.log(err);
    });
  }
  else {
    modifyAndChunkURLs()
    .then(clearData)
    .then(configureRun)
    .then(getPlatformVersion)
    .then(sendRunStartToServer)
    .then(setFirstPassInPlatform)
    .then(runFirstHalf)
    .then(completeMeasurement)
    .then(getStatsFromPlatform)
    .then(finalizeRunInfoAtServer)
    .then(clearPlatformRunName)
    .then(checkMoreRepeats) 
    .catch(function(err) {
      console.log('Failure running measurement with error');
      console.log(err);
    });
  }
   
}
