exports.config = {
  messages: {
    building: "Building src:",
    testing: "Running tests:"
  },
  
  globs: {
    src: ["src/**/*.js"],
    using: ["src/using.js"],
    dist: "dist",
    distFiles: "dist/**/*",
    test: ["test/**/*.js"]
  },
  
  karmaConfig: __dirname + "/../karma.conf.js"
}