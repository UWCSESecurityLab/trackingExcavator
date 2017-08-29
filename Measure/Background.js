"use strict";

// Register this add-on to TrackingObserver with the main extension
var to_id = "obheeflpdipmaefcoefhimnaihmhpkao";

console.log("REGISTERING");
    
chrome.runtime.sendMessage(to_id, 
    {type : 'registerAddon', 
    name : 'Measure', 
    link : 'Measure.html'},
    function(response) {
        console.log(response);
    }
);

chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        if (request.type == "trackingNotification") {
            // don't care
        }
    }
);

