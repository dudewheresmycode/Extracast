const fs = require('fs');
const Transcoder = require('stream-transcoder');
const ffbinaries = require('ffbinaries');
const electronApp = require('electron').app;
const ffmpeg_dir = electronApp.getAppPath() + '/ffmpeg_build/';
const exec = require('child_process').exec;
const sharp = require('sharp');

const http = require('http');
const util = require("util");
const shortid = require("shortid");

const hhmmss = require("hh-mm-ss");
const ffparse = require('ffmpeg-parse');

let transcode_process=false;
let transcode_server=false
let _stream_opts = {};

const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();



let getBinary = (name, callback) => {
  var reg = new RegExp(name, "gi");
  callback(ffmpeg_dir + (fs.readdirSync(ffmpeg_dir).find(function(it){ return reg.test(it); })));
};

module.exports.install = (callback) => {
  var platform = ffbinaries.detectPlatform();
  ffbinaries.downloadFiles(platform, {quiet: true, destination: ffmpeg_dir.slice(0,-1)}, function(){
    callback(platform);
  });
};
module.exports.exists = () => {
  return fs.existsSync(ffmpeg_dir);
};
module.exports.probe = (options, callback) => {
  console.log("PROBE: ", options);
  getBinary("ffprobe", (bin) => {
    getBinary("ffmpeg", (fbin) => {
      var cmd = util.format("\"%s\" -v quiet -print_format json -show_format -show_streams \"%s\"", bin, options.inputFile);
      exec(cmd, function(e,so,se){
        try {
          var obj = JSON.parse(so);

          var seekTo = hhmmss.fromS(Math.round(obj.format.duration*0.50));
          console.log("SEEK", seekTo);

          // -vf \"select=gt(scene\,0.4)\"
          var tmp = util.format("%s/ss_%s.jpg", electronApp.getPath("temp"), shortid.generate());
          console.log("_tmp thumnail: %s ", tmp);

          //,select='gt(scene\,0.2)'
          //
          var cmd_img = util.format(
            "\"%s\" -ss \"%s\" -i \"%s\" -frames:v 1 -t 1 -vf \"select='gt(scene\,0.4)*eq(pict_type\,I)'\" %s",
            fbin,
            seekTo,
            options.inputFile,
            tmp
          );

          console.log("cmd_img thumnail: %s ", cmd_img);
          exec(cmd_img, function(err, stdout, stderr){
              console.log(err);
              console.log(stdout.toString());
              console.log(stderr.toString());

              function _pre(i){
                return 'data:image/jpeg;base64,' + i.toString('base64');
              }
              var imgData = _pre(fs.readFileSync(tmp).toString('base64'));
              console.log(imgData.substr(0,50));

              sharp(tmp)
                .quality(40)

                .toBuffer(function(err, buffer_full) {

                  sharp(tmp)
                    .resize(320, 180)
                    .crop(sharp.gravity.center)
                    .quality(33)
                    .toBuffer(function(err, buffer_sq) {

                      callback(null, {meta:obj, thumbnails:{full:_pre(buffer_full), square:_pre(buffer_sq)}, fileId:options.fileId});
                      if(fs.existsSync(tmp)) fs.unlinkSync(tmp);
                    });

                })
                .on('error', function(err) {
                  console.log(err);
                });

          });
          // var cptr = new Transcoder(options.inputFile);
          // var strm = cptr.captureFrame(params.meta.format.duration/4)
          //   .on('error', function(err) {
          //     console.log("IMAGEERR: ", err);
          //   })
          //   .on('finish', function(err) {
          //     console.log("FINISH: ", err);
          //   })
          //   .stream();
            // strm.on('data', function(d){
            //   console.log(d.length);
            //   _cache = Buffer.concat([_cache, d]);
            // })
            //
            // strm.on('end',function(){
            //   var imgData = ['data:image/jpeg;base64', _cache.toString('base64')].join(',');
            //   console.log(imgData);
            //   callback(null, {meta:obj, thumbnail:imgData, fileId:options.fileId});
            // });

        }catch(e){
          callback(e);
        }
      });
    });
  });
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


 function _handle_request(req,res){
  console.log("VIDEO REQUEST");
  getBinary("ffmpeg", (bin) => {
    process.env.FFMPEG_BIN_PATH = bin;
    console.log("STREAM %s ", _stream_opts.inputFile);


    transcode_process = new Transcoder(_stream_opts.inputFile);

    if(_stream_opts.seek){
      var seekTo = hhmmss.fromS(_stream_opts.seek);
      console.log("Start from: ", seekTo);
      transcode_process.custom('ss', seekTo);
    }

    var defaultSize = [1280,720];
    var defaultBitrate = 800;
    var size =
      _stream_opts.vopts.size === '1080' ? [1920,1080] :
      (_stream_opts.vopts.size === '720' ? [1280,720] :
      (_stream_opts.vopts.size === '480' ? [854,480] : defaultSize));

    var bitrate = (_stream_opts.vopts.bitrate ? _stream_opts.vopts.bitrate :
      (_stream_opts.vopts.size === '1080' ? 3500 :
      (_stream_opts.vopts.size === '720' ? 1800 :
      (_stream_opts.vopts.size === '480' ? 750 : defaultBitrate))));

      console.log("SETUP ", bitrate, size)
    transcode_process
      .videoCodec('h264')
      .format('mp4')
      //.custom("profile", "ultrafast")
      //.custom("movflags", "+faststart")
      .custom("pix_fmt", "yuv420p")
      .maxSize(size[0],size[1])

      .custom("minrate", (bitrate*0.75) * 1000)
      .custom("maxrate", (bitrate*1.20) * 1000)
      .videoBitrate(bitrate * 1000)
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
        transcode_process = null;
        //transcode_server.close();
      })
      .on('error', function(err) {
        console.log('transcoding error: %o', err);
        transcode_server.close();
      });

      transcode_process.stream().pipe(res);
  });
}

module.exports.stream = (options,callback) => {
  var self = this;
  _stream_opts = options;

  if(transcode_server) transcode_server.close();
  transcode_server = http.createServer(function(req, res) {
    if(req.url=='/stream.mp4'){
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type':'video/mp4'
      });
      _handle_request(req,res);
    }else{
      res.writeHead(404).end("Not found");
    }
  }).listen(3130, function(){
    callback();
  });

};
