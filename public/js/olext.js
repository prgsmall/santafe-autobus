/*globals OpenLayers */

OpenLayers.Marker.Label = OpenLayers.Class(OpenLayers.Marker, {

    labelDiv        : null,
    label           : null,
    mouseOver       : false,
    labelClass      : "olMarkerLabel",
    events          : null,
    div             : null,
    onlyOnMouseOver : false,
    mouseover       : false,
    labelOffset     : "10px",

    /** 
     * Constructor: OpenLayers.Marker.Label
     * Parameters:
     * icon - {<OpenLayers.Icon>}  the icon for this marker
     * lonlat - {<OpenLayers.LonLat>} the position of this marker
     * label - {String} the position of this marker
     * options - {Object}
     */
    initialize: function (lonlat, icon, label, options) {
        var newArguments = [];
        OpenLayers.Util.extend(this, options);
        newArguments.push(lonlat, icon, label);
        OpenLayers.Marker.prototype.initialize.apply(this, newArguments);

        this.label = label;
        this.labelDiv = OpenLayers.Util.createDiv(this.icon.id + "_Text", null, null);
        this.labelDiv.className = this.labelClass;
        this.labelDiv.innerHTML = label;
        this.labelDiv.style.marginTop = this.labelOffset;
        this.labelDiv.style.marginLeft = this.labelOffset;
    },
    
    /**
     * APIMethod: destroy
     * Destroy the marker. You must first remove the marker from any 
     * layer which it has been added to, or you will get buggy behavior.
     * (This can not be done within the marker since the marker does not
     * know which layer it is attached to.)
     */
    destroy: function () {
        this.label = null;
        this.labelDiv = null;
        OpenLayers.Marker.prototype.destroy.apply(this, arguments);
    },
   
    /** 
    * Method: draw
    * Calls draw on the icon, and returns that output.
    * 
    * Parameters:
    * px - {<OpenLayers.Pixel>}
    * 
    * Returns:
    * {DOMElement} A new DOM Image with this marker's icon set at the 
    * location passed-in
    */
    draw: function (px) {
        this.div = OpenLayers.Marker.prototype.draw.apply(this, arguments);
        this.div.appendChild(this.labelDiv, this.div.firstChild);
        
        if (this.mouseOver === true) {
            this.setLabelVisibility(false);
            this.events.register("mouseover", this, this.onmouseover);
            this.events.register("mouseout", this, this.onmouseout);
        }
        else {
            this.setLabelVisibility(true);
        }
        return this.div;
    }, 
    /** 
     * Method: onmouseover
     * When mouse comes up within the popup, after going down 
     * in it, reset the flag, and then (once again) do not 
     * propagate the event, but do so safely so that user can 
     * select text inside
     * 
     * Parameters:
     * evt - {Event} 
     */
    onmouseover: function (evt) {
    
        if (!this.mouseover) {
            this.setLabelVisibility(true);
            this.mouseover = true;
        }
        if (this.map.getSize().w - this.map.getPixelFromLonLat(this.lonlat).x < 50) {
            this.labelDiv.style.marginLeft = (-10 - this.icon.size.w) + "px";
        }
        if (this.map.getSize().h - this.map.getPixelFromLonLat(this.lonlat).y < 50) {
            this.labelDiv.style.marginTop = (-10 - this.icon.size.h) + "px";
        }
        OpenLayers.Event.stop(evt, true);
    },
    /** 
     * Method: onmouseout
     * When mouse goes out of the popup set the flag to false so that
     *   if they let go and then drag back in, we won't be confused.
     * 
     * Parameters:
     * evt - {Event} 
     */
    onmouseout: function (evt) {
        this.mouseover = false;
        this.setLabelVisibility(false);
        this.labelDiv.style.marginLeft = this.labelOffset;
        this.labelDiv.style.marginTop = this.labelOffset;
        OpenLayers.Event.stop(evt, true);
    },
    /** 
     * Method: setLabel
     * Set new label
     * 
     * Parameters:
     * label - {String} 
     */
    setLabel: function (label) {
        this.label = label;
        this.labelDiv.innerHTML = label;
    },
    /** 
     * Method: setLabelVisibility
     * Toggle label visibility
     * 
     * Parameters:
     * visibility - {Boolean} 
     */
    setLabelVisibility: function (visibility) {
        if (visibility) {
            this.labelDiv.style.display = "block";
        } else {
            this.labelDiv.style.display = "none";
        }
    },
    
    /** 
     * Method: getLabelVisibility
     * Get label visibility
     * 
     * Returns:
     *   visibility - {Boolean} 
     */
    getLabelVisibility: function () {
        if (this.labelDiv.style === "none") {
            return false;
        } else {
            return true;
        }
    },
    
    CLASS_NAME: "OpenLayers.Marker.Label"
});

/*
AND... 
Instead of markers.addMArker --> 
 
 markers.addMarker(new OpenLayers.Marker.Label(point, icon.clone(), 'Tool Tip Text', {mouseOver:true}));
*/