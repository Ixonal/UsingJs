/*
UsingJs script loader and dependency tracker
Copyright 2013 Benjamin McGregor (Ixonal)
Released under the MIT Licence
http://opensource.org/licenses/MIT
*/

(function (/** @type {Window} */global, configuration, undefined) {
  "use strict";

  //default configuration settings
  var defaultConfiguration = {
    /** @type {boolean} */
    "noConflict": false,
    /** @type {string} */
    "scriptRoot": "/",
    /** @type {string} */
    "styleRoot": "/",
    /** @type {boolean} */
    "cached": true,
    /** @type {number} */
    "pollingTimeout": 200
  },

  /** @type {Array.<Dependency>} */
  unknownDependencies = [],

  document = global.document,
    
  //various reused type definitions
  /** @type {string} */
  object = "object",
  /** @type {string} */
  string = "string",
  /** @type {string} */
  array = "array",
  /** @type {string} */
  arrayOfString = "array<string>",
  /** @type {string} */
  arrayOfDependency = "array<dependency>",
  /** @type {string} */
  dependency = "dependency",
  /** @type {string} */
  date = "date",
  /** @type {string} */
  regexp = "regexp",
    
  //valid types
  /** @type {string} */
  js = "js",
  /** @type {string} */
  css = "css",
  /** @type {string} */
  usingContext = "usingContext",
  /** @type {string} */
  page = "page",
    
  /** @type {RegExp} */
  ieReg = /MSIE\s*(\d+)/i,
  /** @type {RegExp} */
  chromeReg = /Chrome\/(\d+)/i,
  /** @type {RegExp} */
  firefoxReg = /Firefox\/(\d+)/i,
  /** @type {RegExp} */
  safariReg = /Safari\/(\d+)/i,
  /** @type {RegExp} */
  jsReg = /\.((js)|(jscript))$/i,
  /** @type {RegExp} */
  cssReg = /\.(css)$/i,
  /** @type {RegExp} */
  domainReg = /([a-zA-Z0-9\.]*:)\/\/([^\/]+)\/?/,

  /** @type {string} */
  unknown = "unknown",
  /** @type {string} */
  ie = "ie",
  /** @type {string} */
  firefox = "ff",
  /** @type {string} */
  chrome = "cr",
  /** @type {string} */
  safari = "sf",
    
  /** @type {number} */
  uninitiated = 0,
  /** @type {number} */
  initiated = 1,
  /** @type {number} */
  loading = 2,
  /** @type {number} */
  loaded = 3,
  /** @type {number} */
  resolved = 4,
  /** @type {number} */
  withdrawn = 5,
  /** @type {number} */
  destroyed = 6,
  /** @type {number} */
  finalizing = 7,
  /** @type {number} */
  complete = 8,
  /** @type {number} */
  error = 9,
  
  /** @type {string} */
  interactive = "interactive";

  //general form of dependency: 
  //{
  //  src: "path/to/source",
  //  conditionally: evaluates.as.boolean,
  //  type: "js" || "css",
  //  noExtension: evaluates.as.boolean,
  //  dependsOn: "path/to/other/source" || new dependency
  //}

  //convenience functions
  //--------------------------------------------------------//
  
  //does a shallow copy of one or more objects into the object specified
  //extend(extendee, extender1, extender2, ..., extendern)
  /** @param {...Object} var_args */
  function extend() {
    if(arguments.length <= 1) throw new Error("At least an extender and extendee are required");

    var extendee = arguments[0],
        extender,
        index1, index2;

    for (index1 = 1; index1 < arguments.length; index1++) {
      extender = arguments[index1];
      if (extender) {
        for (index2 in extender) {
          extendee[index2] = extender[index2];
        }
      }
    }

    return extendee;
  }

  //like extend, but for arrays
  /** @param {...Array} var_args */
  function merge() {
    var mergee = arguments[0],
        merger,
        index1, index2;

    if (!mergee || mergee.constructor !== Array) throw new Error("The mergee must be an array.");

    for (index1 = 1; index1 < arguments.length; index1++) {
      merger = arguments[index1];
      if (!merger || merger.constructor !== Array) throw new Error("The merger must be an array.");
      if (merger) {
        for (index2 = 0; index2 < merger.length; index2++) {
          mergee.push(merger[index2]);
        }
      }
    }

    return mergee;
  }

  //uses array implementation if it exists, or a shim if it doesn't
  //didn't want to insert it into the Array prototype, so keeping it in this closure
  /**
    @param {Array} arr
    @param {Object} obj
  */
  function indexOf(arr, obj) {
    if (global.Array.prototype.indexOf) return global.Array.prototype.indexOf.apply(arr, obj);

    for (var index = 0; index < arr.length; index++) {
      if (arr[index] === obj) return index;
    }

    return -1;
  }

  //like above, but uses the dependency's "matches" function for equality
  /**
    @param {Array} arr
    @param {Dependency} dep
  */
  function indexOfDependency(arr, dep) {
    for (var index = 0; index < arr.length; index++) {
      if (arr[index].matches(dep)) return index;
    }

    return -1;
  }

  //based off of typeof, but also discriminates between built in types and arrays of types
  /** @param {Object} obj 
      @param {boolean=} excludeArrayType */
  function getType(obj, excludeArrayType) {
    if (typeof (obj) === object) {
      //lots of things count as objects, so let's get a lil more specific
      if (obj.constructor === global["Array"]) {
        if (excludeArrayType) return array;
        //an array where the inner type can be determined
        if (obj.length > 0) return array + "<" + getType(obj[0]) + ">";
        //an array where the inner type cannot be determined
        else return array + "<object>";
      } else if (obj.constructor === global["RegExp"]) {
        //a regular expression
        return regexp;
      } else if (obj.constructor === global["Date"]) {
        //a date
        return date;
      } else if (obj["src"]) {
        //a dependency entry (loosely defined)
        return dependency;
      } else {
        //general object
        return object;
      }
    } else {
      //type known to typeof
      return typeof (obj);
    }
  }

  function dependencyEquals(dep1, dep2) {
    return dep1["src"] === dep2["src"] &&
           dep1["type"] === dep2["type"] &&
           dep1["conditionally"] === dep2["conditionally"] &&
           dep1["dependsOn"] === dep2["dependsOn"] &&
           dep1["noExtension"] === dep2["noExtension"];
  }

  //detects the user's browser and version
  function detectBrowser() {
    if (!global.navigator) return { "browser": null };

    var browser = /** @dict */ {
      name: unknown,
      version: null
    }, results;

    if (results = ieReg.exec(global.navigator.userAgent)) {
      browser.name = ie;
      browser.version = +results[1];
    } else if(results = chromeReg.exec(global.navigator.userAgent)) {
      browser.name = chrome;
      browser.version = +results[1];
    } else if (results = firefoxReg.exec(global.navigator.userAgent)) {
      browser.name = firefox;
      browser.version = +results[1];
    } else if (results = safariReg.exec(global.navigator.userAgent)) {
      browser.name = safari;
      browser.version = +results[1];
    }

    return { "browser": browser };
  }

  //configures the script
  /** @param {Object} options */
  function configure(options) {
    configuration = extend({}, defaultConfiguration, configuration, options, detectBrowser());

    var scriptTag = locateUsingScriptTag();

    if (scriptTag === null) throw new Error("Could not locate the using.js script include. \nPlease specify the name of the source file in the configuration.");

    var scriptRoot = scriptTag.getAttribute("data-script-root"),
        styleRoot = scriptTag.getAttribute("data-style-root"),
        initialUsing = scriptTag.getAttribute("data-using"),
        initialStyleUsing = scriptTag.getAttribute("data-using-css");

    //set up the script root
    if (scriptRoot && scriptRoot.substr(scriptRoot.length - 1, 1) !== "/") {
      //make sure we have that ending / for later concatination
      scriptRoot += "/";
    }
    configuration["scriptRoot"] = scriptRoot || "/";

    //set up the style root
    if (styleRoot && styleRoot.substr(styleRoot.length - 1, 1) !== "/") {
      //make sure we have that ending / for later concatination
      styleRoot += "/";
    }
    configuration["styleRoot"] = styleRoot || "/";

    if(initialUsing) configuration["initialUsing"] = global["eval"]("(" + initialUsing + ")");
    if(initialStyleUsing) configuration["initialStyleUsing"] = global["eval"]("(" + initialStyleUsing + ")");
  }

  function emitError(err) {
    if (global["console"]) global["console"]["error"](err);
  }

  //finds the script tag that's referencing "using.js"
  function locateUsingScriptTag() {
    var index, index2,
        allScriptTags = document.getElementsByTagName("script"),
        currentSrc,
        usingJs = ["using.js", "using.min.js", configuration.srcName];

    for (index = 0; index < allScriptTags.length; index++) {
      currentSrc = allScriptTags[index].src;
      for (index2 = 0; index2 < usingJs.length; index2++) {
        if (currentSrc.substr(currentSrc.length - usingJs[index2].length, usingJs[index2].length) === usingJs[index2]) return allScriptTags[index];
      }
      
    }

    return null;
  }

  /** @param {string} src */
  function isCrossServerLocation(src) {
    if(src && ((src.length >= 7 && src.substr(0, 7).toLowerCase() === "http://") || (src.length >= 8 && src.substr(0, 8).toLowerCase() === "https://"))) {
      if(global.location) {
        var domain = domainReg.exec(src);
        return domain && (domain[1] !== global.location.protocol || domain[2] !== global.location.host);
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  /**
    @param {string} src
    @param {string} type
    @param {boolean=} noExtension
  */
  function resolveSourceLocation(src, type, noExtension) {
    //for simplicity's sake, I'm assuming src is just a single string
    var retVal = "" + src,
        timestamp = new Date().getTime();
    if(isCrossServerLocation(retVal)) {
      //the request is for another domain probly a CDN
      return retVal + (!configuration["cached"] ? (retVal.indexOf("?") === -1 ? "?_t=" : "&_t=") + timestamp : "");
    } else {
      //looks like a relative path. Make sure the script root and type are included.
      if(!noExtension && retVal.substr(retVal.length - type.length) !== type) {
        //type is not already included, add it
        retVal += "." + type;
      }
      if(retVal.substr(0, 1) === "/") {
        //make sure we don't print out "//" in the source...
        retVal = retVal.substr(1);
      }

      if (!configuration["cached"]) {
        if (retVal.indexOf("?") === -1) {
          retVal += "?_t=" + timestamp;
        } else {
          retVal += "&_t=" + timestamp;
        }
      }

      //use the correct root directory
      switch (type) {
        case js:
          return configuration["scriptRoot"] + retVal;

        case css:
          return configuration["styleRoot"] + retVal;

        default:
          return "/" + retVal;
      }
      
    }
  }

  function getUsingType(src) {
    switch(getType(src)) {
      case string:
        if(jsReg.test(src)) {
          return js;
        } else if(cssReg.test(src)) {
          return css;
        } else {
          return js; //should probably set this as unknown at some point
        }
      case dependency:
        return src.type || js;
    }
  }

  /** @param {string} src
      @param {string} type */
  function ensureHasType(src, type) {
    //make sure the last characters in the src are a '.' followed by the type
    if (src.substr(src.length - (type.length + 1), type.length + 1) !== ("." + type)) {
      src += "." + type;
    }
    return src;
  }

  //make sure that a given source is set up to be css
  function fixSourceForCss(src) {
    var index;

    switch (getType(src, true)) {
      case string:
        src = ensureHasType(src, css);
        break;

      case dependency:
        if (!src["noExtension"]) {
          src["src"] = ensureHasType(src["src"], css);
        }
        src["type"] = css;
        break;

      case array:
        for (index = src.length - 1; index >= 0; index--) {
          src[index] = fixSourceForCss(src[index]);
        }
        break;

    }
    
    return src;
  }

  //--------------------------------------------------------//


  //configuration
  //--------------------------------------------------------//
  configure(configuration);
  //--------------------------------------------------------//

  //Dependency Map
  //--------------------------------------------------------//

  //the alias map keeps track of all relationships between aliases and script locations
  var aliasMap = {
    /**
      @private
      @type {Object.<object>} 
    */
    map: {},


    //will look through all dependencies to see if it can find a matching one
    /** @protected */
    locateDependency: function (dep) {
      var index, index2, depType = getType(dep, true);

      //note, this is O(N * M), but the sets should be fairly small, so it shouldn't cause an issue
      for (index in this.map) {
        for (index2 = this.map[index].length - 1; index2 >= 0; index2--) {
          switch (depType) {
            case string:
              switch (getType(this.map[index][index2], true)) {
                case string:
                  if (this.map[index][index2] === dep) {
                    return this.map[index][index2];
                  }
                  break;
                case dependency:
                  if (this.map[index][index2].src === dep) {
                    return this.map[index][index2];
                  }
                  break;
              }
              break;

            case dependency:
              switch (getType(this.map[index][index2], true)) {
                case string:
                  if (this.map[index][index2] === dep.src) {
                    return this.map[index][index2];
                  }
                  break;
                case dependency:
                  if (dependencyEquals(this.map[index][index2], dep)) {
                    return this.map[index][index2];
                  }
                  break;
              }
              break;
          }
        }
      }
      return null;
    },

    /** @protected */
    addAlias: function (alias, src) {
      if (getType(alias) !== string) throw new Error("The alias must be a string.");

      var index, srcType = getType(src, true), tmp;


      //this would cause infinite recursion
      if (alias === src) throw new Error("Mapping to an equivalently named alias is not allowed.");


      if (srcType === dependency && alias === src["src"]) {
        //this would cause infinite recursion
        throw new Error("Mapping to an equivalently named alias is not allowed.");
      }

      switch (srcType) {
        case array:
          tmp = [];
          for (index = src.length - 1; index >= 0; index--) {
            merge(tmp, this.resolveAlias(src[index]));
          }
          break;

        case string:
        case dependency:
          tmp = this.resolveAlias(src);
          break;
      }

      this.map[alias] = tmp;

      return this;
    },

    /** @protected */
    resolveAlias: function (alias) {
      var sources = [], index;

      switch (getType(alias, true)) {
        case string:
          //resolving a single string
          if (this.map[alias]) {
            for (index = 0; index < this.map[alias].length; index++) {
              merge(sources, this.resolveAlias(this.map[alias][index]));
            }
          } else {
            return [alias];
          }
          break;
        case dependency:
          //resolving a single "dependency"
          return [alias];
          break;
        case array:
          if (alias.length === 0) return sources;
          for (index = alias.length - 1; index >= 0; index--) {
            merge(sources, this.resolveAlias(alias[index]));
          }
          break;
        default:
          throw new Error("Alias is not a recognized type.");
      }

      return sources.length === 0 ? [alias] : sources;
    }
  }

  /** Constructor */
  function Dependency(src, type, noExtension) {
    this.src = src;
    this.type = type || js;
    this.noExtension = noExtension;
    this.resolutionCallbacks = [];
    this.dependencyFor = [];
    this.dependentOn = [];
  }

  extend(Dependency.prototype, {
    /** @protected */
    src: null,                  //location of this dependency
    /** @protected */
    type: js,                   //the type of this dependency
    /** @protected */
    noExtension: false,         //whether or not to include an extension in the source for this dependency
    /** @protected */
    searched: false,            //whether or not this node has been searched through
    /** @protected */
    status: uninitiated,
    /** @protected */
    dependencyFor: null,        //dependencies observing this dependency
    /** @protected */
    dependentOn: null,          //dependencies this dependency is observing
    /** @protected */
    resolutionCallbacks: null,  //list of callbacks to run when the dependency is resolved,
    /** @private */
    requestObj: null,

    /** @protected */
    destroy: function () {
      if (this.status === destroyed) return;

      var index;

      for (index = this.dependencyFor.length - 1; index >= 0; index--) {
        if (this.dependencyFor[index].matches(this)) {
          this.dependencyFor.splice(index, 1);
        }
      }

      for (index = this.dependentOn.length - 1; index >= 0; index--) {
        if (this.dependentOn[index].matches(this)) {
          this.dependentOn.splice(index, 1);
        }
      }

      delete this.dependencyFor;
      delete this.dependentOn;
      delete this.resolutionCallbacks;
      delete this.requestObj;
      delete this.requestObj;
      delete this.src;
      delete this.type;
      delete this.searched;
      this.status = destroyed;
    },

    finalize: function () {
      var _this = this, index;

      _this.status = finalizing;

      //notify anything this depends on
      for (index = 0; index < _this.dependentOn.length; index++) {
        _this.dependentOn[index].notify();
      }

      //run any resolution callbacks
      for (index = 0; index < _this.resolutionCallbacks.length; index++) {
        _this.resolutionCallbacks[index]();
      }

      this.status = complete;

      //notify anything dependent on this
      for (index = 0; index < _this.dependencyFor.length; index++) {
        _this.dependencyFor[index].notify();
      }

      if (dependencyMap.testCompleteness()) {
        allReady();
      }
    },

    /** @protected */
    notify: function () {
      var _this = this;
      //return if not currently resolved
      if (_this.status !== resolved && _this.status !== error) return;

      //a dependency resolved, test to see if this one can resolve
      var index, ready = _this.isReady(); 

      if (ready) {
        _this.finalize();
      } else if (_this.status === error) {
        if (dependencyMap.testCompleteness()) {
          allReady();
        }
      }
    },

    /** @protected */
    isReady: function () {
      var _this = this;
      if (_this.status !== resolved && _this.status !== complete) return false;

      for (var index = _this.dependentOn.length - 1; index >= 0; index--) {
        if (!_this.dependentOn[index].isReady()) return false;
      }

      return true;
    },

    /** @protected */
    dependOn: function (otherDep) {
      var _this = this;

      //type checking
      if (!otherDep || otherDep.constructor !== Dependency) throw new Error("The other dependency must be a valid Dependency object.");

      //don't want to depend on ourselves, now do we?
      if (_this.matches(otherDep)) return;

      //check to see if we already depend on the other dependency
      var index = indexOfDependency(_this.dependentOn, otherDep);

      //if not, depend on it
      if (index === -1) {
        otherDep.dependencyFor.push(_this);
        _this.dependentOn.push(otherDep);
      }

      if (otherDep.status === resolved) {
        //other dependency is already resolved, notify self 
        _this.notify();
      }
    },

    /** @protected */
    addResolutionCallback: function (callback) {
      if (getType(callback) !== "function") throw new Error("dependency resolution callback function must be a function.");
      if (this.stautus === resolved) {
        callback();
      } else {
        this.resolutionCallbacks.push(callback);
      }
    },

    /** @protected */
    matches: function (dep) {
      var depType = getType(dep);

      if (depType === string) {
        return this.src === dep;
      } else if (depType === dependency) {
        return this.src === dep.src && this.type == dep.type;
      }
    },

    /** 
      @protected 
      @param {Dependency} dep
    */
    removeDependencyOn: function (dep) {
      if (this.matches(dep)) return;

      var index = indexOfDependency(this.dependentOn, dep);

      if (index >= 0) {
        //remove the other entity from this entity
        this.dependentOn.splice(index, 1);
      }

      index = indexOfDependency(dep.dependencyFor, this);

      if (index >= 0) {
        //remove this entity from the other entity
        dep.dependencyFor.splice(index, 1);
      }
    },


    /** @protected */
    resolve: function () {
      if (this.status !== loaded) return;

      var _this = this, index, index2, dependencies, dependency, storedDependencies, dependentOn, dependencyIndex;

      //incude was loaded and the code should have been executed, so find any unknown dependencies and associate them with this dependency
      dependencies = unknownDependencies.splice(0, unknownDependencies.length);
      //debugger;
      for (index = 0; index < dependencies.length; index++) {
        dependency = dependencies[index];
        if (dependency.type !== usingContext || dependency.status === destroyed) continue;
        storedDependencies = [];

        for (index2 = dependency.dependentOn.length - 1; index2 >= 0; index2--) {
          //move any observed dependencies over that aren't already included
          dependentOn = dependency.dependentOn[index2];
          _this.dependOn(dependentOn);

          //now remove the unknown dependency from the inner dependency's observing dependencies list and add this one
          dependency.removeDependencyOn(dependentOn);
        }

        //move all associated callbacks to this dependency
        for (index2 = dependency.resolutionCallbacks.length - 1; index2 >= 0; index2--) {
          _this.addResolutionCallback(dependency.resolutionCallbacks[index2]);
        }

        //at this point, remove the outstanding using context
        dependencyMap.removeDependency(dependency);
      }

      _this.status = resolved;

      if(_this.status !== destroyed) _this.notify();
    },

    error: function () {
      var _this = this, index, dep, parent = arguments[0], message;

      _this.status = error;

      message = "UsingJs: An error has occurred when loading " + _this.src;
      if(parent) message += " - dependency " + parent.src + " registered an error";
      emitError(message);

      for (index = _this.dependencyFor.length - 1; index >= 0; index--) {
        dep = _this.dependencyFor[index];
        if (dep.status !== error && dep.status !== withdrawn && dep.status !== complete) {
          dep.error(_this);
        }
      }

      _this.notify();
    },

    /** @protected */
    load: function () {
      var _this = this, index, dep;

      if (this.status !== initiated) return;

      //first, check to make sure that none of the files this file is dependent on are not loaded
      for (index = _this.dependentOn.length - 1; index >= 0; index--) {
        dep = _this.dependentOn[index];
        if (dep.status === loading || dep.status === initiated) return;

        if (dep.status === error) {
          //a dependency had an error, so this file should have an error
          dep.error();
        }
      }

      _this.status = loading;

      if (_this.type === js) {
        //using a script element
        _this.requestObj = document.createElement("script");
        _this.requestObj.setAttribute("src", resolveSourceLocation(_this.src, _this.type, _this.noExtension));
        _this.requestObj.setAttribute("type", "text/javascript");
        _this.requestObj.setAttribute("defer", "false");
        _this.requestObj.setAttribute("async", "true");

      } else if (_this.type === css) {
        //using a link element
        _this.requestObj = document.createElement("link");
        _this.requestObj.setAttribute("type", "text/css");
        _this.requestObj.setAttribute("href", resolveSourceLocation(_this.src, _this.type, _this.noExtension));
        _this.requestObj.setAttribute("rel", "stylesheet");


      } else {
        throw new Error("Attempting to load an unsupported file type: " + _this.type);
      }

      //register event handlers
      if (configuration["browser"]["name"] === ie && configuration["browser"]["version"] < 9) {
        _this.requestObj.onreadystatechange = function () {

          if (_this.requestObj.readyState === "complete" || _this.requestObj.readyState === "loaded") {
            _this.requestObj.onreadystatechange = null;
            _this.status = loaded;
            _this.resolve();
          }
        }
        //global.onerror = function (msg, url, lineNum) {
        //  emitError("test");
        //};
        if (_this.requestObj.attachEvent) {
          _this.requestObj.attachEvent("onerror", function () {
            _this.error();
          });
        }
      } else {
        _this.requestObj.addEventListener("load", function () {
          _this.status = loaded;
          _this.resolve();
        }, true);

        _this.requestObj.addEventListener("error", function (e) {
          _this.error();
        }, true);
      }

      //just appending whichever element to the head of the page
      document.getElementsByTagName("head")[0].appendChild(_this.requestObj);
    },

    /** @protected */
    init: function () {
      var _this = this;
      if (_this.status !== uninitiated) return; //throw new Error("Attempting to initiate a previously initiated dependency.");

      _this.status = initiated;

      if (_this.type !== usingContext && _this.type !== page) {
          _this.load();
      } else {
        _this.notify();
      }
    }
  });
  
  //the dependency map keeps track of individual dependency structures and all dependencies registered with the system
  var dependencyMap = {
    /** @private */
    _dependencies: {},
    /** @private */
    _depenencyCount: 0,

    /** @protected */
    clearSearchedFlags: function() {
      for (var index in this._dependencies) {
        this._dependencies[index].searched = false;
      }
    },

    /** @protected */
    empty: function() {
      return this._depenencyCount === 0;
    },

    /** @protected */
    locateInteractiveDependency: function () {
      var index, dependency;

      for (index in this._dependencies) {
        dependency = this._dependencies[index];
        if (dependency.requestObj && dependency.requestObj.readyState === interactive) {
          return dependency;
        }
      }

      return null;
    },

    /** @protected */
    locateDependency: function (dep) {
      switch(getType(dep)) {
        case string:
          return this._dependencies[dep] || null;
          
        case dependency:
          return this._dependencies[dep.src] || null;

        default: 
          return null;
      }
    },

    /** @protected */
    addDependency: function(dep) {
      if (!this.locateDependency(dep)) {
        var newDependency;

        switch (getType(dep)) {
          case string:
            newDependency = new Dependency(dep, js);
            newDependency.init();
            this._dependencies[dep] = newDependency;
            break;

          case dependency:
            this._dependencies[dep.src] = dep;
            break;
        }
      }

      this._depenencyCount++;

      return this;
    },

    /** @protected */
    removeDependency: function(dep) {
      switch (getType(dep)) {
        case string:
          var iDep = this.locateDependency(dep);
          return this.removeDependency(iDep);
          break;

        case dependency:
          delete this._dependencies[dep.src];
          dep.destroy();
          break;

      }

      this._dependencyCount--;

      return this;
    },

    /** @protected */
    resolve: function () {
      //go through existing dependencies and load where needed
      for (var index in this._dependencies) {
        if (!this._dependencies[index].initiated) {
          this._dependencies[index].resolve();
        }
      }
    },

    notifyAll: function() {

    },

    /** @protected */
    testCompleteness: function () {
      var index, status;
      
      //test to see if all known dependencies are in a terminal state
      for (index in this._dependencies) {
        status = this._dependencies[index].status;
        if (status !== complete && status !== withdrawn && status !== destroyed && status !== error) {
          return false;
        }
      }

      return true;
    }
  }

  var /** @type {Array.<function()>} */ readyCallbacks = [], allReadyFired = false, poll;

  function allReady() {
    if (allReadyFired) return;
    allReadyFired = true;
    for (var index = 0; index < readyCallbacks.length; index++) {
      readyCallbacks[index]();
    }
  }

  //because events don't seem to be reliably firing in IE at times, I'm also going to poll
  function startPolling() {
    var timeout = configuration["pollingTimeout"];
    setTimeout(function poll() {
      if (!allReadyFired) {
        if (dependencyMap.testCompleteness()) {
          allReady();
        } else {
          setTimeout(poll, timeout);
        }
      }
      //at this point, just let it die off
    }, timeout);
  }

  var /** @type {number} */ usingIndex = 0;

  //--------------------------------------------------------//

  //public access
  //--------------------------------------------------------//
  function using(src, callback) {
    var /** @type {Array.<string>} */     sourceList, 
        /** @type {number} */             index,
        /** @type {number} */             index2,
        /** @type {Dependency} */         usingDep,
        /** @type {Array.<Dependency>} */ dependencies,
        /** @type {Dependency} */         dep,
        /** @type {Dependency} */         executingDependency,
        /** @type {boolean} */            delayInit,
        /** @type {boolean} */            initialUsing = dependencyMap.empty(),
        /** @type {Dependency} */         hdnDepRef = arguments[2];


    switch (getType(src, true)) {
      case "function":
        //if src is a function, then this is an "all ready" shortcut
        return using.ready(src);

      case string:
      case dependency:
      case array:
        //make sure to get all sources from aliases
        sourceList = aliasMap.resolveAlias(src);
        break;

      default:
        throw new Error("Valid dependencies must be entered");
    }

    dependencies = [];

    if (initialUsing) {
      //initially, we're going to create a base "page" type dependency
      executingDependency = new Dependency(page, page);
      executingDependency.init();
    } else if (hdnDepRef) {
      //sneaky sneaky...
      executingDependency = hdnDepRef;
    } else {
      //earlier versions of IE may not execute scripts in the right order, but they do mark a script as interactive
      if (configuration["browser"]["name"] === ie && configuration["browser"]["version"] <= 10) {
        executingDependency = dependencyMap.locateInteractiveDependency();
      }
    }

    for (index = sourceList.length - 1; index >= 0; index--) {
      dep = dependencyMap.locateDependency(sourceList[index]);
      if (!dep) {
        //no existing entry for this source file, create one
        switch (getType(sourceList[index], true)) {
          case string:
            delayInit = false;
            dep = new Dependency(sourceList[index], getUsingType(sourceList[index]), false);
            break;
          case dependency:
            delayInit = sourceList[index]["dependsOn"];
            dep = new Dependency(sourceList[index]["src"], getUsingType(sourceList[index]), sourceList[index]["noExtension"]);
            break;
        }
        dependencyMap.addDependency(dep);
        if (delayInit) {
          //this dependency is dependent on another dependency...
          //leave the dependency uninitialized, and run a using call on the other 
          //dependency, with a callback that initializes the original dependency.
          (function () {
            var myDep = dep,
                dependsOn = sourceList[index]["dependsOn"];

            using(dependsOn, function () {
              myDep.load();
            }, myDep);
            myDep.init();
          })();
        } else {
          //initializing normally
          dep.init();
        }
      }
      dependencies.push(dep);
    }
    
    if (executingDependency) {
      //in this case, we know up front what the base file is, so make it depend on the new dependencies
      for (index = dependencies.length - 1; index >= 0; index--) {
        executingDependency.dependOn(dependencies[index]);
        if (hdnDepRef) {
          dependencies[index].addResolutionCallback(callback);
        }
      }
      if (callback && !hdnDepRef) {
        executingDependency.addResolutionCallback(callback);
      }
    } else {
      //we don't currently know what the base file is, so create a fake one and have it get resolved later
      usingDep = new Dependency(usingContext + usingIndex++, usingContext);
      dependencyMap.addDependency(usingDep);

      for (index = dependencies.length - 1; index >= 0; index--) {
        usingDep.dependOn(dependencies[index]);
      }

      if (callback) usingDep.addResolutionCallback(callback);
      usingDep.init();

      if (!initialUsing) {
        unknownDependencies.push(usingDep);
      }
    }

    if (configuration["browser"]["name"] === ie) {
      startPolling();
    }

    return using;
  }

  using.ready = function (callback) {
    readyCallbacks.push(callback);
  }
  using["ready"] = using.ready;

  using.config = function (config) {
    configure(config);
    return using;
  }
  using["config"] = using.config;

  using.conditionally = function (condition, src, callback) {
    if (condition) {
      using(src, callback);
    }

    return using;
  }
  using["conditionally"] = using.conditionally;

  using.alias = function (alias, src) {
    aliasMap.addAlias(alias, src);

    return using;
  }
  using["alias"] = using.alias;

  using.css = function (src, callback) {
    var index;

    switch (getType(src, true)) {
      case string:
      case dependency:
        return using(fixSourceForCss(src), callback);

      case array:
        for (index = src.length - 1; index >= 0; index--) {
          src[index] = fixSourceForCss(src[index]);
        }
        return using(src, callback);

      default:
        throw new Error("Valid dependencies must be entered");
    }
  }
  using["css"] = using.css;

  using.css.conditionally = function (condition, src, callback) {
    if (condition) {
      using.css(src, callback);
    }

    return using;
  }
  using["css"]["conditionally"] = using.css.conditionally;

  using.css.alias = function (alias, src) {
    //now going to make sure that it's known to be css in particular
    return using.alias(alias, fixSourceForCss(src));
  }
  using["css"]["alias"] = using.css.alias;

  //--------------------------------------------------------//


  if (!configuration.noConflict) global["using"] = using;

  //lastly, if some start scripts were included, call using on them
  if (configuration.initialUsing) using(configuration.initialUsing);
  if (configuration.initialStyleUsing) using.css(configuration.initialStyleUsing);

  return using;
})(window || global, ((window || global)["using"] ? using["configuration"] : null));
