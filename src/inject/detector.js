/**
 * CrawlHQ Hooker - Comprehensive Fingerprint Detection
 * Hooks all fingerprinting APIs used by anti-bot systems
 *
 * Runs in MAIN world at document_start via content script manifest
 */

(function() {
  if (window.__FINGERPRINT_HOOKER_ACTIVE__) return;
  window.__FINGERPRINT_HOOKER_ACTIVE__ = true;

  // ==================== UTILITIES ====================
  var __FP_EVENT_NAME__ = '__FINGERPRINT_DETECTED__';
  var __FP_THUMB_SIZE__ = 200;

  function __fpGenId__() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  function __fpGetStack__() {
    try { return (new Error()).stack.split('\n').slice(3).join('\n'); } catch(e) { return ''; }
  }

  function __fpGetSource__(stack) {
    try {
      var lines = (stack || '').split('\n');
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/(?:at\s+)?(?:.*?\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/);
        if (m && m[1].indexOf('chrome-extension://') === -1 && m[1].indexOf('chrome://') !== 0) {
          return { url: m[1], line: parseInt(m[2]), column: parseInt(m[3]) };
        }
      }
    } catch(e) {}
    return { url: 'unknown', line: 0, column: 0 };
  }

  function __fpDispatch__(category, method, data) {
    var stack = __fpGetStack__();
    var payload = {
      id: __fpGenId__(),
      category: category,
      method: method,
      timestamp: Date.now(),
      pageUrl: window.location.href,
      source: __fpGetSource__(stack),
      stackTrace: stack,
      data: data || {}
    };
    if (category === 'canvas' && data) {
      if (data.canvas) payload.canvas = data.canvas;
      if (data.arguments) payload.arguments = data.arguments;
      if (data.result) payload.result = data.result;
    }
    window.postMessage({ type: __FP_EVENT_NAME__, payload: payload }, '*');
  }

  // Store canvas originals for use by other hooks
  var __origToDataURL__ = HTMLCanvasElement.prototype.toDataURL;
  var __origGetContext__ = HTMLCanvasElement.prototype.getContext;

  function __fpCaptureCanvas__(canvas) {
    try {
      if (!canvas || !canvas.width || !canvas.height) return null;
      var scale = Math.min(__FP_THUMB_SIZE__ / canvas.width, __FP_THUMB_SIZE__ / canvas.height, 1);
      var tc = document.createElement('canvas');
      tc.width = Math.max(1, Math.floor(canvas.width * scale));
      tc.height = Math.max(1, Math.floor(canvas.height * scale));
      var ctx = __origGetContext__.call(tc, '2d');
      if (!ctx) return null;
      ctx.drawImage(canvas, 0, 0, tc.width, tc.height);
      return __origToDataURL__.call(tc, 'image/png');
    } catch(e) {
      try { return __origToDataURL__.call(canvas, 'image/png'); } catch(e2) { return null; }
    }
  }

  // ==================== CANVAS HOOKS ====================
  (function() {
    var __origToBlob__ = HTMLCanvasElement.prototype.toBlob;
    var __origGetImageData__ = CanvasRenderingContext2D.prototype.getImageData;
    var __origMeasureText__ = CanvasRenderingContext2D.prototype.measureText;

    HTMLCanvasElement.prototype.toDataURL = function() {
      var r = __origToDataURL__.apply(this, arguments);
      try {
        __fpDispatch__('canvas', 'toDataURL', {
          canvas: { width: this.width, height: this.height, image: __fpCaptureCanvas__(this) },
          arguments: { type: arguments[0] || 'image/png', quality: arguments[1] }
        });
      } catch(e) {}
      return r;
    };

    HTMLCanvasElement.prototype.toBlob = function(cb) {
      try {
        __fpDispatch__('canvas', 'toBlob', {
          canvas: { width: this.width, height: this.height, image: __fpCaptureCanvas__(this) },
          arguments: { type: arguments[1] || 'image/png', quality: arguments[2] }
        });
      } catch(e) {}
      return __origToBlob__.apply(this, arguments);
    };

    CanvasRenderingContext2D.prototype.getImageData = function() {
      var r = __origGetImageData__.apply(this, arguments);
      try {
        __fpDispatch__('canvas', 'getImageData', {
          canvas: { width: this.canvas.width, height: this.canvas.height, image: __fpCaptureCanvas__(this.canvas) },
          arguments: { sx: arguments[0], sy: arguments[1], sw: arguments[2], sh: arguments[3] }
        });
      } catch(e) {}
      return r;
    };

    var __measureTextLogged__ = {};
    CanvasRenderingContext2D.prototype.measureText = function(text) {
      var r = __origMeasureText__.apply(this, arguments);
      try {
        var key = String(text).substring(0, 50) + '|' + this.font;
        if (!__measureTextLogged__[key]) {
          __measureTextLogged__[key] = true;
          __fpDispatch__('canvas', 'measureText', {
            arguments: { text: String(text).substring(0, 100), font: this.font },
            result: { width: r.width }
          });
        }
      } catch(e) {}
      return r;
    };
  })();

  // ==================== WEBGL HOOKS ====================
  (function() {
    var __webglContexts__ = new WeakSet();

    HTMLCanvasElement.prototype.getContext = function(type) {
      var ctx = __origGetContext__.apply(this, arguments);
      if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
        if (!__webglContexts__.has(ctx)) {
          __webglContexts__.add(ctx);
          __hookWebGLContext__(ctx, type);
        }
      }
      return ctx;
    };

    function __hookWebGLContext__(gl, ctxType) {
      var __webglLogged__ = {};

      // readPixels
      var origReadPixels = gl.readPixels.bind(gl);
      gl.readPixels = function() {
        var r = origReadPixels.apply(gl, arguments);
        if (!__webglLogged__['readPixels']) {
          __webglLogged__['readPixels'] = true;
          try {
            __fpDispatch__('webgl', 'readPixels', {
              canvas: { width: gl.canvas.width, height: gl.canvas.height, image: __fpCaptureCanvas__(gl.canvas) },
              arguments: { x: arguments[0], y: arguments[1], w: arguments[2], h: arguments[3], contextType: ctxType }
            });
          } catch(e) {}
        }
        return r;
      };

      // getParameter
      var origGetParameter = gl.getParameter.bind(gl);
      gl.getParameter = function(pname) {
        var r = origGetParameter(pname);
        try {
          var key = 'getParam_' + pname;
          if (!__webglLogged__[key]) {
            __webglLogged__[key] = true;
            __fpDispatch__('webgl', 'getParameter', {
              parameterCode: pname,
              value: r !== null && typeof r === 'object' ? '[object]' : r
            });
          }
        } catch(e) {}
        return r;
      };

      // getExtension
      var origGetExtension = gl.getExtension.bind(gl);
      gl.getExtension = function(name) {
        var ext = origGetExtension(name);
        if (!__webglLogged__['ext_' + name]) {
          __webglLogged__['ext_' + name] = true;
          try {
            __fpDispatch__('webgl', 'getExtension', { name: name, available: !!ext });
          } catch(e) {}
        }
        return ext;
      };

      // getSupportedExtensions
      var origGetSupportedExtensions = gl.getSupportedExtensions.bind(gl);
      gl.getSupportedExtensions = function() {
        var exts = origGetSupportedExtensions();
        if (!__webglLogged__['supportedExtensions']) {
          __webglLogged__['supportedExtensions'] = true;
          try {
            __fpDispatch__('webgl', 'getSupportedExtensions', { count: exts ? exts.length : 0, extensions: exts });
          } catch(e) {}
        }
        return exts;
      };

      // getShaderPrecisionFormat
      var origGetShaderPrecisionFormat = gl.getShaderPrecisionFormat.bind(gl);
      gl.getShaderPrecisionFormat = function(shaderType, precisionType) {
        var fmt = origGetShaderPrecisionFormat(shaderType, precisionType);
        var key = 'shaderPrecision_' + shaderType + '_' + precisionType;
        if (!__webglLogged__[key]) {
          __webglLogged__[key] = true;
          try {
            __fpDispatch__('webgl', 'getShaderPrecisionFormat', {
              shaderType: shaderType, precisionType: precisionType,
              rangeMin: fmt ? fmt.rangeMin : null, rangeMax: fmt ? fmt.rangeMax : null, precision: fmt ? fmt.precision : null
            });
          } catch(e) {}
        }
        return fmt;
      };
    }
  })();

  // ==================== NAVIGATOR HOOKS ====================
  (function() {
    var __navLogged__ = {};
    var navProps = ['userAgent', 'platform', 'language', 'languages', 'hardwareConcurrency', 'deviceMemory',
                    'cookieEnabled', 'doNotTrack', 'maxTouchPoints', 'vendor', 'vendorSub', 'productSub',
                    'appVersion', 'appName', 'appCodeName', 'oscpu', 'buildID', 'pdfViewerEnabled'];

    navProps.forEach(function(prop) {
      try {
        var desc = Object.getOwnPropertyDescriptor(navigator, prop) || Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
        if (desc && desc.get) {
          var origGetter = desc.get;
          Object.defineProperty(navigator, prop, {
            get: function() {
              var val = origGetter.call(navigator);
              if (!__navLogged__[prop]) {
                __navLogged__[prop] = true;
                __fpDispatch__('navigator', prop, { property: prop, value: val });
              }
              return val;
            },
            configurable: true
          });
        }
      } catch(e) {}
    });

    // plugins
    try {
      var pluginsDesc = Object.getOwnPropertyDescriptor(navigator, 'plugins') || Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins');
      if (pluginsDesc && pluginsDesc.get) {
        var origPluginsGetter = pluginsDesc.get;
        Object.defineProperty(navigator, 'plugins', {
          get: function() {
            var plugins = origPluginsGetter.call(navigator);
            if (!__navLogged__['plugins']) {
              __navLogged__['plugins'] = true;
              try {
                var names = [];
                for (var i = 0; i < Math.min(plugins.length, 10); i++) {
                  names.push(plugins[i].name);
                }
                __fpDispatch__('navigator', 'plugins', { count: plugins.length, sample: names });
              } catch(e) {}
            }
            return plugins;
          },
          configurable: true
        });
      }
    } catch(e) {}

    // mimeTypes
    try {
      var mimeDesc = Object.getOwnPropertyDescriptor(navigator, 'mimeTypes') || Object.getOwnPropertyDescriptor(Navigator.prototype, 'mimeTypes');
      if (mimeDesc && mimeDesc.get) {
        var origMimeGetter = mimeDesc.get;
        Object.defineProperty(navigator, 'mimeTypes', {
          get: function() {
            var mimes = origMimeGetter.call(navigator);
            if (!__navLogged__['mimeTypes']) {
              __navLogged__['mimeTypes'] = true;
              __fpDispatch__('navigator', 'mimeTypes', { count: mimes.length });
            }
            return mimes;
          },
          configurable: true
        });
      }
    } catch(e) {}
  })();

  // ==================== SCREEN HOOKS ====================
  (function() {
    var __screenLogged__ = {};
    var screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth',
                       'availLeft', 'availTop', 'orientation'];

    screenProps.forEach(function(prop) {
      try {
        var desc = Object.getOwnPropertyDescriptor(screen, prop) || Object.getOwnPropertyDescriptor(Screen.prototype, prop);
        if (desc && desc.get) {
          var origGetter = desc.get;
          Object.defineProperty(screen, prop, {
            get: function() {
              var val = origGetter.call(screen);
              if (!__screenLogged__[prop]) {
                __screenLogged__[prop] = true;
                if (prop === 'orientation') {
                  __fpDispatch__('screen', prop, { type: val ? val.type : null, angle: val ? val.angle : null });
                } else {
                  __fpDispatch__('screen', prop, { property: prop, value: val });
                }
              }
              return val;
            },
            configurable: true
          });
        }
      } catch(e) {}
    });

    // devicePixelRatio
    try {
      var dprDesc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
      if (dprDesc && dprDesc.get) {
        var origDprGetter = dprDesc.get;
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() {
            var val = origDprGetter.call(window);
            if (!__screenLogged__['devicePixelRatio']) {
              __screenLogged__['devicePixelRatio'] = true;
              __fpDispatch__('screen', 'devicePixelRatio', { value: val });
            }
            return val;
          },
          configurable: true
        });
      }
    } catch(e) {}
  })();

  // ==================== AUDIO HOOKS ====================
  (function() {
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return;
    var __audioLogged__ = {};
    var OrigAudioContext = window.AudioContext || window.webkitAudioContext;

    window.AudioContext = window.webkitAudioContext = function() {
      var ctx = new OrigAudioContext(...arguments);
      if (!__audioLogged__['createContext']) {
        __audioLogged__['createContext'] = true;
        try {
          __fpDispatch__('audio', 'AudioContext', { sampleRate: ctx.sampleRate, state: ctx.state });
        } catch(e) {}
      }

      // createOscillator
      var origCreateOsc = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = function() {
        var osc = origCreateOsc();
        if (!__audioLogged__['createOscillator']) {
          __audioLogged__['createOscillator'] = true;
          __fpDispatch__('audio', 'createOscillator', {});
        }
        return osc;
      };

      // createAnalyser
      var origCreateAnalyser = ctx.createAnalyser.bind(ctx);
      ctx.createAnalyser = function() {
        var analyser = origCreateAnalyser();
        if (!__audioLogged__['createAnalyser']) {
          __audioLogged__['createAnalyser'] = true;
          __fpDispatch__('audio', 'createAnalyser', {});
        }
        return analyser;
      };

      // createDynamicsCompressor
      var origCreateCompressor = ctx.createDynamicsCompressor.bind(ctx);
      ctx.createDynamicsCompressor = function() {
        var comp = origCreateCompressor();
        if (!__audioLogged__['createDynamicsCompressor']) {
          __audioLogged__['createDynamicsCompressor'] = true;
          __fpDispatch__('audio', 'createDynamicsCompressor', {});
        }
        return comp;
      };

      return ctx;
    };
    window.AudioContext.prototype = OrigAudioContext.prototype;
    if (window.webkitAudioContext) window.webkitAudioContext.prototype = OrigAudioContext.prototype;
  })();

  // ==================== FONTS HOOKS ====================
  (function() {
    if (!document.fonts || !document.fonts.check) return;
    var __fontsLogged__ = {};

    var origCheck = document.fonts.check.bind(document.fonts);
    document.fonts.check = function(font, text) {
      var result = origCheck(font, text);
      var key = font + '|' + (text || '');
      if (!__fontsLogged__[key]) {
        __fontsLogged__[key] = true;
        try {
          __fpDispatch__('fonts', 'check', { font: font, text: text ? text.substring(0, 20) : undefined, result: result });
        } catch(e) {}
      }
      return result;
    };

    var origLoad = document.fonts.load.bind(document.fonts);
    document.fonts.load = function(font, text) {
      if (!__fontsLogged__['load_' + font]) {
        __fontsLogged__['load_' + font] = true;
        try {
          __fpDispatch__('fonts', 'load', { font: font });
        } catch(e) {}
      }
      return origLoad(font, text);
    };
  })();

  // ==================== WEBRTC HOOKS ====================
  (function() {
    if (typeof RTCPeerConnection === 'undefined') return;
    var __webrtcLogged__ = {};
    var OrigRTCPeerConnection = window.RTCPeerConnection;

    window.RTCPeerConnection = function(config) {
      if (!__webrtcLogged__['constructor']) {
        __webrtcLogged__['constructor'] = true;
        try {
          __fpDispatch__('webrtc', 'RTCPeerConnection', {
            iceServers: config && config.iceServers ? config.iceServers.length : 0
          });
        } catch(e) {}
      }
      var pc = new OrigRTCPeerConnection(config);

      var origCreateDataChannel = pc.createDataChannel.bind(pc);
      pc.createDataChannel = function(label) {
        if (!__webrtcLogged__['createDataChannel']) {
          __webrtcLogged__['createDataChannel'] = true;
          __fpDispatch__('webrtc', 'createDataChannel', { label: label });
        }
        return origCreateDataChannel.apply(this, arguments);
      };

      return pc;
    };
    window.RTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;
  })();

  // ==================== TIMING HOOKS ====================
  (function() {
    var __timingLogged__ = {};

    var origPerfNow = performance.now.bind(performance);
    performance.now = function() {
      var r = origPerfNow();
      if (!__timingLogged__['now']) {
        __timingLogged__['now'] = true;
        __fpDispatch__('timing', 'performance.now', { value: r });
      }
      return r;
    };
  })();

  // ==================== SPEECH HOOKS ====================
  (function() {
    if (typeof speechSynthesis === 'undefined') return;
    var __speechLogged__ = false;

    var origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
    speechSynthesis.getVoices = function() {
      var voices = origGetVoices();
      if (!__speechLogged__ && voices && voices.length > 0) {
        __speechLogged__ = true;
        try {
          var sample = voices.slice(0, 5).map(function(v) { return { name: v.name, lang: v.lang }; });
          __fpDispatch__('speech', 'getVoices', { count: voices.length, sample: sample });
        } catch(e) {}
      }
      return voices;
    };
  })();

  // ==================== PERMISSIONS HOOKS ====================
  (function() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    var __permLogged__ = {};

    var origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(desc) {
      return origQuery(desc).then(function(result) {
        var name = desc && desc.name;
        if (name && !__permLogged__[name]) {
          __permLogged__[name] = true;
          try {
            __fpDispatch__('permissions', 'query', { name: name, state: result.state });
          } catch(e) {}
        }
        return result;
      });
    };
  })();

  // ==================== STORAGE HOOKS ====================
  (function() {
    var __storageLogged__ = {};
    var __storageCount__ = { localStorage: 0, sessionStorage: 0, indexedDB: 0 };

    ['localStorage', 'sessionStorage'].forEach(function(storageName) {
      try {
        var storage = window[storageName];
        if (!storage) return;

        var origGetItem = storage.getItem.bind(storage);
        storage.getItem = function(key) {
          __storageCount__[storageName]++;
          if (__storageCount__[storageName] === 1 || __storageCount__[storageName] % 50 === 0) {
            try {
              __fpDispatch__('storage', storageName + '.getItem', {
                callCount: __storageCount__[storageName], keyLength: key ? key.length : 0
              });
            } catch(e) {}
          }
          return origGetItem(key);
        };

        var origSetItem = storage.setItem.bind(storage);
        storage.setItem = function(key, value) {
          if (!__storageLogged__[storageName + '_setItem']) {
            __storageLogged__[storageName + '_setItem'] = true;
            try {
              __fpDispatch__('storage', storageName + '.setItem', { keyLength: key ? key.length : 0 });
            } catch(e) {}
          }
          return origSetItem(key, value);
        };
      } catch(e) {}
    });

    // IndexedDB
    if (window.indexedDB && window.indexedDB.open) {
      var origOpen = window.indexedDB.open.bind(window.indexedDB);
      window.indexedDB.open = function(name) {
        __storageCount__.indexedDB++;
        if (__storageCount__.indexedDB <= 3) {
          try {
            __fpDispatch__('storage', 'indexedDB.open', { name: name, callCount: __storageCount__.indexedDB });
          } catch(e) {}
        }
        return origOpen.apply(window.indexedDB, arguments);
      };
    }
  })();

  // ==================== BATTERY HOOKS ====================
  (function() {
    if (!navigator.getBattery) return;

    var origGetBattery = navigator.getBattery.bind(navigator);
    navigator.getBattery = function() {
      return origGetBattery().then(function(battery) {
        try {
          __fpDispatch__('battery', 'getBattery', {
            charging: battery.charging, chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime, level: battery.level
          });
        } catch(e) {}
        return battery;
      });
    };
  })();

  // ==================== BEHAVIOR HOOKS ====================
  (function() {
    var __behaviorLogged__ = {};
    var __behaviorCount__ = { mousemove: 0, keydown: 0, touchmove: 0, scroll: 0, wheel: 0 };
    var __behaviorSampleRate__ = 50;
    var __lastMousePos__ = null;
    var __lastMouseTime__ = 0;

    document.addEventListener('mousemove', function(e) {
      __behaviorCount__.mousemove++;
      var now = Date.now();
      var velocity = 0, timeDelta = 0;
      if (__lastMousePos__ && __lastMouseTime__) {
        var dx = e.clientX - __lastMousePos__.x;
        var dy = e.clientY - __lastMousePos__.y;
        timeDelta = now - __lastMouseTime__;
        if (timeDelta > 0) velocity = Math.sqrt(dx*dx + dy*dy) / timeDelta;
      }
      __lastMousePos__ = { x: e.clientX, y: e.clientY };
      __lastMouseTime__ = now;
      if (__behaviorCount__.mousemove === 1 || __behaviorCount__.mousemove % __behaviorSampleRate__ === 0) {
        try {
          __fpDispatch__('behavior', 'mousemove', {
            eventCount: __behaviorCount__.mousemove, clientX: e.clientX, clientY: e.clientY,
            velocity: velocity.toFixed(3), timeDelta: timeDelta
          });
        } catch(ex) {}
      }
    }, { passive: true });

    document.addEventListener('mousedown', function(e) {
      try {
        __fpDispatch__('behavior', 'mousedown', { button: e.button, clientX: e.clientX, clientY: e.clientY });
      } catch(ex) {}
    }, { passive: true });

    var __keyTimes__ = {};
    document.addEventListener('keydown', function(e) {
      __behaviorCount__.keydown++;
      __keyTimes__[e.code] = Date.now();
      if (__behaviorCount__.keydown === 1 || __behaviorCount__.keydown % 20 === 0) {
        try {
          __fpDispatch__('behavior', 'keydown', {
            eventCount: __behaviorCount__.keydown, code: e.code, key: e.key.length === 1 ? '[char]' : e.key
          });
        } catch(ex) {}
      }
    }, { passive: true });

    document.addEventListener('keyup', function(e) {
      var dwellTime = __keyTimes__[e.code] ? Date.now() - __keyTimes__[e.code] : 0;
      delete __keyTimes__[e.code];
      try {
        __fpDispatch__('behavior', 'keyup', { code: e.code, dwellTime: dwellTime });
      } catch(ex) {}
    }, { passive: true });

    document.addEventListener('touchstart', function(e) {
      if (!__behaviorLogged__['touchstart']) {
        __behaviorLogged__['touchstart'] = true;
        try {
          __fpDispatch__('behavior', 'touchstart', { touches: e.touches.length });
        } catch(ex) {}
      }
    }, { passive: true });

    document.addEventListener('wheel', function(e) {
      __behaviorCount__.wheel++;
      if (__behaviorCount__.wheel === 1 || __behaviorCount__.wheel % 10 === 0) {
        try {
          __fpDispatch__('behavior', 'wheel', { eventCount: __behaviorCount__.wheel, deltaY: e.deltaY });
        } catch(ex) {}
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', function() {
      try {
        __fpDispatch__('behavior', 'visibilitychange', { hidden: document.hidden });
      } catch(ex) {}
    });
  })();

  // ==================== AUTOMATION HOOKS ====================
  (function() {
    var __automationLogged__ = {};

    try {
      var webdriverDesc = Object.getOwnPropertyDescriptor(navigator, 'webdriver') ||
                          Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
      Object.defineProperty(navigator, 'webdriver', {
        get: function() {
          var result = webdriverDesc ? webdriverDesc.get.call(navigator) : false;
          if (!__automationLogged__['webdriver']) {
            __automationLogged__['webdriver'] = true;
            __fpDispatch__('automation', 'webdriver', { value: result });
          }
          return result;
        },
        configurable: true
      });
    } catch(e) {}

    setTimeout(function() {
      if (!__automationLogged__['plugins']) {
        __automationLogged__['plugins'] = true;
        try {
          __fpDispatch__('automation', 'plugins', {
            count: navigator.plugins ? navigator.plugins.length : 0,
            hasPlugins: navigator.plugins && navigator.plugins.length > 0
          });
        } catch(e) {}
      }
      if (!__automationLogged__['notification']) {
        __automationLogged__['notification'] = true;
        try {
          __fpDispatch__('automation', 'notification', {
            permission: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'
          });
        } catch(e) {}
      }
    }, 100);
  })();

  // ==================== SENSORS HOOKS ====================
  // Hook addEventListener to detect sensor usage by the page (avoids permissions policy violations)
  (function() {
    var __sensorsLogged__ = {};
    var __originalAddEventListener__ = window.addEventListener;

    window.addEventListener = function(type, listener, options) {
      if ((type === 'deviceorientation' || type === 'devicemotion') && !__sensorsLogged__[type]) {
        __sensorsLogged__[type] = true;
        try {
          __fpDispatch__('sensors', type + '_listener', { detected: true });
        } catch(ex) {}
      }
      return __originalAddEventListener__.call(this, type, listener, options);
    };
  })();

  // ==================== GAMEPAD HOOKS ====================
  (function() {
    if (!navigator.getGamepads) return;
    var __gamepadLogged__ = false;

    var origGetGamepads = navigator.getGamepads.bind(navigator);
    navigator.getGamepads = function() {
      var gamepads = origGetGamepads();
      if (!__gamepadLogged__) {
        __gamepadLogged__ = true;
        try {
          var count = 0;
          for (var i = 0; i < gamepads.length; i++) if (gamepads[i]) count++;
          __fpDispatch__('gamepad', 'getGamepads', { count: count });
        } catch(e) {}
      }
      return gamepads;
    };
  })();

  // ==================== NETWORK HOOKS ====================
  (function() {
    var __networkLogged__ = {};
    var __networkCount__ = { fetch: 0, xhr: 0 };

    var origFetch = window.fetch;
    window.fetch = function(input) {
      __networkCount__.fetch++;
      if (__networkCount__.fetch === 1 || __networkCount__.fetch % 10 === 0) {
        try {
          var url = typeof input === 'string' ? input : (input.url || 'unknown');
          __fpDispatch__('network', 'fetch', { count: __networkCount__.fetch, url: url.substring(0, 100) });
        } catch(e) {}
      }
      return origFetch.apply(this, arguments);
    };

    var origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      __networkCount__.xhr++;
      if (__networkCount__.xhr === 1 || __networkCount__.xhr % 10 === 0) {
        try {
          __fpDispatch__('network', 'XMLHttpRequest', { count: __networkCount__.xhr, method: method });
        } catch(e) {}
      }
      return origXHROpen.apply(this, arguments);
    };

    if (navigator.connection && !__networkLogged__['connection']) {
      __networkLogged__['connection'] = true;
      setTimeout(function() {
        try {
          var conn = navigator.connection;
          __fpDispatch__('network', 'connection', {
            effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt
          });
        } catch(e) {}
      }, 100);
    }
  })();

  // ==================== MEDIA HOOKS ====================
  (function() {
    var __mediaLogged__ = {};

    var origCanPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function(type) {
      var result = origCanPlayType.call(this, type);
      if (!__mediaLogged__['canPlayType_' + type]) {
        __mediaLogged__['canPlayType_' + type] = true;
        try {
          __fpDispatch__('media', 'canPlayType', { type: type, result: result });
        } catch(e) {}
      }
      return result;
    };

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      var origEnumDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = function() {
        return origEnumDevices().then(function(devices) {
          if (!__mediaLogged__['enumerateDevices']) {
            __mediaLogged__['enumerateDevices'] = true;
            try {
              __fpDispatch__('media', 'enumerateDevices', { total: devices.length });
            } catch(e) {}
          }
          return devices;
        });
      };
    }
  })();

  // ==================== GEOLOCATION HOOKS ====================
  (function() {
    if (!navigator.geolocation) return;
    var __geoLogged__ = {};

    var origGetPos = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      var wrappedSuccess = function(position) {
        if (!__geoLogged__['getCurrentPosition']) {
          __geoLogged__['getCurrentPosition'] = true;
          try {
            __fpDispatch__('geolocation', 'getCurrentPosition', {
              accuracy: position.coords.accuracy, hasAltitude: position.coords.altitude !== null
            });
          } catch(e) {}
        }
        success(position);
      };
      return origGetPos(wrappedSuccess, error, options);
    };
  })();

  // ==================== DOM HOOKS ====================
  (function() {
    var __domLogged__ = {};

    var origGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function(element) {
      if (!__domLogged__['getComputedStyle']) {
        __domLogged__['getComputedStyle'] = true;
        try {
          __fpDispatch__('dom', 'getComputedStyle', { tagName: element ? element.tagName : 'unknown' });
        } catch(e) {}
      }
      return origGetComputedStyle.apply(this, arguments);
    };

    var origGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      var result = origGetBCR.call(this);
      if (!__domLogged__['getBoundingClientRect']) {
        __domLogged__['getBoundingClientRect'] = true;
        try {
          __fpDispatch__('dom', 'getBoundingClientRect', { tagName: this.tagName });
        } catch(e) {}
      }
      return result;
    };

    var origMatchMedia = window.matchMedia;
    window.matchMedia = function(query) {
      var result = origMatchMedia.call(this, query);
      if (!__domLogged__['matchMedia_' + query]) {
        __domLogged__['matchMedia_' + query] = true;
        try {
          __fpDispatch__('dom', 'matchMedia', { query: query, matches: result.matches });
        } catch(e) {}
      }
      return result;
    };
  })();

  // ==================== CRYPTO HOOKS ====================
  (function() {
    var __cryptoLogged__ = {};

    if (crypto && crypto.getRandomValues) {
      var origGetRandomValues = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = function(array) {
        if (!__cryptoLogged__['getRandomValues']) {
          __cryptoLogged__['getRandomValues'] = true;
          try {
            __fpDispatch__('crypto', 'getRandomValues', { arrayType: array ? array.constructor.name : 'unknown' });
          } catch(e) {}
        }
        return origGetRandomValues(array);
      };
    }
  })();

  // ==================== HARDWARE HOOKS ====================
  (function() {
    var __hardwareLogged__ = {};

    setTimeout(function() {
      if (!__hardwareLogged__['gpu']) {
        __hardwareLogged__['gpu'] = true;
        try {
          var canvas = document.createElement('canvas');
          var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            __fpDispatch__('hardware', 'gpu', {
              vendor: gl.getParameter(gl.VENDOR),
              renderer: gl.getParameter(gl.RENDERER),
              unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null
            });
          }
        } catch(e) {}
      }
    }, 500);

    if (navigator.vibrate) {
      var origVibrate = navigator.vibrate.bind(navigator);
      navigator.vibrate = function(pattern) {
        if (!__hardwareLogged__['vibrate']) {
          __hardwareLogged__['vibrate'] = true;
          try {
            __fpDispatch__('hardware', 'vibrate', {});
          } catch(e) {}
        }
        return origVibrate(pattern);
      };
    }
  })();

  // ==================== CLIPBOARD HOOKS ====================
  (function() {
    var __clipboardLogged__ = {};

    document.addEventListener('copy', function() {
      if (!__clipboardLogged__['copy']) {
        __clipboardLogged__['copy'] = true;
        try { __fpDispatch__('clipboard', 'copyEvent', {}); } catch(ex) {}
      }
    });

    document.addEventListener('paste', function() {
      if (!__clipboardLogged__['paste']) {
        __clipboardLogged__['paste'] = true;
        try { __fpDispatch__('clipboard', 'pasteEvent', {}); } catch(ex) {}
      }
    });
  })();

  // ==================== CREDENTIALS HOOKS ====================
  (function() {
    var __credentialsLogged__ = {};

    if (navigator.credentials && navigator.credentials.get) {
      var origCredGet = navigator.credentials.get.bind(navigator.credentials);
      navigator.credentials.get = function(options) {
        if (!__credentialsLogged__['get']) {
          __credentialsLogged__['get'] = true;
          try {
            __fpDispatch__('credentials', 'credentials.get', {
              hasPublicKey: !!(options && options.publicKey)
            });
          } catch(e) {}
        }
        return origCredGet(options);
      };
    }
  })();

  // ==================== CLIENT HINTS HOOKS ====================
  (function() {
    if (!navigator.userAgentData) return;
    var __clientHintsLogged__ = {};

    try {
      var desc = Object.getOwnPropertyDescriptor(navigator, 'userAgentData') ||
                 Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgentData');
      if (desc && desc.get) {
        var origGetter = desc.get;
        Object.defineProperty(navigator, 'userAgentData', {
          get: function() {
            var uad = origGetter.call(navigator);
            if (!__clientHintsLogged__['userAgentData'] && uad) {
              __clientHintsLogged__['userAgentData'] = true;
              try {
                __fpDispatch__('clientHints', 'userAgentData', {
                  mobile: uad.mobile, platform: uad.platform,
                  brands: uad.brands ? uad.brands.map(function(b) { return b.brand; }) : []
                });
              } catch(e) {}
            }
            return uad;
          },
          configurable: true
        });
      }
    } catch(e) {}

    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      var origGetHEV = navigator.userAgentData.getHighEntropyValues.bind(navigator.userAgentData);
      navigator.userAgentData.getHighEntropyValues = function(hints) {
        return origGetHEV(hints).then(function(data) {
          if (!__clientHintsLogged__['highEntropy']) {
            __clientHintsLogged__['highEntropy'] = true;
            try {
              __fpDispatch__('clientHints', 'getHighEntropyValues', {
                hintsRequested: hints, platform: data.platform, platformVersion: data.platformVersion
              });
            } catch(e) {}
          }
          return data;
        });
      };
    }
  })();

})();
