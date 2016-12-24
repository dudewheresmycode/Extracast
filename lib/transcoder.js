const fs = require('fs');
const Transcoder = require('stream-transcoder');
const ffbinaries = require('ffbinaries');
const electronApp = require('electron').app;
const ffmpeg_dir = electronApp.getAppPath() + '/ffmpeg_build/';
const exec = require('child_process').exec;

const http = require('http');
const util = require("util");

let transcode_process;

module.exports = new require('events').EventEmitter();


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
module.exports.probe = (inputFile, callback) => {
  console.log("PROBE: ", inputFile);
  getBinary("ffprobe", (bin) => {
    var cmd = util.format("\"%s\" -v quiet -print_format json -show_format -show_streams \"%s\"", bin, inputFile);
    exec(cmd, function(e,so,se){
      try {
        var obj = JSON.parse(so);
        callback(null, obj);
      }catch(e){
        callback(e);
      }
    });
  });
};

module.exports.kill = () => {

  if(ff_ps)
    ff_ps.stdin.pause();
    ff_ps.kill('SIGINT');

};

module.exports.stream = (inputFile) => {
  var self = this;
  getBinary("ffmpeg", (bin) => {

    process.env.FFMPEG_BIN_PATH = bin;
    http.createServer(function(req, res) {
      if(req.url=='/stream.mp4'){
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type':'video/mp4'
        });
        transcode_process = new Transcoder(fs.createReadStream(inputFile))
          .videoCodec('h264')
          .format('mp4')
          .maxSize(1280,720)
          .videoBitrate(1000 * 1000) //1mb/s
          .fps(25)
          .audioCodec('aac')
          .sampleRate(44100)
          .channels(2)
          .audioBitrate(96 * 1000)
          //.custom("-vf", "scale='iw*min(1\,min(1280/iw\,720/ih)):-1'")
          //.custom('deadline', 'realtime')
          .custom('strict', 'experimental')
          .on('finish', function() {
            debug('finished transcoding');
          })
          .on('error', function(err) {
            debug('transcoding error: %o', err);
          });
          transcode_process.stream().pipe(res);
        }
    }).listen(3130);

  });
};
