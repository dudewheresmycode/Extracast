module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'src/<%= pkg.name %>.js',
        dest: 'build/<%= pkg.name %>.min.js'
      }
    }
    electron: {
      macosBuild: {
        options: {
          name: 'Extracast',
          icon: 'icons/sample.icns',
          dir: 'app',
          out: 'releases/',
          version: '<%= pkg.version %>',
          platform: 'darwin',
          arch: 'x64'
        }
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['electron']);

};
