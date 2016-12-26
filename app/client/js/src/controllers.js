
angular.module('ec.controllers',[])

.controller('main',function($scope,$ecPlayerStatus){

  $scope._versions = process.versions;
  $scope.status = function(){ return $ecPlayerStatus.status(); }
  //$scope.currentFile = function(){ return $media.get(); }
})
