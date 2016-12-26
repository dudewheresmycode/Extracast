var $ = jQuery = require('jquery');

var util = require('util');
var ipc = require('electron').ipcRenderer;
var moment = require('moment');



angular.module('ec.directives',[])
.directive('optionInput',function(){
  return {
    link: function(){

    }
  }
})
.directive('sliderInput',function($media,$timeout){
  return {
    restrict: 'E',
    template:'<div class="slider-input">'+
      '<div class="slider-track"></div>'+
      '<div ng-style="style()" class="slider-value"></div>'+
      '<div class="slider-range"><input type="range" ng-model="value" min="0" max="100" /></div>'+
      '</div>',
    scope: {onchange:'='},
    replace:true,
    //require:'?ngModel',
    link: function(scope,ele,attr){
      scope.value = 0;
      $(ele).find('input').val(scope.value);
      scope.style = function(){
        return {width:scope.value+"%"};
      }
      scope.setValue = function(v){
        // if(scope.ngModel){
        //   ngModelCtl.$setViewValue(v);
        //   ngModelCtl.$render();
        // }
      }
      $(ele)
        .on('mousedown',function(){
          scope.mouseActive=true;
          scope.$apply();
          console.log("DOWN");
        })
        .on('mouseup',function(){
          scope.mouseActive=false;
          scope.$apply();
          scope.changeValue();
          console.log("RELEASE");
        })
        .on('input',function(e){
          console.log("CHANGE");
          //scope.changeValue();
        });
      attr.$observe('value', function(val) {
        if(!scope.mouseActive)
          scope.value = Math.round(val);
      });
      //scope.$watch('value', function(nv,ov){
      scope.changeValue = function(){
        console.log('changed', scope.value);
        var freeze = angular.copy(scope.value);
          if(scope.onchange){
            scope.onchange(freeze);
          }

        // if(scope.timer) $timeout.cancel(scope.timer);
        // scope.timer = $timeout(function(){
        //   console.log("CHANGING", freeze);
        //   if(scope.onchange){
        //     scope.onchange(freeze);
        //   }
        // },500);

      };
    }
  }
})
.directive('playerStats',function($media){
  return {
    template:'<h3>Debug</h3><pre>{{stats()|json}}</pre>',
    link: function(scope,ele,attr){
      scope.stats = function(){ return $media.get().stats; }
    }
  }
})
.directive('playerControls',function($chromecast,$rootScope,$player,$media){
  return {
    scope: {},
    replace:true,
    templateUrl: 'tpl/dir.player-controls.html',
    link: function(scope,ele,attr){
      // ipc.on('ffmpeg-probe-result', function(event,params){
      //   console.log("PROBE", event, params);
      // });
      //scope.currentFile = function(){ return $media.get(); }
      //scope.activeMedia = function(){ return $rootScope.activeMedia; }
      scope._activeMedia = function(){ return $rootScope.activeMedia; }

      scope.currentPlayer = function(){
        if($rootScope.playerType==$rootScope.LOCAL_PLAYER)
         return $player;
        if($rootScope.playerType==$rootScope.CHROMECAST_PLAYER)
         return $chromecast;
        return null;
      }

      $rootScope.$on('player.ended', function(){
        scope.currentTime=0;
        $rootScope.activeMedia=null;
      });

      $rootScope.$on('player.timechange', function(e,time){
        console.log("CHANGE", time);
        if($rootScope.isSeeking==false){
          scope.currentTime = time + $rootScope.seekOffset;
        }
      });

      scope.$seek = function(percent){
        $rootScope.isSeeking=true;
        var time = Math.round($rootScope.activeMedia.meta.duration*(percent/100));
        $rootScope.seekOffset = time;
        console.log("SEEK percent: %s, time: %s", percent, time);
        scope.currentPlayer().seek(time);
      }
      scope.$pause = function(){
        console.log("PAUSE!");
        scope.currentPlayer().pause();
      }
      scope.$play = function(){
        scope.currentPlayer().play();
      }
      scope.$stop = function(){
        $rootScope.activeMedia = null;
        ipc.sendSync("transcode.stop");
        scope.currentPlayer().stop();
        //$chromecast.stop();
      }
    }
  }
})
.directive('chromeCast', function($chromecast,$player,$ecPlayerStatus,$ecConfig,$rootScope){
  return {
    templateUrl: 'tpl/dir.chromecast-button.html',
    link: function(scope,ele,attr){

      scope._isc = function(){ return $chromecast.isConnected(); }
      scope.castIcon = function(){
        return util.format("../images/chromecast-icons/%s.png", (scope._isc() ? "ic_cast_connected_blue_24dp" : "ic_cast_white_24dp"));
      }
      scope.devices = function(){
        return $chromecast.list();
      };

      // $chromecast.list().then(function(d){
      //   console.log(d);
      // });
      scope.$disconnect = function(){
        $chromecast.disconnect();
      }
      scope.$connect = function(device){
        //var addr = util.format("%s:%s", scope.devices[0].addresses[0], scope.devices[0].port);
        var addr = device.addresses[0];
        console.log("Connecting to chromecast at:  %s", addr);
        $chromecast.connect(addr).then(function(){
          console.log("Chromecast connected");
          if($rootScope.playerState==$rootScope.STATE_PLAYING){
            //seek and start on chromecast
            var ctime = $ecPlayerStatus.get("currentTime");
            console.log("CURRENT TIME", ctime);
//            $rootScope.activeMedia = null;
            ipc.sendSync("transcode.stop");
            $player.stop();
            ipc.send("transcode.stream", {inputFile:$rootScope.activeMedia.file.path, duration:$rootScope.activeMedia.meta.duration, seek:ctime, vopts:$ecConfig.get("video")});
          }

        });
      }

    }
  }
})
.directive('videoPlayer', function($rootScope,$timeout,$chromecast,$ecPlayerStatus,$ecConfig,$player){
  return {
    templateUrl: 'tpl/dir.video-player.html',
    replace: true,
    link: function(scope,ele,attr){
      scope.videoEle = ele.find('video')[0];
      scope.videoEle.addEventListener('progress',function(e){
        // var loaded = e.loaded;
        // console.log("LOADING", scope.videoEle.loaded, scope.videoEle.duration);
        // if(!isNaN(scope.videoEle.duration) && scope.videoEle.paused){
        //   scope.videoEle.play();
        // }
      });
      scope._gracePeriod = 2000;
      scope.mouseActive = true;
      scope._mouse = {current:[],last:[]};

      $(window)
        .on('mousemove',function(e){
          console.log('move');
          scope.mouseActive = true;
          scope._mouse.current = [e.clientX,e.clientY];
          $timeout.cancel(scope._dtimer);
          scope._dtimer= $timeout(_defer, scope._gracePeriod);
          scope._mouse.last = scope._mouse.current;
          scope.$apply();
        });

      function _defer(){
        console.log('time');
        if(angular.equals(scope._mouse.last,scope._mouse.current)){
          console.log('same!');
          scope.mouseActive = false;
        }
      }
      scope._dtimer= $timeout(_defer, scope._gracePeriod);

      scope.videoEle.addEventListener('canplay',function(){
        scope.videoEle.play();
      });
      scope.videoEle.addEventListener('play',function(){
        $rootScope.playerState=$rootScope.STATE_PLAYING;
      });
      scope.videoEle.addEventListener('pause',function(){
        $rootScope.playerState=$rootScope.STATE_PAUSED;
      });
      scope.videoEle.addEventListener('ended',function(){
        $rootScope.playerState=$rootScope.STATE_STOPPED;
//        $rootScope.videoActive = false;
        $rootScope.$emit('player.ended', scope.videoEle.currentTime);
        $rootScope.$apply();
      });
      scope.videoEle.addEventListener('timeupdate',function(e){
        $ecPlayerStatus.set("currentTime", scope.videoEle.currentTime + $rootScope.seekOffset);
        $rootScope.$emit('player.timechange', scope.videoEle.currentTime);
        $rootScope.$apply();
      });
      scope.start = function(){
        $(scope.videoEle).prop("src", "http://localhost:3130/stream.mp4");
        scope.videoEle.load();
        $rootScope.isSeeking=false;
      }

      scope._stop = function(){
        //$rootScope.videoActive = false;
        scope.videoEle.pause();
        $(scope.videoEle).prop("src", "");
        $rootScope.playerState=$rootScope.STATE_STOPPED;
      }
      scope.$stop = function(){
        $rootScope.activeMedia = null;
        ipc.sendSync("transcode.stop");
        if($rootScope.playerType==$rootScope.CHROMECAST_PLAYER)
          $chromecast.stop();
        else
          scope._stop();
        //$chromecast.stop();
      }

      $rootScope.$on('player.seek', function(evt,s){
        scope.videoEle.pause();
        $(ele).prop("src", "");
        ipc.sendSync("transcode.stop");
        ipc.send("transcode.stream", {inputFile:$rootScope.activeMedia.file.path,duration:$rootScope.activeMedia.meta.duration, seek:s, vopts:$ecConfig.get("video")});
        scope.start();
      });
      scope._pauseTime = 0;
      $rootScope.$on('player.pause', function(evt){
        scope._pauseTime = scope.videoEle.currentTime + $rootScope.seekOffset;
        console.log(scope._pauseTime);
        scope.videoEle.pause();
      });
      $rootScope.$on('player.resume',function(evt){
        console.log(scope._pauseTime);
        $rootScope.seekOffset = scope._pauseTime;
        ipc.send("transcode.stream", {inputFile:$rootScope.activeMedia.file.path,duration:$rootScope.activeMedia.meta.duration, seek:scope._pauseTime, vopts:$ecConfig.get("video")});
        scope.start();
      })
      $rootScope.$on('player.stop', function(evt,file){
        scope._stop();
      });
      $rootScope.$on('player.start', function(evt,file){
        //$rootScope.videoActive = true;
        $rootScope.playerState=$rootScope.STATE_LOADING;
        console.log("PLAY", evt,file);
        scope.start();
      });
    }
  }
})
.directive('mediaList',function($rootScope,$timeout,$chromecast,$ecConfig,$player,$media){
  return {
    scope: {},
    replace:true,
    templateUrl: 'tpl/dir.media-list.html',
    link: function(scope,ele,attr){


      scope.$play = function(item){
        console.log("PLAY", item);
        // var _start = function(){
        //   $rootScope.playerType=LOCAL_PLAYER;
        //   console.log("play locally");
        //   $player.start(item);
        // }
        //
        // if($chromecast.isConnected()){
        //   _start = function(){
        //     //play on chromecast
        //     console.log("play on chromecast");
        //     $rootScope.playerType=CHROMECAST_PLAYER;
        //     $chromecast.play(item);
        //   }
        // }else{
        //   $rootScope.videoActive = true;
        // }
        $rootScope.activeMedia = item;
        $rootScope.seekOffset = 0;
        $rootScope.playerType = $chromecast.isConnected() ? $rootScope.CHROMECAST_PLAYER : $rootScope.LOCAL_PLAYER
        //start transcode
        ipc.send("transcode.stream", {inputFile:item.file.path, duration:item.meta.duration, seek:0, vopts:$ecConfig.get("video")});

      }
      scope.list = function(){
        return $media.list();
      }
    }
  }
})
.directive('mediaSelect',function($chromecast,$rootScope,$media,$timeout){
  return {
    replace: true,
    template: '<a class="btn btn-primary" href ng-click="_click()">Import File</a>',
    link: function(scope,ele,attr){
      var file = document.createElement('input');
      file.type = 'file';
      file.accept = '.mp4,.mov,.avi,.mpg,.mkv,.webm,.moov,.mpeg,.m4v,.mpg4,video/*';
      //scope.currentFile = function(){ return $media.get(); }

      file.addEventListener('change',function(e){
        $media.add(e.target.files[0]);
      });


      scope._click = function(){
        file.click();
      }
    }
  }
})
