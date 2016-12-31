
var constants = require('./constants.js')
var ec_http = require('./http.js');

const fs = require('fs');
const Transcoder = require('stream-transcoder');
const ffbinaries = require('ffbinaries');
const electronApp = require('electron').app;
const ipcMain = require('electron').ipcMain;

const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const sharp = require('sharp');


const util = require("util");
const uuidV1 = require("uuid/v1");
const path = require("path");
const mime = require("mime");
const hhmmss = require("hh-mm-ss");
const ffparse = require('ffmpeg-parse');

var log = require('electron-log');
log.transports.file.level = 'info';
var id3 = require('id3js');

process.env.FFMPEG_BIN_DIR = 'ffmpeg-bundle/';
process.env.FFMPEG_BIN_PATH = searchBinaryPath("ffmpeg");
process.env.FFPROBE_BIN_PATH = searchBinaryPath("ffprobe");


let transcode_process=false;

const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();

let _processQueue = [], _processBusy = false;
ipcMain.on("transcode.stop", function(event){
  module.exports.kill();
  event.returnValue = 'killed'
});
ipcMain.on("transcode.pause", function(event){
  if(transcode_process) ec_http.pause();
});
ipcMain.on("transcode.resume", function(event){
  if(transcode_process) ec_http.resume();
});
ipcMain.on('transcode.stream', function(event, options, stream){
  //console.log(params);
  // var outputFile = app.getPath("temp")+"/stream.webm";
  // var writer = new streams.WritableStream();
  // var reader = new streams.ReadableStream();
  //_cache = new Buffer("", "binary")
  module.exports.stream(options, event.sender, function(err,stream){
    event.sender.send('transcode.ready', options, stream)
  });

})

ipcMain.on('transcoder.probe.input', function(event,options){

  var sender = event.sender;
  var _callback = function(err,obj){
    sender.send('transcoder.probe.result', obj);
  }

  if(options.input.file.type=='Video' || options.input.file.type=='Audio'){
    probe(options, function(err, meta){
      if(options.input.file.type=='Video'){
        options.seekTo = hhmmss.fromS(Math.round(meta.format.duration*0.40)); //seek 40% into the content
        thumbnails(options, function(err,thmbs){
          _callback(null, {meta:meta, thumbnails:thmbs, fileId:options.input.id})
        });
      }else if(options.input.file.type=='Audio'){
        if(meta.format.format_name=='mp3'){
          id3({ file: options.input.file.path, type: id3.OPEN_LOCAL }, function(err, tags) {
            meta.id3tags = tags.v2;
            //var base64String = btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)));
            if(tags.v2.image){
              album_thumbs(tags.v2.image, options, function(err, thumbs){
                _callback(err, {meta:meta, thumbnails:thumbs, fileId:options.input.id})
              });
            }else{
              _callback(err, {meta:meta, thumbnails:null, fileId:options.input.id})
            }
            //var base64String = "data:%s;base64,%s"+(new Buffer(tags.v2.image.data)).toString('base64');
          });
        }else{
          _callback(null, {meta:meta, thumbnails:null, fileId:options.input.id})
        }
      }else{
        _callback(null, {error:"Unkown Type", fileId:options.input.id})
      }
    })
  }else{
    _callback(null, {error:"Unkown Type", fileId:options.input.id})
  }


  // module.exports.probe(options, function(err, obj){
  //   event.sender.send('transcoder.probe.result', obj);
  // });
})

function searchBinaryPath(name, callback){
  var reg = new RegExp(name, "gi");
  var d = path.join(electronApp.getAppPath(), process.env.FFMPEG_BIN_DIR);
  return path.join(d, fs.readdirSync(d).find(function(it){ return reg.test(it); }));
  //callback(electronApp.getAppPath() + '/ffmpeg-bundle/' + (fs.readdirSync(ffmpegBuildDir).find(function(it){ return reg.test(it); })));
};


function probe(options, callback){
  var cmd = util.format("\"%s\" -v quiet -print_format json -show_format -show_streams \"%s\"", process.env.FFPROBE_BIN_PATH, options.input.file.path);
  exec(cmd, function(e,so,se){
    try {
      var obj = JSON.parse(so);
      callback(null, obj);
    }catch(e){
      callback(e);
    }
  });
}
function album_thumbs(image, options, callback){
  var tmp = _th("aa", mime.extension(image.mime));
  fs.writeFileSync(tmp, new Buffer(image.data));
  resize(tmp, options, callback);
}

function resize(input,options,callback){

  var tmp_hd = _th("hd");
  var tmp_sq = _th("sq");


  sharp(input)
    .jpeg({quality:60})
    .resize(1280, 720)
    .min()
    .crop(sharp.gravity.center)
    .toFile(tmp_hd, function(err){

      sharp(input)
        .jpeg({quality:50})
        .resize(256, 256)
        .min()
        .crop(sharp.strategy.entropy)
        .toFile(tmp_sq, function(err) {
        // .toBuffer(function(err, buffer_sq) {
          callback(null, {full:tmp_hd, square:tmp_sq});
          //if(fs.existsSync(input)) fs.unlinkSync(input);
        });

    })
    .on('error', function(err) {
      console.log(err);

    });
}

function _th(prefix,ext){
  var ex = ext || 'jpg';
  return util.format("%s/t-%s-%s.%s", electronApp.getPath("appData"), prefix, uuidV1(), ex);
}


function thumbnails(options, callback){

  var tmp = _th("hd");

  // -vf \"select=gt(scene\,0.4)\"
  //gt(scene\,0.4)*
  var cmd = ['-ss', options.seekTo, "-i", options.input.file.path, "-frames:v", 1, "-t", 1, "-vf", "select='eq(pict_type\,I)'", tmp];
  var thumbp = spawn(process.env.FFMPEG_BIN_PATH, cmd);

  thumbp.stdout.on('data',function(data){
    //console.log("stdout: %s", data);
  });
  thumbp.stderr.on('data',function(data){
    //console.log("stderr: %s", data);
  });
  thumbp.on('close',function(code){
    if(code){
      console.log("ERROR", code);
    }
    resize(tmp,options,callback);
  });



}


module.exports.probe = (options, callback) => {

  probe(options, function(err, meta){
    options.seekTo = hhmmss.fromS(Math.round(meta.format.duration*0.40)); //seek 40% into the content
    thumbnails(options, function(err,thmbs){
      callback(null, {meta:meta, thumbnails:thmbs, fileId:options.fileId})
    });
  })

};
module.exports.pause = () => {
  //ec_http.pause();
  transcode_process.pause();
}
module.exports.resume = () => {
  //ec_http.pause();
  transcode_process.resume();
}
module.exports.kill = () => {

  if(transcode_process)
    transcode_process.kill();
  ec_http.stop();

  //if(transcode_server)
  //  transcode_server.close();
};


/*
	Transcode the media stream to mp4 and serve it over HTTP.
	 @options {Object} The configuration options.

	Options:
	 'inputFile' {String} - (required) absolute path of the file to play.
   'seek' - {Number} time in seconds to start playing from.
   'size' - {String} Resolution of the video playback. Accepts a string value (`480`,`720`,`1080`)

   Events:
	 'progress' emitted when transcoding has progressed.
	 'finish' emitted when transcoding has completed.
	 'error' emmited if an error occurs.

*/

var currentResponse;
var streamOverHTTP = function(options, http_res){


  log.info("Extracast - start streaming file: "+options.inputFile);

  transcode_process = new Transcoder(options.inputFile);
  currentResponse = http_res;

  if(options.seek){
    var seekTo = hhmmss.fromS(options.seek);
    transcode_process.custom('ss', seekTo);
  }

  if(options.vopts.limitBitrate){
    transcode_process
    .custom("minrate", (options.vopts.bitrate*0.65) * 1000)
    .custom("maxrate", options.vopts.bitrate * 1000)
    .videoBitrate(options.vopts.bitrate * 1000);
  }
  // if(options.playerType==constants.CHROMECAST_PLAYER){
  //   transcode_process.maxSize(options._playbackSize[0],options._playbackSize[1])
  // }

  transcode_process
    .videoCodec('h264')
    .format('mp4')
    .maxSize(options._playbackSize[0],options._playbackSize[1])
    //.custom("profile:v", "fast")
    //.custom("movflags", "+faststart")
    .custom("pix_fmt", "yuv420p")

    //go as high as possible?
    //.custom("threads", 2)
    //.custom("minrate", (_stream_opts._playbackBitrate*0.65) * 1000)
    //.custom("maxrate", (_stream_opts._playbackBitrate*1.20) * 1000)
    //.videoBitrate(_stream_opts._playbackBitrate * 1000)
    .fps(30)

    .audioCodec('aac')
    .sampleRate(44100)
    .channels(2)
    .audioBitrate(96 * 1000)

    .custom('deadline', 'realtime')
    .custom('strict', 'experimental')
    .on('progress', function(data) {
      var obj = ffparse(data);
      //if(currentSender) currentSender.send('transcode.stats', obj);
    })
    .on('finish', function() {
      ec_http.stop();
      //transcode_server.close();
    })
    .on('error', function(err) {
      //done(err);
      log.error(`Transocding error: ${err}`);
    });

    transcode_process.stream().pipe(http_res);

}


module.exports.stream = (options, sender, callback) => {
  var self = this;

  var _stream_opts = Object.assign(options);

  currentSender = sender;
  log.info(`Extracast - start stream ${options.inputFile}`);

  if(_stream_opts.vopts.port)
    process.env.HTTP_STREAM_PORT = _stream_opts.vopts.port;

  var defaultSize = [1280,720];
  var defaultBitrate = 800;

  _stream_opts._playbackSize =
    _stream_opts.vopts.size === '1080' ? [1920,1080] :
    (_stream_opts.vopts.size === '720' ? [1280,720] :
    (_stream_opts.vopts.size === '480' ? [854,480] : defaultSize));

  _stream_opts._playbackBitrate = (_stream_opts.vopts.bitrate ? _stream_opts.vopts.bitrate :
    (_stream_opts.vopts.size === '1080' ? 3500 :
    (_stream_opts.vopts.size === '720' ? 1800 :
    (_stream_opts.vopts.size === '480' ? 750 : defaultBitrate))));

  //if(options.http_stream){
    ec_http.server(_stream_opts, callback);
    ec_http.removeListener("streamRequest", streamOverHTTP);
    ec_http.on("streamRequest", streamOverHTTP);


    // function(options,res){
    //   console.log("NEW STREAM REQ");
    //   streamOverHTTP(options, res, function(){
    //     console.log("STREAM DONE");
    //     ec_http.stop();
    //   });
    // })

};
