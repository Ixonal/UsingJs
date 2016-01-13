UsingJs
=======

Javascript async module loader. I know that many others exist, 
however nothing did quite what I wanted it to do (except possibly for require.js, but
it decided not to cooperate and I don't like that it takes two global variables), so 
I created this. I also tried to consolidate all the various features that I liked from 
other script loaders into one. 
Please make sure to download from a release tag, rather than the master copy.
  
  
### To include UsingJs on the page: ###

    <script type="text/javascrpt" src="location/of/using.js" data-script-root="/script/root" data-using="'main'"></script>
  
  
### Available attributes: ###

These attributes can be applied to the script tag:

**data-script-root:** will specify where the root of the script directory is. The default is the server root ("/").  
**data-using:** will run a using call on whatever is specified in it. This may be any kind of dependency, though it
will typically be a call to a single main module.  
**data-style-root:** will specify where the root of the style (css) directory is. The default is the server root ("/").  
**data-using-css:** will run a css using call on whatever is specified in it.  
  
  
### Basic syntax: ###

    using("main", function() {
      //occurs after main.js has been included
    });
  
  
### With CSS: ###

    using.css("main", function() {
      //occurs after main.css has been included
    }

*Well that's simple enough. How about something more helpful?*
  
  
### Conditionals: ###

    using.css.conditionally(browserName === "MSIE", "IeStyles");
    
    using.conditionally(!window.JSON, "JsonShim");


*Spiffy. What if my script depends on multiple other scripts?*
  
  
### Using lists: ###

    using(["main", "foo", "bar"], function() {
      //occurs after all dependencies have been included
    });


*OK, now what if I don't want to include huge lists of files or huge file names all over the place?*
  
  
### Using alias: ###

    using.alias("jquery", "http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js");
    
    using("jquery", function() {
      //occurs after jquery is loaded from the Google CDN
    });
    
    using.alias("MainScripts", ["jquery", "foo", "bar"]);
    
    using("MainScripts", function() {
      //occurs after all dependencies in the MainScripts alias are loaded
    });

An alias may contain sources (in either string or object form) or even other aliases.

*So what's this about dependency tracking?*
  
  
### Dependency Tracking: ###

Anything within a using callback will only be run after all dependencies listed are ready. This only happens when those dependencies have all of their dependencies ready as well, on and on up the chain. These chains are created naturally through using calls or by specifying the 'dependsOn' property in a dependency declaration.

For example, assume there are three files, A.js, B.js, and C.js

**A.js:**

    console.log("in A");
    using("B", function() {
      console.log("in A's callback");
      function A() {}
      A.prototype = new B();
      
      var test = new A();
      console.log(test instanceof B);
      console.log(test instanceof C);
    });

**B.js:**

    console.log("in B");
    using("C", function() {
      console.log("in B's callback");
      function B() {}
      B.prototype = new C();
    });

**C.js:**

    console.log("in C");
    
    function C() {}
    C.prototype = {}

**The output would end up being:**

    in A
    in B
    in C
    in B's callback
    in A's callback
    true
    true

As you see, file dependencies will resolve themselves without the need to pre-register anything.

### AMD-Like ###
This library doesn't adhere strictly to the AMD spec, but it does accomplish the same task. Modules 
can be created and referenced completely out of the global scope. This is handled through the imports 
and exports arguments.

    using("some/dependency", function(imports, exports) {
      var something = imports.some.dependency;
      
      exports.doSomething = function() {
        something.do();
      }
    });
    
If anything is defined in the return value instead of exports, it will be used in place of the exports. 
This is convenient for defining and exposing types.

    using([], function() {
      function SomeType() {
        this.someAction = function() {
          console.log("blah");
        }
      }
      
      return SomeType;
    });
    
    //then in another module....
    
    using("SomeType", function(imports) {
      var something = new imports.SomeType();
    });

*Anything else I should know?*

### Advanced Dependencies ###

Dependencies may be described using either a string (as above) or an object of the following form:

    {
      src: "Test",                  //source string as above                        (string, required)
      type: "js or css",            //the type of file ("js" by default)           (string, optional)
      noExtension: true || false,   //whether or not to add an extension           (boolean, optional)
      conditionally: condition,     //whether or not to register this dependency   (boolean, optional)
      dependsOn: "Something"        //A file on which this dependency is dependent (string, dependency, or array of either, optional)
      backup: "alternate/location", //backup source location                       (string, optional)
      name: "importName",           //name of the import                           (string, optional)
      exports: "someObj",           //name of the global property considered to be (string, optional)
                                    //exported from the referenced module
    }

**Of Note:**
The "dependsOn" property, as defined above, allows defining dependency chains for libraries which don't use UsingJs. A good example of the use of this is including both jQuery and jQuery UI. This property will take anything that would go into a normal using call, so it may also contain arrays of dependencies and aliases.

    using(["jQuery", { src: "jQueryUI", dependsOn: "jQuery" }], function() {
      //occurs after jQuery and then jQueryUI are loaded
    });
  
**Also:**
The "backup" property defines a source location to attempt to load from if the location in the "src" property has an error. This is helpful in avoiding the issue where you attempt to load a dependency from a CDN, but the CDN is temporarily down.

    using.alias("jQuery", { src: "//ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js", backup: "Lib/jquery-1.11.0.min" });

**Finally:**
The "name" and "exports" properties can be used to import libraries that place things into the global scope into modules. This can be helpful with libraries such as jQuery. For example:

    using([{ src: "Lib/jquery.min", exports: "jQuery", name: "$" }, function(imports) {
      var $ = imports.$;
    });
  
### Configurations: ###
There are certain global options that can be configured:

    {
      srcName: "some/file.js", //string, name of the using script file (if changed)
      noConflict: false,       //boolean, whether or not using is inserted into the global scope
      scriptRoot: "/",         //string, default script root
      styleRoot: "/",          //string, default style root
      cached: true,            //boolean, whether or not to cache the source files
      version: "1.0.0"         //string or number, a string to denote the current version of the app 
                               //                  using this library. When the version increases, users will 
                               //                  load the new files, but enjoy cached versions the rest of 
                               //                  the time.
      debug: false             //boolean, whether or not to show error messages in log
    }

These settings can be set by assigning an object to the global variable using.configuration before 
the library has been included, or calling the using.config function on an object after the library 
has been included.

    //before including the library
    using = {
      config: {
        scriptRoot: "/Scripts",
        cached: false
      }
    }
    
    //after including the library
    using.config({
      scriptRoot: "/Scripts",
      cached: false
    });
    
    //a typical production configuration may look like this
    using.config({
      scriptRoot: "/Scripts",
      minified: true,
      version: "@Html.VersionHelper()"
    });

