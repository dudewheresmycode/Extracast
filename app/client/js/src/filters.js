

const _hhmmss = require("hh-mm-ss");

angular.module('ec.filters',[])
.filter('noSrc',function(){
  return function(input){
    return input ? input : '';
  }
})
.filter('loader',function(){
  return function(input){
    return input ? input : '../images/ring-alt.svg';
  }
})
.filter('bytes', function() {
	return function(bytes, precision) {
		if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
		if (typeof precision === 'undefined') precision = 1;
		var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
			number = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
	}
})
.filter('hhmmss',function(){
  return function(input){
    return input ? _hhmmss.fromS(Math.round(input)) : '00:00';
  }
});
