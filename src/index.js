"use strict";

import StylesControl from "mapbox-gl-controls/lib/styles";
import TooltipControl from "mapbox-gl-controls/lib/tooltip";
import bboxPolygon from "@turf/bbox-polygon";

let parseString = require("xml2js").parseString;
let Parser = require("rss-parser");
let parser = new Parser();

var changesetsGeojson = {
  type: "FeatureCollection",
  features: [],
};

//
// Create OpenStreetMap Map using Mapbox GL vector tiles
// https://docs.mapbox.com/vector-tiles/reference/mapbox-streets-v8/
//

mapboxgl.accessToken =
  "pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ";

var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/planemad/ckf4xcet7231819mm2e8njlca",
  center: [82, 22], // Centre position of India
  zoom: 4,
  hash: true,
});

//
// Map controls
//

// Style controls
map.addControl(
  new StylesControl({
    styles: [
      {
        label: "Streets",
        styleName: "Streets India",
        styleUrl: "mapbox://styles/planemad/ckf4xcet7231819mm2e8njlca",
      },
      {
        label: "Railways",
        styleName: "Rail World",
        styleUrl: "mapbox://styles/planemad/ck7p3wxmp0q571imu99elwqs1",
      },
      {
        label: "Waterways",
        styleName: "Water Flow",
        styleUrl: "mapbox://styles/planemad/ckd42fwa20n531iqrewerwla1",
      },
      {
        label: "Satellite",
        styleName: "Satellite",
        styleUrl: "mapbox://styles/mapbox/satellite-streets-v10",
      }
    ],
    onChange: (style) => filterBoundaries(),
  }),
  "top-left"
);

// Add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

// Add geolocate control to the map.
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    trackUserLocation: true,
  }),
  "bottom-right"
);

// Add Mapbox Geocoder
// https://github.com/mapbox/mapbox-gl-geocoder/blob/master/API.md
map.addControl(
  new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: "IN",
  })
);

// Resize map to fit all of India within the screen
// TODO: resize only when no explicit location provided
// map.fitBounds([
//     [67, 7],
//     [97, 37]
// ]);

// Buttone to edit the current map view on OSM
document.getElementById("edit-map").onclick = function () {
  window.open(
    `https://www.openstreetmap.org/edit?editor=id#map=${map.getZoom()}/${
      map.getCenter().lngLat.lat
    }/${map.getCenter().lngLat.lng}`
  );
};

//
//  Map logic
//

map.on("load", function () {
  // Show country boundaries as per Government of India
  filterBoundaries();

  // Add custom layers
  addMapLayers();

  // Add map interactions
  addMapEvents();
});

//
// Map functions
//

function addMapLayers() {
  // Map data sources

  map.addSource("changesets", {
    type: "geojson",
    generateId: true,
    data: changesetsGeojson,
    tolerance: 0,
  });

  // Map layers

  map.addLayer({
    id: "earthquakes-heat",
    type: "heatmap",
    source: "changesets",
    maxzoom: 9,
    paint: {
      // Increase the heatmap color weight weight by zoom level
      // heatmap-intensity is a multiplier on top of heatmap-weight
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(0, 0, 255, 0)",
        0.1,
        "royalblue",
        0.3,
        "cyan",
        0.5,
        "lime",
        0.7,
        "yellow",
        1,
        "red",
      ],
      "heatmap-opacity":0.4
    },
  });

  map.addLayer({
    id: "changesets",
    type: "fill",
    source: "changesets",
    paint: {
      "fill-color": "red",
      "fill-opacity": 0.1,
    },
  });

  map.addLayer({
    id: "changesets outline",
    type: "line",
    source: "changesets",
    paint: {
      "line-color": "red",
      "line-width": 2,
    },
  });

  map.addLayer({
    id: "changesets circle",
    type: "circle",
    source: "changesets",
    paint: {
      "circle-radius": 3,
      "circle-color": "red",
    },
  });
}

// Map events

function addMapEvents() {
  // Change the cursor to a pointer when the mouse is over the places layer.
  map.on("mouseenter", "changesets", function () {
    map.getCanvas().style.cursor = "pointer";
  });

  // Change it back to a pointer when it leaves.
  map.on("mouseleave", "changesets", function () {
    map.getCanvas().style.cursor = "";
  });

  // When a click event occurs on a feature in the csvData layer, open a popup at the
  // location of the feature, with description HTML from its properties.
  map.on("click", "changesets", function (e) {
    console.log(e.features);
    const feature = e.features[0];
    var coordinates = e.lngLat.toArray();

    var lng = e.lngLat.lng;
    var lat = e.lngLat.lat;

    // console.log(moment("20111031", "YYYYMMDD").fromNow())

    // Generate bbox from point coords
    var buffer = 0.05;
    var bbox_osmcha = [
      lng + buffer,
      lat - buffer,
      lng - buffer,
      lat + buffer,
    ].join(",");
    var bbox_wsen = [
      lng - buffer,
      lat - buffer,
      lng + buffer,
      lat + buffer,
    ].join(",");

    var description = `<b>${feature.properties.changes}</b> changes by ${feature.properties.user}`;
    description += `<p>${feature.properties.comment}</p>`;
    description += `<br><a href='https://osmcha.org/filters?filters={"in_bbox":[{"label":"${bbox_osmcha}","value":"${bbox_osmcha}"}],"area_lt":[{"label":"10","value":"10"}]}'>Check neighbourhood acitivy with OSMCha</a>`;
    description += `<br><a href='https://www.openstreetmap.org/history#map=14/${e.lngLat.lat}/${e.lngLat.lng}'>OSM History</a>`;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    //add Popup to map

    document.getElementById("map-overlay").innerHTML = description;

    new mapboxgl.Popup().setLngLat(coordinates).setHTML(description).addTo(map);
  });
}

function filterBoundaries() {
  // Apply an Indian worldview filter to the boundary map layers
  // https://docs.mapbox.com/mapbox-gl-js/example/toggle-worldviews/
  [
    "admin-0-boundary-bg",
    "admin-0-boundary",
    "admin-0-boundary-disputed",
    "admin-1-boundary",
  ].forEach((layer) => {
    let layerFilter = map.getFilter(layer);
    layerFilter[layerFilter.length - 1] = [
      "match",
      ["get", "worldview"],
      ["all", "IN"],
      true,
      false,
    ];
    map.setFilter(layer, layerFilter);
  });
}

// Fetch OSM data

(async () => {
  let feed = await parser.parseURL(
    "https://osmcha.org/api/v1/aoi/4c1607d7-c103-4cec-a49b-f81a17300bcf/changesets/feed/"
  );
  console.log(feed);

  feed.items.forEach((item) => {
    const changesetId = item.link.split("/")[4];

    fetch(
      `https://api.openstreetmap.org/api/0.6/changeset/${changesetId}?include_discussion=true`
    )
      .then((response) => response.text())
      .then((str) => {
        parseString(str, function (err, result) {
          const changesetMetadata = result.osm.changeset[0].$;
          const changesetPolygon = bboxPolygon([
            changesetMetadata.min_lon,
            changesetMetadata.min_lat,
            changesetMetadata.max_lon,
            changesetMetadata.max_lat,
          ]);

          console.log(result.osm.changeset);
          changesetPolygon.properties = {
            title: item.title,
            user: result.osm.changeset[0].$.user,
            "edit-count": result.osm.changeset[0].tag[0].$.v,
            timestamp: result.osm.changeset[0].$.closed_at,
            changes: result.osm.changeset[0].$.changes_count,
            comment: result.osm.changeset[0].tag.slice(-1)[0].$.v,
          };

          changesetsGeojson.features.push(changesetPolygon);
          map.getSource("changesets").setData(changesetsGeojson);
        });
      })
      .finally((e) => {
        map.getSource("changesets").setData(changesetsGeojson);
      });
  });
})();
