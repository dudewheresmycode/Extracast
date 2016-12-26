var util        = require('util');
var debug       = require('debug')('castv2-client');
var Application = require('castv2-client').Application;
var MediaController = require('castv2-client').MediaController;

function ECMediaReceiver(client, session) {
  Application.apply(this, arguments);

  this.media = this.createController(MediaController);

  this.media.on('status', onstatus);
  this.media.on('message', onmessage);
  var self = this;

  function onstatus(status) {
    self.emit('status', status);
  }
  function onmessage(status) {
    self.emit('message', status);
  }
}

ECMediaReceiver.APP_ID = 'B730EB9C'; //default test app

util.inherits(ECMediaReceiver, Application);

ECMediaReceiver.prototype.getStatus = function(callback) {
  this.media.getStatus.apply(this.media, arguments);
};

ECMediaReceiver.prototype.load = function(media, options, callback) {
  this.media.load.apply(this.media, arguments);
};

ECMediaReceiver.prototype.play = function(callback) {
  this.media.play.apply(this.media, arguments);
};

ECMediaReceiver.prototype.pause = function(callback) {
  this.media.pause.apply(this.media, arguments);
};

ECMediaReceiver.prototype.stop = function(callback) {
  this.media.stop.apply(this.media, arguments);
};

ECMediaReceiver.prototype.seek = function(currentTime, callback) {
  this.media.seek.apply(this.media, arguments);
};

module.exports = ECMediaReceiver;
