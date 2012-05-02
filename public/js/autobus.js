/*global $ window document google console navigator MapIconMaker AcequiaClient setTimeout*/

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};

var autobus = {

    map: null,
    
    routes: {},
    
    routePaths: {},
    
    markers: {},
    
    buses: {},
    
    currentPositionMarker: null,
    
    onPositionUpdate: function (position) {
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
    },
    
    initialize: function () {
        // Initialize the map
        var myOptions = {
            zoom: 12,
            center: new google.maps.LatLng(35.6660, -105.9632),
            mapTypeId: google.maps.MapTypeId.TERRAIN
        };
        this.map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

        this.acequiaClient = new AcequiaClient("autobus_" + Math.random(), "3001");
        this.acequiaClient.on("routes", objCallback(this, "onRoutes"));
        this.acequiaClient.on("route", objCallback(this, "onRouteFromServer"));
        this.acequiaClient.on("busPosition", objCallback(this, "onBusPosition"));
        this.acequiaClient.addConnectionChangeHandler(objCallback(this, "onConnected"));
        this.acequiaClient.connect();
            
        // Set up to get position updates
        navigator.geolocation.getCurrentPosition(objCallback(this, "onPositionUpdate"));
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

            $("<div></div>")
                .attr("id", "route_" + rt.route_id)
                .css("background", "#" + rt.route_color)
                .html(rt.route_id + ": " + rt.route_desc)
                .click(objCallback(this, "onclickRoute"))
                .addClass("autobus_list_item ui-corner-all")
                .css("opacity", "0.5")
                .appendTo("#autobus_route_list");

            $('<button></button>')
                .attr("id", "simulate_" + rt.route_id)
                .click(objCallback(this, "ondbclickRoute"))
                .css("margin-left", "100px")
                .html("sim")
                .appendTo("#route_" + rt.route_id);
        }
    },
    
    routeIdFromEvent: function (evt) {
        var route_id = evt.target.id;
        return route_id.substring(route_id.indexOf("_") + 1);
    },
    
    ondbclickRoute: function (evt) {
        var trip, route_id = this.routeIdFromEvent(evt);
        
        evt.stopPropagation();
        
        if (this.routePaths[route_id]) {
            trip = this.getTripForRoute(route_id);
            this.startBusSimulation(trip);
        }
    },
    
    onclickRoute: function (evt) {
        var trip, route_id = this.routeIdFromEvent(evt);
        if (this.routePaths[route_id]) {
            this.toggleRoute(route_id);
        } else {
            if (typeof(this.routes[route_id].trips) === "undefined") {
                this.acequiaClient.send("getRoute", {route_id: route_id});
            } else {
                trip = this.getTripForRoute(route_id);
                this.onRoute(trip);
            }
        }
    },
    
    toggleRoute: function (route_id) {
        var i;
        if (this.routePaths[route_id].getMap() === null) {
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
        this.routePaths[route_id].setMap(map);
        this.setMapForMarkers(route_id, map);
    },
    
    dateFromTimeString: function (timeString) {
        var ret,
        dd = timeString.split(":");

        ret = new Date();
        ret.setHours(parseInt(dd[0], 10));
        ret.setMinutes(parseInt(dd[1], 10));
        ret.setSeconds(parseInt(dd[2], 10));

        return ret;
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
    
    getNextArrivalsForStop: function (route_id, stop_id, time) {
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
    },
    
    onRouteFromServer: function (message) {
        var trip, route = message.body[0];
        this.routes[route.route_id] = route;
        
        trip = this.getTripForRoute(route.route_id);
        this.onRoute(trip);
    },
    
    updateBusPosition: function () {
        this.busMarkerIndex += 1;
        if (this.busMarkerIndex >= this.busMarkerPoints.length) {
            clearInterval(this.interval);
            this.interval = null;
            this.busMarker.setMap(null);
        }
        
        this.busMarker.setPosition(this.busMarkerPoints[this.busMarkerIndex]);        
    },
    
    busMarker: null,
    busMarkerIndex: 0,
    busMarkerPoints: [],
    interval: null,
    
    startBusSimulation: function (trip) {
        var i, j, points, fraction;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.busMarker.setMap(null);
        }
        
        this.busMarkerPoints = [];
        this.busMarkerIndex  = 0;
        
        // Generate the bus marker points by interpolating between each stop
        
        // First create an array of the trip points
        points = [];
        for (j = 0; j < trip.stop_times.length; j += 1) {
            points.push(new google.maps.LatLng(parseFloat(trip.stop_times[j].stop.stop_lat), parseFloat(trip.stop_times[j].stop.stop_lon)));
        }
        
        // Interpolate between the points
        for (i = 0; i < points.length; i += 1) {
            this.busMarkerPoints.push(points[i]);
            if (i < points.length - 1) {
                fraction = 0;
                while (fraction <= 1) {
                    this.busMarkerPoints.push(new google.maps.geometry.spherical.interpolate(points[i], points[i + 1], fraction));
                    fraction += 0.2;
                }
            }
        }
        
        // Create the marker
        if (!this.busMarker) {
            this.busMarker = new google.maps.Marker({
                position: points[0],
                map: this.map,
                title: "bus",
                icon: "/images/bus.png"
            });
        } else {
            this.busMarker.setMap(this.map);
        }
        this.interval = setInterval(objCallback(this, "updateBusPosition"), 1000);        
    },

    onRoute: function (route) {
        var i, routePath, stop, point, marker, infowindow,
        routeCoordinates = [], color,
        
        onclick = function (i, m) {
            return function () {
                var times, content, j;
                times = autobus.getNextArrivalsForStop(m.route_id, m.stop_id);
                content = "<div style='height:100px;overflow:hidden;'>";
                content += "<div style='font-weight:bold'>" + m.title + "</div>";
                content += "<div style='height:90px;overflow:auto;'>";
                for (j = 0; j < times.length; j += 1) {
                    content += "<div>" + times[j].time;
                    // content += (times[j].direction_id === "0") ? " outbound" : " inbound";
                    content += "</div>";
                }
                content += "</div></div>";
                i.content = content;
                i.open(this.map, m);
            };
        };
        
        color = "#" + this.routes[route.route_id].route_color;
        
        this.markers[route.route_id] = [];
        
        infowindow = new google.maps.InfoWindow({
            content: "blah"
        });

        for (i = 0; i < route.stop_times.length; i += 1) {
            stop = route.stop_times[i].stop;
            point = new google.maps.LatLng(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
            routeCoordinates.push(point);
            
            marker = new google.maps.Marker({
                position: point,
                map: this.map,
                title: stop.stop_name,
                icon: MapIconMaker.createMarkerIcon({width: 20, height: 34, primaryColor: color}),
                stop_id: stop.stop_id,
                route_id: route.route_id
            });
            
            this.markers[route.route_id].push(marker);
            
            google.maps.event.addListener(marker, 'click', onclick(infowindow, marker));
        }
            
        routePath = new google.maps.Polyline({
            path: routeCoordinates,
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
          
        routePath.setMap(this.map);
        $("#route_" + route.route_id).css("opacity", "1.0");
        
        this.routePaths[route.route_id] = routePath;
    }
};