
(function (global, configuration, undefined) {
  "use strict";

  //default configuration settings
  var defaultConfiguration = {
    noConflict: false,
    tests: false
  },

  unknownDependencies = [],

  document = global.document,
    
  //various reused type definitions
  object = "object",
  string = "string",
  array = "array",
  arrayOfString = "array<string>",
  arrayOfDependency = "array<dependency>",
  dependency = "dependency",
  date = "date",
  regexp = "regexp",
    
  //valid types
  js = "js",
  css = "css",
  usingContext = "usingContext",
  page = "page",
    
  ieReg = /MSIE\s*(\d+)/i,
  chromeReg = /Chrome\/(\d+)/i,
  firefoxReg = /Firefox\/(\d+)/i,
  safariReg = /Safari\/(\d+)/i,
  jsReg = /\.((js)|(jscript))$/i,
  cssReg = /\.(css)$/i,
  domainReg = /:\/\/([^\/]+)\/?/,

  unknown = "unknown",
  ie = "ie",
  firefox = "ff",
  chrome = "cr",
  safari = "sf",
    
  uninitiated = 0,
  initiated = 1,
  loading = 2,
  loaded = 3,
  resolved = 4,
  withdrawn = 5,
  destroyed = 6,
  complete = 7,
    
  interactive = "interactive";

  //general form of dependency: 
  //{
  //  src: "path/to/source",
  //  conditionally: evaluates.as.boolean,
  //  type: "js" || "css"
  //}

  //convenience functions
  //--------------------------------------------------------//
  
  //does a shallow copy of one or more objects into the object specified
  //extend(extendee, extender1, extender2, ..., extendern)
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
          //mergee[index2] = merger[index2];
          mergee.push(merger[index2]);
        }
      }
    }

    return mergee;
  }

  //uses array implementation if it exists, or a shim if it doesn't
  //didn't want to insert it into the Array prototype, so keeping it in this closure
  function indexOf(arr, obj) {
    if (global.Array.prototype.indexOf) return global.Array.prototype.indexOf.apply(arr, obj);

    for (var index = 0; index < arr.length; index++) {
      if (arr[index] === obj) return index;
    }

    return -1;
  }

  //like above, but uses the dependency's "matches" function for equality
  function indexOfDependency(arr, dep) {
    for (var index = 0; index < arr.length; index++) {
      if (arr[index].matches(dep)) return index;
    }

    return -1;
  }

  //based off of typeof, but also discriminates between built in types and arrays of types
  function getType(obj) {
    if (typeof (obj) === object) {
      //lots of things count as objects, so let's get a lil more specific
      if (obj.constructor === global.Array) {
        //an array where the inner type can be determined
        if (obj.length > 0) return array + "<" + getType(obj[0]) + ">";
        //an array where the inner type cannot be determined
        else return array + "<object>";
      } else if (obj.constructor === global.RegExp) {
        //a regular expression
        return regexp;
      } else if (obj.constructor === global.Date) {
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

  function detectBrowser() {
    if (!global.navigator) return { browser: null };

    var browser = {
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

    return { browser: browser };
  }

  //configures the script
  function configure(options) {
    configuration = extend({}, defaultConfiguration, configuration, detectBrowser());

    var scriptTag = locateUsingScriptTag(),
        scriptRoot = scriptTag.getAttribute("data-script-root"),
        styleRoot = scriptTag.getAttribute("data-style-root"),
        initialUsing = scriptTag.getAttribute("data-using"),
        initialStyleUsing = scriptTag.getAttribute("data-style-using");

    //set up the script root
    if (scriptRoot && scriptRoot.substr(scriptRoot.length - 1, 1) !== "/") {
      //make sure we have that ending / for later concatination
      scriptRoot += "/";
    }
    configuration.scriptRoot = scriptRoot || "/";

    //set up the style root
    if (styleRoot && styleRoot.substr(styleRoot.length - 1, 1) !== "/") {
      //make sure we have that ending / for later concatination
      styleRoot += "/";
    }
    configuration.styleRoot = styleRoot || "/";

    if(initialUsing) configuration.initialUsing = eval.call(null, "(" + initialUsing + ")");
    if(initialStyleUsing) configuration.initialStyleUsing = eval.call(null, "(" + initialStyleUsing + ")");
  }

  //finds the script tag that's referencing "using.js"
  function locateUsingScriptTag() {
    var index,
        allScriptTags = document.getElementsByTagName("script"),
        currentSrc,
        usingJs = "using.js";

    for (index = 0; index < allScriptTags.length; index++) {
      currentSrc = allScriptTags[index].src;
      if (currentSrc.substr(currentSrc.length - usingJs.length, usingJs.length) === usingJs) return allScriptTags[index];
      //if (allScriptTags[index].src.indexOf("using.js") !== -1) return allScriptTags[index];
    }

    return null;
  }

  function isCrossServerLocation(src) {
    if(src && ((src.length >= 7 && src.substr(0, 7).toLowerCase() === "http://") || (src.length >= 8 && src.substr(0, 8).toLowerCase() === "https://"))) {
      if(global.location) {
        var domain = domainReg.exec(src);
        return domain && domain[1] === global.location.host;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  function resolveSourceLocation(src, type) {
    //for simplicity's sake, I'm assuming src is just a single string
    var retVal = "" + src;
    if(isCrossServerLocation(retVal)) {
      //the request is for another domain probly a CDN
      return retVal;
    } else {
      //looks like a relative path. Make sure the script root and type are included.
      if(retVal.substr(retVal.length - type.length) !== type) {
        //type is not already included, add it
        retVal += "." + type;
      }
      if(retVal.substr(0, 1) === "/") {
        //make sure we don't print out "//" in the source...
        retVal = retVal.substr(1);
      }
      return configuration.scriptRoot + retVal;
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

  //--------------------------------------------------------//


  //configuration
  //--------------------------------------------------------//
  configure(configuration);
  //--------------------------------------------------------//

  //Dependency Map
  //--------------------------------------------------------//

  //the alias map keeps track of all relationships between aliases and script locations
  var aliasMap = {
    map: {},

    locateAlias: function (src) {
      for (var index in this._aliases) {
        if (this._aliases[index] === src) return index;
      }

      return null;
    },

    addAlias: function (alias, src) {
      if (getType(alias) !== string) throw new Error("The alias must be a string.");

      //if the alias is the same as the source what's the point?
      if (alias === src) return this;

      var index;

      if (!this.map[alias]) {
        //no map previously existed for this alias
        this.map[alias] = [];
      }

      switch (getType(src)) {
        case string:
          //adding a single string map
          this.map[alias].push(src);
          break;
        case dependency:
          //adding a single map from a "dependency"
          if (src.conditionally === undefined || src.conditionally) {
            this.map[alias].push(src.src);
          }
          break;
        case arrayOfString:
          //adding a list of string maps
          for (index = 0; index < src.length; index++) {
            this.map[alias].push(src[index]);
          }
          break;
        case arrayOfDependency:
          //adding a list of "dependency" entries
          for (index = 0; index < src.length; index++) {
            if (src[index].conditionally === undefined || src[index].conditionally) {
              this.map[alias].push(src[index].src);
            }
          }
          break;
      }

      return this;
    },

    resolveAlias: function (alias) {

      var sources = [], index;

      switch (getType(alias)) {
        case string:
          //resolving a single string
          if (this.map[alias]) {
            for (index = 0; index < this.map[alias].length; index++) {
              merge(sources, this.resolveAlias(this.map[alias][index]));
            }
          }
          break;
        case dependency:
          //resolving a single "dependency"
          if (alias.conditionally === undefined || alias.conditionally) {
            merge(sources, this.resolveAlias(alias.src));
          }
          break;
        case arrayOfString:
          //resolvig an array of strings
          for (index = 0; index < alias.length; index++) {
            merge(sources, this.resolveAlias(alias[index]));
          }
          break;
        case arrayOfDependency:
          //resolving an array of "dependency" objects
          for (index = 0; index < alias.length; index++) {
            if (alias[index].conditionally === undefined || alias[index].conditionally) {
              merge(sources, this.resolveAlias(alias[index].src));
            }
          }
          break;
        default:
          throw new Error("Alias is not a recognized type.");
      }

      return sources.length === 0 ? [alias] : sources;
    }
  }

  function Dependency(src, type) {
    this.src = src;
    this.type = type || js;
    this.resolutionCallbacks = [];
    this.dependencyFor = [];
    this.dependentOn = [];
  }

  Dependency.constructor = Dependency;

  extend(Dependency.prototype, {
    src: null,                  //location of this dependency
    type: js,                   //the type of this dependency
    searched: false,            //whether or not this node has been searched through
    status: uninitiated,
    dependencyFor: null,        //dependencies observing this dependency
    dependentOn: null,          //dependencies this dependency is observing
    resolutionCallbacks: null,  //list of callbacks to run when the dependency is resolved,
    requestObj: null,

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

    notify: function () {
      //return if not currently resolved
      if (this.status !== resolved) return;

      //a dependency resolved, test to see if this one can resolve
      var index, ready = this.isReady(); 


      if (ready) {
        //looks like we're good to go, mark this dependency as complete
        this.status = complete;

        //notify anything this depends on
        for (index = 0; index < this.dependentOn.length; index++) {
          this.dependentOn[index].notify();
        }

        //run any resolution callbacks
        for (index = 0; index < this.resolutionCallbacks.length; index++) {
          this.resolutionCallbacks[index]();
        }

        //notify anything dependent on this
        for (index = 0; index < this.dependencyFor.length; index++) {
          this.dependencyFor[index].notify();
        }

        if (dependencyMap.testCompleteness()) {
          allReady();
        }
      }
    },

    isReady: function () {
      if (this.status !== resolved && this.status !== complete) return false;

      for (var index = this.dependentOn.length - 1; index >= 0; index--) {
        if (!this.dependentOn[index].isReady()) return false;
      }

      return true;
    },

    dependOn: function (otherDep) {
      //type checking
      if (!otherDep || otherDep.constructor !== Dependency) throw new Error("The other dependency must be a valid Dependency object.");

      //don't want to depend on ourselves, now do we?
      if (this.matches(otherDep)) return;

      //check to see if we already depend on the other dependency
      var index = indexOfDependency(this.dependentOn, otherDep);

      //if not, depend on it
      if (index === -1) {
        otherDep.dependencyFor.push(this);
        this.dependentOn.push(otherDep);
      }

      if (otherDep.status === resolved) {
        //other dependency is already resolved, notify self 
        this.notify();
      }
    },

    addResolutionCallback: function (callback) {
      if (getType(callback) !== "function") throw new Error("dependency resolution callback function must be a function.");
      if (this.stautus === resolved) {
        callback();
      } else {
        this.resolutionCallbacks.push(callback);
      }
    },

    matches: function (dep) {
      var depType = getType(dep);

      if (depType === string) {
        return this.src === dep;
      } else if (depType === dependency) {
        return this.src === dep.src && this.type == dep.type;
      }
    },

    locate: function (dep) {
      this.searched = true;

      if (this.matches(dep)) {
        //found it, return the reference
        return this;
      } else {
        var index, result;
        //check through this file's dependencies
        for (index = 0; index < this.dependsOn.length; index++) {
          if (!this.dependsOn[index].searched) {
            result = this.dependsOn[index].locate(dep);
            if (result) {
              //dependency was found, return it
              return result;
            }
          }
        }
        //didn't find the dependency in any of the things this file depends on, let's check in files that depend on this file
        for (index = 0; index < this.dependencyOf.length; index++) {
          if (!this.dependencyOf[index].searched) {
            result = this.dependencyOf[index].locate(dep);
            if (result) {
              return result;
            }
          }
        }
      }

      //if you got here, we couldn't find it anywhere in the structure.
      return null;
    },

    
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

        //merge(_this.dependentOn, storedDependencies);

        //move all associated callbacks to this dependency
        for (index2 = dependency.resolutionCallbacks.length - 1; index2 >= 0; index2--) {
          _this.addResolutionCallback(dependency.resolutionCallbacks[index2]);
        }

        //at this point, remove the outstanding using context
        dependencyMap.removeDependency(dependency);
      }

      _this.status = resolved;

      if(this.status !== destroyed) _this.notify();
    },

    load: function () {
      var _this = this;

      _this.status = loading;

      if (_this.type === js) {
        _this.requestObj = document.createElement("script");
        _this.requestObj.src = resolveSourceLocation(_this.src, _this.type);
        _this.requestObj.type = "text/javascript";
        _this.requestObj.defer = false;
        _this.requestObj.async = true;


        //register event handlers
        if (configuration.browser.name === ie && configuration.browser.version < 9) {
          _this.requestObj.onreadystatechange = function () {

            if (_this.requestObj.readyState === "complete" || _this.requestObj.readyState === "loaded") {
              _this.requestObj.onreadystatechange = null;
              _this.status = loaded;
              _this.resolve();
            }
          }
        } else {
          _this.requestObj.addEventListener("load", function () {
            _this.status = loaded;
            _this.resolve();
          }, true);
        }
      } else {
        throw new Error("Attempting to load an unsupported file type: " + this.type);
      }

      document.getElementsByTagName("head")[0].appendChild(this.requestObj);
    },

    init: function () {
      if (this.status !== uninitiated) throw new Error("Attempting to initiate a previously initiated dependency.");

      var _this = this;

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
    _dependencies: {},
    _depenencyCount: 0,

    clearSearchedFlags: function() {
      for (var index in this._dependencies) {
        this._dependencies[index].searched = false;
      }
    },

    empty: function() {
      return this._depenencyCount === 0;
    },

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

    addDependency: function(dep) {
      if (!this.locateDependency(dep)) {
        var newDependency;

        switch (getType(dep)) {
          case string:
            //todo: implement me!
            break;

          case dependency:
            this._dependencies[dep.src] = dep;
            break;

          case arrayOfString:
            //todo: implement me!
            break;
        }
      }

      this._depenencyCount++;

      return this;
    },

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

    resolve: function () {
      //go through existing dependencies and load where needed
      for (var index in this._dependencies) {
        if (!this._dependencies[index].initiated) {
          this._dependencies[index].resolve();
        }
      }
    },

    testCompleteness: function () {
      var index, status;
      
      //test to see if all known dependencies have been resolved
      for (index in this._dependencies) {
        status = this._dependencies[index].status;
        if (status !== complete && status !== withdrawn && status !== destroyed) {
          return false;
        }
      }

      return true;
    }
  }

  var readyCallbacks = [];

  function allReady() {
    for (var index = 0; index < readyCallbacks.length; index++) {
      readyCallbacks[index]();
    }
  }

  var usingIndex = 0;

  //--------------------------------------------------------//

  //public access
  //--------------------------------------------------------//
  function using(src, callback) {
    var sourceList, 
        index,
        usingDep,
        dependencies,
        dep,
        executingDependency,
        initialUsing = dependencyMap.empty();

    //var test = dependencyMap.locateInteractiveDependency();
    //if (test) {
    //  if (global.console) console.log("Interactive dependency: " + test.src);
    //}

    switch (getType(src)) {
      case "function":
        //if src is a function, then this is an "all ready" shortcut
        return using.ready(src);

      case string:
      case dependency:
      case arrayOfString:
      case arrayOfDependency:
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
    } else {
      if (configuration.browser.name === ie && configuration.browser.version <= 10) {
        executingDependency = dependencyMap.locateInteractiveDependency();
      }
    }

    for (index = sourceList.length - 1; index >= 0; index--) {
      dep = dependencyMap.locateDependency(sourceList[index]);
      if (!dep) {
        //no existing entry for this source file, create one
        dep = new Dependency(sourceList[index], getUsingType(sourceList[index]));
        dependencyMap.addDependency(dep);
        dep.init();
      }
      dependencies.push(dep);
      //usingDep.dependOn(dep);
    }
    
    if (executingDependency) {
      //in this case, we know up front what the base file is, so make it depend on the new dependencies
      for (index = dependencies.length - 1; index >= 0; index--) {
        executingDependency.dependOn(dependencies[index]);
      }
      if (callback) executingDependency.addResolutionCallback(callback);
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
        //this is the initial using call, so we should be coming from the html page itself, 
        //and that will never need to be resolved.
        unknownDependencies.push(usingDep);
      }
    }

    return using;
  }

  using.ready = function (callback) {
    readyCallbacks.push(callback);
  }

  using.config = function (config) {
    configure(config);
    return using;
  }

  using.conditionally = function (condition, src, callback) {
    if (condition) {
      using(src, callback);
    }

    return using;
  }

  using.alias = function (alias, src) {
    var existingAlias = aliasMap.resolveAlias(alias);

    if (existingAlias.length === 1 && existingAlias[0] === alias) {
      aliasMap.addAlias(alias, src);
    }

    return using;
  }

  using.css = function (src, callback) {
    var index;

    switch (getType(src)) {
      case string:
        return using(src + "." + css, callback);

      case dependency:
        src.src += "." + css;
        src.type = css;
        return using(src, callback);

      case arrayOfString:
        for (index = 0; index < src.length; index++) {
          src[index] += "." + css;
        }
        return using(src, callback);

      case arrayOfDependency:
        for (index = 0; index < src.length; index++) {
          src[index].src += "." + css;
          src[index].type = css;
        }
        return using(src, callback);

      default:
        throw new Error("Valid dependencies must be entered");
    }

    return using;
  }

  using.css.conditionally = function (condition, src, callback) {
    if (condition) {
      using.css(src, callback);
    }

    return using;
  }

  using.css.alias = function (alias, src) {
    //todo: this may cause conflicts if scripts and styles are similarly named. Fix it...
    return using.alias(alias, src);
  }

  //--------------------------------------------------------//


  //testing area
  //--------------------------------------------------------//
  if (configuration.tests) {

    using.alias("jQuery", "jquery-1.8.2.min");
    using.alias("jQueryUI", "jquery-ui-1.8.24.min");

    using.alias("jQueryAll", ["jQuery", "jQueryUI"]);

    using.alias("SiteScripts", ["jQueryAll", "knockout-2.2.0"]);

    var test = aliasMap.resolveAlias("SiteScripts");

    using("jQueryAll");

    if (global.console) global.console.log("Tests Complete");
  }
  //--------------------------------------------------------//


  if (!configuration.noConflict) global["using"] = using;

  //lastly, if some start scripts were included, call using on them
  if (configuration.initialUsing) using(configuration.initialUsing);
  if (configuration.initialStyleUsing) using.css(configuration.initialStyleUsing);

  return using;
})(window || global, ((window || global).using ? using.configuration : null));
