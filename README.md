UsingJs
=======

Javascript async script loader and dependency tracker. I know that many others exist, 
however nothing did quite what I wanted it to do, so I created this. I also tried to 
consolidate all the various features that I liked from other script loaders into one. 
Please make sure to download from a release tag, rather than the master copy.


To include UsingJs on the page:
-------------------------------

    <script type="text/javascrpt" src="location/of/using.js" data-script-root="/script/root" data-using="'main'"></script>


Available attributes:
---------------------

*data-script-root:* will specify where the root of the script directory is. The default is the server root ("/").  
*data-using:* will run a using call on whatever is specified in it. This is the preferred entry point.  
*data-style-root:* will specify where the root of the style (css) directory is. The default is the server root ("/").  
*data-using-css:* will run a css using call on whatever is specified in it.  


Basic syntax:
-------------

    using("main", function() {
      //occurs after main.js has been included
    });


With CSS:
---------

    using.css("main", function() {
      //occurs after main.css has been included
    }

<i>Well that's simple enough. How about something more helpful?</i><br/>


Conditionals:
-------------

    using.css.conditionally(browserName === "MSIE", "IeStyles");
    
    using.conditionally(!window.JSON, "JsonShim");


<i>Spiffy. What if my script depends on multiple other scripts?</i>


Using lists:
------------

    using(["main", "foo", "bar"], function() {
      //occurs after all dependencies have been included
    });


<i>OK, now what if I don't want to include huge lists of files or huge file names all over the place?</i>


Using alias:
------------

    using.alias("jquery", "http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js");
    
    using("jquery", function() {
      //occurs after jquery is loaded from the Google CDN
    });
    
    using.alias("MainScripts", ["jquery", "foo", "bar"]);
    
    using("MainScripts", function() {
      //occurs after all dependencies in the MainScripts alias are loaded
    });

An alias may contain sources (in either string or object form) or even other aliases.

<i>So what's this about dependency tracking?</i>


Dependency Tracking:
--------------------
Anything within a using callback will only be run after all dependencies listed are ready. This only happens when those dependencies have all of their dependencies ready as well, on and on up the chain. These chains are created naturally through using calls or by specifying the 'dependsOn' property in a dependency declaration. <br/><br/>

For example, assume there are three files, A.js, B.js, and C.js<br/><br/>
<b>A.js:</b>
<pre>
  console.log("in A");
  using("B", function() {
    console.log("in A's callback");
    function A() {}
    A.prototype = new B();
    
    var test = new A();
    console.log(test instanceof B);
    console.log(test instanceof C);
  });
</pre>
<br/>

<b>B.js:</b>
<pre>
  console.log("in B");
  using("C", function() {
    console.log("in B's callback");
    function B() {}
    B.prototype = new C();
  });
</pre>
<br/>

<b>C.js:</b>
<pre>
  console.log("in C");
  
  function C() {}
  C.prototype = {}
</pre>
<br/>
<b>The output would end up being:</b>
<pre>
  in A
  in B
  in C
  in B's callback
  in A's callback
  true
  true
</pre>
<br/>
As you see, file dependencies will resolve themselves without the need to pre-register anything.
<br/><br/>
<i>Anything else I should know?</i><br/>
<br/>
<b>Dependencies may be described using either a string (as above) or an object of the following form:</b>
<pre>
  {
    src: "Test", //source string as above                                  (string, required)
    type: "js or css", //the type of file                                  (string, optional)
    conditionally: condition, //whether or not to register this dependency (boolean, optional)
    dependsOn: "Something" //A file on which this dependency is dependant  (string or dependency, optional)
  }
</pre>

<b>Of Note:</b><br/>
The "dependsOn" property, as defined above, allows defining dependency chains for libraries which don't 
use UsingJs. A good example of the use of this is including both jQuery and jQuery UI.
<pre>
  using(["jQuery", { src: "jQueryUI", dependsOn: "jQuery" }], function() {
    //occurs after jQuery and then jQueryUI are loaded
  });
</pre>
<br/><br/>
<b>Configurations:</b><br/>
There are certain global options that can be configured:
<pre>
  {
    noConflict: false, //boolean, whether or not using is inserted into the global scope
    scriptRoot: "/", //string, default script root
    styleRoot: "/", //string, default style root
    cached: true //boolean, whether or not to cache the source files
  }
</pre>
These settings can be set by assigning an object to the global variable using.configuration before 
the library has been included, or calling the using.config function on an object after the library 
has been included.
<pre>
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
</pre>
