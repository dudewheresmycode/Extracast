var constants = require('./constants.js');


const electronApp = require('electron').app;
const util = require("util");
const fs = require('fs');
const dns = require('dns');
const os = require('os');
const https = require('https');
const http = require('http');

process.env.HTTP_STREAM_PORT = 3130; //default port
let transcodeServer;

const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();



module.exports.stop = function(){
    transcodeServer
};
module.exports.server = function(options,callback){

    var that = this;
    that.options = options;
    _get_ip_addr(function(err,addr){

      var streamUrl = util.format("http://%s:%s/stream.mp4", addr, process.env.HTTP_STREAM_PORT);
      if(options.playerType==constants.CHROMECAST_PLAYER){

        //chromecast wants things over HTTPS, here we have setup a dynamic DNS service (extcast.net) to generate A records on the fly and sign through a wildcard cert
        streamUrl = util.format("https://%s.extcast.net:%s/stream.mp4", addr.replace(/\./g,"-"), process.env.HTTP_STREAM_PORT);

        transcodeServer = https.createServer({
          key: fs.readFileSync(electronApp.getAppPath()+'/ssl/_.extcast.net.key'),
          cert: fs.readFileSync(electronApp.getAppPath()+'/ssl/_.extcast.net.x509.crt'),
          ca: fs.readFileSync(electronApp.getAppPath()+'/ssl/ca.pem')
        }, module.exports._handle_request.bind(that)).listen(process.env.HTTP_STREAM_PORT, function(){
          console.log(streamUrl);
          callback(null, streamUrl);
        });
        return;
      }

      //start normal HTTP server
      transcodeServer = http.createServer(module.exports._handle_request.bind(that)).listen(process.env.HTTP_STREAM_PORT, function(){
        console.log(streamUrl);
        callback(null, streamUrl);
      });


    });//end get_ip
}


function _get_ip_addr(callback){
  dns.lookup(os.hostname(), callback);
}

module.exports._handle_request = function(req,res){
  var options = this.options;
  if(req.url=='/stream.mp4'){
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type':'video/mp4'
    });
    this.emit('streamRequest', options, res);

    // console.log(transcoder, transcoder.streamOverHTTP);
    // transcoder.streamOverHTTP(ec_http.options, res,
    //   function(err){
    //     //stream done
    //     console.log("STREAM ENCODER FINISHED");
    //     //transcodeServer.close();
    //   }
    // );
  }else if(req.url=='/thumbs_lg.jpg'){
    res.writeHead(200, {'Content-Type':'image/jpeg'});
    fs.createReadStream(ec_http.options.thumbnails.full).pipe(res);
  }else if(req.url=='/thumbs_sm.jpg'){
    res.writeHead(200, {'Content-Type':'image/jpeg'});
    fs.createReadStream(ec_http.options.thumbnails.square).pipe(res);
  }else{
    res.writeHead(404, {'Content-Type':'text/plain'});
    res.end("404: Not found");
  }
}
