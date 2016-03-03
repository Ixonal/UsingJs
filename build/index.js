require("./build");
require("./clean");
require("./watch");
require("./test");

var gulp = require("gulp"),
    sequence = require("run-sequence");

gulp.task("default", function() {
  return sequence("clean", "build", "watch");
});