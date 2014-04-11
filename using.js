/*
UsingJs script loader and dependency tracker
Copyright 2013 Benjamin McGregor (Ixonal)
Released under the MIT Licence
http://opensource.org/licenses/MIT
*/

( /** @param {Undefined=} undefined */
  function (undefined) {
    "use strict";

    //global variable should be the context of "this" when this closure is run
    var global = this || (0, eval)('this'),

      configuration = global["using"] ? using["configuration"] : null,

      Array = global["Array"],

      //default configuration settings
      defaultConfiguration = {
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

      inPageBlock = false,

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

      //valid environments
      /** @type {string} */
      webbrowser = "wb",
      /** @type {string} */
      webworker = "ww",
      /** @type {string} */
      node = "nd",

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
      domainReg = /([a-zA-Z0-9\.]*:)?\/\/([^\/]+)\/?/,

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
    //  backup: "path/to/backup/source",
    //  conditionally: evaluates.as.boolean,
    //  type: "js" || "css",
    //  noExtension: evaluates.as.boolean,
    //  dependsOn: "path/to/other/source" || "alias" || new dependency || []
    //}

    //convenience functions
    //--------------------------------------------------------//

    //does a shallow copy of one or more objects into the object specified
    //extend(extendee, extender1, extender2, ..., extendern)
    /** @param {...Object} args */
    function extend(args) {
      if (arguments.length <= 1) throw new Error("At least an extender and extendee are required");

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
    /** @param {...Array} args */
    function merge(args) {
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
      if (Array.prototype.indexOf) return Array.prototype.indexOf.apply(arr, obj);

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
    /** @param {Object|string|function()|number} obj 
        @param {boolean=} excludeArrayType */
    function getType(obj, excludeArrayType) {
      if (obj === null) return "null";
      if (obj === undefined) return "undefined";
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
          //a dependency entry (loosely defined) will have a src property
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

    /** @param {Dependency|Object|string} dep1
        @param {Dependency|Object|string} dep2 */
    function dependencyEquals(dep1, dep2) {
      return dep1["src"] === dep2["src"] &&
             dep1["type"] === dep2["type"] &&
             dep1["conditionally"] === dep2["conditionally"] &&
             dep1["dependsOn"] === dep2["dependsOn"] &&
             dep1["noExtension"] === dep2["noExtension"] &&
             dep1["backup"] === dep2["backup"];
    }

    //detects the user's browser and version
    function detectBrowser() {

      var /** @type {{name: ?string, version: ?number}} */ browser = {
        name: unknown,
        version: null
      }, results, v = 3, div, all;

      if (!global.navigator) return { "browser": browser };

      if (results = ieReg.exec(global.navigator.userAgent)) {
        div = document.createElement('div');
        all = div.getElementsByTagName('i');
        while (
          div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
          all[0]
        ) { }

        browser.name = ie;
        
        if (v > 4) {
          //getting the version from feature detection
          browser.version = v;
        } else {
          //getting the version from user agent sniffing
          browser.version = +results[1];
        }

        //the rest use user agent sniffing, but really this is mainly for IE anyways
      } else if (results = chromeReg.exec(global.navigator.userAgent)) {
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
      configuration = extend({}, defaultConfiguration, configuration, options);

      if (!configuration["browser"]) extend(configuration, detectBrowser());

      //determining the environment so that later we will know what method to use to import files
      configuration["environment"] = (typeof module !== 'undefined' && this.module !== module ? node : (global.document ? webbrowser : webworker));

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

      if (initialUsing) configuration["initialUsing"] = global["eval"]("(" + initialUsing + ")");
      if (initialStyleUsing) configuration["initialStyleUsing"] = global["eval"]("(" + initialStyleUsing + ")");
    }

    function emitError(err) {
      if (global["console"]) global["console"]["error"](err);
    }

    //finds the script tag that's referencing "using.js"
    function locateUsingScriptTag() {
      var index, index2,
          allScriptTags = document.getElementsByTagName("script"),
          currentSrc,
          usingJs = ["using.js", "using.min.js", configuration["srcName"]];

      for (index = 0; index < allScriptTags.length; index++) {
        currentSrc = allScriptTags[index].src;
        for (index2 = 0; index2 < usingJs.length; index2++) {
          if (currentSrc.substr(currentSrc.length - usingJs[index2].length, usingJs[index2].length) === usingJs[index2]) return allScriptTags[index];
        }

      }

      return null;
    }

    //determines if a particular location is on another server
    /** @param {string} src */
    function isCrossServerLocation(src) {
      if (!src) return false;
      domainReg.lastIndex = 0; //make sure to start at the beginning

      //let's see what we got
      var domain = domainReg.exec(src);
      if (domain) {
        //there is a domain specified
        if (global.location) {
          //see if the protocol and host are the same
          return domain && (domain[1] !== global.location.protocol || domain[2] !== global.location.host);
        } else {
          //just assuming it's another domain here
          return true;
        }
      } else {
        //if the regex returns null, then it didn't find anything to indicate this is for another server
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
      if (isCrossServerLocation(retVal)) {
        //the request is for another domain probly a CDN
        return retVal + (!configuration["cached"] ? (retVal.indexOf("?") === -1 ? "?_t=" : "&_t=") + timestamp : "");
      } else {
        //looks like a relative path. Make sure the script root and type are included.
        if (!noExtension && retVal.substr(retVal.length - type.length) !== type) {
          //type is not already included, add it
          retVal += "." + type;
        }
        if (retVal.substr(0, 1) === "/") {
          //make sure we don't print out "//" in the source...
          retVal = retVal.substr(1);
        }

        //can trick browsers into getting an uncached copy of a script by adding the current timestamp as a query string parameter
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

    //see if we're working with a javascript or css include
    /** @protected 
        @param {?string|Dependency} src */
    function getUsingType(src) {
      switch (getType(src)) {
        case string:
          if (jsReg.test(src)) {
            return js;
          } else if (cssReg.test(src)) {
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

    //determines if the user is on a version of Internet Explorer less than or equal to 10
    function ieLteTen() {
      return configuration["browser"]["name"] === ie && configuration["browser"]["version"] <= 10;
    }

    function isEmptyObject(obj) {
      if (Object.keys) return Object.keys(obj).length === 0;

      for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
          return false;
      }

      return true;
    }

    //drills down through the given path, starting at the given object, creating any objects neccessary on the way. 
    //splits on '.', '/', or '\' so that file paths are correctly split into namespaces
    /** 
      @protected
      @param {Object} root
      @param {string} path
      @param {Object} content
    */
    function drillPathAndInsert(root, path, content) {
      var pathParts = path.split(/[\.\/\\]+/), context = root, index;

      for (index = 0; index < pathParts.length - 1; index++) {
        context = (context[pathParts[index]] = context[pathParts[index]] || {});
      }

      context[pathParts[pathParts.length - 1]] = content;

      return context;
    }

    //--------------------------------------------------------//


    //configuration
    //--------------------------------------------------------//
    configure(configuration);
    //--------------------------------------------------------//

    //Alias Map
    //--------------------------------------------------------//

    //the alias map keeps track of all relationships between aliases and script locations
    var aliasMap = {
      /**
        @private
        @type {Object.<Object>} 
      */
      map: {},


      //will look through all dependencies to see if it can find a matching one
      /** @protected */
      /** @param {Dependency|Object|string} dep */
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
      /** @param {string} alias
          @param {Dependency|Object|string|Array} src */
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

      //get all sources associated with a given alias
      /** @protected */
      resolveAlias: function (alias) {
        var sources = [], index, innerSources;

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
            if (alias["conditionally"] === undefined || alias["conditionally"] === true) {
              innerSources = this.resolveAlias(alias.src);
              if (innerSources.length > 0 && !(innerSources.length === 1 && innerSources[0] === alias.src)) return innerSources;
              else return [alias];
            } else return sources;
            break;
          case array:
            if (alias.length === 0) return sources;
            for (index = alias.length - 1; index >= 0; index--) {
              merge(sources, this.resolveAlias(alias[index]));
            }
            if (sources.length === 0) merge(sources, alias);
            break;
          default:
            throw new Error("Alias is not a recognized type.");
        }

        return sources.length === 0 ? [alias] : sources;
      }
    }

    //--------------------------------------------------------//


    //Dependencies
    //--------------------------------------------------------//

    /** @constructor 
        @param {string} src 
        @param {?string=} type 
        @param {?boolean=} noExtension 
        @param {?string=} backup 
        @param {?string=} name */
    function Dependency(src, type, noExtension, backup, name) {
      this.src = src;
      this.type = type || js;
      this.backup = backup;
      this.noExtension = noExtension;
      this.resolutionCallbacks = [];
      this.dependencyFor = [];
      this.dependentOn = [];
      this.exports = {};
      if (name) this.name = name;
    }

    extend(Dependency.prototype, /** @lends {Dependency.prototype} */ {
      /** @protected */
      src: null,                  //location of this dependency
      /** @protected */
      backup: null,               //backup location for this dependency
      /** @protected */
      useBackup: false,           //whether or not to use the backup location to load
      /** @protected */
      type: js,                   //the type of this dependency
      /** @protected */
      noExtension: false,         //whether or not to include an extension in the source for this dependency
      /** @protected */
      status: uninitiated,        //status of this dependency
      /** @protected */
      dependencyFor: null,        //dependencies observing this dependency
      /** @protected */
      dependentOn: null,          //dependencies this dependency is observing
      /** @protected */
      resolutionCallbacks: null,  //list of callbacks to run when the dependency is resolved,
      /** @private */
      requestObj: null,           //reference to the DOM element that is including the script into the page
      /** @protected */
      exports: null,              //exports object for a file
      /** @protected */
      name: null,                 //name of this dependency's export

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
        delete this.backup;
        delete this.useBackup;
        delete this.type;
        this.status = destroyed;
      },

      /** @protected */
      finalize: function () {
        var _this = this, index, exports, res;

        //can only finalize if successfully resolved
        if (_this.status !== resolved) return;

        //for a short period, we're in the processing of finalizing
        _this.status = finalizing;

        //notify anything this depends on
        for (index = 0; index < _this.dependentOn.length; index++) {
          if (_this.dependentOn[index].status !== complete) {
            _this.dependentOn[index].notify();
          }
        }

        //run any resolution callbacks
        for (index = 0; index < _this.resolutionCallbacks.length; index++) {
          exports = _this.resolutionCallbacks[index](_this.getDependencyExports(), _this.exports);
          switch (getType(exports, true)) {
            case object:
              extend(_this.exports, exports);
              break;
              
            default:
              if (exports) _this.exports = exports;
              break;
          }
        }

        //now we are officially considered complete
        this.status = complete;

        //notify anything dependent on this
        for (index = 0; index < _this.dependencyFor.length; index++) {
          if (_this.dependencyFor[index].status != complete) {
            _this.dependencyFor[index].notify();
          }
        }

        //check to see if everything else is ready
        if (dependencyMap.testCompleteness()) {
          allReady();
        }
      },

      /** @protected */
      getDependencyExports: function() {
        var _this = this, 
            index, 
            dependency, 
            exports = {};

        for (index = _this.dependentOn.length - 1; index >= 0; index--) {
          dependency = _this.dependentOn[index];
          if (!isEmptyObject(dependency.exports)) {
            drillPathAndInsert(exports, dependency.name || dependency.src, dependency.exports);
          }
        }

        return exports;
      },

      /** @protected */
      notify: function () {
        var _this = this;
        //return if not currently resolved
        if (_this.status !== resolved && _this.status !== error) return;

        if (_this.status === error) {
          if (dependencyMap.testCompleteness()) {
            allReady();
          }
        } else if (_this.isReady()) {
          _this.finalize();
        }
      },

      /** @protected */
      isReady: function (path) {
        var _this = this, currentDep;

        //if the status is complete, then it's definitely ready
        if (_this.status === complete) return true;

        //if the status isn't resolved, there's no way it could be ready
        if (_this.status !== resolved) return false;

        path = path || [];
        path.push(_this);

        for (var index = _this.dependentOn.length - 1; index >= 0; index--) {
          currentDep = _this.dependentOn[index];
          if (indexOf(path, currentDep) !== -1) {
            //if the current dependency was found in the path, just notify the user and keep going
            emitError("Cyclic dependency found (non-terminal): " + (currentDep.name || currentDep.src));
            continue;
          }

          //yes, this is recursive
          if (!currentDep.isReady(path)) return false;
        }

        return true;
      },

      /** @protected */
      /** @param {Dependency} otherDep */
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
      /** @param {function()} callback */
      addResolutionCallback: function (callback) {
        if (getType(callback) !== "function") throw new Error("dependency resolution callback function must be a function.");
        if (this.status === resolved) {
          callback();
        } else {
          this.resolutionCallbacks.push(callback);
        }
      },

      /** @protected */
      /** @param {Dependency|Object|string} dep */
      matches: function (dep) {
        //does this dependency match (different from equal) another dependency?
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
        while ((dependency = unknownDependencies.shift()) !== undefined) {
          //we only want using contexts that haven't been destroyed
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

        _this.notify();
      },

      /** @protected */
      error: function () {
        var _this = this, index, dep, parent = arguments[0], message;

        _this.status = error;

        message = "UsingJs: An error has occurred when loading " + _this.src;
        if (parent) message += " - dependency " + parent.src + " registered an error";
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
        var _this = this, index, dep, onError;

        if (this.status !== initiated) return;

        //first, check to make sure that all of the files this file is dependent on are loaded
        for (index = _this.dependentOn.length - 1; index >= 0; index--) {
          dep = _this.dependentOn[index];
          //since we can't control when this will execute, if there's a dependency that isn't done yet, we're not ready to load yet.
          if (dep.status === loading || dep.status === initiated) return;

          if (dep.status === error) {
            //a dependency had an error, so this file should have an error
            dep.error();
          }
        }

        _this.status = loading;

        //todo: add support for node and webworkers
        if (_this.type === js) {
          //using a script element for Javascript
          _this.requestObj = document.createElement("script");
          _this.requestObj.setAttribute("src", resolveSourceLocation(_this.useBackup ? _this.backup : _this.src, _this.type, _this.noExtension));
          _this.requestObj.setAttribute("type", "text/javascript");
          _this.requestObj.setAttribute("defer", "false");
          _this.requestObj.setAttribute("async", "true");

        } else if (_this.type === css) {
          //using a link element for CSS
          _this.requestObj = document.createElement("link");
          _this.requestObj.setAttribute("type", "text/css");
          _this.requestObj.setAttribute("href", resolveSourceLocation(_this.useBackup ? _this.backup : _this.src, _this.type, _this.noExtension));
          _this.requestObj.setAttribute("rel", "stylesheet");



        } else {
          throw new Error("Attempting to load an unsupported file type: " + _this.type);
        }

        //general error handler
        onError = function () {
          if (_this.backup && !_this.useBackup) {
            emitError("Error occurred while loading " + _this.src + ", attempting to load " + _this.backup);
            _this.useBackup = true;
            _this.status = initiated;
            _this.load();
          } else {
            _this.error();
          }
        }


        if (_this.requestObj.addEventListener) {
          //can use addEventListener
          _this.requestObj.addEventListener("load", function () {
            _this.status = loaded;
            _this.resolve();
          }, true);

          _this.requestObj.addEventListener("error", onError, true);
        } else if (configuration["browser"]["name"] === ie && configuration["browser"]["version"] < 9) {
          //have an older version of IE
          _this.requestObj.onreadystatechange = function () {

            if (_this.requestObj.readyState === "complete" || _this.requestObj.readyState === "loaded") {
              _this.requestObj.onreadystatechange = null;
              _this.status = loaded;
              _this.resolve();
            }
          }
          if (_this.requestObj.attachEvent) {
            _this.requestObj.attachEvent("onerror", onError);
          }
        } else {
          //well hmmm....
          _this.error("Unable to properly attach events with the current browser configuration.");
        }

        //just appending whichever element to the head of the page
        document.getElementsByTagName("head")[0].appendChild(_this.requestObj);
      },

      /** @protected */
      init: function () {
        var _this = this;
        if (_this.status !== uninitiated) return;

        if (_this.type !== usingContext && _this.type !== page) {
          _this.status = initiated;
          _this.load();
        } else {
          _this.status = resolved;
          _this.notify();
        }
      }
    });

    //the dependency map keeps track of individual dependency structures and all dependencies registered with the system
    var dependencyMap = {
      /** @private */
      _dependencies: {},
      /** @private */
      _dependencyCount: 0,

      /** @protected */
      empty: function () {
        return this._dependencyCount === 0;
      },

      //locates a dependency based off of it being considered "interactive"
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

      //locates a dependency based off of the "currentScript" property
      /** @protected */
      locateCurrentScriptDependency: function () {
        var _this = this, index, dependency, currentScript = document["currentScript"];

        if (!currentScript.src) return null;

        for (index in _this._dependencies) {
          dependency = _this._dependencies[index];
          if (dependency.requestObj && dependency.requestObj === currentScript) {
            return dependency;
          }
        }

        return null;
      },

      /** @protected */
      /** @param {Dependency|Object|string} dep */
      locateDependency: function (dep) {
        switch (getType(dep)) {
          case string:
            return this._dependencies[dep] || null;

          case dependency:
            return this._dependencies[dep.src] || null;

          default:
            return null;
        }
      },

      /** @protected */
      /** @param {Dependency|Object|string} dep */
      addDependency: function (dep) {
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

        this._dependencyCount++;

        return this;
      },

      /** @protected */
      /** @param {Dependency|Object|string} dep */
      removeDependency: function (dep) {
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

    var /** @type {Array.<function()>} */ readyCallbacks = [], allReadyFired = false, polling = false;

    function allReady() {
      if (allReadyFired) return;
      allReadyFired = true;
      for (var index = 0; index < readyCallbacks.length; index++) {
        readyCallbacks[index]();
      }
    }

    //because events don't seem to be reliably firing in IE at times, I'm also going to poll
    function startPolling() {
      if (polling) return;
      polling = true;
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
        polling = false;
      }, timeout);
    }

    var /** @type {number} */ usingIndex = 0;

    //--------------------------------------------------------//

    /**
      @param {string|Object|Dependency|function()} src 
      @param {?function()=} callback 
      @param {?string=} name 
      @param {?Dependency=} hdnDepRef 
    */
    function usingMain(src, callback, name, hdnDepRef) {
      var /** @type {Array.<string>} */     sourceList,
          /** @type {number} */             index,
          /** @type {number} */             index2,
          /** @type {Dependency} */         usingDep,
          /** @type {Array.<Dependency>} */ dependencies,
          /** @type {Dependency} */         dep,
          /** @type {Dependency} */         executingDependency,
          /** @type {boolean} */            delayInit,
          /** @type {boolean} */            initialUsing = dependencyMap.empty();


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


      if (hdnDepRef) {
        //sneaky sneaky...
        executingDependency = hdnDepRef;
      } else if (initialUsing || inPageBlock) {
        //the first using call and any calls made in the "page" context are to be dependent on the page itself
        executingDependency = new Dependency(page, page);
        executingDependency.init();
      } else if (ieLteTen()) {
        //earlier versions of IE may not execute scripts in the right order, but they do mark a script as interactive
        executingDependency = dependencyMap.locateInteractiveDependency();
      } else if ("currentScript" in document) {
        //newer browsers will keep track of the currently executing script
        executingDependency = dependencyMap.locateCurrentScriptDependency();
      }

      for (index = sourceList.length - 1; index >= 0; index--) {
        dep = dependencyMap.locateDependency(sourceList[index]);
        if (!dep) {
          //no existing entry for this source file, create one
          switch (getType(sourceList[index], true)) {
            case string:
              delayInit = false;
              dep = new Dependency(sourceList[index], getUsingType(sourceList[index]), false, null);
              break;
            case dependency:
              delayInit = sourceList[index]["dependsOn"];
              dep = new Dependency(sourceList[index]["src"], getUsingType(sourceList[index]), sourceList[index]["noExtension"], sourceList[index]["backup"]);
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

              usingMain(dependsOn, function () {
                myDep.load();
              }, null, myDep);
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
        if (name) executingDependency.name = name;
      } else {
        //we don't currently know what the base file is, so create a fake one and have it get resolved later
        usingDep = new Dependency(usingContext + usingIndex++, usingContext);
        dependencyMap.addDependency(usingDep);

        for (index = dependencies.length - 1; index >= 0; index--) {
          usingDep.dependOn(dependencies[index]);
        }

        if (callback) usingDep.addResolutionCallback(callback);
        if (name) usingDep.name = name;
        usingDep.init();

        if (!initialUsing && !inPageBlock && !ieLteTen()) {
          unknownDependencies.push(usingDep);
        }
      }

      if (configuration["browser"]["name"] === ie) {
        startPolling();
      }
    }

    //public interface
    //--------------------------------------------------------//
    /** 
      @param {string|Object} src
      @param {function()=} callback
    */
    function using(src, callback) {
      usingMain(src, callback);

      return using;
    }

    using.amd = function (name, src, callback) {
      if (arguments.length === 2) {
        //in this case, it's really equivalent to a normal using call
        callback = src;
        src = name;
        name = null;
      }
      usingMain(src, callback, name);
      return using;
    }

    using["amd"] = using.amd;

    //forces using calls to be in the context of the page (as opposed to a script file)
    /** @param {Dependency|Array|function()} opt1 
        @param {function()=} opt2 */
    using.page = function (opt1, opt2) {
      inPageBlock = true;
      switch (getType(opt1, true)) {
        case "function":
          opt1();
          break;
        default:
          using(opt1, opt2);
          break;
      }
      inPageBlock = false;
      return using;
    }
    using["page"] = using.page;

    /** @param {Dependency|Array|function()} opt1 
        @param {function()=} opt2 */
    using.page.css = function (opt1, opt2) {
      inPageBlock = true;
      switch (getType(opt1, true)) {
        case "function":
          opt1();
          break;
        default:
          using.css(opt1, opt2);
          break;
      }
      inPageBlock = false;
      return using;
    }
    using.page["css"] = using.page.css;

    /** @param {function()} callback */
    using.ready = function (callback) {
      readyCallbacks.push(callback);
      return using;
    }
    using["ready"] = using.ready;

    /** @param {Object} config */
    using.config = function (config) {
      configure(config);
      return using;
    }
    using["config"] = using.config;

    /** @param {boolean} condition 
        @param {string|Object|Array|Dependency} src 
        @param {function()=} callback */
    using.conditionally = function (condition, src, callback) {
      if (condition) {
        using(src, callback);
      }

      return using;
    }
    using["conditionally"] = using.conditionally;

    /** @param {string} alias
        @param {string|Object|Array} src */
    using.alias = function (alias, src) {
      aliasMap.addAlias(alias, src);

      return using;
    }
    using["alias"] = using.alias;

    /** @param {string|Object|Array} src 
        @param {function()=} callback */
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

    /** @param {boolean} condition 
        @param {string|Object|Array|Dependency} src 
        @param {function()=} callback */
    using.css.conditionally = function (condition, src, callback) {
      if (condition) {
        using.css(src, callback);
      }

      return using;
    }
    using.css["conditionally"] = using.css.conditionally;

    /** @param {string} alias
        @param {string|Object|Array} src */
    using.css.alias = function (alias, src) {
      //now going to make sure that it's known to be css in particular
      return using.alias(alias, fixSourceForCss(src));
    }
    using.css["alias"] = using.css.alias;

    //--------------------------------------------------------//


    if (!configuration["noConflict"]) global["using"] = using;

    //lastly, if some start scripts were included, call using on them
    if (configuration["initialUsing"]) using.page(configuration["initialUsing"]);
    if (configuration["initialStyleUsing"]) using.page.css(configuration["initialStyleUsing"]);

    return using;
  })();
