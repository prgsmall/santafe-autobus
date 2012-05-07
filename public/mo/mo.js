
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

    this.map.setCenter(this.currentPositionMarker.getPosition());
//    this.map.panToBounds(latlngbounds);
    //this.map.fitBounds(latlngbounds);
};


$(document).bind('pageinit', function (evt) {
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
    } else if (data.toPage[0].id.indexOf("route_") === 0) {
        app.displaySinglePath(app.routeIdFromEleId(data.toPage[0].id));
        map_canvas = $("#map_canvas").detach();
        map_canvas.prependTo("#" + data.toPage[0].id + " div[data-role=content]");
    }
});

