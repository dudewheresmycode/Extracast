// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var $ = jQuery = require('jquery');
var app = require('electron').remote.app;
var angular = require('angular');

require('./src/controllers.js')
require('./src/providers.js')
require('./src/directives.js')
require('./src/filters.js')

angular.module('extracast', ['ec.providers','ec.controllers','ec.directives','ec.filters']).
run(function($rootScope){
  $rootScope.LOCAL_PLAYER=0;
  $rootScope.CHROMECAST_PLAYER=1;


  $rootScope.STATE_STOPPED = 0;
  $rootScope.STATE_PLAYING = 1;
  $rootScope.STATE_PAUSED  = 2;
  $rootScope.STATE_LOADING = 3;
  $rootScope.STATE_SEEKING = 4;
  $rootScope.playerState = $rootScope.STATE_STOPPED;


})
