
describe("UsingJs", function() {
  
  describe("UsingJs public API", function() {
    
    
    it("starts with a function (using())", function() {
      expect(typeof using).toBe("function");
    });
    
    
    it("has amd function (using.amd())", function() {
      expect(typeof using.amd).toBe("function");
    });
    
    
    it("has page function (using.page())", function() {
      expect(typeof using.page).toBe("function");
    });
    
    
    it("has page function that has css function (using.page.css())", function() {
      expect(typeof using.page.css).toBe("function");
    });
    
    
    if("has page function that has progress function (using.page.progress())", function() {
      expect(typeof using.page.progress).toBe("function");
    });
    
    
    it("has ready function (using.ready())", function() {
      expect(typeof using.ready).toBe("function");
    });
    
    
    it("has config function (using.config())", function() {
      expect(typeof using.config).toBe("function");
    });
    
    
    it("has conditionally function (using.conditionally())", function() {
      expect(typeof using.conditionally).toBe("function");
    });
    
    
    it("has alias function (using.alias())", function() {
      expect(typeof using.alias).toBe("function");
    });
    
    
    it("has css function (using.css())", function() {
      expect(typeof using.css).toBe("function");
    });
    
    
    it("has css function that has conditionally function (using.css.conditionally())", function() {
      expect(typeof using.css.conditionally).toBe("function");
    });
    
    
    it("has css function that has alias function (using.css.alias())", function() {
      expect(typeof using.css.alias).toBe("function");
    });
    
  });

  describe("UsingJs Functionality", function() {
    
    beforeAll(function() {
      using.config({
        scriptRoot: "/base/test"
      });
      using.alias("testSource", "resources/testSource");
      using.alias("listAlias", ["resources/listFileOne", "resources/listFileTwo", "resources/listFileThree"]);
    });
    
    it("imports a file", function(done) {
      using("resources/testSource", function(imports) {
        var testSource = imports.resources.testSource;
        
        expect(testSource).not.toBe(null);
        expect(testSource.testProp).toBe("testVal");
        
        done();
      });
    });
    
    it("imports as an alias", function(done) {
      using("testSource", function(imports) {
        var testSource = imports.resources.testSource;
        
        expect(testSource).not.toBe(null);
        expect(testSource.testProp).toBe("testVal");
        
        done();
      });
    });
    
    it("imports dependencies of dependencies", function(done) {
      using("resources/A", function(imports) {
        var a = new imports.resources.A();
        
        expect(a.cFunc()).toBe("in C");
        done();
      });
    });
    
    it("imports lists of files", function(done) {
      using(["resources/listFileOne", "resources/listFileTwo", "resources/listFileThree"], function(imports) {
        var one = imports.resources.listFileOne,
            two = imports.resources.listFileTwo,
            three = imports.resources.listFileThree;
            
        expect(one.prop).toBe(1);
        expect(two.prop).toBe(2);
        expect(three.prop).toBe(3);
        
        done();
      });
    });
    
    it("imports lists as an alias", function(done) {
      using("listAlias", function(imports){
        var one = imports.resources.listFileOne,
            two = imports.resources.listFileTwo,
            three = imports.resources.listFileThree;
            
        expect(one.prop).toBe(1);
        expect(two.prop).toBe(2);
        expect(three.prop).toBe(3);
        
        done();
      });
    });
    
    it("imports files that assign to global", function(done) {
      using({ src: "resources/globalVar", exports: "testing.obj", name: "obj" }, function(imports) {
        var prop = imports.obj.prop;
        
        expect(prop).toBe("val");
        
        done();
      });
    });
    
    it("imports files that assign to global that are dependent on files that assign to global", function(done) {
      using({ src: "resources/globalVarDependent", exports: "testing2", name: "testing2", dependsOn: "resources/globalVar" }, function(imports) {
        var prop = imports.testing2.prop;
        
        expect(prop).toBe("ret");
        
        done();
      });
    });
    
    it("imports from a backup location if the primary fails", function(done) {
      using({ src: "resources/badTestSource", backup: "resources/testSource" }, function(imports) {
        var testSource = imports.resources.badTestSource;
        
        expect(testSource).not.toBe(null);
        expect(testSource.testProp).toBe("testVal");
        
        done();
      });
    });
    
    it("imports a module that defines its own name", function(done) {
      using("resources/namedImport", function(imports) {
        expect(imports.namespace.testImport).not.toBe(null);
        expect(imports.namespace.testImport.prop).toBe("someVal");
        
        done();
      });
    });
    
  });
});