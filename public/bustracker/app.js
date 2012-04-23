
/*global $ window document */

var objCallback = function (obj, func) {
    return function () {
        obj[func].apply(obj, arguments);
    };
};

var app = {
    init: function () {
        this.socket = io.connect("http://localhost:3000");
        this.routeId = "";
    },

    emit: function (msgName, data) {
        if (typeof(data) === "undefined") {
            data = {};
        }
        this.socket.emit(msgName, data);
    },
    
    setRouteId: function (id) {
        this.routeId = id;
    },
    
    onPositionUpdate: function (position) {
        this.emit("busPosition", 
            {route_id: this.routeId,
             lat: position.coords.latitude,
             lon: position.coords.longitude}
        );
    },
    
    startTracking: function () {
        this.routeId = $("#route_id_input").val();
        navigator.geolocation.getCurrentPosition(objCallback(this, "onPositionUpdate"));
    },
    
    stopTracking: function () {
        navigator.geolocation.getCurrentPosition(function(){});        
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

