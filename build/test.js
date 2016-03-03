var gulp = require("gulp"),
    debug = require("gulp-debug"),
    karmaServer = require("karma").Server,

    config = require("./config").config;
    
gulp.task("test", function() {
  new karmaServer({
    configFile: config.karmaConfig,
    singleRun: true
  }).start();
});

gulp.task("test-continuous", function() {
  new karmaServer({
    configFile: config.karmaConfig
  }).start();
});
