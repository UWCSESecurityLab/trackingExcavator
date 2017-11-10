"use strict";

/*
 * This content script is loaded on all frames and overwrites 
 * fingerprint-related APIs (such as the navigator object).
 */
 
// These functions will be injected into the page and allAPIs will be called.
function createEvent(name) { 
  document.dispatchEvent(
    new CustomEvent(
      "fingerprintEvent", 
      {
        detail: {
          apiName : name, 
          stackTrace: inspectStack()
        }
      }
    )
  ); 
}
function hook(api, source, name, toReturn) {
  // console.log('hooking ' + api);
  var _orig = source.__lookupGetter__(api);
  // No getter. It's just a property.
  if (_orig === undefined) {
    _orig = source[api];
    source.__defineGetter__(api, function() {
      createEvent(name);
      if (toReturn) {
        return toReturn(_orig);
      } else {
        return _orig;
      }
    });
  } else { // _orig is the original getter...
    source.__defineGetter__(api, function() { 
      createEvent(name);
      if (toReturn) {
        return toReturn(_orig);
      } else {
        return _orig.apply(this); 
      }
    });
  }
}

function hookMultiple(apis, source, sourceName) {
  apis.forEach(function(api) {
    var name = sourceName + '.' + api;
    hook(api, source, name);
  });
}

function allAPIs() {
  // Fingerprinting
  // ==============
  hook('appCodeName', navigator, 'navigator.appCodeName');
  hook('appName', navigator, 'navigator.appName');
  hook('appVersion', navigator, 'navigator.appVersion');
  hook('cookieEnabled', navigator, 'navigator.cookieEnabled');
  hook('doNotTrack', navigator, 'navigator.doNotTrack');
  hook('hardwareConcurrency', navigator, 'navigator.hardwareConcurrency');
  hook('language', navigator, 'navigator.language');
  hook('languages', navigator, 'navigator.languages');
  hook('maxTouchPoints', navigator, 'navigator.maxTouchPoints');
  hook('mediaDevices', navigator, 'navigator.mediaDevices');
  hook('mimeTypes', navigator, 'navigator.mimeTypes');
  hook('onLine', navigator, 'navigator.onLine');
  hook('permissions', navigator, 'navigator.permissions');
  hook('platform', navigator, 'navigator.platform');
  hook('plugins', navigator, 'navigator.plugins');
  hook('presentation', navigator, 'navigator.presentation');
  hook('product', navigator, 'navigator.product');
  hook('productSub', navigator, 'navigator.productSub');
  hook('serviceWorker', navigator, 'navigator.serviceWorker');
  hook('userAgent', navigator, 'navigator.userAgent');
  hook('vendor', navigator, 'navigator.vendor');
  hook('vendorSub', navigator, 'navigator.vendorSub');

  hook('availHeight', screen, 'screen.availHeight');
  hook('availLeft', screen, 'screen.availLeft');
  hook('availTop', screen, 'screen.availTop');
  hook('availWidth', screen, 'screen.availWidth');
  hook('colorDepth', screen, 'screen.colorDepth');
  hook('height', screen, 'screen.height');
  hook('orientation', screen, 'screen.orientation');
  hook('pixelDepth', screen, 'screen.pixelDepth');
  hook('width', screen, 'screen.width');

  // Canvas Fingerprinting
  hook('getImageData', CanvasRenderingContext2D.prototype, 'CanvasRenderingContext2D.getImageData');
  hook('fillText', CanvasRenderingContext2D.prototype, 'CanvasRenderingContext2D.fillText');
  hook('strokeText', CanvasRenderingContext2D.prototype, 'CanvasRenderingContext2D.strokeText');

  hook('getImageData', WebGLRenderingContext.prototype, 'WebGLRenderingContext.getImageData');
  hook('fillText', WebGLRenderingContext.prototype, 'WebGLRenderingContext.fillText');
  hook('strokeText', WebGLRenderingContext.prototype, 'WebGLRenderingContext.strokeText');

  var _toDataURL_ORIG = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    createEvent('Canvas.toDataURL()')
    return _toDataURL_ORIG.apply(this);
  };

  // Touch stuff
  hook('TouchEvent', window, 'window.TouchEvent');

  // ==============
  // Fancy Features
  // ==============
  hook('classList', HTMLElement.prototype, 'HTMLElement.classList');
  hook('dataset', HTMLElement.prototype, 'HTMLElement.dataset');
  hook('EventSource', window, 'window.EventSource');
  hook('fetch', window, 'window.fetch');
  hook('File', window, 'window.File');
  hook('FileList', window, 'window.FileList');
  hook('FileReader', window, 'window.FileReader');
  hook('Blob', window, 'window.Blob');

  // Related to the Filesystem API, which is DEPRECATED.
  // Still interesting to hook because it allows us to track the emergence/reduction
  // in things that appeared and disappeared, not just those that rose to prominence.
  hook('requestFileSystem', window, 'window.requestFileSystem');

  hook('FormData', window, 'window.FormData');

  hook('mozRequestFullScreen', HTMLElement.prototype, 'HTMLElement.mozRequestFullScreen');
  hook('webkitRequestFullScreen', HTMLElement.prototype, 'HTMLElement.webkitRequestFullScreen');
  hook('msRequestFullscreen', HTMLElement.prototype, 'HTMLElement.msRequestFullscreen');
  hook('requestFullscreen', HTMLElement.prototype, 'HTMLElement.requestFullscreen');

  hook('offsetHeight', HTMLElement.prototype, 'HTMLElement.offsetHeight');
  hook('offsetWidth', HTMLElement.prototype, 'HTMLElement.offsetWidth');
  hook('getBoundingClientRect', HTMLElement.prototype, 'HTMLElement.getBoundingClientRect');

  // hook('geolocation', navigator, 'navigator.geolocation');
  hook('getCurrentPosition', navigator.geolocation, 'navigator.geolocation.getCurrentPosition');
  hook('watchPosition', navigator.geolocation, 'navigator.geolocation.watchPosition');

  hook('history', window, 'window.history');

  hook('indexedDB', window, 'window.indexedDB');
  hook('mozIndexedDB', window, 'window.mozIndexedDB');
  hook('webkitIndexedDB', window, 'window.webkitIndexedDB');
  hook('msIndexedDB', window, 'window.msIndexedDB');

  hook('localStorage', window, 'window.localStorage');
  hook('sessionStorage', window, 'window.sessionStorage');
  hook('matchMedia', window, 'window.matchMedia');

  // Microdata
  hook('itemScope', HTMLElement.prototype, 'HTMLElement.itemScope');
  hook('itemValue', HTMLElement.prototype, 'HTMLElement.itemValue');
  hook('itemProp', HTMLElement.prototype, 'HTMLElement.itemProp');
  hook('itemRef', HTMLElement.prototype, 'HTMLElement.itemRef');
  hook('itemType', HTMLElement.prototype, 'HTMLElement.itemType');
  hook('itemId', HTMLElement.prototype, 'HTMLElement.itemId');

  hook('postMessage', window, 'window.postMessage');
  hook('requestAnimationFrame', window, 'window.requestAnimationFrame');
  hook('vibrate', navigator, 'navigator.vibrate');

  // WebSQL DB (deprecated)
  hook('openDatabase', window, 'window.openDatabase');
  hook('openDatabaseSync', window, 'window.openDatabaseSync');

  hook('Worker', window, 'window.Worker');
  hook('WebSocket', window, 'window.WebSocket');

  var _getContext_ORIG = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(contextType) {
    if (contextType === 'webgl') {
      createEvent('Canvas.getContext(webgl)');
    } else if (contextType === 'experimental-webgl') {
      createEvent('Canvas.getContext(experimental-webgl)');
    } else if (contextType === '2d') {
      createEvent('Canvas.getContext(2d)');
    } 
    return _getContext_ORIG.apply(this, arguments);
  }

  var _localGetItem_ORIG = localStorage.getItem;
  localStorage.getItem = function(key) {
    createEvent(`localStorage.getItem(${key})`);
    return _localGetItem_ORIG.apply(this, arguments);
  }
  var _localSetItem_ORIG = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    createEvent(`localStorage.setItem(${key}, ${value})`);
    return _localSetItem_ORIG.apply(this, arguments);
  }

  var _sessionGetItem_ORIG = sessionStorage.getItem;
  sessionStorage.getItem = function(key) {
    createEvent(`sessionStorage.getItem(${key})`);
    return _sessionGetItem_ORIG.apply(this, arguments);
  }
  var _sessionSetItem_ORIG = sessionStorage.setItem;
  sessionStorage.setItem = function(key, value) {
    createEvent(`sessionStorage.setItem(${key}, ${value})`);
    return _sessionSetItem_ORIG.apply(this, arguments);
  }

  var _offset = new Date().getTimezoneOffset();
  Date.prototype.getTimezoneOffset = function() { 
    createEvent('Date.getTimezoneOffset'); 
    return _offset; 
  };

  // WebComponents (Shadow DOM, Custom Elements, HTML Templates, HTML Imports)
  
  console.log('hooked all apis');
}


 // Serialize and inject the above functions, and call allAPIs.
var fingerprintDetectCode = [ 
  inspectStack.toString(),
  createEvent.toString(),
  hook.toString(),
  allAPIs.toString(),
  'allAPIs();'
].join('\n');

var script = document.createElement('script');
script.appendChild(document.createTextNode(fingerprintDetectCode));
(document.head || document.documentElement).appendChild(script);
script.parentNode.removeChild(script);

// Fires when a fingerprint-related API is accessed and notifies background script.
document.addEventListener('fingerprintEvent', function(e) {
  // console.log(e.detail.apiName);
  var sourceUrl = e.detail.stackTrace;
  chrome.extension.sendRequest(
    {type:'fingerprintApiEvent', url : document.URL, apiName : e.detail.apiName, sourceUrl : sourceUrl});
});
    
// Inspects the call stack to see ultimate source of fingerprinting
function inspectStack() {
  var callstack = [];
  var uri_pattern = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?������]))/ig;

  var isCallstackPopulated = false;
  try {
    i.dont.exist+=0; //doesn't exist- that's the point
  } catch(e) {
      var urls = e.stack.match(uri_pattern);
      if (urls) {
        var sourceUrl = urls[urls.length-1];
        return sourceUrl;      
      }
      // console.log('No URLs found in stack');
      // console.log(e.stack);
      return 'No URLs found in stack';
  }
}
