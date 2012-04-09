
/*global $ window document google io console*/

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};

var autobus = {

    map: null,
    
    routes: {},
    
    routePaths: {},
    
    initialize: function () {
        // Initialize the map
        var myOptions = {
            zoom: 12,
            center: new google.maps.LatLng(35.6660, -105.9632),
            mapTypeId: google.maps.MapTypeId.TERRAIN
        };
        this.map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
        
        // Set the socket
        autobusSocket.init("http://localhost:3000");
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
        if (this.routePaths[route_id]) {
            if (this.routePaths[route_id].getMap() === null) {
                this.routePaths[route_id].setMap(this.map);
                $("#" + evt.target.id).css("opacity", "1.0");
            } else {
                this.routePaths[route_id].setMap(null);
                $("#" + evt.target.id).css("opacity", "0.5");
            }
        } else {
            autobusSocket.emit("get route", {route_id: route_id});
        }
    },

    onRoute: function (data) {
        var i, route = JSON.parse(data), routePath, stop,
        routeCoordinates = [];
        
        for (i = 0; i < route.stop_times.length; i += 1) {
            stop = route.stop_times[i].stop;
            routeCoordinates.push(new google.maps.LatLng(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)));
        }
            
        routePath = new google.maps.Polyline({
            path: routeCoordinates,
            strokeColor: this.routes[route.route_id].route_color,
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
          
        routePath.setMap(this.map);
        $("#route_" + route.route_id).css("opacity", "1.0");
        
        this.routePaths[route.route_id] = routePath;
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
