// node samples/sample.js
var csv = require('csv');
var GTFS = require("./gtfs");
var gtfs = new GTFS();

var start = function() {
    setTimeout(doThings, 30000);
};

var wait = function() {
    setTimeout(wait, 100000);
}
var doThings = function() {
    gtfs.init(__dirname, didThings);
    wait();
};

var didThings = function() {
    console.log("DONE");
    route = gtfs.getRouteById("2");
}

start();