//var chromecast = require('./electron-cast.js');
var util = require('util');
const ipc = require('electron').ipcRenderer
const app = require('electron').remote.app;

const Client                = require('castv2-client').Client
//const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver
// const ExtracastMediaReceiver  = require('../lib/chromecast-controller.js');
const ECMediaReceiver  = require('../lib/media-receiver.js');
const mdns                  = require('mdns')

const path = require("path");
const fs = require("fs");

//const shortid = require("shortid");
const uuidV1 = require("uuid/v1");
const low = require("lowdb");



const lowdb = low(app.getAppPath()+'/extracast-config.json');
//const lowdb = low()
lowdb.defaults({
  config:{video:{limitBitrate:false, bitrate:1200, size:"720", port:3130}},
  media: [],
  playlists: []
}).value();

const hhmmss = require("hh-mm-ss");


let client = new Client();

angular.module('ec.providers',[])

.factory("$ecLastFrameStore", function(){
  var canvas = document.createElement('canvas');
  //canvas.style.position = 'fixed';
  //canvas.style.bottom = '90px';
  //canvas.style.left = '0px';

  //document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var _img = null;
  var store = {
    get: function(){
      return _img;
    },
    clear: function(){
      _img = null;
    },
    store: function(video){
      canvas.width = 854;
      canvas.height = 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      _img = canvas.toDataURL();
    }
  };
  return store;
})

.provider('$ecPlayerStatus',function(){
  var self = this;

  this.$get = function($rootScope){
    var that = this;
    that._status = {
      paused:false,
      currentTime:0,
      seekOffset:0,
      volume:100,
      media:null,
      state:$rootScope.STATE_STOPPED,
      type:$rootScope.LOCAL_PLAYER
    };

    return {
      set: function(key,val){
        that._status[key] = val;
        if ($rootScope.$root.$$phase != '$apply' && $rootScope.$root.$$phase != '$digest') $rootScope.$apply();
      },
      get: function(key){
        return that._status[key];
      },
      state: function(){
        return that._status.state;
      },
      status: function(){
        return that._status;
      }
    }
  }
})
.provider("$ecConfig", function(){
  var self = this;
  self.config = lowdb.getState().config;
  this.$get = function($rootScope){
    var that = this;

    function _render(){
      that.config = lowdb.getState().config;
      if ($rootScope.$root.$$phase != '$apply' && $rootScope.$root.$$phase != '$digest') $rootScope.$apply();
    }

    return {
      availableVideoSizes: function(){
        return ['480','720','1080'];
      },
      set: function(config){
        lowdb
        //.get('config')
        .set("config", config)
        .value();
        _render();
      },
      all: function(){
        return that.config;
      },
      get: function(key){
        return self.config[key];
      }
    }
  }
})
.factory('$ecStreamCtl', function($rootScope,$ecPlayerStatus,$ecConfig){

  ipc.on("transcode.stats", function(event,stats){
    //console.log(event,stats);
    self.stats = stats;
  });

  var self = {
    stop: function(item){
      ipc.sendSync("transcode.stop");
    },
    //#todo figure out better stream pausing/playing
    // pause: function(){
    //   ipc.sendSync("transcode.pause");
    // },
    // resume: function(){
    //   ipc.sendSync("transcode.resume");
    // },
    start: function(item,seek){
      var opts = {
        thumbnails:item.thumbnails,
        inputFile:item.file.path,
        inputType:item.file.type,
        subtitles:item.subtitles,
        playerType: $ecPlayerStatus.get("type"),
        duration:item.meta.duration,
        vopts:$ecConfig.get("video")
      }
      if(seek){ opts.seek = seek; }
      ipc.send("transcode.stream", opts);
    }
  };
  return self;
})
.factory('audioPlayer', function(){
  this.audioEle = document.createElement('audio');
  this.audioEle.autoplay = true;

  var self = {
    start: function(item){
      this.audioEle.src = item;

    }
  };
  return self;
})
.provider("$player", function(){
  var self = this;


  this.$get = function($rootScope,$ecPlayerStatus,$chromecast){

    var that = this;

    ipc.on('transcode.ready', function(event, item, stream){
      if($ecPlayerStatus.get("type")==$rootScope.LOCAL_PLAYER){
        $rootScope.$emit('player.start', item, stream);
        $rootScope.$apply();
      }else if($ecPlayerStatus.get("type")==$rootScope.CHROMECAST_PLAYER){
        $chromecast.start(item, stream);
      }
    });

    // that._playing=false;
    // $rootScope.$on('player.start', function(evt,file){
    //   that._playing=true;
    // });

    return {
      seek: function(s){
        $rootScope.$emit('player.seek', s);
      },
      start: function(item){
        //console.log("START");
        //$rootScope.$emit('player.start', item);
        //that._playing=true;
      },
      fullscreen: function(){
        $rootScope.$emit('player.fullscreen');
      },
      volume: function(v){
        $ecPlayerStatus.set("volume", v);
      },
      pause: function(){

        if($ecPlayerStatus.get("state")==$rootScope.STATE_PLAYING){
           $rootScope.$emit('player.pause');
        }else if($ecPlayerStatus.get("state")==$rootScope.STATE_PAUSED){
          $rootScope.$emit('player.resume');
        }
        //   //ipc.sendSync("transcode.stop");
        //   $rootScope.$emit('player.pause');
        // }else{
        //   $rootScope.$emit('player.resume');
        // }
      },
      stop: function(item){
        $rootScope.$emit('player.stop', item);
        that._playing=false;
      }
    }
  }
})
.provider('$media', function(){
  var self = this;
  self._currentFile = null;
  self._currentStats = {};
  self._currentMeta = {};
  self._bufferReady = false;

  var state = lowdb.getState();
  self.media = state.media;
  self.playlists = state.playlists;

  this.$get = function($rootScope,$ecPlayerStatus){
    var that = this;

    function _render(){
      var state = lowdb.getState()
      that.media = state.media;
      that.playlists = state.playlists;
      if ($rootScope.$root.$$phase != '$apply' && $rootScope.$root.$$phase != '$digest') $rootScope.$apply();
    }

    ipc.on('transcoder.probe.result', function(event,params){
      var meta = {
        format: params.meta.format.format_long_name,
        duration:Math.round(params.meta.format.duration),
        size: Math.round(params.meta.format.size)
      };

      var vstream = params.meta.streams.find(function(it){ return it.codec_type=="video"; });
      if(vstream){
        meta.dimensions = {width:vstream.width, height:vstream.height};
        meta.video_codec = vstream.codec_name;
      }
      var astream = params.meta.streams.find(function(it){ return it.codec_type=="audio"; });
      if(astream){
        meta.audio_codec = astream.codec_name;
      }
      subtitle_scan(params.fileId, function(err,subs){
        lowdb.get('media')
        .find({ id: params.fileId })
        .assign({ meta: meta })
        .assign({ subtitles: subs })
        .assign({ thumbnails: params.thumbnails })
        .value();
        _render();
      });
    });

    function subtitle_scan(itemId, callback){
      var obj = __m.findById(itemId);
      var inputPath = path.parse(obj.file.path);
      var subs = path.join(inputPath.dir,(inputPath.name+".srt"));
      if(!fs.existsSync(subs)){ subs = null; }
      //var dir = path.dirname(inputPath);

      //var subs = fs.readdirSync(dir).filter(function(it){ return /\.srt/g.test(it); }).map(function(it){ return {path:path.join(dir,it), name:it, type:"srt"}; });
      //check for subtitle files in folder
      callback(null, subs);
    }

    var __m = {
      add: function(file){
        var item = { id: uuidV1(), file:angular.copy(file), meta:null };
        console.log("PUSH!", item);
        lowdb.get('media').push(item).value();
        _render();
        ipc.send("transcoder.probe.input", {input:item});
      },
      remove: function(fileId){
        lowdb.get('media').remove({id:fileId}).value();
        _render();
      },
      list: function(){
        return that.media;
      },
      playlists: function(){
        return that.playlists;
      },
      addPlaylist: function(name){
        var item = angular.copy({ id: uuidV1(), name:name, created: new Date(), media:[] });
        console.log("PUSH!", item);
        lowdb.get('playlists').push(item).value();
        _render();
        return item;
      },
      addToPlaylist: function(item,playlist){
        var list = lowdb.get('playlists').find({ id: playlist.id }).value();
          if(list.media.indexOf(item.id) === -1){
            list.media.push(item.id);
            lowdb.get('playlists').find({ id: playlist.id }).assign({media:list.media}).value();
          }
          _render();
          console.log(list);
          //.push({ media: [item.id] })
          //.value()

      },
      removePlaylist: function(id){
        lowdb.get('playlists').remove({id:id}).value();
        _render();
      },
      set: function(file){
        that._currentFile = file;
        $rootScope.$apply();
      },
      findById: function(id){
        //that._currentFile = that.media.find(function(it){ return it.id==id; });
        return that.media.find(function(it){ return it.id==id; });
        //console.log("FILE", that._currentFile);
        //$rootScope.$apply();
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
    };

    return __m;
  }
})
.provider('$chromecast', function(){


  var self = this;
  self._castList = [];
  self._playing = false;
  self._connected = false;

  // $rootScope.CHROMECAST_IDLE = 1;
  // $rootScope.CHROMECAST_CONNECTING = 2;
  // $rootScope.CHROMECAST_CONNECTED = 3;



  this.$get = function($q,$rootScope,$ecConfig,$ecStreamCtl,$ecPlayerStatus,$media){
    var that = this;

    that._state = $rootScope.CHROMECAST_IDLE;

    that.browser = mdns.createBrowser(mdns.tcp('googlecast'));
    that.browser.on('serviceUp', function(service) {
      console.log('found castable device', service.name, service.addresses[0], service.port);
      client.connect(service.addresses[0], function(){
        client.getSessions(function(e,r){
          var _sess = r.find(function(it){ return it.appId==ECMediaReceiver.APP_ID; });

          if(that._castList.indexOf(service) == -1){
            that._castList.push(service);
          }
          if(_sess){
            client.join(_sess, ECMediaReceiver, function(e,player){
              console.log("AREADY ACTIVE",_sess,player);
              that._postConnect(player);
              that._listen();
              // player.getStatus(function(err,status){
              //   that._updateStatus(status,true);
              // });
            });
          }else{
            $rootScope.$apply();
          }

        });
      });
      //   client.getSessions(function(err,sess){
      //     service._sessions = sess;
      //     console.log(service);
      //     //if our app is active
      //   });
      // });
      //callback(null, service);
      //browser.stop();
    });

    // ipc.on("chromeast.quit", function(event){
    //   //console.log(event,stats);
    //   if(that._player) that._player.stop();
    // });



    that.browser.start();

    that._start = function(){

    }
    that._updateStatus = function(status){
      //var s = $rootScope.STATE_STOPPED;
      if(status){
        console.log("STTTTT", status);
        if(status.media_id){
          var mediaId = status.media;
          var media = $media.findById(mediaId);
          if(media)
            $ecPlayerStatus.set('media', media);
        }

        // if(status.playerState=="IDLE" && status.playerState!="LOADING"){
        //   s = $rootScope.STATE_STOPPED;
        //   $ecPlayerStatus.set('media', null);
        //   $ecPlayerStatus.set('currentTime',0);
        // }
        //

        if(status.currentTime){
          $ecPlayerStatus.set('currentTime', status.currentTime);
        }
        if(status.status){
          console.log(status.status);
          if(status.status==$rootScope.STATE_STOPPED){
            $ecPlayerStatus.set('media', null);
            $ecPlayerStatus.set('currentTime',0);
          }
          $ecPlayerStatus.set("state", status.status);
        }




        // if(init){
        //   console.log("INIT CC", status);
        //   var s = $rootScope.STATE_STOPPED;
        //   switch(status.playerState){
        //     case 'BUFFERING':
        //     case 'PLAYING':
        //       //s = $rootScope.STATE_PLAYING;
        //       break;
        //     case 'IDLE':
        //       s = $rootScope.STATE_STOPPED;
        //       break;
        //   }
        // }
      }
    }
    that._postDisconnect = function(){
      $ecPlayerStatus.set("type", $rootScope.LOCAL_PLAYER);
      that._connected=false;
      that._state = $rootScope.CHROMECAST_IDLE;
      that._player = null;
      //$rootScope.$apply();
    }

    that._postConnect = function(player){
      that._player = player;
//      $rootScope.playerType=$rootScope.CHROMECAST_PLAYER;
      $ecPlayerStatus.set("type", $rootScope.CHROMECAST_PLAYER);

      that._connected=true;
      that._state = $rootScope.CHROMECAST_CONNECTED;


      console.log('app "%s" launched', that._player.session.displayName);

      $rootScope.$apply();

      //that._player.getStatus(function(){});

      // setInterval(function(){
      //   that._player.getStatus(function(e,s){
      //     console.log(s.currentTime);
      //   });
      // },1000);
    }
    that._listen = function(){
      // that._player.on('message', function(message) {
      //   console.log('status broadcast message=', message);
      // });
      // that._player.on('timeupdate', function(status) {
      //   console.log('status broadcast timeupdate=', status);
      //   $ecPlayerStatus.set("currentTime", v);
      // });
      that._player.on('status', function(status) {
        that._updateStatus(status);
        console.log('status update', status);
        //if(status.playerState=="BUFFERING")
          //$rootScope.playerState = $rootScope.STATE_LOADING;
        //if(status.playerState=="PLAYING") $rootScope.playerState = $rootScope.STATE_PLAYING;
        //$ecPlayerStatus.set("state", $rootScope.STATE_LOADING);
      });
    }

    that._getIpAddress = function(callback){
      require('dns').lookup(require('os').hostname(), function (err, addr, fam) {
        callback(err, addr);
      });
    }
    return {
      isPlaying: function(){
        return that._playing;
      },
      state: function(){
        return that._state;
      },
      isConnected: function(){
        return that._connected;
      },
      volume: function(v){
        console.log("ch-VOL",v);
        client.setVolume({level:v/100}, function(err,ev){
          $ecPlayerStatus.set("volume", v);
          console.log(err,ev);
        });
      },
      seek: function(s){

        $ecStreamCtl.stop();
        $ecStreamCtl.start($ecPlayerStatus.get('media'), s);
        $ecPlayerStatus.set("seekOffset", s);
        // ipc.sendSync("transcode.stop");
        // ipc.send("transcode.stream", {
        //   inputFile:$rootScope.activeMedia.file.path,
        //   duration:$rootScope.activeMedia.meta.duration,
        //   seek:s,
        //   vopts:$ecConfig.get("video")
        // });
      },
      start: function(item,streamUrl){
        that._playing = true;
        console.log("START!!");
        //$rootScope.playerState=$rootScope.STATE_LOADING;
        $ecPlayerStatus.set('state', $rootScope.STATE_LOADING);

        that._getIpAddress(function(err,addr){
          var port = $ecConfig.get("video").port;

          //var streamUrl = util.format("https://%s.xip.io:%s/stream.mp4", addr.replace(/\./g,"-"), port);

          console.log('streamUrl: %s', streamUrl);

          var media = {
            // Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
            contentId: streamUrl,
            contentType: 'video/mp4',
            streamType: 'LIVE', // BUFFERED or LIVE
            customData: {
              media_id:$ecPlayerStatus.get('media').id,
              seek_offet:$ecPlayerStatus.get('seekOffset'),
              subtitlesEnabled: false,
            },
            //duration: item.meta.duration,
            metadata: {
              type: 0,
              metadataType: 0,
              duration: $ecPlayerStatus.get('media').meta.duration,
              title: $ecPlayerStatus.get('media').file.name,
              images: [
                { name:"lg", url: util.format("https://%s.extcast.net:%s/lg-%s.jpg", addr.replace(/\./g,"-"), port, $ecPlayerStatus.get('media').id) },
                { name:"sm", url: util.format("https://%s.extcast.net:%s/sm-%s.jpg", addr.replace(/\./g,"-"), port, $ecPlayerStatus.get('media').id) }
              ]
            }
          };

          if($ecPlayerStatus.get('media').subtitles){
            media.customData.subtitles = util.format("https://%s.extcast.net:%s/subs-%s.srt", addr.replace(/\./g,"-"), port, $ecPlayerStatus.get('media').id);
          }
//          console.log('app "%s" launched, loading media %s ...', that._player.session.displayName, media.contentId);
          that._player.control({action:'start',media:media});


        });


      },
      // activeFile: function(){
      //   return that._file;
      // },
      stop: function(){
        //that._playing=false;
        console.log("CHROME STOP!");
        console.log(that._player);
        if(that._player){
          that._player.control({action:"stop"});
        }
      },
      pause: function(){
        if($ecPlayerStatus.get("state")==$rootScope.STATE_PLAYING){
          console.log("PAUSE");
          $ecPlayerStatus.set("state",$rootScope.STATE_PAUSED);
          $ecPlayerStatus.set("seekOffset", $ecPlayerStatus.get("currentTime"));
          $ecStreamCtl.stop();
          that._player.control({action:"pause"});
        }else if($ecPlayerStatus.get("state")==$rootScope.STATE_PAUSED){
          console.log("RESUME");
          $ecPlayerStatus.set("state",$rootScope.STATE_LOADING);
          //that._player.control({action:"stop"});
          $ecStreamCtl.start($ecPlayerStatus.get('media'), $ecPlayerStatus.get("seekOffset"));

        }
        // if($ecPlayerStatus.get("state")==$rootScope.STATE_PLAYING){
        //   console.log("PAUSE");
        //    that._player.pause();
        // }else if($ecPlayerStatus.get("state")==$rootScope.STATE_PAUSED){
        //   console.log("RESUME");
        //   that._player.play();
        //   //$rootScope.$emit('player.resume');
        // }

        // var fn = that._playing ? 'pause':'play';
        // that._playing=!that._playing;
        // console.log(fn);
        // that._player[fn](function(){
        //   console.log("PAUSED");
        // });
      },
      disconnect: function(){
        that._player.control({action:"close"});
        that._postDisconnect();
        //session.stop(that._player.session);
      },
      toggleCaptions: function(){
        that._player.control({action:"subtitles"});
      },
      togglePictureMode: function(){
        that._player.control({action:"picturemode"});
      },
      connect: function(host){

        that._state = $rootScope.CHROMECAST_CONNECTING;

        var defer = $q.defer();
        //client.connect(host, function() {
          console.log('connected!, launching app ...');
          //client.getSessions(function(err,sess){

            client.launch(ECMediaReceiver, function(err, player) {
              //$rootScope.castConnected = true;
              that._postConnect(player);
              that._listen();
              defer.resolve();


            });

          //});

        //});
        return defer.promise;
      },
      list: function(){
        return that._castList;
      }

    }
  }
})
