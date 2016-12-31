var constants = require('./constants.js');


const electronApp = require('electron').app;
const util = require("util");
const fs = require('fs');
const dns = require('dns');
const os = require('os');
const https = require('https');
const http = require('http');
const uuidV1 = require("uuid/v1");

process.env.HTTP_STREAM_PORT = 3130; //default port
let transcodeServer, _options;
const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();



module.exports.stop = function(){
  transcodeServer.close();
};



module.exports.server = function(options,callback){


    _options = options;

    _get_ip_addr(function(err,addr){

      var streamUrl = util.format("http://%s:%s/%s.mp4", addr, process.env.HTTP_STREAM_PORT, uuidV1());

      if(options.playerType==constants.CHROMECAST_PLAYER){

        //chromecast wants things over HTTPS, here we have setup a dynamic DNS service (extcast.net) to generate A records on the fly and sign through a wildcard cert
        streamUrl = util.format("https://%s.extcast.net:%s/%s.mp4", addr.replace(/\./g,"-"), process.env.HTTP_STREAM_PORT, uuidV1());

        transcodeServer = https.createServer({
          key: fs.readFileSync(electronApp.getAppPath()+'/ssl/_.extcast.net.key'),
          cert: fs.readFileSync(electronApp.getAppPath()+'/ssl/_.extcast.net.x509.crt'),
          ca: fs.readFileSync(electronApp.getAppPath()+'/ssl/ca.pem')
        }, module.exports._handle_request).listen(process.env.HTTP_STREAM_PORT, function(){
          callback(null, streamUrl);
        });
        return;
      }

      //start normal HTTP server
      transcodeServer = http.createServer(module.exports._handle_request).listen(process.env.HTTP_STREAM_PORT, function(){
        callback(null, streamUrl);
      });


    });//end get_ip
}


function _get_ip_addr(callback){
  dns.lookup(os.hostname(), callback);
}

module.exports._handle_request = function(req,res){

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if ( req.method === 'OPTIONS' ) {
    res.end();
    return;
  }

  if(/(.*)(\.mp4|\.webm)/g.test(req.url)){
  //if(req.url=='/stream.mp4'){

    res.setHeader('Content-Type', 'video/mp4');
    res.writeHead(200);


    module.exports.emit('streamRequest', _options, res);
    // console.log(transcoder, transcoder.streamOverHTTP);
    // transcoder.streamOverHTTP(ec_http.options, res,
    //   function(err){
    //     //stream done
    //     console.log("STREAM ENCODER FINISHED");
    //     //transcodeServer.close();
    //   }
    // );
  }else if(/lg(.*).jpg/g.test(req.url)){
    res.writeHead(200, {'Content-Type':'image/jpeg'});
    fs.createReadStream(_options.thumbnails.full).pipe(res);
  }else if(/sm(.*).jpg/g.test(req.url)){
    res.writeHead(200, {'Content-Type':'image/jpeg'});
    fs.createReadStream(_options.thumbnails.square).pipe(res);
  }else if(/(.*).srt/g.test(req.url)){
    res.writeHead(200, {'Content-Type':'text/plain'});
    fs.createReadStream(_options.subtitles.path).pipe(res);
  }else{
    res.writeHead(404, {'Content-Type':'text/plain'});
    res.end("404: Not found");
  }
}
