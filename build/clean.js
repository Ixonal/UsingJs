var gulp = require("gulp"),
    del = require("del"),
    
    config = require("./config").config;

gulp.task("clean", function() {
  return del(config.globs.distFiles)
});