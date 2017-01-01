var util                      = require('util');
var castv2Cli                 = require('castv2-client');
var RequestResponseController = castv2Cli.RequestResponseController;

function MediaReceiverController(client, sourceId, destinationId) {
  RequestResponseController.call(this, client, sourceId, destinationId, 'urn:x-cast:com.dudewheresmycode.extracast.io');
  // this.once('close', onclose);
  var self = this;
  // function onclose() {
  //   self.stop();
  // }
  // this.on('message', function(message) {
  //   self.emit('status', message);
  //   //console.log("CUSTOM MESSAGE", message);
  // });
}

util.inherits(MediaReceiverController, RequestResponseController);


// action  (required) : 'start' || 'pause' || 'resume'
// media  (required) : 'play' || 'pause' || 'next' || 'prev'
MediaReceiverController.prototype.control = function(opts){
  this.request(opts);
};


module.exports = MediaReceiverController;
