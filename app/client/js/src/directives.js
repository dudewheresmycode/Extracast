var $ = jQuery = require('jquery');

var util = require('util');
var ipc = require('electron').ipcRenderer;
var moment = require('moment');
var BigScreen = require('bigscreen');



angular.module('ec.directives',[])
.directive('sliderInput',function($media,$parse,$timeout){
  return {
    restrict: 'E',
    template:'<div class="slider-input">'+
      '<div class="slider-track"></div>'+
      '<div ng-style="style()" class="slider-value"></div>'+
      '<div class="slider-range"><input type="range" ng-model="value" min="0" max="100" /></div>'+
      '</div>',
    scope: {onchange:'=',oninput:'='},
    replace:true,
    //require:'?ngModel',
    link: function(scope,ele,attr){

      scope.value = $parse(attr.value)(scope.$parent);
      $input = $(ele).find('input');
      $input.val(scope.value);

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
          scope.changeValue();
          scope.$apply();
          console.log("RELEASE");
        });

      $input
        .on('input',function(e){
          if(scope.oninput){
            scope.oninput(scope.value);
            scope.$apply();
          }
          console.log("CHANGE", scope.value);
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
.directive('playerControls',function($chromecast,$ecStreamCtl,$ecPlayerStatus,$rootScope,$player,$media){
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
      scope._activeMedia = function(){ return $ecPlayerStatus.get('media'); }
      scope._isChromeCastPlayer = function(){
        return $ecPlayerStatus.get("type")==$rootScope.CHROMECAST_PLAYER;
      }
      scope._rootStatus = function(s){
        return $rootScope[s];
      }
      scope._playerStatus = function(){
        return $ecPlayerStatus.status();
      }

      scope.currentPlayer = function(){
        if($ecPlayerStatus.get("type")==$rootScope.LOCAL_PLAYER)
         return $player;
        if($ecPlayerStatus.get("type")==$rootScope.CHROMECAST_PLAYER)
         return $chromecast;
        return null;
      }

      // $rootScope.$on('player.ended', function(){
      //   scope.currentTime=0;
      //   $ecPlayerStatus.set('media',null)
      //   //$rootScope.activeMedia=null;
      // });

      // $rootScope.$on('player.timechange', function(e,time){
      //   console.log("CHANGE", time);
      //   if($rootScope.isSeeking==false){
      //     scope.currentTime = time + $rootScope.seekOffset;
      //   }
      // });
      //
      scope.$fullscreen = function(){
        if($ecPlayerStatus.get("type")==$rootScope.LOCAL_PLAYER)
          $player.fullscreen();
      }
      scope.$volume = function(v){
        console.log("ctlVOLUME", v, scope.currentPlayer());
        //$ecPlayerStatus.set("volume", v);
        if(scope.currentPlayer()) scope.currentPlayer().volume(v);
      }
      scope.$seek = function(percent){
        $rootScope.isSeeking=true;
        var d = $ecPlayerStatus.get('media').meta.duration;
        var time = Math.round(d*(percent/100));
        //$rootScope.seekOffset = time;
        $ecPlayerStatus.set("seekOffset", time);
        console.log("SEEK percent: %s, time: %s", percent, time);
        if(scope.currentPlayer()) scope.currentPlayer().seek(time);
      }
      scope.$pause = function(){
        console.log("PAUSE!");
        if(scope.currentPlayer()) scope.currentPlayer().pause();
      }
      scope.$play = function(){
        if(scope.currentPlayer()) scope.currentPlayer().play();
      }
      // scope.$stop = function(){
      //   //$rootScope.activeMedia = null;
      //   console.log("STOP!");
      //   if(scope.currentPlayer()) scope.currentPlayer().stop();
      //   $ecPlayerStatus.set('media',null);
      //   $ecStreamCtl.stop();
      //
      //   //$chromecast.stop();
      // }
    }
  }
})
.directive('chromeCast', function($chromecast,$player,$ecStreamCtl,$ecPlayerStatus,$ecConfig,$rootScope){
  return {
    templateUrl: 'tpl/dir.chromecast-button.html',
    link: function(scope,ele,attr){

      scope._isc = function(){ return $chromecast.isConnected(); }
      scope._state = function(){ return $chromecast.state(); }
      var states = [$rootScope.CHROMECAST_IDLE,$rootScope.CHROMECAST_CONNECTING,$rootScope.CHROMECAST_CONNECTED];

      scope.castIcon = function(){
        return util.format("../images/chromecast/%s_24dp.svg", ["ic_cast","ic_cast_anim","ic_cast_connected"][states.indexOf(scope._state())]);
      }
      scope.castIconClass = function(){
        return ["","connecting","connected"][states.indexOf(scope._state())];
      }

      scope.devices = function(){
        return $chromecast.list();
      };

      // $chromecast.list().then(function(d){
      //   console.log(d);
      // });
      scope.$disconnect = function(){
        if($ecPlayerStatus.state()!=$rootScope.STATE_STOPPED) $chromecast.stop();
        $chromecast.disconnect();
      }
      scope.$connect = function(device){
        //var addr = util.format("%s:%s", scope.devices[0].addresses[0], scope.devices[0].port);
        var addr = device.addresses[0];
        console.log("Connecting to chromecast at:  %s", addr);
        $chromecast.connect(addr).then(function(){
          console.log("Chromecast connected");

          if($ecPlayerStatus.get("state")==$rootScope.STATE_PLAYING){
          //if($rootScope.playerState==$rootScope.STATE_PLAYING){
            //seek and start on chromecast
            var ctime = $ecPlayerStatus.get("currentTime");
            console.log("CURRENT TIME", ctime);
//            $rootScope.activeMedia = null;
            //ipc.sendSync("transcode.stop");
            $player.stop();
            $ecStreamCtl.stop();
            $ecStreamCtl.start(item,ctime);
            // ipc.send("transcode.stream", {
            //   inputFile:$rootScope.activeMedia.file.path,
            //   thumbnails:$rootScope.activeMedia.thumbnails,
            //   duration:$rootScope.activeMedia.meta.duration,
            //   seek:ctime,
            //   http_stream:($rootScope.playerType == $rootScope.CHROMECAST_PLAYER),
            //   vopts:$ecConfig.get("video")
            // });
          }

        });
      }

    }
  }
})
.directive('videoPlayer', function($rootScope,$timeout,$ecStreamCtl,$chromecast,$ecPlayerStatus,$ecConfig,$player){
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

      scope._playerStatus = function(){
        return $ecPlayerStatus.status();
      }
      scope.$watch(function(){ return scope._playerStatus().volume; }, function(nv,ov){
        console.log("VOLUE CHANGE", nv);
        scope.videoEle.volume = nv/100;
      });

      var bind_keys = function(){
        $(window).on('keypress',function(e){
          console.log(e.which);
        });
      }

      $(ele)
        .on('mousemove',function(e){
          scope.mouseActive = true;
          scope._mouse.current = [e.clientX,e.clientY];
          $timeout.cancel(scope._dtimer);
          scope._dtimer= $timeout(_defer, scope._gracePeriod);
          scope._mouse.last = scope._mouse.current;
          scope.$apply();
        });

      function _defer(){
        if(angular.equals(scope._mouse.last,scope._mouse.current)){
          scope.mouseActive = false;
        }
      }
      scope._dtimer= $timeout(_defer, scope._gracePeriod);

      scope.videoEle.addEventListener('canplay',function(){
        $timeout(function(){ scope.videoEle.play(); }, 2000);
      });
      scope.videoEle.addEventListener('progress',function(e){
        console.log("PROGRESS", this.loaded);
      });
      scope.videoEle.addEventListener('play',function(){
        //$rootScope.playerState=$rootScope.STATE_PLAYING;
        $ecPlayerStatus.set("state", $rootScope.STATE_PLAYING);
      });
      scope.videoEle.addEventListener('pause',function(){
        //$rootScope.playerState=$rootScope.STATE_PAUSED;
        $ecPlayerStatus.set("state", $rootScope.STATE_PAUSED);
        $ecPlayerStatus.set("paused", true);
        $ecPlayerStatus.set("currentTime", scope.videoEle.currentTime + $ecPlayerStatus.get("seekOffset"));
      });
      scope.videoEle.addEventListener('ended',function(){
        $rootScope.playerState=$rootScope.STATE_STOPPED;
//        $rootScope.videoActive = false;
        $rootScope.$emit('player.ended', scope.videoEle.currentTime);
        $ecPlayerStatus.set("currentTime", 0);
        $rootScope.$apply();
      });
      scope.videoEle.addEventListener('timeupdate',function(e){
        $ecPlayerStatus.set("currentTime", scope.videoEle.currentTime + $ecPlayerStatus.get("seekOffset"));
        //$rootScope.$emit('player.timechange', scope.videoEle.currentTime);
        //$rootScope.$apply();
      });

      scope.$minify = function(){
        scope.minified=!scope.minified;
      }

      scope.start = function(stream){
        //$(scope.videoEle).prop("src", "http://localhost:3130/stream.mp4");
        console.log("PLAY", stream)
        $ecPlayerStatus.set("paused", false);
        $ecPlayerStatus.set("state", $rootScope.STATE_LOADING);
        $(scope.videoEle).prop("src", stream);
        scope.videoEle.volume = $ecPlayerStatus.get("volume")/100;
        scope.videoEle.load();
        $rootScope.isSeeking=false;
      }

      scope._stop = function(){
        //$rootScope.videoActive = false;
        //$ecPlayerStatus.set("paused", false);
        //$ecPlayerStatus.set("stopped", true);
        $ecPlayerStatus.set("currentTime", 0);

        scope.videoEle.pause();

        $(scope.videoEle).prop("src", "");
        //$rootScope.playerState=$rootScope.STATE_STOPPED;
      }
      scope.$stop = function(){
        //$rootScope.activeMedia = null;
        $ecPlayerStatus.set('media',null)
        $ecPlayerStatus.set("state", $rootScope.STATE_STOPPED);

        //first stop the stream
        $ecStreamCtl.stop();

        if($ecPlayerStatus.get("type")==$rootScope.CHROMECAST_PLAYER){
          $chromecast.stop();
        }else if($ecPlayerStatus.get("type")==$rootScope.LOCAL_PLAYER){
          scope._stop();
        }

      }
      $rootScope.$on('player.fullscreen', function(evt){

        if (BigScreen.enabled) {
            BigScreen.toggle();
            BigScreen.request(ele[0], function(){ console.log("enter"); }, function(){ console.log("exit"); }, function(e){ console.log("err",e); });
        }
        else {
            // fallback
        }
        // console.log("FULL");
        // if (ele[0].webkitRequestFullscreen) {
        //   console.log("GO FULL");
        //   ele[0].webkitRequestFullscreen();
        // }
      });


      $rootScope.$on('player.seek', function(evt,s){
        scope.videoEle.pause();
        $(ele).prop("src", "");

        $ecStreamCtl.stop();
        $ecStreamCtl.start($ecPlayerStatus.get('media'), s);

        //ipc.sendSync("transcode.stop");
        // ipc.send("transcode.stream", {
        //   inputFile:$rootScope.activeMedia.file.path,
        //   thumbnails:$rootScope.activeMedia.thumbnails,
        //   duration:$rootScope.activeMedia.meta.duration,
        //   http_stream:($rootScope.playerType == $rootScope.CHROMECAST_PLAYER),
        //   seek:s, vopts:$ecConfig.get("video")
        // });
        scope.start();
      });
      scope._pauseTime = 0;
      $rootScope.$on('player.pause', function(evt){
        scope._pauseTime = scope.videoEle.currentTime + $ecPlayerStatus.get("seekOffset");
        console.log(scope._pauseTime);
        scope.videoEle.pause();
      });
      $rootScope.$on('player.resume',function(evt){
        console.log(scope._pauseTime);
        //$rootScope.seekOffset = scope._pauseTime;
        $ecPlayerStatus.set("seekOffset", scope._pauseTime);
        $ecStreamCtl.start($ecPlayerStatus.get('media'), scope._pauseTime);

      //   ipc.send("transcode.stream", {
      //     inputFile:$rootScope.activeMedia.file.path,
      //     thumbnails:$rootScope.activeMedia.thumbnails,
      //     duration:$rootScope.activeMedia.meta.duration,
      //     http_stream:($rootScope.playerType == $rootScope.CHROMECAST_PLAYER),
      //     seek:scope._pauseTime,
      //     vopts:$ecConfig.get("video")
      // });
        scope.start();
      })
      $rootScope.$on('player.stop', function(evt,file){
        scope._stop();
      });
      $rootScope.$on('player.start', function(evt,file,stream){
        //$rootScope.videoActive = true;
        $rootScope.playerState=$rootScope.STATE_LOADING;
        console.log("PLAY", evt,file);
        scope.start(stream);
      });
    }
  }
})
.directive('contextGroup', function(){
  return {
    //scope: {},
    link: function(scope,ele,attr){
      scope.contextVisible = false;
      scope.position = [0,0];
      scope.selectedMedia = null;
      scope.contextStyle = function(){
        return {top:scope.position[1]+'px',left:scope.position[0]+'px'};
      }
      scope.item_play = function(){
        console.log("$PLAY", scope.selectedMedia);
        scope.$play(scope.selectedMedia);
      }

      $(window).on('click',function(e){
        scope.contextVisible = false;
        scope.$apply();
      });


    }
  }
})

.directive('contextRow', function($parse){
  return {
    //scope:{contextRow:'='},
    link: function(scope,ele,attr){
      //scope.item = scope.contextRow;
      //scope._visible = false;
      var item = $parse(attr.contextRow)(scope);
      // scope.item_play = function(){
      //   console.log("$PLAY", item);
      //   scope.$parent.$play(item);
      // }

      $(ele).on('mousedown',function(event){
        if(event.which==3){
          scope.$parent.selectedMedia = item;
          scope.$parent.selected = item.id;
          var maxX = $(window).width() - $(ele).parent().find('.context-menu').outerWidth();
          var cx = event.pageX > maxX ? maxX : event.pageX;
          console.log(maxX, cx);
          scope.$parent.position = [cx,event.pageY];
          scope.$parent.contextVisible = true;
          //$(ele).find('.context-menu').addClass('open');
          console.log("Context", event, scope.$parent.position);
          event.preventDefault();
          event.stopPropagation();
          scope.$apply();
        }
      });

    }
  }
})
.directive('newPlaylist',function($timeout,$media,$state){
  return {
    template:'<div><span class="icon icon-folder"></span> <input type="text" ng-model="val" /></div>',
    link: function(scope,ele,attr){
      scope.$input = $(ele).find('input');
      scope.val = 'New Playlist';

      ipc.on("playlist.create", function(evt,file){

      });
      scope.$watch('createMode',function(nv,ov){
        if(nv && !ov){
          $timeout(function(){scope.$input.focus();});
        }
      });
      scope.$input
      .on('keypress',function(e){
        if(e.which==13){
          scope.$input.blur();
          e.preventDefault();
        }
      })
      .on('focus', function(){
        scope.$input.select();
      })
      .on('blur', function(){
        console.log("BLUR", scope.$parent.createMode, scope.createMode);
        scope.createMode=false;
        var playlist = $media.addPlaylist(scope.val);
        $state.go('playlist', {listId:playlist.id});
      });
    }
  }
})
.directive('sidebarList',function($filter,$media){
  return {
    templateUrl: 'tpl/dir.sidebar-list.html',
    replace:true,
    link: function(scope,ele,attr){
      scope.createMode=false;
      scope.playlists = function(){ return $filter('orderBy')($media.playlists(), 'name'); }
      scope.createPlaylist = function(){
        scope.createMode=true;
      }
    }
  }
})
.directive('settingsView', function($ecConfig){
  return {
    templateUrl: 'tpl/dir.settings.html',
    link: function(scope,ele,attr){

      scope.settings = angular.copy($ecConfig.all());

    }
  }
})

.directive('mediaList',function($rootScope,$ecPlayerStatus,$ecStreamCtl,$filter,$timeout,$chromecast,$ecConfig,$player,$media){
  return {
    scope: {},
    replace:true,
    templateUrl: 'tpl/dir.media-list.html',
    link: function(scope,ele,attr){

      scope._activeMedia = function(){ return $ecPlayerStatus.get('media'); }

      scope.$context = function($event){
        var t = $event.target.localName=='span' ? $event.target.parentNode : $event.target;
        console.dir(t);
        //$(t).dropdown('show');
        //$event.preventDefault();
        $event.stopPropagation();
      }
      scope.$select = function(item){
        scope.selected = item.id;
      }
      scope.$play = function(item){
        console.log("PLAY", item);

        scope.selected = item.id
        $ecPlayerStatus.set('media', item);
        //$rootScope.activeMedia = item;
        //$rootScope.seekOffset = 0;
        $rootScope.playerType = $chromecast.isConnected() ? $rootScope.CHROMECAST_PLAYER : (item.file.type=='Audio' ? $rootScope.AUDIO_PLAYER : $rootScope.LOCAL_PLAYER);
        //start transcode
        var isStream = $rootScope.playerType == $rootScope.CHROMECAST_PLAYER;
        $ecStreamCtl.start(item);
        // ipc.send("transcode.stream", {
        //   thumbnails:$rootScope.activeMedia.thumbnails,
        //   inputFile:item.file.path,
        //   inputType:item.file.type,
        //   duration:item.meta.duration,
        //   http_stream:($rootScope.playerType == $rootScope.CHROMECAST_PLAYER),
        //   vopts:$ecConfig.get("video")
        // });

      }
      scope.list = function(){
        return $filter('orderBy')($media.list(), 'file.name');
      }
    }
  }
})
