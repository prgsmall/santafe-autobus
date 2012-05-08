
/*global $ window document google MapIconMaker AutobusClient google console*/

var app = new AutobusClient();


app.onRoutes = function (message) {
    var i, rt, routes = message.body;
    
    for (i = 0; i < routes.length; i += 1) {
        rt = routes[i];
        this.routes[rt.route_id] = rt;

        this.acequiaClient.send("getRoute", {route_id: rt.route_id});
    }
};

app.onRoute = function (route) {
    var i, routePath, stop, point, marker, infowindow,
    routeCoordinates = [], color,
    
    onclick = function (i, m) {
        return function () {
            var times, content, j;
            times = app.getNextArrivalsForStop(m.route_id, m.stop_id);
            content = "<div style='height:100px;overflow:hidden;'>";
            content += "<div style='font-size:12px;font-weight:bold;'>" + m.title + "</div>";
            content += "<a href='#next_buses' style='font-size:12px;'>Next Buses</a>";
/*            content += "<div style='height:90px;overflow:auto;'>";
            for (j = 0; j < times.length; j += 1) {
                content += "<div>" + times[j].time;
                // content += (times[j].direction_id === "0") ? " outbound" : " inbound";
                content += "</div>";
            }
            content += "</div>"
*/
            content += "</div>";
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
            map: null,
            title: route.route_id + ": " + stop.stop_name,
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
      
    routePath.setMap(null);
    $("#route_" + route.route_id).css("opacity", "1.0");
    
    this.routePaths[route.route_id] = routePath;
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
    console.log(latlngbounds.getCenter().lat()    + "  " + latlngbounds.getCenter().lng());
    console.log(latlngbounds.getNorthEast().lat() + "  " + latlngbounds.getNorthEast().lng());
    console.log(latlngbounds.getSouthWest().lat() + "  " + latlngbounds.getSouthWest().lng());

    this.map.setCenter(latlngbounds.getCenter());
    this.map.panToBounds(latlngbounds);
    //this.map.fitBounds(latlngbounds);
};

app.centerMap = function (latlng, r)
{
    // latlng is the point of the zipcode
    var circ = new google.maps.Circle({
        center: latlng,
        map: this.map,
        radius: r * 1609.0,
        fillOpacity: 0,
        fillColor: "#cccccc",
        strokeOpacity: 0.8,
        strokeColor: "#cccccc"
    });
    
    this.map.setCenter(latlng);
    this.map.fitBounds(circ.getBounds());
    this.map.setZoom(this.map.getZoom() + 1);

    // updates markers
    google.maps.event.trigger(this.map, 'resize');
    
    return circ.getBounds();
};

app.triggerResize = function () {
    google.maps.event.trigger(this.map, "resize");
    this.map.setZoom(this.map.getZoom());  
};

app.showMap = function (show) {
    if (show) {
        $("#map_canvas").show();
        $("#home_image").hide();
    } else {
        $("#map_canvas").hide();
        $("#home_image").show();
    }
};

app.displayWhereIAm = function () {
    
    var i, bounds, route_id, m, stops = [];

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
            }
        }
    }
    
    // Display those markers
    for (i = 0; i < stops.length; i += 1) {
        stops[i].setMap(this.map);
    }
};

$(document).bind('pageinit', function (evt) {
    $("#map_canvas").hide();
    app.init(11, 35.6660, -105.9632, 
             google.maps.MapTypeId.ROADMAP,
             { mapTypeControl: false
             , streetViewControl: false
             , zoomControl: false});
});

$(document).bind("pagechange", function (evt, data) {
    var map_canvas;
    if (data.toPage[0].id === "bus_schedule_page") {
        $("#bus_schedule_route").html(data.options.fromPage[0].id);
    } else if (data.toPage[0].id === "home") {
        app.showMap(false);
    } else if (data.toPage[0].id === "where_am_i") {
        app.showMap(true);
        app.triggerResize();
        map_canvas = $("#map_canvas").detach();
        map_canvas.prependTo("#" + data.toPage[0].id + " div[data-role=content]");
        app.displayWhereIAm();
    } else if (data.toPage[0].id.indexOf("route_") === 0) {
        app.showMap(true);
        app.triggerResize();
        app.displaySinglePath(app.routeIdFromEleId(data.toPage[0].id));
        map_canvas = $("#map_canvas").detach();
        map_canvas.prependTo("#" + data.toPage[0].id + " div[data-role=content]");
    }
});

