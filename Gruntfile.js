
function auto_target(t){
  if(t!='auto') return t;
  var os = require('os');
  return [os.platform(),os.arch()].join("_");
}

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks
  var shortid = require('shortid');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    buildId: shortid.generate(),
    dist: "app/client/dist",
    clean: {
      dist:['<%= dist %>']
    },
    less: {
      build: {
        options: {
          paths: ['less/']
        },
        files: {
          '<%= dist %>/css/extracast.css': 'less/base.less'
        }
      }
    },
    cssmin: {
      target: {
        files: {
          '<%= dist %>/css/extracast.min.css': ['<%= dist %>/css/extracast.css']
        }
      }
    },

    // uglify: {
    //   options: {
    //     banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
    //   },
    //   build: {
    //     src: 'src/<%= pkg.name %>.js',
    //     dest: 'build/<%= pkg.name %>.min.js'
    //   }
    // },
    //other build prep? ...
    //
    ffmpeg_bundle: {
      auto: {
        options: {
          platform: "auto",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      darwin_x64: {
        options: {
          platform: "osx-64",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      mas_x64: {
        options: {
          platform: "osx-64",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      linux_x64: {
        options: {
          platform: "linux-64",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      linux_x32: {
        options: {
          platform: "linux-32",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      win32_ia32: {
        options: {
          platform: "windows-32",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      win32_x64: {
        options: {
          platform: "windows-64",
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      }
    },
    electron: {
      darwin_x64: {
        options: {
          name: 'Extracast',
          icon: 'icons/icon-001.icns',
          dir: 'app',
          out: 'releases/<%= pkg.version %>/<%= buildId %>/',
          version: '1.4.1',
          platform: 'darwin',
          arch: 'x64'
        }
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  //grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-electron');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-cssmin');

  grunt.loadTasks('./tasks/grunt-ffmpeg-bundle');

  //targets = darwin_x64
  var target = grunt.option('target') || "auto";
  console.log(target);

  grunt.registerTask('dist', ['clean:dist','less','cssmin']);

  grunt.registerTask('ffmpeg', ['ffmpeg_bundle:'+target]);

  //grunt.registerTask('build', ['less','electron:'+auto_target(target)]);
  grunt.registerTask('build', ['less','ffmpeg_bundle:'+target, 'electron:'+auto_target(target)]);

};
