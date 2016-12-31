var ipc = require('electron').ipcRenderer;

angular.module('ec.controllers',[])

.controller('main',function($scope,$state,$media,$ecPlayerStatus){

  $scope._versions = process.versions;
  $scope.status = function(){ return $ecPlayerStatus.status(); }
  //$scope.currentFile = function(){ return $media.get(); }
  ipc.on('goto.settings',function(){
    $state.go("settings");
  });
  ipc.on("media.select", function(evt,file){
    console.log("SELECT!", file);
    file.forEach(function(f){
      $media.add(f);
    })
  });

})
