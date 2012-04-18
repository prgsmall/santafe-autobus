
/*global $ window document google io console alert OpenLayers navigator*/

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};

var MarkerInfo = function (lonlat, content) {
    this.lonlat = lonlat;
    this.content = content;
};

var autobus = {

    map: null,
    
    routes: {},
    
    markers: {},
    
    markerLayers: {},
    
    routeLayers: {},
    
    lonlat: function (lon, lat) {
        return new OpenLayers.LonLat(lon, lat)
            .transform(
                    new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
                    new OpenLayers.Projection("EPSG:900913") // to Spherical Mercator Projection
        );
    },
    
    onPositionUpdate: function (position) {
        var markerInfo;
        if (!("currentPosition" in this.markerLayers)) {
            markerInfo = new MarkerInfo(this.lonlat(position.coords.longitude, position.coords.latitude), "You are here");
            this.createMarkerLayer("currentPosition", [markerInfo]);
        }

        console.log("Current position: " + position.coords.latitude + " " + position.coords.longitude);        
    },
    
    createMarkerLayer: function (name, markerInfo) {
        var i, markerLayer = new OpenLayers.Layer.Markers(name);
        
        for (i = 0; i < markerInfo.length; i += 1) {
            this.addMarker(markerInfo[i].lonlat, markerInfo[i].content, markerLayer);
        }
        
        this.markerLayers[name] = markerLayer;
        this.map.addLayer(this.markerLayers[name]);
        
        return markerLayer;
    },
    
    /**
     * Add a new marker to the markers layer given the lonlat and popup contents HTML.
     * @param ll {OpenLayers.LonLat} Where to place the marker
     * @param popupContentHTML {String} What to put in the popup
     * @param markerLayer {OpenLayers.Layer.Markers} The marker layer to add the markers to
     */
    addMarker: function (ll, popupContentHTML, markerLayer) {

        var feature = new OpenLayers.Feature(markerLayer, ll); 
        feature.closeBox = true;
        feature.popupClass = OpenLayers.Popup.FramedCloud;
        feature.data.popupContentHTML = popupContentHTML;
        feature.data.overflow = "auto";

        var marker = feature.createMarker();

        var markerClick = function (evt) {
            if (this.popup == null) {
                this.popup = this.createPopup(this.closeBox);
                this.layer.map.addPopup(this.popup);
                this.popup.show();
            } else {
                this.popup.toggle();
            }
            currentPopup = this.popup;
            OpenLayers.Event.stop(evt);
        };
        marker.events.register("mousedown", feature, markerClick);

        markerLayer.addMarker(marker);
    },

    initialize: function () {
        OpenLayers.Popup.FramedCloud.prototype.autoSize = true;

        var mapCenter = this.lonlat(-105.9632, 35.6660);
        
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
                .css("background", "#" + rt.route_color)
                .html(rt.route_short_name + " " + rt.route_desc)
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
        markerInfo = [], points = [], route_style;
        
        // Extract the route coordinates
        for (i = 0; i < route.stop_times.length; i += 1) {
            stop = route.stop_times[i].stop;
            point = this.lonlat(parseFloat(stop.stop_lon), parseFloat(stop.stop_lat));
            
            markerInfo.push(new MarkerInfo(point, stop.stop_name));
            
            points.push(new OpenLayers.Geometry.Point(point.lon, point.lat));
        }
        
        // Create a marker layer to contain each stop
        this.createMarkerLayer(route.route_id, markerInfo);
        
        route_style = {
            strokeColor: "#" + this.routes[route.route_id].route_color,
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
