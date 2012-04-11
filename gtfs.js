/*globals require module console*/
var path = require('path');
var csv = require('csv');
var fs = require('fs');

var clone = function (src, dest) {
    var keys, l;
    for (keys = Object.keys(src), l = keys.length; l; l -= 1) {
        dest[keys[l - 1]] = src[keys[l - 1]];
    }   
};

if (typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180;
    };
}

var Point = function (lat, lon) {
    this.lat = lat;
    this.lon = lon;
};

var RADIUS_OF_EARTH = 6371;

var distanceBetweenTwoPoints = function (pt1, pt2) {
    var dLat, dLon, a, c;
    
    dLat = (pt2.lat - pt1.lat).toRad();
    
    dLon = (pt2.lon - pt1.lon).toRad();
    a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(pt1.lat.toRad()) * Math.cos(pt2.lat.toRad()) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
    return RADIUS_OF_EARTH * c; // Distance in km
};

module.exports = function () {
    
    this.dataset = {};
    
    this.feedFiles = ['agency', 'calendar', 'calendar_dates', 'fare_attributes',
                      'fare_rules', 'feed_info', 'frequencies', 'routes', 'shapes', 
                      'stops', 'stop_times', 'transfers', 'trips'];
    
    this.getAgency = function () {
        return this.dataset.agency;
    };
    
    this.getCalendars = function () {
        return this.dataset.calendar;
    };
    
    this.getRoutes = function () {
        return this.dataset.routes;
    };
    
    this.getShapes = function () {
        return this.dataset.shapes;
    };
    
    this.getStops = function () {
        return this.dataset.stops;
    };
    
    this.getStopTimes = function () {
        return this.dataset.stop_times;
    };
    
    this.getTrips = function () {
        return this.dataset.trips;
    };
    
    this.getClosestStop = function (point) {
        var d = 1;
    };
    
    this.getRouteById = function (id) {
        var ret = null, route = null, i;
        for (i = 0; i < this.dataset.routes.length; i += 1) {        
            if (this.dataset.routes[i].route_id === id) { 
                route = this.dataset.routes[i];
                break;
            }   
        }
        
        if (route) {
            ret = {};
            clone(route, ret);
            ret.trips = this.getTripsForRoute(ret.route_id);
        }
        return ret;
    };
            
    this.getTripById = function (id) {
        var ret = null, trip = null, i;
        for (i = 0; i < this.dataset.trips.length; i += 1) {      
            if (this.dataset.trips[i].trip_id === id) {
                trip = this.dataset.trips[i];
                break;
            }
        }

        if (trip) {
            ret = {};
            clone(trip, ret);
            ret.stop_times = this.getStopTimesForTrip(ret.trip_id);
        }
        return ret;
    };
    
    this.getTripsForRoute = function (route_id) {
        var trip, trip_ids = [], trips = [], i;
        for (trip in this.dataset.trips) {      
            if (this.dataset.trips[trip].route_id === route_id) {
                trip_ids.push(this.dataset.trips[trip].trip_id);
            }
        }
        
        for (i = 0; i < trip_ids.length; i += 1) {
            trips.push(this.getTripById(trip_ids[i]));
        }
        return trips;
        
    };

    this.getTripForRoute = function (route_id) {
        return this.getTripsForRoute(route_id)[0];
    };
    
    this.getShapesById = function (id) {
        var ret = [], i;
        for (i in this.dataset.shapes) {
            if (this.dataset.shapes[i].shape_id === id) {
                ret.push(this.dataset.shapes[i]);
            }
        }
        return ret;
    };
    
    this.getCalendarById = function (id) {
        var cal;
        for (cal in this.dataset.calendar) {
            if (this.dataset.calendar[cal].service_id === id) {
                return this.dataset.calendar[cal];
            } 
        }
        return null;
    };
    
    this.getStopById = function (id) {
        var stop;
        for (stop in this.dataset.stops) {
            if (this.dataset.stops[stop].stop_id === id) {
                return this.dataset.stops[stop];
            } 
        }
        return null;
    };
    
    this.getStopTimeById = function (trip_id, stop_id) {
        var stop_time = null, ret = null, i;
        for (i = 0; i < this.dataset.stop_times.length; i += 1) {
            if (this.dataset.stop_times[i].trip_id === trip_id && 
                this.dataset.stop_times[i].stop_id === stop_id) {
                stop_time = this.dataset.stop_times[i];
                break;
            } 
        }
        
        if (stop_time) {
            ret = {};
            clone(stop_time, ret);
            ret.stop = this.getStopById(stop_id);
        }
        return ret;
    };
    
    this.getNearestStop = function (lat, lon) {
        
    };
    
    this.getStopTimesForTrip = function (trip_id) {
        var stop_time, stop_times = [], ids = [], i;
        for (stop_time in this.dataset.stop_times) {
            if (this.dataset.stop_times[stop_time].trip_id === trip_id) {
                ids.push(this.dataset.stop_times[stop_time].stop_id);
            } 
        }
        
        for (i = 0; i < ids.length; i += 1) {
            stop_times.push(this.getStopTimeById(trip_id, ids[i]));
        }
        return stop_times;
    };

    this.init = function (dir, cb) {
        var loadFeed = (function (self) {
            return function (dir, id, cb) {
                return self.load(dir, id, cb, self);
            };
        }(this));
        
        this.feedFiles.forEach(function (id) {
            loadFeed(dir, id, cb);
        });
    };
    
    this.load = function (dir, feed, cb, self) {
        var out = [], stats,
        feedFile = dir + "/data/" + feed + ".txt";
        try {
            // Call stat to see if the file exists.  If it doesn't, it will throw
            // an exception and we will set the collection associated with this feed to empty
            stats = fs.lstatSync(feedFile);

            csv()
            .fromPath(feedFile, {
                columns: true,
                trim: true
            })
            .on('data', function (data, index) {
                out.push(data);
            })
            .on('end', function (count) {
                console.log(feed + ':  number of lines: ' + count);
                self.dataset[feed] = out;
                self.checkLoad(cb);
            })
            .on('error', function (error) {
                console.log(error.message);
            });
        } catch (e) {
            self.dataset[feed] = out;
            self.checkLoad(cb);
            console.log(feed + ':  number of lines: ' + self.dataset[feed].length);
            if (e.code !== "ENOENT") {
                console.log("uncaught exception reading " + feed + ":  " + e.message);
            }
        }
    };

    this.checkLoad = function (callback) {
        var i, isDone = true;
        for (i = 0; i < this.feedFiles.length; i += 1) {
            if (!(this.feedFiles[i] in this.dataset)) {
                isDone = false;
                break;
            }
        }

        if (isDone) {
            callback();
        }
    };
};
