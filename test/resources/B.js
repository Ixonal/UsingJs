//debugger;
using("resources/C", function(imports) {
  var C = imports.resources.C;
  
  function B() {
    
  }
  
  B.prototype = new C();
  
  return B;
});
