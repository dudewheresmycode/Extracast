
//**build for mac 64-bit**
//
//  grunt bundle --target=darwin_x64
//
//**build for linux 64-bit**
//
//  grunt bundle --target=linux_x64


function auto_target(t){
  if(t!='auto') return t;
  var os = require('os');
  return [os.platform(),os.arch()].join("_");
}

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks
  var shortid = require('shortid');
  //targets = darwin_x64
  var target = grunt.option('target') || "auto";
  console.log(target);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    //buildId: shortid.generate(),
    dist: "app/client/dist",
    clean: {
      dist:['<%= dist %>'],
      release:['release/'+target]
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
          components: ["ffmpeg","ffprobe"],
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      darwin_x64: {
        options: {
          platform: "osx-64",
          components: ["ffmpeg","ffprobe"],
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      mas_x64: {
        options: {
          platform: "osx-64",
          components: ["ffmpeg","ffprobe"],
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      linux_x64: {
        options: {
          platform: "linux-64",
          components: ["ffmpeg","ffprobe"],
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      linux_x32: {
        options: {
          platform: "linux-32",
          components: ["ffmpeg","ffprobe"],
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      win32_ia32: {
        options: {
          platform: "windows-32",
          components: ["ffmpeg","ffprobe"],
          destination: "app/ffmpeg-bundle/",
          clean: true
        }
      },
      win32_x64: {
        options: {
          platform: "windows-64",
          components: ["ffmpeg","ffprobe"],
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
          out: 'release/'+target+'/<%= pkg.version %>/',
          version: '1.4.1',
          platform: 'darwin',
          arch: 'x64'
        }
      }
    },
    zip: {
      dist: {
        cwd: 'release/'+target+'/<%= pkg.version %>',
        src: ['release/'+target+'/<%= pkg.version %>/**/*'],
        dest: 'release/Extracast_'+target+'_<%= pkg.version %>.zip'
      }
    },

    //for internal releasing use only
    aws: grunt.file.readJSON('credentials-aws.json'), //you'll need keys to upload the release to the official server
    aws_s3: {
      options: {
        accessKeyId: '<%= aws.key %>', // Use the keys
        secretAccessKey: '<%= aws.sac %>', // You can also use magical env variables
        region: 'us-east-1'
      },
      release: {
        options: {
          bucket:'extracast-static'
        },
        files: [
          {src:['release/Extracast_<%= pkg.version %>.zip'], dest: 'release/<%= pkg.version %>/'+target+'/'}
        ]
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  //grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-electron');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-aws-s3');
  grunt.loadNpmTasks('grunt-zip');

  grunt.loadTasks('./tasks/grunt-ffmpeg-bundle');


  grunt.registerTask('dist', ['clean:dist','less','cssmin']);

  grunt.registerTask('ffmpeg', ['ffmpeg_bundle:'+target]);

  //grunt.registerTask('build', ['less','electron:'+auto_target(target)]);""
  grunt.registerTask('bundle', ['clean','less','cssmin','ffmpeg_bundle:'+target, 'electron:'+auto_target(target)]);

  grunt.registerTask('release', ['aws_s3']);
};
