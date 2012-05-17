/*global $ window document google console navigator MapIconMaker setInterval clearInterval AutobusClient objCallback*/

var Autobus = function () {
    this.busMarker = null;
    this.busMarkerIndex = 0;
    this.busMarkerPoints = [];
    this.interval = null;
    AutobusClient.call(this);
};

Autobus.prototype = new AutobusClient();

var autobus = new Autobus();

autobus.onRoutes = function (routes) {
    var i, rt;
    
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
            .click(objCallback(this, "onClickStartSimulation"))
            .css("margin-left", "100px")
            .html("sim")
            .appendTo("#route_" + rt.route_id);
    }
};

autobus.onclickRoute = function (evt) {
    var trip, route_id = this.routeIdFromEleId(evt.target.id);
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
};

autobus.toggleRoute = function (route_id) {
    var i;
    if (this.routePaths[route_id].getMap() === null) {
        this.setMapForPath(route_id, this.map);
        $("#route_" + route_id).css("opacity", "1.0");
    } else {
        this.setMapForPath(route_id, null);
        $("#route_" + route_id).css("opacity", "0.5");
    }
};

autobus.onClickStartSimulation = function (evt) {
    var trip, route_id = this.routeIdFromEleId(evt.target.id);
    
    evt.stopPropagation();
    
    if (this.routePaths[route_id]) {
        trip = this.getTripForRoute(route_id);
        this.startBusSimulation(trip);
    }
};

autobus.startBusSimulation = function (trip) {
    var i, j, points, fraction;
    
    if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
        this.busMarker.setMap(null);
        return;
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
    }
    this.interval = setInterval(objCallback(this, "updateBusPosition"), 1000);        
};

autobus.updateBusPosition = function () {
    this.busMarkerIndex += 1;
    if (this.busMarkerIndex >= this.busMarkerPoints.length) {
        clearInterval(this.interval);
        this.interval = null;
        this.busMarker.setMap(null);
    }
    
    this.busMarker.setPosition(this.busMarkerPoints[this.busMarkerIndex]);        
    if (this.busMarker.getMap() === null) {
        this.busMarker.setMap(this.map);
    }    
};

autobus.onRoute = function (route) {
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
};

