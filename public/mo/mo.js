
/*global $ window document google  MapIconMaker AcequiaClient */

var objCallback = function (obj, func) {
    return function () {
        // console.log(func);
        obj[func].apply(obj, arguments);
    };
};

var app = {
    map: null,
    
    routes: {},
    
    routePaths: {},
    
    markers: {},
    
    buses: {},
    
    initialized: false,
    
    init: function () {
        if (!this.initialized) {
            this.initialized = true;
            this.acequiaClient = new AcequiaClient("mobile_autobus_" + Math.random(), "3001");
            this.acequiaClient.on("routes", objCallback(this, "onRoutes"));
            this.acequiaClient.on("route", objCallback(this, "onRouteFromServer"));
            this.acequiaClient.on("busPosition", objCallback(this, "onBusPosition"));
            this.acequiaClient.addConnectionChangeHandler(objCallback(this, "onConnected"));
            this.acequiaClient.connect();
            
            // Initialize the map
            var options = {
                zoom: 11,
                center: new google.maps.LatLng(35.6660, -105.9632),
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            this.map = new google.maps.Map(document.getElementById("map_canvas"), options);
        }
    },

    onConnected: function (connected) {
        if (connected) {
            this.acequiaClient.send("getRoutes");
        }
    },
    
    onBusPosition: function (message) {
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
    },
    
    onRoutes: function (message) {
        var i, rt, routes = message.body;
        
        for (i = 0; i < routes.length; i += 1) {
            rt = routes[i];
            this.routes[rt.route_id] = rt;

            this.acequiaClient.send("getRoute", {route_id: rt.route_id});
        }
    },
    
    routeIdFromEvent: function (eleId) {
        var route_id = eleId;
        return route_id.substring(route_id.indexOf("_") + 1);
    },
    
    onRouteFromServer: function (message) {
        var trip, route = message.body[0];
        this.routes[route.route_id] = route;
        
        trip = this.getTripForRoute(route.route_id);
        this.onRoute(trip);
    },

    onRoute: function (route) {
        var i, routePath, stop, point, marker,
        routeCoordinates = [], color;
        
        color = "#" + this.routes[route.route_id].route_color;
        
        this.markers[route.route_id] = [];
        
        for (i = 0; i < route.stop_times.length; i += 1) {
            stop = route.stop_times[i].stop;
            point = new google.maps.LatLng(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
            routeCoordinates.push(point);
            
            marker = new google.maps.Marker({
                position: point,
                map: null,
                title: stop.stop_name,
                icon: MapIconMaker.createMarkerIcon({width: 20, height: 34, primaryColor: color})
            });
            
            this.markers[route.route_id].push(marker);            
        }
            
        routePath = new google.maps.Polyline({
            path: routeCoordinates,
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
          
        routePath.setMap(this.map);
        
        this.routePaths[route.route_id] = routePath;
    },
    
    getServiceId: function (time) {
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
    },
    
    getTripForRoute: function (route_id) {
        var i, route = this.routes[route_id],
        service_id = this.getServiceId();
        for (i = 0; i < route.trips.length; i += 1) {
            if (route.trips[i].service_id === service_id) {
                return route.trips[i];
            }
        }
        
        return null;
    },

    setMapForMarkers: function (route_id, map) {
        var i;
        for (i = 0; i < this.markers[route_id].length; i += 1) {
            this.markers[route_id][i].setMap(map);
        }
    },
    
    setMapForPath: function (route_id, map) {
        this.routePaths[route_id].setMap(map);
        this.setMapForMarkers(route_id, map);
    },
    
    displaySinglePath: function (route_id) {
        var i;
        for (i in this.routes) {
            if (i === route_id) {
                this.setMapForMarkers(i, this.map);
                this.setMapForPath(i, this.map);
            } else {
                this.setMapForMarkers(i, null);
                this.setMapForPath(i, null);
            }
        }

        var latlngbounds = new google.maps.LatLngBounds();

        this.routePaths[route_id].getPath().forEach(function(n){
            latlngbounds.extend(n);
        });
        console.log(latlngbounds.getCenter().lat() + "  " + latlngbounds.getCenter().lng());
        console.log(latlngbounds.getNorthEast().lat() + "  " + latlngbounds.getNorthEast().lng());
        console.log(latlngbounds.getSouthWest().lat() + "  " + latlngbounds.getSouthWest().lng());

        this.map.setCenter(latlngbounds.getCenter());
        this.map.fitBounds(latlngbounds);
    }
};

$(document).bind('pageinit', function (evt) {
    app.init();
});

$(document).bind("pagechange", function (evt, data) {
    var map_canvas;
    if (data.toPage[0].id === "bus_schedule_page") {
        $("#bus_schedule_route").html(data.options.fromPage[0].id);
    } else if (data.toPage[0].id.indexOf("route_") === 0) {
        app.displaySinglePath(app.routeIdFromEvent(data.toPage[0].id));
        map_canvas = $("#map_canvas").detach();
        map_canvas.prependTo("#" + data.toPage[0].id + " div[data-role=content]");
    }
});

