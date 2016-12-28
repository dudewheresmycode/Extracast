//var chromecast = require('./electron-cast.js');
var util = require('util');
const ipc = require('electron').ipcRenderer
const app = require('electron').remote.app;

const Client                = require('castv2-client').Client
const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver
const ECMediaReceiver  = require('../media-receiver.js');
const mdns                  = require('mdns')

const shortid = require("shortid");
const low = require("lowdb");



const lowdb = low(app.getAppPath()+'/extracast-config.json');
//const lowdb = low()
lowdb.defaults({ media: [], config:{video:{bitrate:1200, size:"720", port:3130}}}).value();

const hhmmss = require("hh-mm-ss");


let client = new Client();

angular.module('ec.providers',[])

.provider('$ecPlayerStatus',function(){
  var self = this;

  this.$get = function($rootScope){
    var that = this;
    that._status = {playing:false, currentTime:0, state:$rootScope.STATE_STOPPED, type:$rootScope.LOCAL_PLAYER};

    return {
      set: function(key,val){
        return that._status[key] = val;
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
  console.log("CONFIG", self.config);

  this.$get = function($rootScope){
    var that = this;
    function _render(){
      that.config = lowdb.getState().config;
      $rootScope.$apply();
    }

    return {
      availableVideoSizes: function(){
        return ['480','720','1080'];
      },
      set: function(opt){
        lowdb.get('config')
        .set("config."+key, value)
        .value();
        _render();
      },
      get: function(key){
        return self.config[key];
      }
    }
  }
})
.provider("$player", function(){
  var self = this;


  this.$get = function($rootScope,$chromecast){

    var that = this;

    ipc.on('transcode.ready', function(event, item, stream){
      console.log("READY");
      if($rootScope.playerType==$rootScope.LOCAL_PLAYER){
        console.log("LOCAL START");
        $rootScope.$emit('player.start', item, stream);
        $rootScope.$apply();
      }else if($rootScope.playerType==$rootScope.CHROMECAST_PLAYER){
        $chromecast.start(item);
      }
    });

    that._playing=false;
    $rootScope.$on('player.start', function(evt,file){
      that._playing=true;
    });
    return {
      seek: function(s){
        $rootScope.$emit('player.seek', s);
      },
      start: function(item){
        console.log("START");
        $rootScope.$emit('player.start', item);
        that._playing=true;
      },
      fullscreen: function(){
        $rootScope.$emit('player.fullscreen');
      },
      pause: function(){
        console.log("IS PLAYING", that._playing)
        if(that._playing){
          ipc.sendSync("transcode.stop");
          $rootScope.$emit('player.pause');
        }else{
          $rootScope.$emit('player.resume');
        }
        that._playing = !that._playing;
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

  self.media = lowdb.getState().media;

  this.$get = function($rootScope){
    var that = this;

    function _render(){
      var state = lowdb.getState()
      that.media = state.media;
      $rootScope.$apply();
    }

    // ipc.on('ffmpeg-update', function(event,params){
    //   that._currentStats = params;
    //   $rootScope.$apply();
    //   var time = moment.duration(params.time).as('seconds');
    //   var sec = hhmmss.toS(params.time);
    //   console.log(time);
    //   if(time > 15 && !that._bufferReady){
    //     that._bufferReady=true;
    //     $rootScope.$emit('buffer-ready');
    //   }
    //
    // });

    ipc.on('transcoder.probe.result', function(event,params){
      console.log("PROBED", event, params);
      //fileObject._probe = params;
      var meta = {
        format: params.meta.format.format_long_name,
        duration:Math.round(params.meta.format.duration),
        size: Math.round(params.meta.format.size)
        //streams:params.meta.streams
      };

      lowdb.get('media')
      .find({ id: params.fileId })
      .assign({ meta: meta })
      .assign({ thumbnails: params.thumbnails })
      .value();
      _render();
    });


    return {
      add: function(file){
        var item = { id: shortid.generate(), file:{name:file.name, path:file.path, size:file.size}, meta:{} };
        lowdb.get('media').push(item).value();
        _render();
        ipc.send("transcoder.probe.input", {inputFile:file.path, fileId:item.id});
      },
      list: function(){
        return that.media;
      },
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


  var self = this;
  self._castList = [];
  self._playing = false;
  self._connected = false;

  // $rootScope.CHROMECAST_IDLE = 1;
  // $rootScope.CHROMECAST_CONNECTING = 2;
  // $rootScope.CHROMECAST_CONNECTED = 3;



  this.$get = function($q,$rootScope,$ecConfig,$media){
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
            client.join(_sess, ECMediaReceiver, function(e,ra){
              console.log("AREADY ACTIVE",e,ra);
              that._connected=true;
              that._postConnect(ra);
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
    that.browser.start();

    that._start = function(){

    }
    that._postDisconnect = function(){
      that._player = null;
      $rootScope.playerType=$rootScope.LOCAL_PLAYER;
      that._connected=false;
      that._state = $rootScope.CHROMECAST_IDLE;
      //$rootScope.$apply();
    }

    that._postConnect = function(player){
      that._player = player;
      $rootScope.playerType=$rootScope.CHROMECAST_PLAYER;
      that._connected=true;
      that._state = $rootScope.CHROMECAST_CONNECTED;

      console.log('app "%s" launched', that._player.session.displayName);

      that._player.on('message', function(message) {
        console.log('status broadcast message=', message);
      });
      that._player.on('timeupdate', function(status) {
        console.log('status broadcast playerState=', status);
      });
      that._player.on('status', function(status) {
        console.log('status broadcast playerState=%s', status.playerState, status);
        //if(status.playerState=="BUFFERING")
          //$rootScope.playerState = $rootScope.STATE_LOADING;
        if(status.playerState=="PLAYING")
          $rootScope.playerState = $rootScope.STATE_PLAYING;

      });
      $rootScope.$apply();

      //that._player.getStatus(function(){});

      // setInterval(function(){
      //   that._player.getStatus(function(e,s){
      //     console.log(s.currentTime);
      //   });
      // },1000);
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
      seek: function(s){
        ipc.sendSync("transcode.stop");
        ipc.send("transcode.stream", {
          inputFile:$rootScope.activeMedia.file.path,
          duration:$rootScope.activeMedia.meta.duration,
          seek:s,
          vopts:$ecConfig.get("video")
        });
      },
      start: function(){
        that._playing = true;

        $rootScope.playerState=$rootScope.STATE_LOADING;

        that._getIpAddress(function(err,addr){
          var port = $ecConfig.get("video").port;

          var streamUrl = util.format("http://%s:%s/stream.mp4", addr, port);

          console.log('port: %s, addr: %s', port, streamUrl);

          var media = {
            // Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
            contentId: streamUrl,
            contentType: 'video/mp4',
            streamType: 'LIVE', // BUFFERED or LIVE
            customData: {media_id:$rootScope.activeMedia.id},
            //duration: item.meta.duration,
            metadata: {
              type: 0,
              metadataType: 0,
              duration: $rootScope.activeMedia.meta.duration,
              title: $rootScope.activeMedia.file.name,
              images: [
                { name:"lg", url: util.format("http://%s:%s/thumbs_lg.jpg", addr, port) },
                { name:"sm", url: util.format("http://%s:%s/thumbs_sm.jpg", addr, port) }
              ]
            }
          };

//          console.log('app "%s" launched, loading media %s ...', that._player.session.displayName, media.contentId);
          that._player.load(media, { autoplay: true }, function(err, status) {
            console.log('media loaded playerState=%s', status.playerState);
            if(status.playerState=="BUFFERING")
              $rootScope.playerState = $rootScope.STATE_LOADING;
            if(status.playerState=="PLAYING")
              $rootScope.playerState = $rootScope.STATE_PLAYING;
          });


        });


      },
      // activeFile: function(){
      //   return that._file;
      // },
      stop: function(){
        that._playing=false;
        console.log(that._player);
        that._player.stop(function(){
          console.log("STOPPED");
        });
      },
      pause: function(){


        var fn = that._playing ? 'pause':'play';
        that._playing=!that._playing;
        console.log(fn);
        that._player[fn](function(){
          console.log("PAUSED");
        });
      },
      disconnect: function(){
        that._player.close();
        that._postDisconnect();
        //session.stop(that._player.session);
      },
      connect: function(host){

        that._state = $rootScope.CHROMECAST_CONNECTING;

        var defer = $q.defer();
        //client.connect(host, function() {
          console.log('connected!, launching app ...');
          //client.getSessions(function(err,sess){

            client.launch(ECMediaReceiver, function(err, player) {
              //$rootScope.castConnected = true;
              console.log(player);
              that._postConnect(player);
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
