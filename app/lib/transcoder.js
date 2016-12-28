const fs = require('fs');
const Transcoder = require('stream-transcoder');
const ffbinaries = require('ffbinaries');
const electronApp = require('electron').app;

const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const sharp = require('sharp');

const http = require('http');
const util = require("util");
const uuidV1 = require("uuid/v1");
const path = require("path");
const hhmmss = require("hh-mm-ss");
const ffparse = require('ffmpeg-parse');

process.env.FFMPEG_BIN_DIR = 'ffmpeg-bundle/';
process.env.FFMPEG_BIN_PATH = searchBinaryPath("ffmpeg");
process.env.FFPROBE_BIN_PATH = searchBinaryPath("ffprobe");
process.env.HTTP_STREAM_PORT = 3130;



let transcode_process=false;
let transcode_server=false
let _stream_opts = {};

const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();

let _processQueue = [], _processBusy = false;

function searchBinaryPath(name, callback){
  var reg = new RegExp(name, "gi");
  var d = path.join(electronApp.getAppPath(), process.env.FFMPEG_BIN_DIR);
  return path.join(d, fs.readdirSync(d).find(function(it){ return reg.test(it); }));
  //callback(electronApp.getAppPath() + '/ffmpeg-bundle/' + (fs.readdirSync(ffmpegBuildDir).find(function(it){ return reg.test(it); })));
};


function probe(options, callback){
  var cmd = util.format("\"%s\" -v quiet -print_format json -show_format -show_streams \"%s\"", process.env.FFPROBE_BIN_PATH, options.inputFile);
  exec(cmd, function(e,so,se){
    try {
      var obj = JSON.parse(so);
      callback(null, obj);
    }catch(e){
      callback(e);
    }
  });
}

function thumbnails(options, callback){

  function _th(prefix){
    return util.format("%s/t-%s-%s-%s.jpg", electronApp.getPath("appData"), prefix, options.fileId, uuidV1());
  }
  var tmp_full = _th("hd");
  var tmp_sq = _th("sq");

  console.log("get full thumnail: %s ", tmp_full);
  // -vf \"select=gt(scene\,0.4)\"
  //gt(scene\,0.4)*
  var cmd = ['-ss', options.seekTo, "-i", options.inputFile, "-frames:v", 1, "-t", 1, "-vf", "select='eq(pict_type\,I)'", tmp_full];
  var thumbp = spawn(process.env.FFMPEG_BIN_PATH, cmd);

  thumbp.stdout.on('data',function(data){
    console.log("stdout: %s", data);
  });
  thumbp.stderr.on('data',function(data){
    console.log("stderr: %s", data);
  });
  thumbp.on('close',function(code){
    if(code){
      console.log("ERROR", code);
    }
    sharp(tmp_full)
      .jpeg({quality:50})
      .resize(854, 480)
      .min()
      .crop(sharp.gravity.center)
      .toFile(tmp_full, function(err){
        console.log("get full thumnail: %s ", tmp_full);

        sharp(tmp_full)
          .jpeg({quality:50})
          .resize(256, 256)
          .min()
          .crop(sharp.strategy.entropy)
          .toFile(tmp_sq, function(err) {
          // .toBuffer(function(err, buffer_sq) {
            callback(null, {full:tmp_full, square:tmp_sq});
          });

      })
      .on('error', function(err) {
        console.log(err);
      });

  });



}


module.exports.probe = (options, callback) => {

  probe(options, function(err, meta){
    console.log(err, meta);
    options.seekTo = hhmmss.fromS(Math.round(meta.format.duration*0.40)); //seek 40% into the content
    thumbnails(options, function(err,thmbs){
      callback(null, {meta:meta, thumbnails:thmbs, fileId:options.fileId})
    });
  })

};

module.exports.kill = () => {
  if(transcode_process)
    transcode_process.kill();
  if(transcode_server)
    transcode_server.close();
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

function _start_stream(outStream,done,error){
  transcode_process = new Transcoder(_stream_opts.inputFile);

  if(_stream_opts.seek){
    var seekTo = hhmmss.fromS(_stream_opts.seek);
    transcode_process.custom('ss', seekTo);
  }

  // var defaultSize = [1280,720];
  // var defaultBitrate = 800;
  // var size =
  //   _stream_opts.vopts.size === '1080' ? [1920,1080] :
  //   (_stream_opts.vopts.size === '720' ? [1280,720] :
  //   (_stream_opts.vopts.size === '480' ? [854,480] : defaultSize));
  //
  // var bitrate = (_stream_opts.vopts.bitrate ? _stream_opts.vopts.bitrate :
  //   (_stream_opts.vopts.size === '1080' ? 3500 :
  //   (_stream_opts.vopts.size === '720' ? 1800 :
  //   (_stream_opts.vopts.size === '480' ? 750 : defaultBitrate))));

  transcode_process
    .videoCodec('h264')
    .format('mp4')
    //.custom("profile", "ultrafast")
    //.custom("movflags", "+faststart")
    .custom("pix_fmt", "yuv420p")
    .maxSize(_stream_opts._playbackSize[0],_stream_opts._playbackSize[1])

    .custom("threads", 2)
    .custom("minrate", (_stream_opts._playbackBitrate*0.65) * 1000)
    .custom("maxrate", (_stream_opts._playbackBitrate*1.20) * 1000)
    .videoBitrate(_stream_opts._playbackBitrate * 1000)
    .fps(25)
    .audioCodec('aac')
    .sampleRate(44100)
    .channels(2)
    .audioBitrate(96 * 1000)

    .custom('deadline', 'realtime')
    .custom('strict', 'experimental')
    .on('progress', function(data) {
      var obj = ffparse(data);
      //console.log(obj);
    })
    .on('finish', function() {
      console.log('finished transcoding');
      //transcode_server.close();
    })
    .on('error', function(err) {
      console.log('transcoding error: %o', err);
    });

    transcode_process.stream().pipe(outStream);

}




module.exports.stream = (options,callback) => {
  var self = this;
  _stream_opts = options;


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
    console.log("STREAM OPTS", _stream_opts);

    if(transcode_server) transcode_server.close();
    transcode_server = http.createServer(function(req, res) {
      if(req.url=='/stream.mp4'){
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type':'video/mp4'
        });
        _start_stream(res,
          function(){
            //done
            transcode_process = null;
            transcode_server.close();
          },
          function(){
            //error
            transcode_process = null;
            transcode_server.close();
          }
        );
        //_handle_request(req, res);
      }else if(req.url=='/thumbs_lg.jpg'){
        res.writeHead(200, {'Content-Type':'image/jpeg'});
        fs.createReadStream(_stream_opts.thumbnails.full).pipe(res);
      }else if(req.url=='/thumbs_sm.jpg'){
        res.writeHead(200, {'Content-Type':'image/jpeg'});
        fs.createReadStream(_stream_opts.thumbnails.square).pipe(res);
      }else{
        res.writeHead(404, {'Content-Type':'text/plain'});
        res.end("Not found");
      }
    }).listen(process.env.HTTP_STREAM_PORT, function(){
      require('dns').lookup(require('os').hostname(), function (err, addr, fam) {
        callback(null, util.format("http://%s:%s/stream.mp4",addr, process.env.HTTP_STREAM_PORT));
      });
    });
  // }else{
  //
  //   var local_tmp = util.format("%s/local.mp4", electronApp.getPath("appData"));
  //   _start_stream(fs.createWriteStream(local_tmp),
  //     function(){
  //       //done
  //       transcode_process = null;
  //       transcode_server.close();
  //     },
  //     function(){
  //       //error
  //       transcode_process = null;
  //       transcode_server.close();
  //     }
  //   );
  //   callback(null,local_tmp);
  // }

};
