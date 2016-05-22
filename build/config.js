exports.config = {
  messages: {
    building: "Building src:",
    minifying: "Minifying src:",
    testing: "Running tests:"
  },
  
  globs: {
    src: ["src/**/*.js"],
    using: ["src/using.js"],
    dist: "dist",
    distFiles: "dist/**/*",
    test: ["test/**/*.js"]
  },
  
  settings: {
    closureCompiler: {
      compilation_level: "ADVANCED_OPTIMIZATIONS",
      warning_level: "DEFAULT"
    }
  },
  
  karmaConfig: __dirname + "/../karma.conf.js"
}