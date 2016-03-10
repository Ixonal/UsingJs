
describe("UsingJs", function() {
  
  describe("UsingJs API", function() {
    
    
    it("starts with a function", function() {
      expect(typeof using).toBe("function");
    });
    
    
    it("has amd function", function() {
      expect(typeof using.amd).toBe("function");
    });
    
    
    it("has page function", function() {
      expect(typeof using.page).toBe("function");
    });
    
    
    it("has page function that has css function", function() {
      expect(typeof using.page.css).toBe("function");
    });
    
    
    if("has page function that has progress function", function() {
      expect(typeof using.page.progress).toBe("function");
    });
    
    
    it("has ready function", function() {
      expect(typeof using.ready).toBe("function");
    });
    
    
    it("has config function", function() {
      expect(typeof using.config).toBe("function");
    });
    
    
    it("has conditionally function", function() {
      expect(typeof using.conditionally).toBe("function");
    });
    
    
    it("has alias function", function() {
      expect(typeof using.alias).toBe("function");
    });
    
    
    it("has css function", function() {
      expect(typeof using.css).toBe("function");
    });
    
    
    it("has css function that has conditionally function", function() {
      expect(typeof using.css.conditionally).toBe("function");
    });
    
    
    it("has css function that has alias function", function() {
      expect(typeof using.css.alias).toBe("function");
    });
    
  });

  describe("UsingJs Functionality", function() {
    
    beforeAll(function() {
      using.config({
        scriptRoot: "/base/test",
        debug: true
      });
      using.alias("testSource", "resources/testSource");
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
    
    it("includes dependencies of dependencies", function(done) {
      using("resources/A", function(imports) {
        var a = new imports.resources.A();
        
        expect(a.cFunc()).toBe("in C");
        done();
      });
    });
    
  });
});