/*globals require module console __dirname setTimeout*/
var express = require('express'),
    csv = require('csv'),
    GTFS = require("./gtfs");
var app;
var io;
var gtfs = null;

var startHTTPServer = function () {
    app = express.createServer();
    io = require('socket.io').listen(app);
    
    // Configuration
    app.configure(function () {
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express["static"](__dirname + '/public'));
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });
    
    app.get('/', function (req, res) {
        res.render('/index.html');
    });

    app.listen(3000);
    console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
    
    io.sockets.on('connection', function (socket) {
        socket.on("get routes", function (data) {
            socket.emit("routes", JSON.stringify(gtfs.getRoutes()));
        });
        socket.on("get route", function (data) {
            socket.emit("route", JSON.stringify(gtfs.getRouteById(data.route_id)));
        });
    });
};

var START = function () {
    gtfs = GTFS.createGeneralTransitFeed("http://www.gtfs-data-exchange.com/agency/santa-fe-trails/feed", startHTTPServer);    
};

var start = function () {
    setTimeout(START, 20000);
};

start();