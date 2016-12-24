// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var $ = jQuery = require('jquery');
var app = require('electron').remote.app;
var angular = require('angular');
var util = require('util');
var ipc = require('electron').ipcRenderer;
var moment = require('moment');

var chromecast = require('./electron-cast.js');

angular.module('homeMovies', [])
.provider('$inputFile', function(){
  var self = this;
  self._currentFile = null;
  self._currentStats = {};
  self._currentMeta = {};
  self._bufferReady = false;

  this.$get = function($rootScope){
    var that = this;

    ipc.on('ffmpeg-update', function(event,params){
      that._currentStats = params;
      $rootScope.$apply();
      var time = moment.duration(params.time).as('seconds');
      console.log(time);
      if(time > 15 && !that._bufferReady){
        that._bufferReady=true;
        $rootScope.$emit('buffer-ready');
      }

    });

    return {
      set: function(file){
        that._currentFile = file;
        $rootScope.$apply();
      },
      meta: function(meta){
        that._currentMeta = meta;
        $rootScope.$apply();
      },
      get: function(){
        return {file:that._currentFile, meta:that._currentMeta, stats:that._currentStats};
      },
      clear: function(){
        that._currentFile = null;
        this._currentMeta = {};
        //$rootScope.$apply();
      }
    }
  }
})
.provider('$chromecast', function(){
  console.log("CAST!");

  this._castList = [];
  this._playing = false;

  this.$get = function($q,$rootScope,$inputFile){
    var that = this;
    return {
      isPlaying: function(){
        return that._playing;
      },
      play: function(){
        that._playing = true;
        require('dns').lookup(require('os').hostname(), function (err, add, fam) {
          var streamUrl = util.format("http://%s:3130/stream.mp4", add);
          console.log('addr: ', add, streamUrl);
          chromecast.play(streamUrl, $inputFile.get());
        })
      },
      activeFile: function(){
        return that._file;
      },
      stop: function(){
        that._playing=false;
        var res = ipc.sendSync("ffmpeg-stop");
        chromecast.stop();
        $inputFile.clear();
        console.log(res);
      },
      connect: function(host){
        var defer = $q.defer();
        chromecast.connect(host, function(err){
          $rootScope.castConnected = true;
          defer.resolve();
        });
        return defer.promise;
      },
      list: function(){
        var defer = $q.defer();
        chromecast.listDevices(function(err, device){
          //#todo: full device list?
          this._castList = [device];
          defer.resolve(this._castList);
        });
        return defer.promise;
      }
    }
  }
})
.controller('main',function($scope,$inputFile){

  $scope._versions = process.versions;
  $scope.currentFile = function(){ return $inputFile.get(); }
})

.directive('playerStats',function($inputFile){
  return {
    template:'<pre>{{stats()|json}}</pre>',
    link: function(scope,ele,attr){
      scope.stats = function(){ return $inputFile.get().stats; }
    }
  }
})
.directive('playerControls',function($chromecast,$inputFile){
  return {
    template:
    '<nav class="navbar navbar-light bg-faded" ng-if="currentFile().file">'+
      '<span class="navbar-text">{{currentFile().file.name}}</span>'+
      '<ul class="nav navbar-nav">'+
      '<li class="nav-item">'+
        '<a href ng-click="$stop()">Stop</a>'+
      '</li>'+
      '<li class="nav-item">'+
      '<a href ng-click="$seek(300)">Seek to 03:00</a>'+
      '</li>'+
      '</ul>'+
    '</nav>',
    link: function(scope,ele,attr){
      // ipc.on('ffmpeg-probe-result', function(event,params){
      //   console.log("PROBE", event, params);
      // });
      scope.currentFile = function(){ return $inputFile.get(); }

      scope.$seek = function(){

      }
      scope.$stop = function(){
        $chromecast.stop();
      }
    }
  }
})
.directive('chromeCast', function($chromecast){
  return {
    template: '<p class="text-xs-center"><a ng-click="$connect()" class="btn btn-secondary">Chromecast Connect</a></p>',
    link: function(scope,ele,attr){

      scope.devices = [];

      $chromecast.list().then(function(d){
        console.log(d);
        scope.devices = d;
      });

      scope.$connect = function(){
        //var addr = util.format("%s:%s", scope.devices[0].addresses[0], scope.devices[0].port);
        var addr = scope.devices[0].addresses[0];
        console.log("CNT", addr);
        $chromecast.connect(scope.devices[0].addresses[0]).then(function(){
          console.log("CAST CONNECTED");
        });
      }

    }
  }
})
.directive('fileSelect',function($chromecast,$rootScope,$inputFile,$timeout){
  return {
    template: '<p class="text-xs-center"><button ng-if="!currentFile().file" ng-click="_click()" class="btn btn-primary">Select File</button></p>',
    link: function(scope,ele,attr){
      var file = document.createElement('input');
      file.type = 'file';
      file.accept = 'video/*';
      scope.currentFile = function(){ return $inputFile.get(); }

      file.addEventListener('change',function(e){
        $inputFile.set(e.target.files[0]);
        ipc.send("ffprobe-start", scope.currentFile().file.path);
      });

      ipc.on('ffprobe-result', function(event,params){
        console.log("PROBE", event, params);
        //fileObject._probe = params;
        var meta = {
          format: params.format.format_long_name,
          duration:Math.round(params.format.duration),
          size: Math.round(params.format.size),
          streams:params.streams
        };
        $inputFile.meta(meta);
        //fileObject.duration = Math.round(params.format.duration);
        ipc.send("ffmpeg-start", scope.currentFile().file.path);
        $chromecast.play();

        $rootScope.$on('buffer-ready', function(){
          console.log("READY");
          //$chromecast.play();
        });
      });

      scope._click = function(){
        file.click();
      }
    }
  }
})
