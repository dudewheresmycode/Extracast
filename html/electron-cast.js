var Client                = require('castv2-client').Client;
var DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
var mdns                  = require('mdns');
var client = new Client();
var _player;
var chromecast = {
  listDevices: function(callback){
    var browser = mdns.createBrowser(mdns.tcp('googlecast'));
    browser.on('serviceUp', function(service) {
      //console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
      callback(null, service);
      browser.stop();
    });
    browser.start();
  },
  connect: function(host,callback){
    client.connect(host, function() {
      console.log('connected, launching app ...');
      client.launch(DefaultMediaReceiver, function(err, player) {
        _player = player;

        _player.on('status', function(status) {
          console.log('status broadcast playerState=%s', status.playerState);
        });


        callback(err);
      });
    });
  },
  stop: function(){
    if(_player) _player.stop();
  },
  play: function(mediaUrl, fileItem){
    var media = {
      // Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
      contentId: mediaUrl,
      contentType: 'video/webm',
      streamType: 'LIVE', // BUFFERED or LIVE
      //duration: fileItem.meta.duration,
      // Title and cover displayed while buffering
      metadata: {
        type: 0,
        metadataType: 0,
        title: fileItem.file.name,
        images: [
          //{ url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg' }
        ]
      }
    };

    console.log('app "%s" launched, loading media %s ...', _player.session.displayName, media.contentId);
    _player.load(media, { autoplay: true }, function(err, status) {
      console.log('media loaded playerState=%s', status.playerState);
      // // Seek to 2 minutes after 15 seconds playing.
      // setTimeout(function() {
      //   player.seek(2*60, function(err, status) {
      //     //
      //   });
      // }, 15000);

    });


  }
}

module.exports = chromecast;
