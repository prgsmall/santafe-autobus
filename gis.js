/**
 *  gis
 *
 *  Created by Peter R. G. Small on 2012-04-18.
 *  Copyright (c) 2012 PRGSoftware, LLC. All rights reserved.
 */

/*global $ module */

if (typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180;
    };
}

var Point = function (lat, lon) {
    this.lat = Number(lat);
    this.lon = Number(lon);
};

var RADIUS_OF_EARTH = 6371;

module.exports.distanceBetweenTwoPoints = function (pt1, pt2) {
    var dLat, dLon, a, c;
    
    dLat = (pt2.lat - pt1.lat).toRad();
    
    dLon = (pt2.lon - pt1.lon).toRad();
    a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(pt1.lat.toRad()) * Math.cos(pt2.lat.toRad()) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
    return RADIUS_OF_EARTH * c; // Distance in km
};


module.exports.createPoint = function (lat, lon) {
    return new Point(lat, lon);
};