var gulp = require("gulp"),
    debug = require("gulp-debug"),
    plumber = require("gulp-plumber"),
    rename = require("gulp-rename"),
    closureCompiler = require("gulp-closure-compiler-service"),
    //closureCompiler = require("google-closure-compiler").gulp(),

    config = require("./config").config;
    
function build(glob) {
  return gulp.src(glob)
             .pipe(plumber())
             .pipe(debug({ title: config.messages.building }))
             .pipe(gulp.dest(config.globs.dist))
             .pipe(closureCompiler(config.settings.closureCompiler))
             .pipe(rename({
               suffix: ".min"
             }))
             .pipe(debug({ title: config.messages.minifying }))
             .pipe(gulp.dest(config.globs.dist));
}

gulp.task("build", function() {
  return build(config.globs.using);
});

exports.build = build;