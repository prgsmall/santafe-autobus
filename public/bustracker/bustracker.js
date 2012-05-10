
/*global $ window document AcequiaClient navigator setTimeout*/

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};

var app = {
    initialized: false,
    
    init: function () {
        if (!this.initialized) {
            this.initialized = true;
            this.acequiaClient = new AcequiaClient("bus_tracker_" + Math.random(), "3001");
            this.acequiaClient.connect();
            this.routeId = "";
            this.tracking = false;
        }
    },

    setRouteId: function (id) {
        this.routeId = id;
    },
    
    onPositionUpdate: function (position) {
        var ll, center, markers, src;
        this.acequiaClient.send("busPosition", 
            {route_id: this.routeId,
             lat: position.coords.latitude,
             lon: position.coords.longitude}
        );
        ll = position.coords.latitude + "," + position.coords.longitude;
        center = "&center=" + ll;
        markers = "&markers=color:blue|label:" + this.routeId + "|" + ll;
        src = "https://maps.googleapis.com/maps/api/staticmap?zoom=15&size=288x300&sensor=false" + center + markers;
        $("#map-image").attr("src", src);
        
        if (this.tracking) {
            setTimeout(objCallback(this, "getCurrentPosition"), 5000);
        }
    },
    
    getCurrentPosition: function () {
        navigator.geolocation.getCurrentPosition(objCallback(this, "onPositionUpdate"));
    },
    
    startTracking: function () {
        this.tracking = true;
        this.routeId = $("#route_id").val();
        this.getCurrentPosition();
    },
    
    stopTracking: function () {
        this.tracking = false;   
    }
};

$(document).bind('pageinit', function (evt) {
    app.init();
});

$(document).bind("pagechange", function (evt, data) {
    switch (data.toPage[0].id) {
    case "tracking_page":
        app.startTracking();
        break;
    case "enter_tracking_data":
        if (data.options.fromPage && data.options.fromPage[0].id === "tracking_page") {
            app.stopTracking();
        }
        break;
    }
});

