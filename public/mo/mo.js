/*global $ window document google MapIconMaker AutobusClient 
  google console InfoBubble setInterval clearInterval objCallback*/


var disableButtons = function () {
    $("div[data-role=footer]>a").addClass('ui-disabled');
};

var enableButtons = function () {
    $("div[data-role=footer]>a").removeClass('ui-disabled');
};



var app = new AutobusClient();

app.onRoutes = function (message) {
    var i, rt, routes = message.body;
    
    for (i = 0; i < routes.length; i += 1) {
        rt = routes[i];
        this.routes[rt.route_id] = rt;

        this.acequiaClient.send("getRoute", {route_id: rt.route_id});
    }
};

app.infowindow = new InfoBubble({
    padding: 10,
    borderRadius: 10,
    arrowSize: 15,
    arrowStyle: 0,
    arrowPosition: 50,
    maxWidth: 150,
    borderColor: "#ccc",
    backgroundColor: "#fff"
});

app.onRoute = function (route) {
    var i, routePath, stop, point, marker,
    routeCoordinates = [], color,
    
    onclick = function (i, m) {
        return function () {
            var content, onclick = "\"app.displayNextBuses('" + m.route_id + "','" + m.stop_id + "');\"";
            content = "<div class='info'>";
            content += "<div class='info-title'>" + m.title + "</div>";
            content += "<a href='#next_buses' onclick=" + onclick + ">Next Buses</a>";
            content += "</div>";
            i.setContent(content);
            i.open(this.map, m);
        };
    };
    
    color = "#" + this.routes[route.route_id].route_color;
    
    this.markers[route.route_id] = [];
    
    for (i = 0; i < route.stop_times.length; i += 1) {
        stop = route.stop_times[i].stop;
        point = new google.maps.LatLng(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
        routeCoordinates.push(point);
        
        marker = new google.maps.Marker({
            position: point,
            map: null,
            title: route.route_id + ": " + stop.stop_name,
            icon: MapIconMaker.createMarkerIcon({width: 20, height: 34, primaryColor: color}),
            stop_id: stop.stop_id,
            route_id: route.route_id
        });
        
        this.markers[route.route_id].push(marker);
        
        google.maps.event.addListener(marker, 'click', onclick(this.infowindow, marker));
    }
        
    routePath = new google.maps.Polyline({
        path: routeCoordinates,
        strokeColor: color,
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: this.map
    });

    $("#route_" + route.route_id).css("opacity", "1.0");
    
    this.routePaths[route.route_id] = routePath;
    
    this.checkRoutes();
};

app.checkRoutes = function () {
    var route_id;
    for (route_id in this.routes) {
        if (typeof(this.routes[route_id].trips) === "undefined") {
            return;
        }
    }
    enableButtons();
};

app.displayNextBuses = function (route_id, stop_id) {
    var times, j, onclick, rt = this.routes[route_id], count;
    
    $("#next_bus_title").html("Next Buses for " + rt.route_id + ": " + rt.route_desc);
    
    $("#next-bus-listview-title~li").remove();
    
    times = this.getNextArrivalsForStop(route_id, stop_id);
    
    count = Math.min(7, times.length);
    
    for (j = 0; j < count; j += 1) {
        onclick = "onclick='app.setSelectedBusDateTime(\"" + times[j].time + "\");'";
        $('<li data-theme="c"><a href="#count-down" data-transition="slide"' + onclick + '>' +
           times[j].time + '</a></li>').appendTo("#next-bus-listview");        
    }
    
    try {
        $("#next-bus-listview").listview('refresh');
    } catch (e) {
        // Eat the exception
    }

    /*
    $("#bus-time-buttons>legend~input").remove();
    $("#bus-time-buttons>legend~label").remove();

    for (j = 0; j < count; j += 1) {
        $("<input/>")
            .attr("name", "bus-time-radiobutton")
            .attr("id", "stop_" + j)
            .attr("value", times[j].time)
            .attr("type", "radio")
            .appendTo("#bus-time-buttons");

        $("<label/>")
            .attr("for", "stop_" + j)
            .html(times[j].time)
            .appendTo("#bus-time-buttons");
    }
    */
};

app.setSelectedBusDateTime = function (txt) {
    var timeParts = txt.split(":");
    this.selectedBusDateTime = new Date();
    this.selectedBusDateTime.setHours(parseInt(timeParts[0], 10));
    this.selectedBusDateTime.setMinutes(parseInt(timeParts[1], 10));
    this.selectedBusDateTime.setSeconds(parseInt(timeParts[2], 10));
};

app.displaySinglePath = function (route_id) {
    var i, latlngbounds;
    for (i in this.routes) {
        if (i === route_id) {
            this.setMapForMarkers(i, this.map);
            this.setMapForPath(i, this.map);
        } else {
            this.setMapForMarkers(i, null);
            this.setMapForPath(i, null);
        }
    }

    latlngbounds = new google.maps.LatLngBounds();

    this.routePaths[route_id].getPath().forEach(function (n) {
        latlngbounds.extend(n);
    });

    this.map.fitBounds(latlngbounds);
    this.map.setCenter(latlngbounds.getCenter());
    
    this.circ.setMap(null);
};

app.circ = null;

app.centerMap = function (latlng, r) {
    r = r * 1609.0;
    
    if (!this.circ) {
        this.circ = new google.maps.Circle({
            center: latlng,
            map: this.map,
            radius: r,
            fillOpacity: 0,
            fillColor: "#cccccc",
            strokeOpacity: 0.8,
            strokeColor: "#cccccc"
        });
    } else {
        this.circ.setCenter(latlng);
        this.circ.setRadius(r);
        this.circ.setMap(this.map);
    }
        
    this.map.setCenter(latlng);
    this.map.fitBounds(this.circ.getBounds());
    this.map.setZoom(this.map.getZoom() + 1);

    // updates markers
    google.maps.event.trigger(this.map, 'resize');
    
    return this.circ.getBounds();
};

app.displayWhereIAm = function () {
    
    var i, bounds, route_id, m, stops = [], routes = {};

    // Hide any paths that are displayed    
    for (route_id in this.routes) {
        this.setMapForMarkers(route_id, null);
        this.setMapForPath(route_id, null);
    }
    
    // Zoom into the map within a radius of half mile
    bounds = this.centerMap(this.currentPositionMarker.getPosition(), 0.35);
    
    // Find the stops that are on the map by looping through the markers
    for (route_id in this.markers) {
        for (i = 0; i < this.markers[route_id].length; i += 1) {
            m = this.markers[route_id][i];
            if (bounds.contains(m.getPosition())) {
                stops.push(m);
                routes[route_id] = route_id;
            }
        }
    }
    
    // Display those markers
    for (i = 0; i < stops.length; i += 1) {
        stops[i].setMap(this.map);
    }
    
    // Display the bus lines
    for (route_id in routes) {
        this.setMapForPath(route_id, this.map);
    }
    
};

app.countdownInterval = null;
app.selectedBusDateTime = null;

app.decrementCoundownTimer = function () {
    var now, timeDiff, txtTime, time, pad, hours, minutes, seconds;
    
    pad = function (n) {
        var s = n.toString();
        return s.length < 2 ? '0' + s : s;
    };
    
    now = new Date();
    time = app.selectedBusDateTime.getTime() - now.getTime();
    if (time <= 0) {
        txtTime = "00:00:00";
        this.stopCountdownTimer();
    } else {
        // convert to seconds
        time = Math.floor(time / 1000);
        hours = Math.floor(time / 3600);
        time = time % 3600;
        minutes = Math.floor(time / 60);
        seconds = time % 60;

        txtTime = pad(hours) + ":" +  pad(minutes) + ":" +  pad(seconds);
    }
            
    $("#countDownText").html(txtTime);
};

app.stopCountdownTimer = function () {
    clearInterval(this.countdownInterval);
    this.countdownInterval = null;
};

app.startCountdownTimer = function () {
    this.decrementCoundownTimer();
    this.countdownInterval = setInterval(objCallback(this, "decrementCoundownTimer"), 1000);
};

var setMapParent = function (pageId, append) {
    var map_canvas = $("#map_canvas").detach();
    if (typeof(append) === "undefined") {
        map_canvas.prependTo("#" + pageId + " div[data-role=content]");        
    } else {
        map_canvas.appendTo("#" + pageId + " div[data-role=content]");
    }
};

$(document).ready(function (evt) {
    disableButtons();
    app.init(11, 35.6660, -105.9632, 
             google.maps.MapTypeId.ROADMAP,
             { mapTypeControl: false
             , streetViewControl: false
             , zoomControl: false});
});

$(document).bind("pagechange", function (evt, data) {
   
    switch (data.toPage[0].id) {
    case "bus_schedule_page":
        $("#bus_schedule_route").html(data.options.fromPage[0].id);
        break;

    case "home":
        setMapParent(data.toPage[0].id);
        try {
            app.showAllPaths();
            if (app.circ) {
                app.circ.setMap(null);
            }
            app.infowindow.close();
        } catch (e) {
        }
        break;

    case "where_am_i":
        setMapParent(data.toPage[0].id);
        app.displayWhereIAm();
        break;
        
    case "count-down":
        setMapParent(data.toPage[0].id, true);
        app.startCountdownTimer();
        break;
        
    default:
        if (data.toPage[0].id.indexOf("route_") === 0) {
            setMapParent(data.toPage[0].id);
            app.displaySinglePath(app.routeIdFromEleId(data.toPage[0].id));
        }
        break;
    }
});

