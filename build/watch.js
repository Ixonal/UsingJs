var gulp = require("gulp"),
    watch = require("gulp-watch"),
    build = require("./build").build,
    
    config = require("./config").config;
    
gulp.task("watch", function() {
  return watch(config.globs.src, function(file) {
    if(file.event === "unlink") return;
    build(config.globs.using);
  });
});