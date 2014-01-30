UsingJs
=======

Javascript async script loader and dependency tracker. I know that many others exist, 
however nothing did quite what I wanted it to do, so I created this. I also tried to 
consolidate all the various features that I liked from other script loaders into one.

<b>To include UsingJs on the page:</b><br\>

<pre>
  &lt;script type="text/javascrpt" src="location/of/using.js" data-script-root="/script/root" data-using="'main'"&gt;&lt;/script&gt;<br/>
</pre>
<b>Available attributes: </b><br/>
<b>data-script-root:</b> will specify where the root of the script directory is. The default is the server root ("/").<br/>
<b>data-using:</b> will run a using call on whatever is specified in it. This is the preferred entry point. <br/>
<b>data-style-root:</b> will specify where the root of the style (css) directory is. The default is the server root ("/").<br/>
<b>data-using-css:</b> will run a css using call on whatever is specified in it.<br/>
<br/><br/>
<b>Basic syntax:</b>
<pre>
  using("main", function() {
    //occurs after main.js has been included
  });
</pre><br/>
<b>With CSS:</b>
<pre>
  using.css("main", function() {
    //occurs after main.css has been included
  }
</pre>
<br/>

<i>Well that's simple enough. How about something more helpful?</i><br/>
<br/>
<b>Conditionals:</b>
<pre>
  using.css.conditionally(browserName === "MSIE", "IeStyles");

  using.conditionally(!window.JSON, "JsonShim");
</pre>
     
<br/><br/>
<i>Spiffy. What if my script depends on multiple other scripts?</i><br/>
<br/>
<b>Using lists:</b>
<pre>
  using(["main", "foo", "bar"], function() {
    //occurs after all dependencies have been included
  });
</pre>
<br/>
<i>OK, now what if I don't want to include huge lists of files or huge file names all over the place?</i><br/>
<br/>
<b>Using alias:</b>
<pre>
  using.alias("jquery", "http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js");

  using("jquery", function() {
    //occurs after jquery is loaded from the Google CDN
  });

  using.alias("MainScripts", ["jquery", "foo", "bar"]);

  using("MainScripts", function() {
    //occurs after all dependencies in the MainScripts alias are loaded
  });
</pre>
An alias may contain sources (in either string or object form) or even other aliases.

<br/><br/>
<i>So what's this about dependency tracking?</i><br/>
<br/>
<b>Dependency Tracking:</b><br/>
Assume there are three files, A.js, B.js, and C.js<br/>
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
use this library. A good example of the use of this is including both jQuery and jQuery UI.
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
