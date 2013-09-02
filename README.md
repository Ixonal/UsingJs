UsingJs
=======

Javascript async script loader and dependency tracker. This is a sort of consolidation of existing script loaders 
that I found acros the internet.

For now, here are the usages:

on your page, include using.js<br/>
&lt;script type="text/javascrpt" src="location/of/using.js" data-script-root="/script/root" data-using="'main'"&gt;&lt;/script&gt;<br/>
the data-script-root attribute will specify where the root of the script directory is. The default is the server root ("/").<br/>
the data-using attribute will run a using call on whatever is specified in it. This is the preferred entry point. <br/>
<br/>
Basic syntax
<pre>
using("main", function() {
  //occurs after main.js has been included
});
</pre>
With CSS:
<pre>
using.css("main", function() {
  //occurs after main.css has been included
}
</pre>
<br/><br/>

Well that's simple enough. How about something more helpful?<br/>
<br/>
Conditionals:
<pre>
using.css.conditionally("IEFix", browserName === "MSIE");

using.conditionally("main", browserName !== "MSIE")
     .conditionally("main-ie-proof", browserName === "MSIE");
</pre>
     
<br/><br/>
Spiffy. Now what if I want to use more than one file at a time?<br/>
<br/>
Using lists:
<pre>
using(["main", "foo", "bar"], function() {
  //occurs after all dependencies have been included
});
</pre>

<br/><br/>
So what's this about dependency tracking?<br/>
<br/>
Dependency Tracking:<br/>
Assume there are three files, A.js, B.js, and C.js<br/>
A.js:
<pre>
console.log("in A");<br/>
using("B", function() {<br/>
  console.log("in A's callback");<br/>
});<br/>
</pre>
<br/>

B.js:
<pre>
console.log("in B");<br/>
using("C", function() {<br/>
  console.log("in B's callback");<br/>
});<br/>
</pre>
<br/>

C.js:
<pre>
console.log("in C");
</pre>
<br/>
The output would end up being:
<pre>
in A
in B
in C
in B's callback
in A's callback
</pre>
<br/>
As you see, file dependencies will resolve themselves without the need to pre-register anything.
<br/><br/>
Anything else I should know?<br/>
<br/>
Dependencies may be described using either a string (as above) or an object of the following form:
<pre>
{
  src: "Test", //source string as above                                 (string, required)
  type: "js or css", //the type of file                                 (string, optional)
  conditionally: condition //whether or not to register this dependency (boolean, optional)
}
</pre>
