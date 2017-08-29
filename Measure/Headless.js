function ws_onmessage(event) {
  var data = JSON.parse(event.data);
  if (data['messageType'] === 'alive') {
    if (data['status'] === 'ok') {
      if (!runState.running) {
          runState.running = true;
          setTimeout(runMeasurement, 000, cfg, runState);
      }
    } else {
      console.log('Alive Down');
    }
  } else if (data['messageType'] === 'logRunEnd') {
      if (data['status'] === 'ok') {
        console.log('[finalizeRunInfoAtServer] Logged run end to server: ' + cfg.runName);
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
        console.log('[sendRunStartToServer] Logged run start to server: ' + cfg.runName);
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

function displayError(str) {
  console.log("error: " + str);
}

function displaySuccess(str) {
  console.log("success: " + str);
}

function check(id) {
  console.log(id + ' CHECK ✓');
}

function cog(id) {
  console.log(id + ' COG ⚙')
}

function spin(id) {
  console.log(id + ' SPIN ⚹')
}

function bang(id) {
  console.log(id + ' BANG !')
}


initializeWebsocket(cfg);
