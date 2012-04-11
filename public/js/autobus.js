
/*global $ window document google io console alert OpenLayers navigator*/

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};

var autobus = {

    map: null,
    
    routes: {},
    
    markers: {},
    
    markerLayers: {},
    
    routeLayers: {},
    
    lonlat: function (lat, lon) {
        return new OpenLayers.LonLat(lon, lat)
            .transform(
                    new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
                    new OpenLayers.Projection("EPSG:900913") // to Spherical Mercator Projection
        );
    },
    
    onPositionUpdate: function (position) {
        var lonlat;
        if (!("currentPosition" in this.markerLayers)) {
            lonlat = this.lonlat(position.coords.latitude, position.coords.longitude);
            this.createMarkerLayer("currentPosition", [lonlat]);
        }

        console.log("Current position: " + position.coords.latitude + " " + position.coords.longitude);        
    },
    
    createMarkerLayer: function (name, lonlats) {
        var i, markerLayer = new OpenLayers.Layer.Markers(name);
        
        for (i = 0; i < lonlats.length; i += 1) {
            markerLayer.addMarker(new OpenLayers.Marker(lonlats[i]));
        }
        
        this.markerLayers[name] = markerLayer;
        this.map.addLayer(this.markerLayers[name]);
        
        return markerLayer;
    },
    
    initialize: function () {
        var mapCenter = this.lonlat(35.6660, -105.9632);
        
        this.map = new OpenLayers.Map("map_canvas");
        this.map.addLayer(new OpenLayers.Layer.OSM());
        this.map.setCenter(mapCenter, 12);
        
        // Set the socket
        // TODO:  need to use acequia for this.  This will need node to node communications.
        autobusSocket.init("http://localhost:3000");
        
        navigator.geolocation.getCurrentPosition(objCallback(this, "onPositionUpdate"));
    },
    
    onRoutes: function (data) {
        var i, rt,
        routes = JSON.parse(data);
        
        for (i = 0; i < routes.length; i += 1) {
            rt = routes[i];
            this.routes[rt.route_id] = rt;
            $("<div></div>")
                .attr("id", "route_" + rt.route_id)
                .css("background", rt.route_color)
                .html(rt.route_desc)
                .click(objCallback(this, "onclickRoute"))
                .addClass("autobus_list_item ui-corner-all")
                .css("opacity", "0.5")
                .appendTo("#autobus_route_list");
        }
    },
    
    onclickRoute: function (evt) {
        var route_id = evt.target.id;
        route_id = route_id.substring(route_id.indexOf("_") + 1);
        if (this.routeLayers[route_id]) {
            this.toggleRoute(route_id);
        } else {
            autobusSocket.emit("get route", {route_id: route_id});
        }
    },
    
    toggleRoute: function (route_id) {
        var i;
        if (this.routeLayers[route_id].getMap() === null) {
            this.setMapForPath(route_id, this.map);
            $("#route_" + route_id).css("opacity", "1.0");
        } else {
            this.setMapForPath(route_id, null);
            $("#route_" + route_id).css("opacity", "0.5");
        }
    },
    
    setMapForMarkers: function (route_id, map) {
        var i;
        for (i = 0; i < this.markers[route_id].length; i += 1) {
            this.markers[route_id][i].setMap(map);
        }
    },
    
    setMapForPath: function (route_id, map) {
        this.routeLayers[route_id].setMap(map);
        this.setMapForMarkers(route_id, map);
    },

    onRoute: function (data) {
        var i, route = JSON.parse(data), routePath, stop, point, lineString, lineFeature,
        routeCoordinates = [], points = [], route_style;
        
        // Extract the route coordinates
        for (i = 0; i < route.stop_times.length; i += 1) {
            stop = route.stop_times[i].stop;
            point = this.lonlat(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
            routeCoordinates.push(point);
            
            points.push(new OpenLayers.Geometry.Point(point.lon, point.lat));
        }
        
        // Create a marker layer to contain each stop
        this.createMarkerLayer(route.route_id, routeCoordinates);
        
        route_style = {
            strokeColor: this.routes[route.route_id].route_color,
            strokeOpacity: 1.0,
            strokeWidth: 2
        };
        
        lineString  = new OpenLayers.Geometry.LineString(points);
        lineFeature = new OpenLayers.Feature.Vector(lineString, null, route_style);
        this.routeLayers[route.route_id] = new OpenLayers.Layer.Vector(route.route_id,
            {
                isBaseLayer: false,
                rendererOptions: {yOrdering: true}
            });
        this.routeLayers[route.route_id].addFeatures([lineFeature]);
        
        this.map.addLayer(this.routeLayers[route.route_id]);

        $("#route_" + route.route_id).css("opacity", "1.0");        
    }
};

var autobusSocket = {
    
    socket: null,
        
    init: function (uri) {
        
        this.socket = io.connect(uri);
        this.socket.on('routes', function (data) {
            autobus.onRoutes(data);
        });

        this.socket.on('route', function (data) {
            autobus.onRoute(data);
        });
        
        this.socket.emit("get routes", {});
    },
    
    emit: function (msgName, data) {
        if (typeof(data) === "undefined") {
            data = {};
        }
        this.socket.emit(msgName, data);
    }
};
