// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var $ = jQuery = require('jquery');
var Tether = window.Tether = require('tether');
var bootstrap = window.bootstrap = require('bootstrap');
// <script src="../../node_modules/bootstrap/dist/js/bootstrap.min.js"></script>

var app = require('electron').remote.app;
var angular = require('angular');

// var ngAnimate = require('angular-animate');
var constants = require('../../lib/constants.js')

require('./src/controllers.js')
require('./src/providers.js')
require('./src/directives.js')
require('./src/filters.js')


angular.module('extracast', [require('angular-ui-router'),'ec.providers','ec.controllers','ec.directives','ec.filters']).

run(function($rootScope){

  $rootScope.debug = false; //disable for production


  //add constants to $rootScope
  Object.keys(constants).forEach(function(key){
    $rootScope[key] = constants[key];
  });

  // $rootScope.PICTURE_SIZES = ['480','720','1080'];
  //
  // $rootScope.LOCAL_PLAYER='LOCAL';
  // $rootScope.CHROMECAST_PLAYER='CHROME';
  // $rootScope.AUDIO_PLAYER='AUDIO';
  //
  // $rootScope.STATE_STOPPED = "STOPPED";
  // $rootScope.STATE_PLAYING = "PLAYING";
  // $rootScope.STATE_PAUSED  = "PAUSED";
  // $rootScope.STATE_LOADING = "LOADING";
  // $rootScope.STATE_SEEKING = "SEEKING";
  //
  // $rootScope.CHROMECAST_IDLE = "IDLE";
  // $rootScope.CHROMECAST_CONNECTING = "CONNECTING";
  // $rootScope.CHROMECAST_CONNECTED = "CONNECTED";

  $rootScope.playerState = $rootScope.STATE_STOPPED;


})

.config(function($stateProvider,$urlRouterProvider) {

  $urlRouterProvider.otherwise('/library');

  $stateProvider.state({
    name: 'library',
    url: '/library',
    template: '<media-list></media-list>'
  })
  .state({
    name: 'settings',
    url: '/settings',
    template: '<settings-view></settings-view>'
  })
  .state({
    name: 'playlist',
    url: '/playlist/:listId',
    template: '<h3>playlist!!</h3>'
  })
  .state({
    name: 'app',
    url: '/app/:appId',
    template: '<h3>app!!</h3>'
  });


})
