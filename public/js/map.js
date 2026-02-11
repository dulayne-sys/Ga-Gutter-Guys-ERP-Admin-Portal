import { api } from "./apiClient.js";
import { estimatorState, estimatorLoadCustomers, estimatorRecalculate } from "./estimator.js";

let mapsScriptLoading = null;

const getMapsApiKey = () => {
  const metaKey = document.querySelector('meta[name="google-maps-key"]');
  if (metaKey && metaKey.content) {
    return metaKey.content;
  }

  return window.GOOGLE_MAPS_API_KEY || "";
};

const loadGoogleMaps = () => {
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }

  if (mapsScriptLoading) {
    return mapsScriptLoading;
  }

  const existingScript = document.getElementById("google-maps-script");
  if (existingScript) {
    mapsScriptLoading = new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
    });
    return mapsScriptLoading;
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    console.warn("Google Maps API key is missing.");
    return Promise.resolve();
  }

  mapsScriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return mapsScriptLoading;
};

export const mapDarkTheme = () => {
  return [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ];
};

export const initEstimatorMap = async () => {
  if (estimatorState.mapInitialized) {
    return;
  }

  await loadGoogleMaps();

  if (typeof google === "undefined" || !google.maps || !google.maps.Map) {
    return;
  }

  const mapContainer = document.getElementById("estimator-map");
  const tabView = document.getElementById("view-estimator");
  if (!mapContainer || !tabView) {
    return;
  }

  if (!tabView.classList.contains("active")) {
    return;
  }

  const computedStyle = window.getComputedStyle(mapContainer);
  if (computedStyle.display === "none" || computedStyle.visibility === "hidden") {
    return;
  }

  if (mapContainer.offsetWidth <= 0 || mapContainer.offsetHeight <= 0) {
    return;
  }

  if (estimatorState.map) {
    estimatorLoadCustomers();
    return;
  }

  const defaultCenter = { lat: 33.749, lng: -84.388 };

  try {
    estimatorState.map = new google.maps.Map(mapContainer, {
      zoom: 16,
      center: defaultCenter,
      mapTypeId: google.maps.MapTypeId.SATELLITE,
      styles: mapDarkTheme(),
    });

    const addressInput = document.getElementById("estimate-address-input");
    if (addressInput) {
      const autocomplete = new google.maps.places.Autocomplete(addressInput);
      autocomplete.bindTo("bounds", estimatorState.map);

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
          alert("Place has no geometry");
          return;
        }

        estimatorState.map.setCenter(place.geometry.location);
        estimatorState.map.setZoom(17);

        const addressDisplay = document.getElementById("estimate-address-display");
        if (addressDisplay) {
          addressDisplay.textContent = place.formatted_address;
        }
      });
    }

    estimatorState.drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polylineOptions: {
        editable: true,
        clickable: true,
        geodesic: true,
        strokeColor: "#0ea5e9",
        strokeOpacity: 0.8,
        strokeWeight: 3,
      },
      map: estimatorState.map,
    });

    estimatorState.drawingManager.addListener("polylinecomplete", onPolylineComplete);
    estimatorState.mapInitialized = true;
    estimatorLoadCustomers();
  } catch (error) {
    console.error("[Estimator] Map initialization error:", error.message || error);
    estimatorState.map = null;
  }
};

export const estimatorSetMapType = (type) => {
  if (estimatorState.map) {
    estimatorState.map.setMapTypeId(type);
  }
};

export const estimatorStartDrawing = () => {
  if (estimatorState.drawingManager) {
    estimatorState.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
    estimatorState.isDrawing = true;
    const drawBtn = document.getElementById("draw-mode-btn");
    const finishBtn = document.getElementById("finish-draw-btn");
    if (drawBtn) drawBtn.style.display = "none";
    if (finishBtn) finishBtn.style.display = "block";
  }
};

export const estimatorFinishDrawing = () => {
  if (estimatorState.drawingManager) {
    estimatorState.drawingManager.setDrawingMode(null);
    estimatorState.isDrawing = false;
    const drawBtn = document.getElementById("draw-mode-btn");
    const finishBtn = document.getElementById("finish-draw-btn");
    if (finishBtn) finishBtn.style.display = "none";
    if (drawBtn) drawBtn.style.display = "block";
  }
};

Object.assign(window, {
  initEstimatorMap,
  estimatorStartDrawing,
  estimatorFinishDrawing,
  estimatorSetMapType,
});

const onPolylineComplete = (polyline) => {
  polyline.setEditable(true);

  const path = polyline.getPath().getArray();
  const coords = path.map((point) => ({ lat: point.lat(), lng: point.lng() }));

  api
    .withSuccessHandler((result) => {
      const polylineData = {
        coordinates: coords,
        length: result.totalFeet,
        color: polyline.strokeColor || "#0ea5e9",
      };

      estimatorState.polylines.push({
        polylineObject: polyline,
        data: polylineData,
      });

      estimatorRecalculate();
    })
    .withFailureHandler((error) => {
      console.error("Error calculating length:", error);
    })
    .calculatePolylineLength({ coords });
};
