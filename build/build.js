var gulp = require("gulp"),
    debug = require("gulp-debug"),
    plumber = require("gulp-plumber"),
    rename = require("gulp-rename"),
    closureCompiler = require("google-closure-compiler").gulp(),

    config = require("./config").config;
    
function build(glob) {
  return gulp.src(glob)
             .pipe(plumber())
             .pipe(debug({ title: config.messages.building }))
             .pipe(gulp.dest(config.globs.dist))
             .pipe(closureCompiler({
               js_output_file: "using.min.js",
               compilation_level: "ADVANCED_OPTIMIZATIONS",
               warning_level: "VERBOSE",
               output_wrapper: "(function() {%output%})()"
             }))
             .pipe(rename(function(path) {
               path.suffix = ".min";
             }))
             .pipe(gulp.dest(config.globs.dist));
}

gulp.task("build", function() {
  return build(config.globs.using);
});

exports.build = build;