UsingJs
=======

Javascript async dependency loader. Think of this as a sort of consolidation of existing script loaders, with built in dependency tracking

For now, here are the usages:

on your page, include using.js<br/>
&lt;script type="text/javascrpt" src="location/of/using.js" data-script-root="/script/root" data-using="'main'"&gt;&lt;/script&gt;<br/>
the data-script-root attribute will specify where the root of the script directory is. The default is the server root ("/").<br/>
the data-using attribute will run a using call on whatever is specified in it. This is the preferred entry point. 

Basic syntax:
using("main", function() {
  //occurs after main.js has been included
});

With CSS:
using.css("main", function() {
  //occurs after main.css has been included
}


Well that's simple enough. How about something more helpful?

Conditionals:
using.css.conditionally("IEFix", browserName === "MSIE");

using.conditionally("main", browserName !== "MSIE")
     .conditionally("main-ie-proof", browserName === "MSIE");
     

Spiffy. Now what if I want to use more than one file at a time?

Using lists:
using(["main", "foo", "bar"], function() {
  //occurs after all dependencies have been included
});

