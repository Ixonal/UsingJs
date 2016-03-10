//debugger;
using("resources/B", function(imports) {
  var B = imports.resources.B;
  
  function A() {
    
  }
  
  A.prototype = new B();
  
  return A;
});
