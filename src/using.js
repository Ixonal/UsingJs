/** @preserve
UsingJs script loader and dependency tracker
Copyright 2013-2016 Benjamin McGregor (Ixonal)
Released under the MIT Licence
http://opensource.org/licenses/MIT
*/

( /** @param {Undefined=} undefined */
  function (undefined) {
    "use strict";

    //global variable should be the context of "this" when this closure is run
    var global = this || (0, eval)('this'),

      configuration = global["using"] ? global["using"]["config"] : null,

      Array = global["Array"],

      //default configuration settings
      defaultConfiguration = {
        /** @type {string} */
        "scriptRoot": "/",
        /** @type {string} */
        "styleRoot": "/",
        /** @type {boolean} */
        "cached": true,
        /** @type {number} */
        "pollingTimeout": 200,
        /** @type {boolean} */
        "minified": false,
        /** @type {boolean} */
        "debug": false
      },

      /** @type {Array.<Dependency>} */
      unknownDependencies = [],

      inPageBlock = false,

      document = global.document || {
        getElementsByTagName: function() { return []; }
      },

      //various reused type definitions
      /** @type {string} 
          @const */
      object = "object",
      /** @type {string} 
          @const */
      string = "string",
      /** @type {string} 
          @const */
      array = "array",
      /** @type {string} 
          @const */
      func = "function",
      /** @type {string} 
          @const */
      arrayOfString = "array<string>",
      /** @type {string} 
          @const */
      arrayOfDependency = "array<dependency>",
      /** @type {string} 
          @const */
      dependency = "dependency",
      /** @type {string} 
          @const */
      date = "date",
      /** @type {string} 
          @const */
      regexp = "regexp",

      //valid types
      /** @type {string} 
          @const */
      js = "js",
      /** @type {string} 
          @const */
      css = "css",
      /** @type {string} 
          @const */
      usingContext = "<||usingContext||>",
      /** @type {string} 
          @const */
      pageType = "<||page||>",
      /** @type {string}
          @const */
      pageSrc = "page",

      //valid environments
      /** @type {string} 
          @const */
      webbrowser = "wb",
      /** @type {string} 
          @const */
      webworker = "ww",
      /** @type {string} 
          @const */
      node = "nd",

      /** @type {RegExp} */
      ieReg = /(MSIE\s*(\d+))|(rv:(\d+\.?\d*))/i,
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

      /** @type {string} 
          @const */
      unknown = "unknown",
      /** @type {string} 
          @const */
      ie = "ie",
      /** @type {string} 
          @const */
      firefox = "ff",
      /** @type {string} 
          @const */
      chrome = "cr",
      /** @type {string} 
          @const */
      safari = "sf",

      /** @type {number} 
          @const */
      uninitiated = 0,
      /** @type {number} 
          @const */
      initiated = 1,
      /** @type {number} 
          @const */
      loading = 2,
      /** @type {number} 
          @const */
      loaded = 3,
      /** @type {number} 
          @const */
      resolved = 4,
      /** @type {number} 
          @const */
      withdrawn = 5,
      /** @type {number} 
          @const */
      destroyed = 6,
      /** @type {number} 
          @const */
      finalizing = 7,
      /** @type {number} 
          @const */
      complete = 8,
      /** @type {number} 
          @const */
      error = 9,

      terminalStatuses = {},
      readyStatuses = {},
      completingStatuses = {},

      /** @type {string} */
      interactive = "interactive";

    terminalStatuses[complete] = true;
    terminalStatuses[withdrawn] = true;
    terminalStatuses[destroyed] = true;
    terminalStatuses[error] = true;
    
    readyStatuses[resolved] = true;
    readyStatuses[finalizing] = true;
    readyStatuses[complete] = true;
    
    completingStatuses[finalizing] = true;
    completingStatuses[complete] = true;

    var handlers = {};
    
    //sets an event handler
    /** 
     * @protected 
     * @param {string} event
     * @param {function()} handler
     */
    function on(event, handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }

    //triggers an event
    /** 
     * @protected
     * @param {string} event
     * @param {?=} data
    */
    function emit(event, data) {
      var evtHandlers = handlers[event];
      if (!evtHandlers) return;

      for(var c = 0, length = evtHandlers.length; c < length; c++) evtHandlers[c].call(null, extend({}, data));
    }
    
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
          index1, index2, length;

      for (index1 = 1, length = arguments.length; index1 < length; index1++) {
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
          index1, index2,
          length1, length2;

      if (!mergee || mergee.constructor !== Array) throw new Error("The mergee must be an array.");

      for (index1 = 1, length1 = arguments.length; index1 < length1; index1++) {
        merger = arguments[index1];
        if (!merger || merger.constructor !== Array) throw new Error("The merger must be an array.");
        for (index2 = 0, length2 = merger.length; index2 < length2; index2++) {
          mergee.push(merger[index2]);
        }
      }

      return mergee;
    }

    /**
     * Native version is slower due to sanity checking. Since I know the data here will be sane, 
     * there is no need for all that.
     * @param {Array} arr
     * @param {Object} obj
     */
    function indexOf(arr, obj) {
      for (var index = 0, length = arr.length; index < length; index++) {
        if (arr[index] === obj) return index;
      }

      return -1;
    }

    //like above, but uses the dependency's "matches" function for equality
    /**
     * like above, but uses the dependency's "matches" function for equality
     * @param {Array} arr
     * @param {Dependency} dep
     */
    function indexOfDependency(arr, dep) {
      for (var index = 0, length = arr.length; index < length; index++) {
        if (arr[index].matches(dep)) return index;
      }

      return -1;
    }

    /** 
     * based off of typeof, but also discriminates between built in types and arrays of types (if desired)
     * @param {Object|string|function()|number} obj 
     * @param {boolean=} excludeArrayType 
     */
    function getType(obj, excludeArrayType) {
      if (obj === null) return "null";
      if (obj === undefined) return "undefined";
      if (typeof (obj) === object) {
        //lots of things count as objects, so let's get a lil more specific
        if (Object.prototype.toString.call(obj) === "[object Array]") {
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
          browser.version = +(results[2] || results[4]);
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
      configuration["environment"] = (typeof global["module"] !== 'undefined' && this["module"] !== global["module"] ? node : (global['document'] ? webbrowser : webworker));

      var scriptTag = locateUsingScriptTag(),
          scriptRoot, styleRoot, initialUsing, initialStyleUsing;

      //if we found a script tag, go ahead and check for some info that may be included in it
      if(scriptTag) {
        scriptRoot = scriptTag.getAttribute("data-script-root") || (options && options["scriptRoot"]) || configuration["scriptRoot"];
        styleRoot = scriptTag.getAttribute("data-style-root") || (options && options["styleRoot"]) || configuration["styleRoot"];
        initialUsing = scriptTag.getAttribute("data-using");
        initialStyleUsing = scriptTag.getAttribute("data-using-css");
      }
      
      //set up the script root
      scriptRoot = scriptRoot || configuration["scriptRoot"];
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

      //I know eval is evil, but in this case, the dev would be doing it to his/her self.
      if (initialUsing) configuration["initialUsing"] = global["eval"]("(" + initialUsing + ")");
      if (initialStyleUsing) configuration["initialStyleUsing"] = global["eval"]("(" + initialStyleUsing + ")");
    }

    function emitError(err) {
      if (configuration["debug"] && global["console"]) global["console"]["error"](err);
    }

    function emitWarning(warn) {
      if (configuration["debug"] && global["console"]) global["console"]["warn"](warn);
    }

    //finds the script tag that's referencing "using.js"
    function locateUsingScriptTag() {
      var index, index2, length, length2,
          allScriptTags = document.getElementsByTagName("script"),
          currentSrc,
          usingJs = ["using.js", "using.min.js", configuration["srcName"]],
          currentSrc2;

      for (index = 0, length = allScriptTags.length; index < length; index++) {
        currentSrc = allScriptTags[index].src;
        for (index2 = 0, length2 = usingJs.length; index2 < length2; index2++) {
          currentSrc2 = usingJs[index2];
          if (currentSrc2 && currentSrc.substr(currentSrc.length - currentSrc2.length, currentSrc2.length) === currentSrc2) return allScriptTags[index];
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
          return domain[1] !== global.location.protocol || domain[2] !== global.location.host;
        } else {
          //just assuming it's another domain here
          return true;
        }
      } else {
        //if the regex returns null, then it didn't find anything to indicate this is for another server
        return false;
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
            return js; //can't infer what we have, assume it's javascript
          }
        case dependency:
          if (src.type === pageType || src.type === usingContext) return js;
          return src.type || getUsingType(src.src);
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
          index = src.length;
          while (index--) {
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
      if (typeof (obj) != object) return false; //not an object to begin with, so being empty is meaningless

      if (Object.keys) return Object.keys(obj).length === 0;

      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) return false;
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
      var pathParts = path.split(/[\.\/\\]+/), context = root, index, length;

      for (index = 0, length = pathParts.length - 1; index < length; index++) {
        context = (context[pathParts[index]] = context[pathParts[index]] || {});
      }

      context[pathParts[pathParts.length - 1]] = content;

      return context;
    }

    function followPathToEnd(root, path) {
      var pathParts = path.split(/[\.\/\\]+/), context = root, index, length;

      for (index = 0, length = pathParts.length; index < length; index++) {
        context = context[pathParts[index]];
        if (context === undefined) return null;
      }

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
          index2 = this.map[index].length;
          while (index2--) {
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
            index = src.length;
            while (index--) {
              merge(tmp, this.resolveAlias(src[index]));
            }
            break;

          case string:
          case dependency:
            tmp = this.resolveAlias(src);
            break;

          default:
            throw Error("Unknown dependency type found");
        }

        this.map[alias] = tmp;

        return this;
      },

      //get all sources associated with a given alias
      /** @protected */
      resolveAlias: function (alias) {
        var sources = [], index, length, innerSources;

        switch (getType(alias, true)) {
          case string:
            //resolving a single string
            if (this.map[alias]) {
              for (index = 0, length = this.map[alias].length; index < length; index++) {
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

          case array:
            if (alias.length === 0) return sources;
            index = alias.length;
            while (index--) {
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
        @param {?string=} name 
        @param {?boolean=} minified
        @param {?string=} exportProp */
    function Dependency(src, type, noExtension, backup, name, minified, exportProp) {
      this.src = src;
      this.type = type || getUsingType(src);
      this.backup = backup;
      this.noExtension = noExtension;
      this.resolutionCallbacks = [];
      this.resolutionDeps = [];
      this.dependencyFor = [];
      this.dependentOn = [];
      this.exports = {};
      this.exportProp = exportProp;
      if (name) this.name = name;
      this.minified = minified !== undefined ? minified : configuration["minified"];
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
      /** @protected */
      resolutionDeps: null,       //list of dependencies for each resolution callback
      /** @private */
      requestObj: null,           //reference to the DOM element that is including the script into the page
      /** @protected */
      exports: null,              //exports object for a file
      /** @protected */
      name: null,                 //name of this dependency's export
      /** @protected */
      minified: false,            //whether or not to try to load a minified version of the source (appends .min to the src)
      /** @protected */
      exportProp: null,           //name of a global property which counts as the exports for this dependency (if exports doesn't contain it)

      /** @protected */
      destroy: function () {
        if (this.status === destroyed) return;

        var index;

        index = this.dependencyFor.length;
        while (index--) {
          if (this.dependencyFor[index].matches(this)) {
            this.dependencyFor.splice(index, 1);
          }
        }

        index = this.dependentOn.length;
        while (index--) {
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
        var _this = this, index, exports;

        //can only finalize if successfully resolved
        if (_this.status !== resolved) return;

        //for a short period, we're in the processing of finalizing
        _this.status = finalizing;

        //notify anything this depends on
        index = _this.dependentOn.length;
        while (index--) {
          if (_this.dependentOn[index].status !== complete) {
            _this.dependentOn[index].notify();
          }
        }

        //run any resolution callbacks
        _this.runResolutionCallbacks();

        //now we are officially considered complete
        _this.status = complete;
        emit("dependency-status-terminal");

        //notify anything dependent on this
        index = _this.dependencyFor.length;
        while (index--) {
          var parentDep = _this.dependencyFor[index];
          if (parentDep.status != complete) {
            parentDep.notify();
          } else {
            parentDep.runResolutionCallbacks();
          }
        }

        //check to see if everything else is ready
        if (_this.type !== pageType && dependencyInterface.testCompleteness()) {
          allReady();
        }
      },
      
      setExports: function(exports) {
        switch (getType(exports, true)) {
          case object:
            extend(this.exports, exports);
            break;

          default:
            if (exports) this.exports = exports;
            break;
        }
      },

      /** @protected */
      getDependencyExports: function (deps) {
        var _this = this,
            index,
            dep,
            exports = {};
            
        deps = deps || _this.dependentOn;

        index = deps.length;
        while (index--) {
          dep = deps[index];
          if (!isEmptyObject(dep.exports)) {
            drillPathAndInsert(exports, dep.name || dep.src, dep.exports);
          } else if (dep.exportProp) {
            drillPathAndInsert(exports, dep.name || dep.src, followPathToEnd(global, dep.exportProp));
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
          if (dependencyInterface.testCompleteness()) {
            allReady();
          }
        } else if (_this.isReady()) {
          _this.finalize();
        }
      },
      
      dependenciesReady: function(path) {
        var _this = this, 
            currentDep, 
            index = _this.dependentOn.length;
        
        path = path || [];
        path.push(_this);
        
        while(index--) {
          currentDep = this.dependentOn[index];
          
          if (indexOf(path, currentDep) !== -1) {
            // if the current dependency was found in the path, just notify the user and keep going
            if (configuration["debug"]) {
              var errorMsg = "Cyclic dependency found (non-terminal): \n", errorIndex;

              for (errorIndex = 0; errorIndex < path.length; errorIndex++) {
                errorMsg += (path[errorIndex] === currentDep) ? "--->" : "    ";
                errorMsg += (path[errorIndex].name || path[errorIndex].src) + "\n";
              }

              errorMsg += "--->" + (currentDep.name || currentDep.src);

              emitWarning(errorMsg);
            }
          } else {
            if(!currentDep.isComplete()) return false;
          }
        }
        
        return true;
      },

      /** @protected */
      isReady: function (path) {
        return this.status in readyStatuses && this.dependenciesReady(path);
      },
      
      isComplete: function(path) {
        return this.status in completingStatuses && this.dependenciesReady(path);
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
      /** @param {Array=} callbacks */
      /** @param {Array=} callbackDeps */
      runResolutionCallbacks: function(callbacks, callbackDeps) {
        //if callbacks aren't provided, use the ones already added to the dependency
        callbacks = (callbacks || this.resolutionCallbacks).slice(0);
        callbackDeps = (callbackDeps || this.resolutionDeps).slice(0);
        
        if(!this.isReady()) {
          var i = callbacks.length;
          while(i--) this.addResolutionCallback(callbacks[i]);
          return;
        }
        
        var callback, deps, exports, index;
            
        //run all the callbacks, setting exports as needed
        while((callback = callbacks.pop()) && (deps = callbackDeps.pop())) {
          exports = callback.call(null, this.getDependencyExports(deps), this.exports);
          this.setExports(exports);
          
          index = indexOf(this.resolutionCallbacks, callback);
          if(index > -1) {
            this.resolutionCallbacks.splice(index, 1);
          }
        }
      },

      /** @protected */
      /** @param {function()} callback */
      /** @param {Array=} callbackDeps */
      addResolutionCallback: function (callback, callbackDeps) {
        if (getType(callback) !== func) throw new Error("dependency resolution callback function must be a function.");
        
        if (this.isComplete()) {
          this.runResolutionCallbacks([callback], [callbackDeps]);
        } else {
          if(indexOf(this.resolutionCallbacks, callback) === -1) {
            this.resolutionCallbacks.push(callback);
            this.resolutionDeps.push(callbackDeps);
          }
        }
      },

      /** 
       * does this dependency match (different from equal) another dependency?
       * @protected 
       * @param {Dependency|Object|string} dep
       */
      matches: function (dep) {
        var depType = getType(dep);

        if (depType === string) {
          return this.src === dep;
        } else if (depType === dependency) {
          return this.src === dep.src && this.type == dep.type;
        }

        return false;
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

        var _this = this, index, dep, dependentOn;

        //incude was loaded and the code should have been executed, so find any unknown dependencies and associate them with this dependency
        while ((dep = unknownDependencies.shift()) !== undefined) {
          //we only want using contexts that haven't been destroyed
          if (dep.type !== usingContext || dep.status === destroyed) continue;

          //looks like these were set, but since we didn't have a hard reference before, we couldn't assign them properly. go ahead and do it here
          if (dep.name) _this.name = dep.name;
          if (dep.noExtension) _this.noExtension = dep.noExtension;
          if (dep.minified !== undefined) _this.minified = dep.minified;

          index = dep.dependentOn.length;
          while (index--) {
            //move any observed dependencies over that aren't already included
            dependentOn = dep.dependentOn[index];
            _this.dependOn(dependentOn);

            //now remove the unknown dependency from the inner dependency's observing dependencies list and add this one
            dep.removeDependencyOn(dependentOn);
          }

          //move all associated callbacks to this dependency
          index = dep.resolutionCallbacks.length;
          while (index--) {
            _this.addResolutionCallback(dep.resolutionCallbacks[index]);
          }

          //at this point, remove the outstanding using context
          dependencyInterface.removeDependency(dep);
        }

        _this.status = resolved;

        _this.notify();
      },

      /** @protected */
      error: function () {
        var _this = this, index, dep, target, parent = arguments[0], message;

        _this.status = error;
        emit("dependency-status-terminal");
        emit("dependency-failed", { dependency: _this });

        target = _this.useBackup ? _this.backup : _this.src;
        if (target === pageSrc) target = "page";
        if (target === usingContext) target = "using context";

        message = "UsingJs: An error has occurred when loading " + target;

        if (parent) {
          target = parent.useBackup ? parent.backup : parent.src;
          if (target === pageSrc) target = "page";
          if (target === usingContext) target = "using context";
          message += " - dependency " + target + " registered an error";
        }
        emitError(message);

        index = _this.dependencyFor.length;
        while (index--) {
          dep = _this.dependencyFor[index];
          if (!(dep.status in terminalStatuses)) {
            dep.error(_this);
          }
        }

        _this.notify();
      },

      /** @protected */
      resolveSourceLocation: function () {
        var _this = this,
            src = _this.useBackup ? _this.backup : _this.src,
            retVal = "" + src,
            timestamp = new Date().getTime();

        if (isCrossServerLocation(retVal)) {
          //the request is for another domain probly a CDN (type, noExtension, and minified are ignored)
          return retVal + (!configuration["cached"] ? (retVal.indexOf("?") === -1 ? "?_t=" : "&_t=") + timestamp : "");
        } else {
          //looks like a relative path. Make sure the script root and type are included.

          //ensure we're looking at the minified version, if needed
          if (!_this.noExtension && _this.minified && retVal.indexOf("min") === -1) {
            retVal += ".min";
          }

          if (!_this.noExtension && _this.type !== usingContext && _this.type !== pageType && retVal.substr(retVal.length - _this.type.length) !== _this.type) {
            //type is not already included, add it
            retVal += "." + _this.type;
          }
          if (retVal.substr(0, 1) === "/") {
            //make sure we don't print out "//" in the source...
            retVal = retVal.substr(1);
          }

          //adding the "version" to the path, so that when the version changes, the new scripts will be loaded
          if (configuration["cached"] && configuration["version"]) {
            retVal += (retVal.indexOf("?") >= 0 ? "&" : "?") + "_v=" + encodeURIComponent(configuration["version"]);
          }

          //can trick browsers into getting an uncached copy of a script by adding the current timestamp as a query string parameter
          if (!configuration["cached"]) {
            retVal += (retVal.indexOf("?") >= 0 ? "&" : "?") + "_t=" + timestamp;
          }


          //use the correct root directory
          switch (_this.type) {
            case js:
              return configuration["scriptRoot"] + retVal;

            case css:
              return configuration["styleRoot"] + retVal;

            default:
              return "/" + retVal;
          }

        }
      },

      /** @protected */
      load: function () {
        var _this = this, index, dep, onError;

        if (_this.status !== initiated) return;

        //first, check to make sure that all of the files this file is dependent on are loaded
        index = _this.dependentOn.length;
        while (index--) {
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
        if (configuration["environment"] == webbrowser) {
          if (_this.type === js) {
            //using a script element for Javascript
            _this.requestObj = document.createElement("script");
            _this.requestObj.setAttribute("src", _this.resolveSourceLocation());
            _this.requestObj.setAttribute("type", "text/javascript");
            _this.requestObj.setAttribute("defer", "false");
            _this.requestObj.setAttribute("async", "true");

          } else if (_this.type === css) {
            //using a link element for CSS
            _this.requestObj = document.createElement("link");
            _this.requestObj.setAttribute("type", "text/css");
            _this.requestObj.setAttribute("href", _this.resolveSourceLocation());
            _this.requestObj.setAttribute("rel", "stylesheet");

          } else {
            throw new Error("Attempting to load an unsupported file type: " + _this.type);
          }

          //general error handler
          onError = function () {
            if (_this.backup && !_this.useBackup) {
              emitWarning("Error occurred while loading " + _this.src + ", attempting to load " + _this.backup);
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
        } else {
          throw Error("This functionality is not yet implemented");
        }
      },

      /** @protected */
      init: function () {
        var _this = this;
        if (_this.status !== uninitiated) return;

        if (_this.type !== usingContext && _this.type !== pageType) {
          _this.status = initiated;
          _this.load();
        } else {
          _this.status = resolved;
          _this.notify();
        }
      }
    });

    //the dependency map keeps track of individual dependency structures and all dependencies registered with the system
    var dependencyInterface = {
      /** @private */
      _dependencies: {},
      /** @private */
      _dependencyCount: 0,

      /** @protected */
      /** @param {(Dependency|Object|string)=} dep */
      getNumTotalDependencies: function(dep) {
        if (!dep) return this._dependencyCount;
        dep = this.locateDependency(dep);
        var visited = [];

        function recursiveCounter(ctx) {
          var count = 1,
              c,
              length = ctx.dependentOn.length,
              nextCtx;

          for (c = 0; c < length; c++) {
            nextCtx = ctx.dependentOn[c];
            if (indexOf(visited, nextCtx) === -1) count += recursiveCounter(nextCtx);
            visited.push(nextCtx);
          }

          return count;
        }

        return recursiveCounter(dep);
      },

      /** @protected */
      /** @param {(Dependency|Object|string)=} dep */
      getNumTerminalDependencies: function(dep) {
        if(!dep) dep = this.locatePageDependency();
        else dep = this.locateDependency(dep);
        var visited = [];

        function recursiveCounter(ctx) {
          var count = ctx.status in terminalStatuses ? 1 : 0,
              c,
              length = ctx.dependentOn.length,
              nextCtx;

          for (c = 0; c < length; c++) {
            nextCtx = ctx.dependentOn[c];
            if (indexOf(visited, nextCtx) === -1) count += recursiveCounter(nextCtx);
            visited.push(nextCtx);
          }

          return count;
        }

        return recursiveCounter(dep);
      },

      
      failedDependency: null,
      failureCallbacks: [],
    
      handleFailCallback: function (callback) {
        this.failureCallbacks.push(callback);
        
        if(this.failedDependency) {
          this.emitFailCallbacks();
        }
      },
      
      emitFailCallbacks: function () {
        for(var index = 0, length = this.failureCallbacks.length; index < length; index++) {
          this.failureCallbacks[index].call(null, this.failedDependency.name || this.failedDependency.src);
        }
        this.failureCallbacks.splice(0, this.failureCallbacks.length);
      },

      /** @protected */
      empty: function () {
        return this._dependencyCount === 0;
      },

      //locates the "page" dependency
      /** @protected */
      locatePageDependency: function () {
        if(this._dependencies[pageType]) return this._dependencies[pageType];
        
        var pageDependency = new Dependency(pageSrc, pageType);
        this._dependencies[pageType] = pageDependency;
        pageDependency.init();
        return pageDependency;
      },

      //locates a dependency based off of it being considered "interactive"
      /** @protected */
      locateInteractiveDependency: function () {
        var index, dep;

        for (index in this._dependencies) {
          dep = this._dependencies[index];
          if (dep.requestObj && dep.requestObj.readyState === interactive) {
            return dep;
          }
        }

        return null;
      },

      //locates a dependency based off of the "currentScript" property
      /** @protected */
      locateCurrentScriptDependency: function () {
        var _this = this, index, dep, currentScript = document["currentScript"];

        if (!currentScript || !currentScript.src) return null;

        for (index in _this._dependencies) {
          dep = _this._dependencies[index];
          if (dep.requestObj && dep.requestObj === currentScript) {
            return dep;
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
            if (!this._dependencies[dep["src"]]) return null;
            if (this._dependencies[dep["src"]].type === (dep["type"] || js)) return this._dependencies[dep["src"]];
            return null;

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
              this._dependencies[dep["src"]] = dep;
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

          case dependency:
            delete this._dependencies[dep["src"]];
            dep.destroy();
            break;
        }

        this._dependencyCount--;

        return this;
      },
      
      /**
       * Returns whether or not all given dependencies exist. If any don't exist, it will return false
       * @protected
       * @param {string|Object|Array|Dependency} src
       */
      dependenciesExist: function(src) {
        if(getType(src, true) !== array) {
          src = [src];
        }
        
        var index = src.length;
        while(index--) {
          switch(getType(src[index], true)) {
            case string:
              if(!this._dependencies[src]) return false;
              break;
              
            case object: 
              if(!this._dependencies[src.src]) return false;
              break;
          }
        }
        
        return true;
      },
      
      /** @protected */
      testCompleteness: function () {
        var index, status;

        //test to see if all known dependencies are in a terminal state
        index = this._dependencies.length;
        while (index--) {
          status = this._dependencies[index].status;
          if (status in terminalStatuses) {
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
      var index = readyCallbacks.length;
      while (index--) {
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
          if (dependencyInterface.testCompleteness()) {
            allReady();
          } else {
            setTimeout(poll, timeout);
          }
        }
        //at this point, just let it die off
        polling = false;
      }, timeout);
    }
    
    //what to do when a dependency fails
    on("dependency-failed", function(info) {
      dependencyInterface.failedDependency = info.dependency;
      dependencyInterface.emitFailCallbacks();
    });

    var /** @type {number} */ usingIndex = 0;

    //--------------------------------------------------------//

    /**
      @param {string|Object|function()|Dependency} src 
      @param {?function()=} callback 
      @param {?string=} name 
      @param {?Dependency=} hdnDepRef 
    */
    function usingMain(src, callback, name, hdnDepRef) {
      var /** @type {Array.<string>} */     sourceList,
          /** @type {number} */             index,
          /** @type {Dependency} */         usingDep,
          /** @type {Array.<Dependency>} */ dependencies,
          /** @type {Dependency} */         dep,
          /** @type {Dependency} */         executingDependency,
          /** @type {boolean} */            delayInit,
          /** @type {boolean} */            initialUsing = dependencyInterface.empty();


      switch (getType(src, true)) {
        case func:
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
        executingDependency = dependencyInterface.locatePageDependency();
        
      } else if (ieLteTen()) {
        //earlier versions of IE may not execute scripts in the right order, but they do mark a script as interactive
        executingDependency = dependencyInterface.locateInteractiveDependency();
        
        if(!executingDependency) executingDependency = dependencyInterface.locatePageDependency();
        
      } else if ("currentScript" in document) {
        //newer browsers will keep track of the currently executing script
        executingDependency = dependencyInterface.locateCurrentScriptDependency();
        
        //in this case, if there is no executing dependency, assume that we're on the page
        if(!executingDependency) executingDependency = dependencyInterface.locatePageDependency();
        
      }

      index = sourceList.length;
      while (index--) {
        dep = dependencyInterface.locateDependency(sourceList[index]);
        if (!dep) {
          //no existing entry for this source file, create one
          switch (getType(sourceList[index], true)) {
            case string:
              delayInit = false;
              dep = new Dependency(sourceList[index], getUsingType(sourceList[index]), false, null);
              break;
            case dependency:
              delayInit = sourceList[index]["dependsOn"];
              dep = new Dependency(sourceList[index]["src"],
                                   getUsingType(sourceList[index]),
                                   sourceList[index]["noExtension"],
                                   sourceList[index]["backup"],
                                   sourceList[index]["name"],
                                   sourceList[index]["minified"],
                                   sourceList[index]["exports"]);
              break;
          }
          dependencyInterface.addDependency(dep);
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
        index = dependencies.length;
        while (index--) {
          executingDependency.dependOn(dependencies[index]);
          if (hdnDepRef) {
            dependencies[index].addResolutionCallback(callback, dependencies);
          }
        }
        if (callback && !hdnDepRef) {
          executingDependency.addResolutionCallback(callback, dependencies);
        }
        if (name) executingDependency.name = name;
        
        //if(!(executingDependency.status in terminalStatuses)) executingDependency.notify();
      } else {
        //we don't currently know what the base file is, so create a fake one and have it get resolved later
        usingDep = new Dependency(usingContext + usingIndex++, usingContext, src["noExtension"], src["backup"], name, src["minified"]);
        dependencyInterface.addDependency(usingDep);

        index = dependencies.length;
        while (index--) {
          usingDep.dependOn(dependencies[index]);
        }

        if (callback) usingDep.addResolutionCallback(callback, dependencies);
        if (name) usingDep.name = name;
        //usingDep.init();

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
      @param {string|Object|function()} src
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

      //going to implicitly alias the dependency, so that calls to that module will reference the correct dependency
      //if (getType(name, true) === string && name !== src) using.alias(name, src);

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
        case func:
          opt1.call(global);
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
        case func:
          opt1.call(global);
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
    using.page.progress = function (callback) {
      if(typeof(callback) !== "function") throw new Error("callback must be a function");
      on("dependency-status-terminal", function() {
        /** @suppress {checkTypes} */
        callback.call(null, dependencyInterface.getNumTotalDependencies(), dependencyInterface.getNumTerminalDependencies());
      });
    }
    using.page["progress"] = using.page.progress;
    
    using.page.failure = function(callback) {
      if(typeof(callback) !== "function") throw new Error("callback must be a function");
      dependencyInterface.handleFailCallback(callback);
    }
    using.page["failure"] = using.page.fail;

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
          index = src.length;
          while (index--) {
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


    //lastly, if some start scripts were included, call using on them
    if (configuration["initialUsing"]) using.page(configuration["initialUsing"]);
    if (configuration["initialStyleUsing"]) using.page.css(configuration["initialStyleUsing"]);

    return using;
  })();
