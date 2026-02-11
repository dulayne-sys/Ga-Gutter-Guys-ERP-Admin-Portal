// map.js
export let map;
export let drawingManager;
export let polylines = [];

export function initMap() {
  const container = document.getElementById("estimator-map");

  map = new google.maps.Map(container, {
    center: { lat: 33.749, lng: -84.388 },
    zoom: 17,
    mapTypeId: "satellite"
  });

  drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYLINE,
    drawingControl: true,
    polylineOptions: {
      editable: true,
      strokeColor: "#0ea5e9",
      strokeWeight: 3
    }
  });

  drawingManager.setMap(map);

  google.maps.event.addListener(
    drawingManager,
    "polylinecomplete",
    function (polyline) {
      polylines.push(polyline);
      updateTotalFeet();
    }
  );
}

function updateTotalFeet() {
  let total = 0;

  polylines.forEach((line) => {
    const path = line.getPath();
    total += google.maps.geometry.spherical.computeLength(path);
  });

  const feet = total * 3.28084;
  document.getElementById("total-feet").textContent =
    feet.toFixed(2) + " ft";
}