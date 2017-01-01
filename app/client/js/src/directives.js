var $ = jQuery = require('jquery');

var util = require('util');
var ipc = require('electron').ipcRenderer;
var shell = require('electron').shell;
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
    //scope: {},
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
      scope._controlDisabled = function(){
        return ![$rootScope.STATE_PLAYING, $rootScope.STATE_PAUSED].includes($ecPlayerStatus.get("state"));
      }
      scope._rootStatus = function(s){
        return $rootScope[s];
      }
      scope._playerStatus = function(){
        return $ecPlayerStatus.status();
      }

      scope._timeMath = function(){
        return scope._playerStatus().currentTime > 0 && scope._activeMedia() ? scope._playerStatus().currentTime / scope._activeMedia().meta.duration * 100 : 0;
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

      scope.$captions = function(){
        $chromecast.toggleCaptions();
      }

      scope.$fullscreen = function(){
        if($ecPlayerStatus.get("type")==$rootScope.LOCAL_PLAYER)
          $player.fullscreen();
        if($ecPlayerStatus.get("type")==$rootScope.CHROMECAST_PLAYER)
          $chromecast.togglePictureMode();
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
.directive('chromecastButton', function($chromecast,$player,$ecStreamCtl,$ecPlayerStatus,$ecConfig,$rootScope){
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
            $ecStreamCtl.start($ecPlayerStatus.get('media'),ctime);

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
.directive('videoPlayer', function($rootScope,$ecLastFrameStore,$timeout,$ecStreamCtl,$chromecast,$ecPlayerStatus,$ecConfig,$player){
  return {
    templateUrl: 'tpl/dir.video-player.html',
    replace: true,
    link: function(scope,ele,attr){
      scope.videoEle = ele.find('video')[0];
      scope.videoEle.controls = false;
      //scope.videoEle.autoplay = true;
      //scope.videoEle.preload = "none";


      scope._isResuming = false;
      scope._gracePeriod = 2000;
      scope.mouseActive = true;
      scope._mouse = {current:[],last:[]};

      scope._splashBg = function(){
        var isLastFrame = !!$ecLastFrameStore.get();
        var url = isLastFrame ? $ecLastFrameStore.get() : (scope._playerStatus().media ? 'file://'+scope._playerStatus().media.thumbnails.full : '');

        var o = {'background-image':'url(\''+url+'\')'};
        if(isLastFrame){
          o['background-size'] = 'contain';
        }
        return o;
      }
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
        console.log("CAN PLAY");
        $timeout(function(){
        scope.videoEle.play();
        });
        $ecPlayerStatus.set("state", $rootScope.STATE_PLAYING);
      });
      //scope.videoEle.addEventListener('progress',function(e){
        //console.log("PROGRESS", e);
      //});

      // scope.videoEle.addEventListener('progress',function(e){
      //   // var loaded = e.loaded;
      //   console.log("progress", scope.videoEle.loaded, scope.videoEle.duration);
      //   if(!isNaN(scope.videoEle.duration) && scope.videoEle.paused && scope.videoEle.paused){
      //     console.log("PLAY");
      //     scope.videoEle.play();
      //   }
      // });

      scope.videoEle.addEventListener('play',function(){
        //$rootScope.playerState=$rootScope.STATE_PLAYING;
        //$ecPlayerStatus.set("state", $rootScope.STATE_PLAYING);
      });
      scope.videoEle.addEventListener('pause',function(){
        $ecLastFrameStore.store(scope.videoEle);
        //$rootScope.playerState=$rootScope.STATE_PAUSED;
        //$ecPlayerStatus.set("state", $rootScope.STATE_PAUSED);
        //$ecPlayerStatus.set("paused", true);
        //$ecPlayerStatus.set("currentTime", scope.videoEle.currentTime + $ecPlayerStatus.get("seekOffset"));
      });
      scope.videoEle.addEventListener('ended',function(){
        console.log("STOPPED");
        scope.$stop(true);
//
// //        $rootScope.videoActive = false;
//         $rootScope.$emit('player.ended');
//         $ecPlayerStatus.set("currentTime", 0);
//         $rootScope.$apply();
      });
      scope.videoEle.addEventListener('timeupdate',function(e){
        if($ecPlayerStatus.get("state")==$rootScope.STATE_PLAYING){
          $ecPlayerStatus.set("currentTime", scope.videoEle.currentTime + $ecPlayerStatus.get("seekOffset"));
        }
        //$rootScope.$emit('player.timechange', scope.videoEle.currentTime);
        //$rootScope.$apply();
      });

      scope.$minify = function(){
        scope.minified=!scope.minified;
      }

      scope.start = function(opts){

        //scope.videoEle.src = "";
        //$ecPlayerStatus.set("paused", false);
        // if(!opts.resume){
        //   $ecPlayerStatus.set("state", $rootScope.STATE_LOADING);
        // }
        //$(scope.videoEle).prop("src", stream);

        $(scope.videoEle).prop("src", opts.streamUrl);
        scope.videoEle.volume = $ecPlayerStatus.get("volume")/100;
        //scope.videoEle.load();
        //scope.videoEle.play();
        $rootScope.isSeeking=false;
      }


      scope.$stop = function(playerRequested){
        //$rootScope.activeMedia = null;
        $ecPlayerStatus.set('media',null)
        $ecPlayerStatus.set("state", $rootScope.STATE_STOPPED);
        $ecPlayerStatus.set("currentTime", 0);
        $ecPlayerStatus.set("seekOffset", 0);

        if(!playerRequested){
          //first stop the stream
          $ecStreamCtl.stop();


          if($ecPlayerStatus.get("type")==$rootScope.CHROMECAST_PLAYER){
            $chromecast.stop();
          }else if($ecPlayerStatus.get("type")==$rootScope.LOCAL_PLAYER){
            scope.videoEle.pause();
            $(scope.videoEle).prop("src", "");
          }
        }

      }
      $rootScope.$on('player.fullscreen', function(evt){
        if($ecPlayerStatus.get("type")!=$rootScope.CHROMECAST_PLAYER){
          if (BigScreen.enabled) {
              BigScreen.toggle();
              BigScreen.request(ele[0], function(){ console.log("enter"); }, function(){ console.log("exit"); }, function(e){ console.log("err",e); });
          }else{
              // fallback
          }
        }
        // console.log("FULL");
        // if (ele[0].webkitRequestFullscreen) {
        //   console.log("GO FULL");
        //   ele[0].webkitRequestFullscreen();
        // }
      });


      $rootScope.$on('player.seek', function(evt,s){
        $ecStreamCtl.stop();
        scope.videoEle.pause();
        scope._isResuming=true;
        $ecStreamCtl.start($ecPlayerStatus.get('media'), s);
        //scope.start({resume:true});
      });

      $rootScope.$on('player.pause', function(evt){
        console.log("PAUSE");
        $ecPlayerStatus.set("state", $rootScope.STATE_PAUSED);
        $ecPlayerStatus.set("seekOffset", $ecPlayerStatus.get("currentTime"));
        $ecStreamCtl.stop();
        scope.videoEle.pause();
      });
      $rootScope.$on('player.resume',function(evt){
        console.log("RESUME");
        // scope._isResuming=true;
        $ecPlayerStatus.set("state", $rootScope.STATE_PLAYING);
        $ecStreamCtl.start($ecPlayerStatus.get('media'), $ecPlayerStatus.get("seekOffset"));
      })
      $rootScope.$on('player.stop', function(evt,file){
        scope.videoEle.pause();
        $(scope.videoEle).prop("src", "");
        //scope._stop();
        //scope._isResuming=false;
      });

      $rootScope.$on('player.start', function(evt,item,streamUrl){
        $(scope.videoEle).prop("src", "");
        $ecPlayerStatus.set("state", $rootScope.STATE_LOADING);
        scope.start({resume:scope._isResuming, streamUrl:streamUrl});
      });
    }
  }
})
.directive('contextGroup', function($parse,$templateRequest,$compile,$rootScope){
  return {
    restrict: 'A',
    scope: {
      contextGroup:'='
    },
    controllerAs: '$ctl',
    controller: function($scope){
      console.log("ctx", $scope.contextGroup);
      var self = this;
      //$scope.$ctl = this;
      this.visible = false;
      this.position = [0,0];
      this.selectedItem = null;

      this._isVisible = function(){
        return this.visible;
      }
      this._contextStyle = function(){
        return {top:self.position[1]+'px',left:self.position[0]+'px'};
      }

      $rootScope.$on('close.context', function(){
        if(self.visible){
          $scope.$parent.selected = null;
          self.enableScroll();
        }
        self.visible = false;
      });

        function preventDefault(e) {
        e = e || window.event;
        if (e.preventDefault)
            e.preventDefault();
        e.returnValue = false;
      }
      this.disableScroll = function() {
        if (window.addEventListener) // older FF
            window.addEventListener('DOMMouseScroll', preventDefault, false);
        window.onwheel = preventDefault; // modern standard
        window.onmousewheel = document.onmousewheel = preventDefault; // older browsers, IE
        window.ontouchmove  = preventDefault; // mobile
        //document.onkeydown  = preventDefaultForScrollKeys;
      }

      this.enableScroll = function() {
          if (window.removeEventListener)
              window.removeEventListener('DOMMouseScroll', preventDefault, false);
          window.onmousewheel = document.onmousewheel = null;
          window.onwheel = null;
          window.ontouchmove = null;
          document.onkeydown = null;
      }

      this.$select = function(item,sub){
        if(typeof item.fn=='function'){
          item.fn(self.selectedItem);
        }else if(typeof sub.fn=='function'){
          sub.fn(self.selectedItem, sub);
        }
        //$scope.$parent.$emit("context.select", item);
      }


    },
    link: function(scope,ele,attr,$ctl){

      scope.$watch('contextGroup',function(nv){
        console.log("ctx-ch", nv);
        scope.options = nv;
      });
      //scope.options = $parse(attr.contextGroup)(scope);

      scope.selectedMedia = null;

      // scope._isVisible = function(){
      //   return scope.visible;
      // }
      // scope._contextStyle = function(){
      //   console.log('pos', scope.position);
      //   return {top:scope.position[1]+'px',left:scope.position[0]+'px'};
      // }
      //
      //
      //
      $(window).on('click',function(e){
        $rootScope.$emit('close.context');
        $rootScope.$apply();
      });

      $templateRequest("tpl/tpl.dropdown.html").then(function(html){
         var template = angular.element(html);
         ele.append(template);
         //scope.$menu = template.find('.context-menu');
         $ctl.$menu = $(ele).parent().find('.context')[0];
         $compile(template)(scope);
      });


    }
  }
})

.directive('contextRow', function($rootScope,$parse){
  return {
    //scope:{contextRow:'='},
    require: "^contextGroup",
    link: function(scope,ele,attr,contextGroup){
      //scope.item = scope.contextRow;
      //scope._visible = false;
      var item = $parse(attr.contextRow)(scope);

      // scope.item_play = function(){
      //   console.log("$PLAY", item);
      //   scope.$parent.$play(item);
      // }

      $(ele).on('mousedown',function(event){
        //scope.$parent.selected = item.id;
        //$rootScope.$emit('close.context');
        console.log($(ele).parent().find('context'));
        if(event.which==3){
          scope.$parent.selected = item.id;
          $rootScope.$emit('close.context');
          contextGroup.position = [event.pageX, event.pageY];
          contextGroup.visible = true;
          contextGroup.selectedItem = item;
          contextGroup.disableScroll();
          $rootScope.$apply();
          console.log('rgt-click', contextGroup.$menu);
          event.preventDefault();
          event.stopPropagation();


        //   //$rootScope.$emit('close.context');
        //   //var maxX = $(window).width() - $(ele).parent().closest('.context-menu').outerWidth();
        //   var maxX =  $(window).width() - 400;
        //   var cx = event.pageX > maxX ? maxX : event.pageX;
        //   scope.$parent.position = [cx, event.pageY];
        //   scope.$parent.visible = true;
        //   scope.$parent.selectedMedia = item;
        //
        //   //scope.$parent.selected = item.id;
        }
        // scope.$parent.$apply();
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

      scope.contextOptions = [
        {
          id:'edit',
          label:'Edit',
          fn:function(item){
            console.log("EDIT", item);
          }
        },
        {
          id: 'remove',
          label: 'Remove',
          fn: function(item){
            $media.removePlaylist(item.id);
            console.log("remove Playlist", item);
          }
        }
      ];
      // scope.$on('context.select', function(v){
      //   console.log("sidebar.context.select", v);
      // });
      scope.createMode=false;
      //scope.playlists = function(){ return $filter('orderBy')($media.playlists(), 'name'); }
      scope.playlists = function(){ return $media.playlists(); }
      scope.createPlaylist = function(){
        scope.createMode=true;
      }
    }
  }
})
.directive('settingsView', function($ecConfig,$timeout){
  return {
    templateUrl: 'tpl/dir.settings.html',
    link: function(scope,ele,attr){
      scope.timer = $timeout();

      scope.settings = angular.copy($ecConfig.all());
      scope.$watch('settings',function(nv,ov){
        if(nv && nv!=ov){
          $timeout.cancel(scope.timer);
          scope.timer = $timeout(function(){
            //debounce commit to DB
            $ecConfig.set(nv);
          },600);
        }
      },true);
    }
  }
})

.directive('mediaList',function($rootScope,$sce,$ecPlayerStatus,$ecStreamCtl,$filter,$timeout,$chromecast,$ecConfig,$player,$media){
  return {
    //scope: {},
    replace:true,
    templateUrl: 'tpl/dir.media-list.html',
    link: function(scope,ele,attr){

      var playListMenu = function(){
        return $media.playlists().map(function(it){
          var pselect = function(item){
            $media.addToPlaylist(item, it);
            //console.log("ADD TO PLAYLIST", item, it);
          }
          return {label:it.name, fn: pselect};
        });
      }
      // [
      //   {
      //     label:"Playlist 1",
      //     fn: function(item,subItem){
      //
      //     }
      //   }
      // ];
      scope.contextOptions = [
        {
          label:'Edit',
          fn:function(item){
            console.log("EDIT", item);
          }
        },
        {
          label:$sce.trustAsHtml("Add to Playlist&hellip;"),
          menu: playListMenu()
        },
        {
          label: 'Show in Finder',
          fn: function(item){
            shell.showItemInFolder(item.file.path);
          }
        },
        {
          label:'Remove',
          fn:function(item){
            $media.remove(item.id);
            console.log("REMOVE", item.id);
          }
        }
      ];
      //   {id:'edit',label:'Edit', fn:function(){ console.log("ML_EDIT"); }},
      //   {id:'reveal',label:'Reveal', fn:function(){ console.log("ML_REVA"); }},
      //   {id:'remove',label:'Remove', fn:function(){ console.log("ML_REMOVE"); }}
      // ];
      // scope.$on('context.select', function(v){
      //   console.log("media.context.select", v);
      // });

      scope._activeMedia = function(){ return $ecPlayerStatus.get('media'); }

      scope.list = function(){
        return $filter('orderBy')($media.list(), 'file.name');
      }

      // scope.item_reveal = function(){
      //   var media = $media.findById(scope.selected);
      //   console.log("$reveal", media);
      //   shell.showItemInFolder(media.file.path);
      // }
      //
      // scope.item_play = function(){
      //   var media = $media.findById(scope.selected);
      //   console.log("$play", media);
      // }
      //
      // scope.item_remove = function(){
      //   var media = $media.findById(scope.selected);
      //   console.log("$remove", media);
      // }


      scope.$select = function(item){
        scope.selected = item.id;
      }

      //item was double clicked...
      scope.$play = function(item){
        console.log("PLAY", item);

        scope.selected = item.id
        $ecPlayerStatus.set('media', item);
        $rootScope.playerType = $chromecast.isConnected() ? $rootScope.CHROMECAST_PLAYER : (item.file.type=='Audio' ? $rootScope.AUDIO_PLAYER : $rootScope.LOCAL_PLAYER);
        //start transcode
        var isStream = $rootScope.playerType == $rootScope.CHROMECAST_PLAYER;
        $ecStreamCtl.start(item);

      }
    }
  }
})
