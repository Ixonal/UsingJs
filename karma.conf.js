
module.exports = function(config) {
  config.set({
    frameworks: ["jasmine"],
    reporters: ["spec"],
    browsers: ["PhantomJS"],
    files: [
    { pattern: "test/resources/**/*.js", included: false },
      "./dist/using.min.js",
      //"./src/using.js",
      "./test/using-spec.js"
    ]
  });
}
