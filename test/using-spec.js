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
        scriptRoot: "/"
      });
    });
    
    it("includes a file", function(done) {
      using("testSource", function(imports) {
        //still workin on this one...
        expect(imports.testSource.testProp).toBe("testVal");
        done();
      });
    });
  });
});