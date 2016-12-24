"use strict"

const Transcoder = require('stream-transcoder');
const fs = require('fs');
const http = require('http');

let ffmpeg_dir = __dirname + '/ffmpeg_build';
let inputFile = "/Volumes/USB30FD/Features/The Blues Brothers (1980) EXTENDED 720p BRRiP x264 AAC [Team Nanban]/The Blues Brothers (1980) EXTENDED 720p BRRiP x264 AAC [Team Nanban].mp4";

process.env.FFMPEG_BIN_PATH = ffmpeg_dir+"/ffmpeg";

http.createServer(function(req, res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type':'video/mp4'
  });
  var trans = new Transcoder(fs.createReadStream(inputFile))
    .videoCodec('h264')
    .format('mp4')
    .maxSize(854,480)
    .fps(25)
    .audioCodec('aac')
    .sampleRate(44100)
    .channels(2)
    //.custom("-vf", "scale='iw*min(1\,min(1280/iw\,720/ih)):-1'")
    .custom('strict', 'experimental')
    .on('finish', function() {
      debug('finished transcoding');
    })
    .on('error', function(err) {
      debug('transcoding error: %o', err);
    });
    trans.stream().pipe(res);
}).listen(3130);
