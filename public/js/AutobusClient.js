/**
 *  AutobusClient
 *
 *  Created by Peter R. G. Small on 2012-05-07.
 *  Copyright (c) 2012 PRGSoftware, LLC. All rights reserved.
 */

/*global $ document google navigator AcequiaClient MapIconMaker setTimeout localStorage */

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};


/**
 * Constructor for AutobusClient
 */
var AutobusClient = function () {
    this.map = null;
    
    this.agency = null;
    
    this.routes = {};
    
    this.routePaths = {};
    
    this.markers = {};
    
    this.buses = {};
    
    this.currentPositionMarker = null;
    
    this.initialized = false;
    
    this.acequiaClient = null;
};

AutobusClient.prototype.init = function (zoom, lat, lng, mapType, mapOptions) {
    if (this.initialized) {
        return;
    }

    this.initialized = true;
    
    // Initialize the map
    var options = $.extend({
        zoom: zoom,
        center: new google.maps.LatLng(lat, lng),
        mapTypeId: mapType
    }, mapOptions || {});
    this.map = new google.maps.Map(document.getElementById("map_canvas"), options);

    // Set up the acequia client and connect to the server
    this.acequiaClient = new AcequiaClient("autobus_" + Math.random(), "3001");
    this.acequiaClient.on("version", objCallback(this, "onVersion"));
    this.acequiaClient.on("routes", objCallback(this, "onRoutesMessage"));
    this.acequiaClient.on("route", objCallback(this, "onRouteMessage"));
    this.acequiaClient.on("busPosition", objCallback(this, "onBusPosition"));
    this.acequiaClient.addConnectionChangeHandler(objCallback(this, "onConnected"));
    this.acequiaClient.connect();
    
    // Start getting position updates
    this.getCurrentPosition();
};

AutobusClient.prototype.centerMapOnCurrentPositon = function () {
    this.map.setCenter(this.currentPositionMarker.getPosition());
};

AutobusClient.prototype.getCurrentPosition = function () {
    navigator.geolocation.getCurrentPosition(objCallback(this, "onPositionUpdate"));
};

AutobusClient.prototype.onConnected = function (connected) {
    if (connected) {
        this.acequiaClient.send("getVersion");
    }
};

AutobusClient.prototype.onVersion = function (message) {
    var version = message.body[0].version, ls, routes,
        agency  = message.body[0].agency;

    if (localStorage.getItem(agency.agency_id + "version") === version) {
        this.agency = JSON.parse(localStorage.getItem(agency.agency_id + "agency"));
        routes = JSON.parse(localStorage.getItem(agency.agency_id + "routes"));
        this.onRoutes(routes);
    } else {
        localStorage.clear();
        this.agency = agency;
        localStorage.setItem(agency.agency_id + "version", version);
        localStorage.setItem(agency.agency_id + "agency", JSON.stringify(agency));
        this.acequiaClient.send("getRoutes");    
    }
    
    this.setAgencyInfo();
};

AutobusClient.prototype.setAgencyInfo = function () {
    document.title = this.agency.agency_name;
    $("#home-title").html(this.agency.agency_name);
};

AutobusClient.prototype.onBusPosition = function (message) {
    var busInfo = message.body[0], label, rt,
        point   = new google.maps.LatLng(parseFloat(busInfo.lat), parseFloat(busInfo.lon));
    
    if (!this.buses[busInfo.route_id]) {
        rt = this.routes[busInfo.route_id];
        label = rt.route_id + ": " + rt.route_desc;
        this.buses[busInfo.route_id] = new google.maps.Marker({
            position: point,
            map: this.map,
            title: label,
            icon: MapIconMaker.createLabeledMarkerIcon({width: 20, height: 34, label: label, 
                                                        primaryColor: rt.route_color, labelColor: rt.route_color})
        });
    } else {
        this.buses[busInfo.route_id].setPosition(point);
    }
};

AutobusClient.prototype.onPositionUpdate = function (position) {
    var point = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    if (!this.currentPositionMarker) {
        this.currentPositionMarker = new google.maps.Marker({
            position: point,
            map: this.map,
            title: "You Are Here",
            draggable: true
        });
    } else {
        this.currentPositionMarker.setPosition(point);
    }
    
    setTimeout(objCallback(this, "getCurrentPosition"), 2000);
};

AutobusClient.prototype.onRoutesMessage = function (message) {
    localStorage.setItem(this.agency.agency_id + "routes", JSON.stringify(message.body));
    this.onRoutes(message.body);
};

AutobusClient.prototype.onRoutes = function (message) {
    throw new Error("onRoutes NOT IMPLEMENTED");
};

AutobusClient.prototype.onRoute = function (route) {
    throw new Error("onRoute NOT IMPLEMENTED");
};

AutobusClient.prototype.onRouteMessage = function (message) {
    var trip, route = message.body[0];
    this.routes[route.route_id] = route;
    
    trip = this.getTripForRoute(route.route_id);
    this.onRoute(trip);
};

AutobusClient.prototype.routeIdFromEleId = function (eleId) {
    var route_id = eleId;
    return route_id.substring(route_id.indexOf("_") + 1);
};

AutobusClient.prototype.getServiceId = function (time) {
    if (typeof(time) === "undefined") {
        time = new Date();
    }
    
    if (time.getDay() === 0) {
        return "SU";
    } else if (time.getDay() === 6) {
        return "SA";
    } else {
        return "WD";
    }
};

AutobusClient.prototype.dateFromTimeString = function (timeString) {
    var ret,
    dd = timeString.split(":");

    ret = new Date();
    ret.setHours(parseInt(dd[0], 10));
    ret.setMinutes(parseInt(dd[1], 10));
    ret.setSeconds(parseInt(dd[2], 10));

    return ret;
};

AutobusClient.prototype.getTripForRoute = function (route_id, directionId) {
    var i, route, service_id;
    
    if (typeof(directionId) === "undefined") {
        directionId = "0";
    }
    route = this.routes[route_id];
    
    service_id = this.getServiceId();
    
    for (i = 0; i < route.trips.length; i += 1) {
        if (route.trips[i].service_id === service_id &&
            route.trips[i].direction_id === directionId) {
            return route.trips[i];
        }
    }
    
    return null;
};

AutobusClient.prototype.getTripsForRoute = function (route_id) {
    return {
        outbound: this.getTripForRoute(route_id, "0"),
        inbound:  this.getTripForRoute(route_id, "1")
    };
};

AutobusClient.prototype.getNextArrivalsForStop = function (route_id, stop_id, time) {
    var i, j, trips = [], stop_time, ret = [], arrival_time, service_id;

    if (typeof(time) === "undefined") {
        time = new Date();
    }
    
    service_id = this.getServiceId(time);

    trips = this.routes[route_id].trips;

    for (i = 0; i < trips.length; i += 1) {
        if (service_id !== trips[i].service_id) {
            continue;
        }
        for (j = 0; j < trips[i].stop_times.length; j += 1) {
            stop_time = trips[i].stop_times[j];
            if (stop_time.stop_id === stop_id) {
                arrival_time = this.dateFromTimeString(stop_time.arrival_time);
                if (arrival_time > time) {
                    ret.push({time: stop_time.arrival_time,
                              direction: trips[i].direction_id});
                }
            }
        }
    }

    return ret;
};

AutobusClient.prototype.setMapForMarkers = function (route_id, map) {
    var i;
    for (i = 0; i < this.markers[route_id].length; i += 1) {
        this.markers[route_id][i].setMap(map);
    }
};

AutobusClient.prototype.setMapForPath = function (route_id, map) {
    this.setMapForPathOnly(route_id, map);
    this.setMapForMarkers(route_id, map);
};

AutobusClient.prototype.setMapForPathOnly = function (route_id, map) {
    this.routePaths[route_id].setMap(map);
};

AutobusClient.prototype.showAllPaths = function () {
    var route_id, i, latlngbounds = new google.maps.LatLngBounds();

    for (route_id in this.markers) {
        for (i = 0; i < this.markers[route_id].length; i += 1) {
            latlngbounds.extend(this.markers[route_id][i].getPosition());
        }
    }
    this.map.fitBounds(latlngbounds);
    this.map.setCenter(latlngbounds.getCenter());

    for (route_id in this.routes) {
        this.setMapForMarkers(route_id, null);
        this.setMapForPathOnly(route_id, this.map);
    }
    this.map.setZoom(this.map.getZoom() + 1);
};

