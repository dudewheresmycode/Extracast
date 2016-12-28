var path = require('path');
var ffbinaries = require('ffbinaries');


module.exports = function(grunt) {

  grunt.registerMultiTask('ffmpeg_bundle', 'Bundle platform specific ffmpeg binaries into your project.', function(){

    var done = this.async();

    var options = this.options({
      destination:'/ffmpeg',
      platform: 'auto', // auto (default), osx-64, linux-32, linux-64, linux-armel, linux-armhf, windows-32, windows-64
      components: 'all', //the string `'all'' to install all available modules, or an array like ['ffmpeg','ffprobe','ffplay','ffserver']
      clean: false //delete the bundle directory first
    });
    var _platform;
    var _dest = path.join(process.cwd(), options.destination);

    if(options.clean){
      grunt.file.delete(_dest);
    }


    if(options.platform=='auto'){
      _platform = ffbinaries.detectPlatform();
    }else{
      _platform = ffbinaries.resolvePlatform(options.platform);
    }

    if(!_platform){
      grunt.fail.fatal(`Supplied platform "${options.platform}" not found.`);
    }

    grunt.log.writeln(`Bundling ffmpeg... \n\n platform: ${_platform}\n components: ${options.components}\n dir:${_dest}\n`);


    var ffopts = {quiet: true, destination: _dest};
    if(typeof options.components=='object' && options.components.length){ ffopts.components = options.components; }


    ffbinaries.downloadFiles(_platform, ffopts, function () {
      grunt.log.writeln('Downloaded binaries to ' + _dest + '.');
      done();
    })

  });

}
