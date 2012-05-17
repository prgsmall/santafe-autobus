/*globals require module console __dirname setTimeout*/
var express = require('express'),
    csv = require('csv'),
    GTFS = require("./gtfs");
var app;

var gtfs = null;

var sfab_clients = {};

var acequiaServer = null;

var feedURI = "http://www.gtfs-data-exchange.com/agency/santa-fe-trails/feed";

var onGetVersion = function (message) {
    var response = {
        version: gtfs.getVersion(),
        agency: gtfs.getAgency()
    };

    acequiaServer.send("", "version", response, message.from);    
};

var onGetRoutes = function (message) {
    acequiaServer.send("", "routes", gtfs.getRoutes(), message.from);
};

var onGetRoute = function (message) {
    acequiaServer.send("", "route", gtfs.getRouteById(message.body[0].route_id), message.from);
};

var onRefresh = function (message) {
    gtfs = GTFS.createGeneralTransitFeed(feedURI, null);    
};

var startHTTPServer = function () {
    acequiaServer = require("acequia").createServer({
        wsPort: 3001,
        oscPort: false,
        tcpPort: false,
        datastore: false
    });
    acequiaServer.on("refresh", onRefresh);    
    acequiaServer.on("getRoutes", onGetRoutes);
    acequiaServer.on("getRoute", onGetRoute);
    acequiaServer.on("getVersion", onGetVersion);    
    acequiaServer.start();
    
    app = express.createServer();
    
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
};

var START = function () {
    gtfs = GTFS.createGeneralTransitFeed(feedURI, startHTTPServer);    
};

var start = function () {
    setTimeout(START, 200);
};

start();