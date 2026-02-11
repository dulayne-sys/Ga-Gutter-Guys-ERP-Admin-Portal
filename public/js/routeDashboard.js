import {
  apiGetDailyRoute,
  apiGetOrCreateDailyRoute,
  apiOptimizeDailyRoute,
  apiReorderStops,
  apiUpdateJobPriority,
  apiAiPrioritizeRoute,
} from "./apiClient.js";

const STATE = {
  map: null,
  polyline: null,
  markers: [],
  initialized: false,
  respectPriority: false,
  manualMode: false,
};

const REVENUE_PER_HOUR_THRESHOLD = 200;

const getMapsApiKey = () => {
  const metaKey = document.querySelector('meta[name="google-maps-key"]');
  if (metaKey && metaKey.content) {
    return metaKey.content;
  }

  return window.GOOGLE_MAPS_API_KEY || "";
};

const ensureMapsLoaded = () => {
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }

  const existing = document.getElementById("google-maps-script");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps")));
    });
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key missing"));
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
};

const clearMap = () => {
  if (STATE.polyline) {
    STATE.polyline.setMap(null);
    STATE.polyline = null;
  }

  STATE.markers.forEach((marker) => marker.setMap(null));
  STATE.markers = [];
};

const renderMarkers = (route) => {
  if (!STATE.map) return;

  const infoWindow = new google.maps.InfoWindow();

  const homeMarker = new google.maps.Marker({
    map: STATE.map,
    position: { lat: route.home.lat, lng: route.home.lng },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: "#22d3ee",
      fillOpacity: 1,
      strokeColor: "#0f172a",
      strokeWeight: 2,
      scale: 6,
    },
    title: "Home",
  });

  STATE.markers.push(homeMarker);

  route.stops.forEach((stop, index) => {
    const leg = route.legs && route.legs[index] ? route.legs[index] : null;
    const tooltip = `
      <div style="font-size:12px;">
        <strong>${stop.customerName || "Stop"}</strong><br>
        ${stop.address || ""}<br>
        ${stop.scheduledAt ? `Scheduled: ${stop.scheduledAt}<br>` : ""}
        ${leg ? `Leg: ${leg.miles} mi / ${leg.minutes} min` : ""}
      </div>
    `;

    const marker = new google.maps.Marker({
      map: STATE.map,
      position: { lat: stop.lat, lng: stop.lng },
      label: String(index + 1),
      title: stop.customerName || stop.address || `Stop ${index + 1}`,
    });

    marker.addListener("click", () => {
      infoWindow.setContent(tooltip);
      infoWindow.open(STATE.map, marker);
    });

    STATE.markers.push(marker);
  });
};

const renderPolyline = (encoded) => {
  if (!STATE.map || !encoded || !google.maps.geometry) return;

  const path = google.maps.geometry.encoding.decodePath(encoded);
  STATE.polyline = new google.maps.Polyline({
    map: STATE.map,
    path,
    strokeColor: "#0ea5e9",
    strokeOpacity: 0.9,
    strokeWeight: 4,
  });

  const bounds = new google.maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  STATE.map.fitBounds(bounds);
};

const renderMap = async (route) => {
  const viewport = document.getElementById("map-viewport");
  const overlay = document.getElementById("map-overlay");

  if (!viewport || !route) return;

  await ensureMapsLoaded();

  if (!STATE.map) {
    STATE.map = new google.maps.Map(viewport, {
      center: { lat: route.home.lat, lng: route.home.lng },
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    });
  }

  if (overlay) overlay.style.display = "none";

  clearMap();
  renderPolyline(route.polyline?.encoded);
  renderMarkers(route);
};

const renderKpis = (route) => {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("route-total-miles", route.totals?.miles ?? "—");
  setText("route-total-minutes", route.totals?.minutes ?? "—");
  setText("route-stop-count", route.stopCount ?? route.stops.length);
  setText("route-optimized", route.optimized ? "Optimized" : "Manual");
  setText("route-revenue-total", `$${route.revenueTotal ?? 0}`);
  setText("route-revenue-per-stop", `$${route.revenuePerStop ?? 0}`);
  setText("route-revenue-per-mile", `$${route.revenuePerMile ?? 0}`);
  setText("route-revenue-per-hour", `$${route.revenuePerHour ?? 0}`);
  setText("route-fuel-cost", `$${route.fuelCost ?? 0}`);
  setText("route-profit-estimate", `$${route.profitEstimate ?? 0}`);
  setText("route-drive-cost", `$${route.routeCost ?? 0}`);
  setText("route-efficiency-score", route.efficiencyScore ?? 0);

  const revenueHourEl = document.getElementById("route-revenue-per-hour");
  if (revenueHourEl) {
    revenueHourEl.style.color = route.revenuePerHour > REVENUE_PER_HOUR_THRESHOLD ? "#4ade80" : "#e5e7eb";
  }

  const efficiencyEl = document.getElementById("route-efficiency-score");
  if (efficiencyEl) {
    const score = Number(route.efficiencyScore || 0);
    efficiencyEl.style.color = score > 120 ? "#4ade80" : score > 80 ? "#fbbf24" : "#f87171";
  }
};

const priorityBadge = (rank) => {
  if (rank <= 3) return "critical";
  if (rank <= 6) return "high";
  if (rank <= 8) return "medium";
  return "low";
};

const renderStopList = (route) => {
  const list = document.getElementById("route-stop-list");
  if (!list) return;

  list.innerHTML = "";

  route.stops.forEach((stop, index) => {
    const row = document.createElement("div");
    row.className = "route-stop-row";
    row.draggable = STATE.manualMode;
    row.dataset.jobId = stop.jobId;
    row.style.cssText = "padding: 10px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.35); background: rgba(15,23,42,0.8); display: flex; justify-content: space-between; align-items: center; gap: 12px;";

    const info = document.createElement("div");
    info.innerHTML = `
      <div style="font-weight: 600; font-size: 12px;">${index + 1}. ${stop.customerName || "Stop"}</div>
      <div style="font-size: 11px; color: #94a3b8;">${stop.address || ""}</div>
    `;

    const badge = document.createElement("span");
    badge.className = `badge ${priorityBadge(stop.rank || 10)}`;
    badge.textContent = `Priority ${stop.rank || "—"}`;

    const select = document.createElement("select");
    select.style.cssText = "background: rgba(15,23,42,0.9); color: #e5e7eb; border: 1px solid rgba(148,163,184,0.4); border-radius: 8px; padding: 4px 6px; font-size: 11px;";
    for (let i = 1; i <= 10; i += 1) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `Rank ${i}`;
      if (Number(stop.rank) === i) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener("change", async () => {
      await apiUpdateJobPriority({ jobId: stop.jobId, priorityRank: Number(select.value) });
      await refreshRoute();
    });

    const right = document.createElement("div");
    right.style.cssText = "display: flex; align-items: center; gap: 8px;";
    right.appendChild(badge);
    right.appendChild(select);

    row.appendChild(info);
    row.appendChild(right);
    list.appendChild(row);
  });

  if (STATE.manualMode) {
    enableDragDrop(list);
  }
};

const enableDragDrop = (list) => {
  let dragSrc = null;

  list.querySelectorAll(".route-stop-row").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      dragSrc = row;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.jobId || "");
    });

    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      if (!dragSrc || dragSrc === row) return;

      const items = Array.from(list.children);
      const dragIndex = items.indexOf(dragSrc);
      const dropIndex = items.indexOf(row);

      if (dragIndex < dropIndex) {
        list.insertBefore(dragSrc, row.nextSibling);
      } else {
        list.insertBefore(dragSrc, row);
      }

      const orderedJobIds = Array.from(list.children)
        .map((child) => child.dataset.jobId)
        .filter(Boolean);

      const date = getTodayDate();
      const response = await apiReorderStops({ date, orderedJobIds });
      updateUi(response.route || response);
    });
  });
};

const updateUi = async (route) => {
  renderKpis(route);
  renderStopList(route);
  await renderMap(route);
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

export const refreshRoute = async () => {
  const date = getTodayDate();

  try {
    const route = await apiGetDailyRoute(date);
    updateUi(route.route || route);
  } catch (error) {
    if (error && error.status === 404) {
      const created = await apiGetOrCreateDailyRoute(date);
      updateUi(created.route || created);
    } else {
      console.error("Route load failed", error);
    }
  }
};

const optimizeRoute = async () => {
  const date = getTodayDate();
  const mode = STATE.respectPriority ? "respectRank" : "optimizeOrder";
  const result = await apiOptimizeDailyRoute({ date, mode });
  updateUi(result.route || result);
};

const aiPrioritize = async () => {
  const date = getTodayDate();
  await apiAiPrioritizeRoute({ date });
  STATE.respectPriority = true;
  await optimizeRoute();
};

const bindControls = () => {
  const optimizeBtn = document.getElementById("route-optimize-btn");
  if (optimizeBtn) optimizeBtn.addEventListener("click", optimizeRoute);

  const respectToggle = document.getElementById("route-respect-toggle");
  if (respectToggle) {
    respectToggle.addEventListener("click", () => {
      STATE.respectPriority = !STATE.respectPriority;
      respectToggle.classList.toggle("active", STATE.respectPriority);
    });
  }

  const manualToggle = document.getElementById("route-manual-toggle");
  if (manualToggle) {
    manualToggle.addEventListener("click", () => {
      STATE.manualMode = !STATE.manualMode;
      manualToggle.classList.toggle("active", STATE.manualMode);
      refreshRoute();
    });
  }

  const aiBtn = document.getElementById("route-ai-btn");
  if (aiBtn) aiBtn.addEventListener("click", aiPrioritize);

  const overlayBuild = document.getElementById("route-build-btn");
  if (overlayBuild) overlayBuild.addEventListener("click", optimizeRoute);
  const overlayAi = document.getElementById("route-ai-schedule-btn");
  if (overlayAi) overlayAi.addEventListener("click", aiPrioritize);
};

export const setRouteMapMode = (mode) => {
  if (!STATE.map) return;
  const mapType = mode === "street" ? google.maps.MapTypeId.ROADMAP : mode === "3d"
    ? google.maps.MapTypeId.HYBRID
    : google.maps.MapTypeId.TERRAIN;
  STATE.map.setMapTypeId(mapType);
};

export const initRouteDashboard = () => {
  if (STATE.initialized) return;
  STATE.initialized = true;
  bindControls();
  refreshRoute();
};
