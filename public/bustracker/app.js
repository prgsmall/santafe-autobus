
/*global $ window document */

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
        this.acequiaClient.send("busPosition", 
            {route_id: this.routeId,
             lat: position.coords.latitude,
             lon: position.coords.longitude}
        );
        
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
        app.stopTracking();
            break;
    }
    console.log(evt);
});

