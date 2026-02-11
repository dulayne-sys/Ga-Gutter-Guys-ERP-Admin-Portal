import { api } from "./apiClient.js";
import { initRouteDashboard, setRouteMapMode } from "./routeDashboard.js";
import {
  apiGetDashboardKPIs,
  apiGetDailyRoute,
  apiGetOrCreateDailyRoute,
  apiOptimizeDailyRoute,
  apiReorderStops,
} from "./apiClient.js";
import { initEstimatorMap } from "./map.js";

/** ========= ANIMATIONS ========= **/
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);

/** ========= SIMPLE APP STATE ========= **/
let CURRENT_VIEW = "dashboard";
let LAST_HUB_VIEW = null;
let APP_MODE = "ANALYTICS";
let EXPANDED_EVENT_ID = null;
let SHIELD_CHAT_OPEN = false;
let TERRITORY_SELECTED_DATE = null;

const getMapsApiKey = () => {
  const metaKey = document.querySelector('meta[name="google-maps-key"]');
  if (metaKey && metaKey.content) {
    return metaKey.content;
  }

  return window.GOOGLE_MAPS_API_KEY || "";
};

function navigateToSubPage(subPageView, sourceHub) {
  LAST_HUB_VIEW = sourceHub || null;
  APP_MODE = "ANALYTICS";
  switchView(subPageView);
}

function navigateToSalesOpsView(viewName) {
  LAST_HUB_VIEW = "salesOps";
  APP_MODE = "EDIT";
  switchView(viewName);
}

function renderShieldAIHintBubble() {
  try {
    if (localStorage.getItem("shieldAIHintDismissed")) {
      return;
    }

    const hintBubble = document.getElementById("shield-ai-hint-bubble");
    const closeBtn = document.getElementById("shield-ai-hint-close");

    if (!hintBubble || !closeBtn) {
      return;
    }

    hintBubble.style.display = "block";

    closeBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      hintBubble.style.opacity = "0";
      setTimeout(() => {
        hintBubble.style.display = "none";
      }, 200);
      localStorage.setItem("shieldAIHintDismissed", "true");
    };

    closeBtn.onmouseover = () => {
      closeBtn.style.color = "#22d3ee";
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.color = "#94a3b8";
    };
  } catch (error) {
    console.error("[Shield AI Hint] Error rendering hint bubble:", error);
  }
}

function toggleShieldAI() {
  SHIELD_CHAT_OPEN = !SHIELD_CHAT_OPEN;
  const panel = document.getElementById("shield-ai-panel");
  const toggleBtn = document.getElementById("shield-ai-toggle");

  if (!panel || !toggleBtn) {
    return;
  }

  if (SHIELD_CHAT_OPEN) {
    panel.style.transform = "translateX(0)";
    toggleBtn.style.opacity = "0";
    toggleBtn.style.pointerEvents = "none";
  } else {
    panel.style.transform = "translateX(360px)";
    toggleBtn.style.opacity = "1";
    toggleBtn.style.pointerEvents = "auto";
  }
}

function backToHub() {
  if (!LAST_HUB_VIEW) {
    return;
  }
  APP_MODE = "ANALYTICS";
  switchView(LAST_HUB_VIEW);
}

function getViewElements_() {
  return Array.from(document.querySelectorAll(".tab-view"));
}

function getViewNameFromEl_(el) {
  if (!el || !el.id) return "";
  return el.id.startsWith("view-") ? el.id.slice(5) : el.id;
}

function resolveViewElement_(viewName) {
  if (!viewName) return null;
  const views = getViewElements_();
  const byDataView = document.querySelector(`.nav-tab[data-view="${viewName}"]`);
  const byExactId = document.getElementById(viewName);
  const byPrefixedId = document.getElementById(`view-${viewName}`);
  const normalized = viewName.startsWith("view-") ? viewName.slice(5) : viewName;
  const byNormalizedId = document.getElementById(`view-${normalized}`);

  if (byExactId && byExactId.classList.contains("tab-view")) return byExactId;
  if (byPrefixedId && byPrefixedId.classList.contains("tab-view")) return byPrefixedId;
  if (byNormalizedId && byNormalizedId.classList.contains("tab-view")) return byNormalizedId;

  if (byDataView) {
    const target = document.getElementById(`view-${byDataView.dataset.view}`);
    if (target && target.classList.contains("tab-view")) return target;
  }

  return views.find((view) => getViewNameFromEl_(view) === normalized) || null;
}

function getFallbackView_() {
  const dashboard = document.getElementById("view-dashboard");
  if (dashboard) return dashboard;
  const views = getViewElements_();
  return views.length ? views[0] : null;
}

function switchView(viewName) {
  try {
    const targetView = resolveViewElement_(viewName) || getFallbackView_();
    if (!targetView) return;

    const resolvedName = getViewNameFromEl_(targetView) || viewName;
    getViewElements_().forEach((view) => {
      view.classList.toggle("active", view === targetView);
    });

    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.view === resolvedName);
    });

    CURRENT_VIEW = resolvedName;
    loadTabData(resolvedName);
  } catch (error) {
    console.error("switchView error", error);
  }
}

function loadTabData(viewName) {
  switch (viewName) {
    case "dashboard":
      refreshDashboard();
      initRouteDashboard();
      break;
    case "activeJobs":
      loadActiveJobs();
      break;
    case "crm":
      loadCrm();
      break;
    case "estimator":
      initEstimatorMap();
      break;
    case "workOrders":
      loadWorkOrders();
      break;
    case "invoices":
      loadInvoices();
      break;
    case "calendar":
      loadCalendar();
      break;
    case "vendors":
      loadVendors();
      break;
    case "procurements":
      loadProcurements();
      break;
    case "jobErp":
      loadJobERP();
      break;
    case "users":
      loadUsers();
      break;
    case "settings":
      loadSettings();
      break;
    case "insights":
      loadAI();
      break;
    default:
      break;
  }
}

function refreshCurrent() {
  if (!resolveViewElement_(CURRENT_VIEW)) {
    return;
  }
  loadTabData(CURRENT_VIEW);
}

function runHealthcheck() {
  api
    .withSuccessHandler((result) => {
      alert(`Healthcheck: ${result || "OK"}`);
    })
    .withFailureHandler((err) => {
      console.error(err);
      alert("Healthcheck failed.");
    })
    .runHealthcheck();
}

/** ========= DASHBOARD ========= **/
function refreshDashboard() {
  loadDashboardKPIs();
  loadDashboardWorkOrders();
  loadDashboardActiveJobs();
  loadDashboardInvoices();
}

function loadDashboardKPIs() {
  apiGetDashboardKPIs()
    .then((kpi) => {
      const activeJobsEl = document.getElementById("kpi-active-jobs");
      const openPipelineEl = document.getElementById("kpi-open-pipeline");
      const revenueYtdEl = document.getElementById("kpi-revenue-ytd");
      const winRateEl = document.getElementById("kpi-win-rate");
      const routeStopsEl = document.getElementById("route-stops");
      const routeMapsEnabledEl = document.getElementById("route-maps-enabled");
      const routeTopPriorityEl = document.getElementById("route-top-priority");

      if (activeJobsEl) activeJobsEl.textContent = safeNumber(kpi.activeJobs);
      if (openPipelineEl) openPipelineEl.textContent = money(kpi.openPipeline);
      if (revenueYtdEl) revenueYtdEl.textContent = money(kpi.revenueYTD);
      if (winRateEl) winRateEl.textContent = (kpi.winRate == null) ? "—" : pct(kpi.winRate);
      if (routeStopsEl) routeStopsEl.textContent = "—";
      if (routeMapsEnabledEl) routeMapsEnabledEl.textContent = "—";
      if (routeTopPriorityEl) routeTopPriorityEl.textContent = "—";
    })
    .catch((err) => {
      console.error("KPI Load Failed", err);
    });
}

function loadDashboardWorkOrders() {
  api
    .withSuccessHandler((html) => {
      const el = document.getElementById("workorders-dashboard-list");
      if (el) el.innerHTML = html;
    })
    .withFailureHandler((err) => console.error(err))
    .getDashboardWorkOrders();
}

function loadDashboardActiveJobs() {
  api
    .withSuccessHandler((html) => {
      const el = document.getElementById("activejobs-dashboard-list");
      if (el) el.innerHTML = html;
    })
    .withFailureHandler((err) => console.error(err))
    .getDashboardActiveJobs();
}

function loadDashboardInvoices() {
  api
    .withSuccessHandler((html) => {
      const el = document.getElementById("invoices-dashboard-list");
      if (el) el.innerHTML = html;
    })
    .withFailureHandler((err) => console.error(err))
    .getDashboardInvoices();
}

/** ========= ACTIVE JOBS ========= **/
function loadActiveJobs() {
  try {
    const el = document.getElementById("activejobs-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No active jobs</h3><p>No records found.</p></div>';
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load active jobs</h3><p>Please try again.</p></div>';
      })
      .getActiveJobsTable();
  } catch (e) {
    console.error("loadActiveJobs error", e);
  }
}

/** ========= CRM ========= **/
function loadCrm() {
  try {
    const el = document.getElementById("crm-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No CRM entries</h3><p>No records found.</p></div>';
        wireTableRowEditing_("CRM", "crm-table", "crm");
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load CRM</h3><p>Please try again.</p></div>';
      })
      .getCrmTable();

    loadSalesIntelligence();
  } catch (e) {
    console.error("loadCrm error", e);
  }
}

function loadSalesIntelligence() {
  const winRateEl = document.getElementById("sales-winrate");
  const winRateSubEl = document.getElementById("sales-winrate-sub");
  const closedCountEl = document.getElementById("sales-closed-count");
  const closedSubEl = document.getElementById("sales-closed-sub");
  const analysisMonthEl = document.getElementById("sales-analysis-month");
  const analysisSubEl = document.getElementById("sales-analysis-sub");
  const procurementCountEl = document.getElementById("sales-procurement-count");
  const procurementSubEl = document.getElementById("sales-procurement-sub");

  if (!winRateEl || !winRateSubEl || !closedCountEl || !closedSubEl || !analysisMonthEl || !analysisSubEl || !procurementCountEl || !procurementSubEl) return;

  api
    .withSuccessHandler((result) => {
      if (!result || !result.hasData) {
        winRateEl.textContent = "—";
        winRateSubEl.textContent = "No data";
        return;
      }
      winRateEl.textContent = pct(result.winRate || 0);
      winRateSubEl.textContent = `${result.wins || 0} wins / ${result.losses || 0} losses`;
    })
    .withFailureHandler((err) => {
      console.error(err);
      winRateEl.textContent = "—";
      winRateSubEl.textContent = "No data";
    })
    .getWinLossMetrics();

  api
    .withSuccessHandler((result) => {
      if (!result || !result.hasData) {
        closedCountEl.textContent = "—";
        closedSubEl.textContent = "No data";
        return;
      }
      closedCountEl.textContent = String(result.totalClosed || 0);
      closedSubEl.textContent = `Revenue ${money(result.totalRevenue || 0)} | Avg P&L ${money(result.avgPnl || 0)}`;
    })
    .withFailureHandler((err) => {
      console.error(err);
      closedCountEl.textContent = "—";
      closedSubEl.textContent = "No data";
    })
    .getClosedJobsMetrics();

  api
    .withSuccessHandler((result) => {
      if (!result || !result.hasData) {
        analysisMonthEl.textContent = "—";
        analysisSubEl.textContent = "No data";
        return;
      }
      analysisMonthEl.textContent = money(result.monthTotal || 0);
      analysisSubEl.textContent = `FY Total ${money(result.fyTotal || 0)}`;
    })
    .withFailureHandler((err) => {
      console.error(err);
      analysisMonthEl.textContent = "—";
      analysisSubEl.textContent = "No data";
    })
    .getAnalysis2026Metrics();

  api
    .withSuccessHandler((result) => {
      if (!result || !result.hasData) {
        procurementCountEl.textContent = "—";
        procurementSubEl.textContent = "No data";
        return;
      }
      procurementCountEl.textContent = String(result.openCount || 0);
      procurementSubEl.textContent = `Pending ${money(result.openTotalValue || 0)}`;
    })
    .withFailureHandler((err) => {
      console.error(err);
      procurementCountEl.textContent = "—";
      procurementSubEl.textContent = "No data";
    })
    .getProcurementSalesMetrics();
}

/** ========= WORK ORDERS ========= **/
function loadWorkOrders() {
  try {
    const el = document.getElementById("workorders-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No work orders</h3><p>No records found.</p></div>';
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load work orders</h3><p>Please try again.</p></div>';
      })
      .getWorkOrdersTable();
  } catch (e) {
    console.error("loadWorkOrders error", e);
  }
}

/** ========= INVOICES ========= **/
function loadInvoices() {
  try {
    const el = document.getElementById("invoices-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No invoices</h3><p>No records found.</p></div>';
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load invoices</h3><p>Please try again.</p></div>';
      })
      .getInvoicesTable();
  } catch (e) {
    console.error("loadInvoices error", e);
  }
}

function handleInvoiceUpload(files) {
  if (!files || !files.length) return;

  const file = files[0];
  const previewEl = document.getElementById("invoice-extract-preview");
  if (previewEl) {
    previewEl.innerHTML = '<div class="spinner"></div><div>Uploading & extracting invoice…</div>';
  }

  api
    .withSuccessHandler((result) => {
      const el = document.getElementById("invoice-extract-preview");
      if (el) el.innerHTML = result;
      loadInvoices();
    })
    .withFailureHandler((err) => {
      console.error(err);
      alert("Invoice ingestion failed.");
    })
    .ingestInvoice({ name: file.name, type: file.type });
}

/** ========= CALENDAR ========= **/
function loadCalendar() {
  const dateEl = document.getElementById("cal-date");
  const assigneeEl = document.getElementById("cal-assignee");
  const date = dateEl ? dateEl.value : "";
  const assignee = assigneeEl ? assigneeEl.value : "";

  api
    .withSuccessHandler((html) => {
      const el = document.getElementById("calendar-table");
      if (el) {
        el.innerHTML = html;
        wireCalendarRowClicks_();
        window._todayPlanLoaded = false;
        loadTodayTerritoryPlan(false);
        initializeTerritoryView();
      }
    })
    .withFailureHandler((err) => console.error(err))
    .getCalendarTable({ date, assignee });
}

function wireCalendarRowClicks_() {
  const container = document.getElementById("calendar-table");
  if (!container) return;

  const rows = container.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    const firstCell = row.querySelector("td");
    if (!firstCell) return;

    const eventId = String(firstCell.textContent || "").trim();
    if (!eventId) return;

    row.style.cursor = "pointer";
    row.onclick = () => expandCalendarEvent(eventId);
  });
}

function buildRoute() {
  const dateEl = document.getElementById("route-date");
  const date = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().split("T")[0];

  loadRoute(date, "optimizeOrder");
}

function aiSchedule() {
  const dateEl = document.getElementById("route-date");
  const date = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().split("T")[0];

  loadRoute(date, "respectRank");
}

const renderRouteList = (route) => {
  const container = document.getElementById("route-output");
  if (!container) return;

  const stops = Array.isArray(route.stops) ? route.stops : [];
  if (stops.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No stops for this date</h3></div>';
    return;
  }

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";

  stops.forEach((stop, index) => {
    const item = document.createElement("div");
    item.draggable = true;
    item.dataset.jobId = stop.jobId;
    item.style.cssText = "padding: 10px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.7); font-size: 12px;";
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <strong>${index + 1}. ${escapeHtml_(stop.customerName || stop.address || "Stop")}</strong>
        <span style="color: #94a3b8;">${escapeHtml_(stop.status || "")}</span>
      </div>
      <div style="color: #94a3b8; margin-top: 4px;">${escapeHtml_(stop.address || "")}</div>
    `;
    list.appendChild(item);
  });

  container.innerHTML = "";
  container.appendChild(list);

  enableRouteReorder(list);
};

const enableRouteReorder = (list) => {
  let dragSrc = null;

  list.querySelectorAll("[draggable='true']").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      dragSrc = item;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.dataset.jobId || "");
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("drop", async (event) => {
      event.preventDefault();
      if (!dragSrc || dragSrc === item) return;

      const items = Array.from(list.children);
      const dragIndex = items.indexOf(dragSrc);
      const dropIndex = items.indexOf(item);

      if (dragIndex < dropIndex) {
        list.insertBefore(dragSrc, item.nextSibling);
      } else {
        list.insertBefore(dragSrc, item);
      }

      const orderedJobIds = Array.from(list.children).map((el) => el.dataset.jobId).filter(Boolean);
      const dateEl = document.getElementById("route-date");
      const date = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().split("T")[0];

      try {
        const result = await apiReorderStops({ date, orderedJobIds });
        renderRoutePanel(result.route || result);
      } catch (error) {
        console.error("Reorder failed", error);
      }
    });
  });
};

const renderRouteMap = (route) => {
  const viewport = document.getElementById("map-viewport");
  const overlay = document.getElementById("map-overlay");
  if (!viewport) return;

  const encoded = route?.polyline?.encoded;
  if (!encoded) {
    if (overlay) overlay.style.display = "flex";
    return;
  }

  if (overlay) overlay.style.display = "none";

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    viewport.innerHTML = '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:12px;">Map key required</div>';
    return;
  }

  const mapUrl = new URL("https://maps.googleapis.com/maps/api/staticmap");
  mapUrl.searchParams.set("size", "640x320");
  mapUrl.searchParams.set("scale", "2");
  mapUrl.searchParams.set("maptype", "roadmap");
  mapUrl.searchParams.set("path", `enc:${encoded}`);
  mapUrl.searchParams.set("key", apiKey);

  viewport.innerHTML = `<img src="${mapUrl.toString()}" style="width: 100%; height: 100%; object-fit: cover;" alt="Route map">`;
};

const renderRoutePanel = (route) => {
  if (!route) return;

  const routeStopsEl = document.getElementById("route-stops");
  const routeMapsEnabledEl = document.getElementById("route-maps-enabled");
  const routeTopPriorityEl = document.getElementById("route-top-priority");

  if (routeStopsEl) routeStopsEl.textContent = route.stopCount ?? (route.stops || []).length;
  if (routeMapsEnabledEl) routeMapsEnabledEl.textContent = route.polyline?.encoded ? "Yes" : "No";
  if (routeTopPriorityEl) routeTopPriorityEl.textContent = route.stops?.[0]?.customerName || "—";

  renderRouteList(route);
  renderRouteMap(route);
};

const loadRoute = async (date, mode) => {
  const output = document.getElementById("route-output");
  if (output) {
    output.innerHTML = '<div class="loading-block"><div class="spinner"></div><div>Loading route…</div></div>';
  }

  try {
    await apiGetOrCreateDailyRoute(date);
    const result = await apiOptimizeDailyRoute({ date, mode });
    renderRoutePanel(result.route || result);
  } catch (error) {
    console.error("Route load failed", error);
    if (output) {
      output.innerHTML = '<div class="empty-state"><h3>Unable to load route</h3><p>Please try again.</p></div>';
    }
  }
};

/** ========= TERRITORY MAPPING ========= **/
function initializeTerritoryView() {
  try {
    const today = new Date();
    const dateIso = today.toISOString().split("T")[0];
    TERRITORY_SELECTED_DATE = dateIso;
    renderTerritoryDayCards(dateIso);
    loadTerritoryDay(dateIso);
  } catch (e) {
    console.warn("[Territory] Init error", e);
  }
}

function loadTerritoryDay(dateIso) {
  try {
    TERRITORY_SELECTED_DATE = dateIso;

    api
      .withSuccessHandler((mapData) => {
        renderTerritoryMap(mapData);
      })
      .withFailureHandler((err) => {
        console.warn("[Territory] Load failed", err);
        const mapEl = document.getElementById("territory-map");
        if (mapEl) {
          mapEl.innerHTML = '<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px;">Map data unavailable</div>';
        }
      })
      .getTerritoryMapForDate({ dateIso });
  } catch (e) {
    console.warn("[Territory] Load error", e);
  }
}

function renderTerritoryDayCards(selectedDateIso) {
  try {
    const container = document.getElementById("territory-day-cards");
    if (!container) return;

    const selectedDate = new Date(`${selectedDateIso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prevDate = new Date(selectedDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateIso = prevDate.toISOString().split("T")[0];

    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateIso = nextDate.toISOString().split("T")[0];

    const formatDayLabel = (date, iso) => {
      if (iso === today.toISOString().split("T")[0]) return "Today";
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
    };

    const prevLabel = formatDayLabel(prevDate, prevDateIso);
    const selectedLabel = formatDayLabel(selectedDate, selectedDateIso);
    const nextLabel = formatDayLabel(nextDate, nextDateIso);

    container.innerHTML = "";

    const buildCard = (label, subtitle, dateIso, isSelected) => {
      const card = document.createElement("div");
      card.dataset.action = "switch-territory-day";
      card.dataset.date = dateIso;
      card.style.cssText = `flex: 1; cursor: pointer; padding: 12px; border-radius: 8px; ${isSelected ? "background: linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(14, 165, 233, 0.15)); border: 1px solid rgba(14, 165, 233, 0.6);" : "background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.35);"} transition: all 200ms ease-out;`;

      const subtitleEl = document.createElement("div");
      subtitleEl.style.cssText = "font-size: 11px; color: #94a3b8; margin-bottom: 4px;";
      subtitleEl.textContent = subtitle;

      const labelEl = document.createElement("div");
      labelEl.style.cssText = "font-size: 13px; font-weight: 600; color: #e5e7eb;";
      labelEl.textContent = label;

      card.appendChild(subtitleEl);
      card.appendChild(labelEl);
      return card;
    };

    container.appendChild(buildCard(prevLabel, "← Previous", prevDateIso, false));
    container.appendChild(buildCard(selectedLabel, "Selected", selectedDateIso, selectedDateIso === TERRITORY_SELECTED_DATE));
    container.appendChild(buildCard(nextLabel, "Next →", nextDateIso, false));
  } catch (e) {
    console.warn("[Territory] Card render error", e);
  }
}

function switchTerritoryDay(dateIso) {
  try {
    TERRITORY_SELECTED_DATE = dateIso;
    renderTerritoryDayCards(dateIso);
    loadTerritoryDay(dateIso);
  } catch (e) {
    console.warn("[Territory] Switch error", e);
  }
}

function renderTerritoryMap(mapData) {
  try {
    const mapEl = document.getElementById("territory-map");
    if (!mapEl) return;

    if (!mapData || !mapData.ok || mapData.eventCount === 0) {
      mapEl.innerHTML = '<div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; text-align: center; padding: 20px;"><div style="font-size: 16px; margin-bottom: 8px;">📅</div><div>No events scheduled for this date</div></div>';
      return;
    }

    let html = '<div style="position: absolute; inset: 0; display: flex; flex-direction: column;">';

    html += '<div style="padding: 12px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(148, 163, 184, 0.2);">';
    html += '<div style="font-size: 13px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">🗺️ Route Summary</div>';
    html += '<div style="display: flex; gap: 16px; font-size: 11px; color: #94a3b8;">';
    html += `<div><strong style="color: #22d3ee;">${mapData.eventCount}</strong> stops</div>`;
    html += `<div><strong style="color: #22d3ee;">${mapData.totals.travelMinutes}</strong> min travel</div>`;
    html += `<div><strong style="color: #22d3ee;">${mapData.totals.distanceMiles}</strong> mi total</div>`;
    html += "</div></div>";

    html += '<div style="flex: 1; position: relative; background: #1e293b;">';

    if (mapData.coordinates && mapData.coordinates.length > 0) {
let coords = [];

if (mapData.encodedPolyline && typeof mapData.encodedPolyline === "string") {
  try {
    coords = google.maps.geometry.encoding.decodePath(mapData.encodedPolyline);
  } catch (e) {
    console.error("Polyline decode failed:", e);
    coords = [];
  }
}      if (coords.length > 0) {
        let mapUrl = "https://maps.googleapis.com/maps/api/staticmap?";
        mapUrl += "size=600x280&scale=2&maptype=roadmap";

        coords.forEach((coord, idx) => {
          const label = String(idx + 1);
          mapUrl += `&markers=color:red%7Clabel:${label}%7C${coord.lat},${coord.lng}`;
        });

        if (coords.length > 1) {
          mapUrl += "&path=color:0x0ea5e9ff%7Cweight:3";
          coords.forEach((coord) => {
            mapUrl += `%7C${coord.lat},${coord.lng}`;
          });
        }

        if (mapData.center) {
          mapUrl += `&center=${mapData.center.lat},${mapData.center.lng}`;
          mapUrl += "&zoom=12";
        }

        const apiKey = getMapsApiKey();
        if (apiKey) {
          mapUrl += `&key=${apiKey}`;
          html += `<img src="${mapUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Route map">`;
        } else {
          html += '<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 12px;">Map key required</div>';
        }
      }
    } else {
      html += '<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 12px;">Events found but no geocoded locations available</div>';
    }

    html += "</div>";

    html += '<div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(148, 163, 184, 0.2); max-height: 80px; overflow-y: auto;">';
    html += '<div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Optimized Stop Order:</div>';
    html += '<div style="display: flex; gap: 8px; flex-wrap: wrap;">';

    for (let i = 0; i < Math.min(mapData.stops.length, 6); i++) {
      const stop = mapData.stops[i];
      html += '<div style="font-size: 10px; padding: 3px 8px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 12px; color: #bfdbfe;">';
      html += `${i + 1}. ${escapeHtml_(stop.title)}`;
      html += "</div>";
    }

    if (mapData.stops.length > 6) {
      html += `<div style="font-size: 10px; padding: 3px 8px; color: #64748b;">+${mapData.stops.length - 6} more</div>`;
    }

    html += "</div></div></div>";

    mapEl.innerHTML = html;
  } catch (e) {
    console.warn("[Territory] Map render error", e);
  }
}

/** ========= VENDORS ========= **/
function loadVendors() {
  try {
    const el = document.getElementById("vendors-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No vendors</h3><p>No records found.</p></div>';
        wireTableRowEditing_("Vendors", "vendors-table", "vendors");
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load vendors</h3><p>Please try again.</p></div>';
      })
      .getVendorsTable();
  } catch (e) {
    console.error("loadVendors error", e);
  }
}

/** ========= PROCUREMENTS ========= **/
function loadProcurements() {
  try {
    const el = document.getElementById("procurements-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No procurements</h3><p>No records found.</p></div>';
        wireTableRowEditing_("Procurements", "procurements-table", "procurements");
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load procurements</h3><p>Please try again.</p></div>';
      })
      .getProcurementsTable();
  } catch (e) {
    console.error("loadProcurements error", e);
  }
}

/** ========= JOB ERP ========= **/
function loadJobERP() {
  try {
    const el = document.getElementById("joberp-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No ERP entries</h3><p>No records found.</p></div>';
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load Job ERP</h3><p>Please try again.</p></div>';
      })
      .getJobERPTable();
  } catch (e) {
    console.error("loadJobERP error", e);
  }
}

/** ========= USERS ========= **/
function loadUsers() {
  try {
    const el = document.getElementById("users-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No users</h3><p>No records found.</p></div>';
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load users</h3><p>Please try again.</p></div>';
      })
      .getUsersTable();
  } catch (e) {
    console.error("loadUsers error", e);
  }
}

/** ========= SETTINGS ========= **/
function loadSettings() {
  try {
    const el = document.getElementById("settings-table");
    if (!el) return;
    api
      .withSuccessHandler((html) => {
        el.innerHTML = html || '<div class="empty-state"><h3>No settings</h3><p>No records found.</p></div>';
      })
      .withFailureHandler((err) => {
        console.error(err);
        el.innerHTML = '<div class="empty-state"><h3>Unable to load settings</h3><p>Please try again.</p></div>';
      })
      .getSettingsTable();
  } catch (e) {
    console.error("loadSettings error", e);
  }
}

/** ========= GENERIC CRUD HANDLERS ========= **/
function showPlaceholder(featureName) {
  const messages = {
    Roles: "Role-based access control (RBAC) will be implemented in Phase 5.",
    AI: "AI & Automation features including intelligent scheduling and forecasting will be added in Phase 5+.",
    Documentation: "System documentation and how-to guides will be available soon.",
  };
  alert(`${featureName}\n\n${messages[featureName] || "Coming soon in a future phase."}`);
}

function validateLeadStatus(status) {
  const validStatuses = ["Open", "Closed Won", "Closed Lost"];
  const normalizedStatus = String(status || "").trim();
  const isValid = validStatuses.includes(normalizedStatus);

  if (!isValid) {
    console.warn(`[CRM] Invalid Lead Status: ${status}. Must be one of: ${validStatuses.join(", ")}`);
  }

  return isValid;
}

function validateProcurementStatus(status) {
  const validStatuses = ["Open", "Closed"];
  const normalizedStatus = String(status || "").trim();
  const isValid = validStatuses.includes(normalizedStatus);

  if (!isValid) {
    console.warn(`[Procurements] Invalid Status: ${status}. Must be one of: ${validStatuses.join(", ")}`);
  }

  return isValid;
}

function checkEditMode() {
  if (APP_MODE !== "EDIT") {
    alert("Editing is done in Sales Ops.\n\nGo to Sales Ops > CRM Management or Sales Ops > Procurements to add/edit records.");
    return false;
  }
  return true;
}

function handleAddRow(sheetName, viewName) {
  if (APP_MODE !== "EDIT") {
    alert(
      "Editing is done in Sales Ops.\n\n" +
      "You will be redirected to Sales Ops to add or edit records."
    );

    APP_MODE = "EDIT";
    LAST_HUB_VIEW = "salesOps";

    if (sheetName === "CRM") {
      switchView("salesOps");
      setTimeout(() => switchView("crm"), 0);
      return;
    }

    if (sheetName === "Procurements") {
      switchView("salesOps");
      setTimeout(() => switchView("procurements"), 0);
      return;
    }

    return;
  }

  if (sheetName === "CRM") {
    addCrmLead(viewName);
  } else if (sheetName === "Procurements") {
    addProcurement(viewName);
  } else {
    alert(`Add functionality for ${sheetName} not yet implemented in EDIT mode.`);
  }
}

function addCrmLead(viewName) {
  try {
    const email = prompt("Contact Email (required, unique key):");
    if (email === null || !email.trim()) {
      return;
    }

    const status = prompt("Lead Status (Open / Closed Won / Closed Lost):") || "Open";
    if (!validateLeadStatus(status)) {
      alert("Invalid Lead Status. Must be: Open, Closed Won, or Closed Lost");
      return;
    }

    const customerName = prompt("Customer Name:") || "";
    const phone = prompt("Contact Phone:") || "";
    const projectType = prompt("Project Type:") || "";
    const address = prompt("Property Address:") || "";
    const estimatedValue = prompt("Estimated Value ($):") || 0;

    const dataObj = {
      "Contact Email": email.trim(),
      "Lead Status": status.trim(),
      "Customer Name": customerName.trim(),
      "Contact Phone": phone.trim(),
      "Project Type": projectType.trim(),
      "Property Address": address.trim(),
      "Estimated Value ($)": isNaN(estimatedValue) ? 0 : Number(estimatedValue),
    };

    api
      .withSuccessHandler((result) => {
        if (result.ok) {
          alert(`Lead added: ${email}`);
          loadCrm();
        } else {
          alert(`Error adding lead: ${result.error || "Unknown error"}`);
        }
      })
      .withFailureHandler((err) => {
        console.error("[CRM] Add error:", err);
        alert(`Failed to add lead: ${String(err)}`);
      })
      .addRow({ sheetName: "CRM", data: dataObj });
  } catch (e) {
    console.error("[CRM] addCrmLead error:", e);
    alert(`Error: ${String(e.message || e)}`);
  }
}

function addProcurement(viewName) {
  try {
    const poId = prompt("PO ID (required, unique):");
    if (poId === null || !poId.trim()) {
      return;
    }

    const status = prompt("Status (Open / Closed):") || "Open";
    if (!validateProcurementStatus(status)) {
      alert("Invalid Status. Must be: Open or Closed");
      return;
    }

    const vendorName = prompt("Vendor Name:") || "";
    const itemDesc = prompt("Item Description:") || "";
    const qty = prompt("Quantity Ordered:") || 1;
    const unitCost = prompt("Unit Cost ($):") || 0;
    const jobId = prompt("Job ID / SKU:") || "";

    const dataObj = {
      "PO ID": poId.trim(),
      "Status": status.trim(),
      "Vendor Name": vendorName.trim(),
      "Item Description": itemDesc.trim(),
      "Quantity Ordered": isNaN(qty) ? 1 : Number(qty),
      "Unit Cost ($)": isNaN(unitCost) ? 0 : Number(unitCost),
      "Job ID / Inventory Stock SKU": jobId.trim(),
    };

    api
      .withSuccessHandler((result) => {
        if (result.ok) {
          alert(`Procurement added: ${poId}`);
          loadProcurements();
        } else {
          alert(`Error adding procurement: ${result.error || "Unknown error"}`);
        }
      })
      .withFailureHandler((err) => {
        console.error("[Procurements] Add error:", err);
        alert(`Failed to add procurement: ${String(err)}`);
      })
      .addRow({ sheetName: "Procurements", data: dataObj });
  } catch (e) {
    console.error("[Procurements] addProcurement error:", e);
    alert(`Error: ${String(e.message || e)}`);
  }
}

function wireTableRowEditing_(sheetName, containerId, viewName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const table = container.querySelector("table");
  if (!table) return;

  const headerCells = table.querySelectorAll("thead th");
  const headers = Array.from(headerCells)
    .map((cell) => String(cell.textContent || "").trim())
    .filter(Boolean);

  if (!headers.length) return;

  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    row.style.cursor = "pointer";
    row.onclick = () => {
      const cells = row.querySelectorAll("td");
      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header] = cells[idx] ? String(cells[idx].textContent || "").trim() : "";
      });
      handleRowEdit(sheetName, rowObj, viewName);
    };
  });
}

function handleRowEdit(sheetName, rowObject, viewName) {
  if (APP_MODE !== "EDIT") {
    alert("Editing is done in Sales Ops.");
    return;
  }

  if (!rowObject || !Object.keys(rowObject).length) {
    alert("No row data available for editing.");
    return;
  }

  const updated = {};
  const fields = Object.keys(rowObject);

  for (const field of fields) {
    const currentValue = rowObject[field] == null ? "" : String(rowObject[field]);
    const nextValue = prompt(`Edit ${field}:`, currentValue);
    if (nextValue === null) {
      return;
    }
    updated[field] = nextValue.trim();
  }

  if (sheetName === "CRM" && !validateLeadStatus(updated["Lead Status"])) {
    alert("Invalid Lead Status. Must be: Open, Closed Won, or Closed Lost");
    return;
  }

  if (sheetName === "Procurements" && !validateProcurementStatus(updated["Status"])) {
    alert("Invalid Status. Must be: Open or Closed");
    return;
  }

  const keyMap = {
    CRM: "Contact Email",
    Procurements: "PO ID",
    Vendors: "Vendor ID",
  };

  const keyField = keyMap[sheetName];
  const keyValue = keyField ? updated[keyField] : null;

  if (!keyField || !keyValue) {
    alert(`Missing key field for update: ${keyField || "Unknown"}`);
    return;
  }

  api
    .withSuccessHandler((result) => {
      if (result && result.ok) {
        alert("Row updated successfully");
        loadTabData(viewName || CURRENT_VIEW);
      } else {
        alert(`Error updating row: ${result.error || "Unknown error"}`);
      }
    })
    .withFailureHandler((err) => {
      console.error(err);
      alert("Failed to update row");
    })
    .updateRow({ sheetName, keyValue, updated });
}

function handleRemoveRow(sheetName, keyValue, viewName) {
  if (APP_MODE !== "EDIT") {
    alert("Editing is done in Sales Ops.");
    return;
  }

  if (!confirm(`Archive/remove this row with key: ${keyValue}?`)) {
    return;
  }

  api
    .withSuccessHandler((result) => {
      if (result.ok) {
        alert("Row archived successfully");
        loadTabData(viewName);
      } else {
        alert(`Error: ${result.error}`);
      }
    })
    .withFailureHandler((err) => {
      console.error(err);
      alert("Failed to archive row");
    })
    .archiveRow({ sheetName, keyValue });
}

function handleAddContact() {
  const type = prompt(
    "What type of contact is this?\n\n" +
    "Customer (Lead)\n" +
    "Vendor\n" +
    "Partner\n" +
    "Internal\n" +
    "Other"
  );

  if (!type) return;

  const normalized = type.trim().toLowerCase();

  if (normalized === "customer" || normalized === "lead") {
    APP_MODE = "EDIT";
    LAST_HUB_VIEW = "salesOps";
    switchView("salesOps");
    setTimeout(() => switchView("crm"), 0);
    return;
  }

  if (normalized === "vendor") {
    APP_MODE = "EDIT";
    LAST_HUB_VIEW = "salesOps";
    switchView("salesOps");
    setTimeout(() => switchView("vendors"), 0);
    return;
  }

  alert(
    `Contact recorded as "${type}".\n\n` +
    "Contact-only records will be fully supported in Phase 6."
  );
}

function openVendorManagement() {
  APP_MODE = "EDIT";
  LAST_HUB_VIEW = "salesOps";
  switchView("vendors");
}

function expandCalendarEvent(eventId) {
  try {
    const panel = document.getElementById("calendar-event-details");
    if (!panel) return;

    if (EXPANDED_EVENT_ID === eventId) {
      panel.style.display = "none";
      EXPANDED_EVENT_ID = null;
      return;
    }

    EXPANDED_EVENT_ID = eventId;

    api
      .withSuccessHandler(renderCalendarEventDetails)
      .withFailureHandler((err) => {
        console.warn("[Calendar] Event load failed", err);
        panel.style.display = "block";
        panel.innerHTML = "<p>No additional details available.</p>";
      })
      .getCalendarEventDetails({ eventId });
  } catch (e) {
    console.warn("[Calendar] Expand error", e);
  }
}

function renderCalendarEventDetails(evt) {
  const panel = document.getElementById("calendar-event-details");
  if (!panel || !evt) return;

  panel.style.display = "block";

  let html = '<div style="padding: 12px; background: #f9f9f9; border-radius: 4px;">';

  if (evt.title) {
    html += `<div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a;">${escapeHtml_(evt.title)}</div>`;
  }

  if (evt.date || evt.startTime) {
    html += '<div style="margin-bottom: 8px; color: #333;">';
    if (evt.date) html += `<strong>Date:</strong> ${escapeHtml_(evt.date)}<br>`;
    if (evt.startTime) html += `<strong>Start:</strong> ${escapeHtml_(evt.startTime)}<br>`;
    html += "</div>";
  }

  if (evt.recommendedArrivalTime) {
    html += '<div style="margin-bottom: 8px; padding: 8px; background: #fff5e6; border-left: 3px solid #ff9800; color: #333;">';
    html += `<strong style="color: #ff9800;">Recommended Arrival:</strong> ${escapeHtml_(evt.recommendedArrivalTime)}`;
    if (evt.bufferMinutes) {
      html += ` (${evt.bufferMinutes} min buffer)`;
    }
    html += "</div>";
  }

  if (evt.travelMinutesFromPrevious || evt.distanceMilesFromPrevious) {
    html += '<div style="margin-bottom: 8px; padding: 8px; background: #e3f2fd; border-left: 3px solid #2196f3; color: #333;">';
    html += '<strong style="color: #2196f3;">Travel from Previous Stop:</strong><br>';
    if (evt.travelMinutesFromPrevious) {
      html += `Travel Time: <strong>${evt.travelMinutesFromPrevious} min</strong><br>`;
    }
    if (evt.distanceMilesFromPrevious) {
      html += `Distance: <strong>${evt.distanceMilesFromPrevious} miles</strong>`;
    }
    html += "</div>";
  } else if (evt.distanceMilesFromPrevious !== undefined || evt.travelMinutesFromPrevious !== undefined) {
    html += '<div style="margin-bottom: 8px; color: #999; font-size: 12px;">Travel data unavailable (previous event or Maps disabled)</div>';
  }

  if (evt.description) {
    html += '<div style="margin-bottom: 8px; color: #333;">';
    html += `<strong>Description:</strong><br>${escapeHtml_(evt.description)}`;
    html += "</div>";
  }

  if (evt.location) {
    html += '<div style="margin-bottom: 8px; color: #333;">';
    html += `<strong>Address:</strong><br>${escapeHtml_(evt.location)}`;
    html += "</div>";
  }

  if (evt.priority || evt.status) {
    html += '<div style="margin-bottom: 8px; color: #666; font-size: 13px;">';
    if (evt.priority) html += `<strong>Priority:</strong> ${escapeHtml_(evt.priority)} | `;
    if (evt.status) html += `<strong>Status:</strong> ${escapeHtml_(evt.status)}`;
    html += "</div>";
  }

  if (evt.lat && evt.lng) {
    html += '<div style="margin-top: 12px; border-top: 1px solid #ddd; padding-top: 12px;">';
    html += "<strong>Location Map:</strong><br>";

    const mapWidth = 280;
    const mapHeight = 200;
    const zoom = 16;
    const apiKey = getMapsApiKey();

    if (apiKey) {
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${evt.lat},${evt.lng}&zoom=${zoom}&size=${mapWidth}x${mapHeight}&markers=color:red%7C${evt.lat},${evt.lng}&style=feature:all%7Celement:labels%7Cvisibility:off&key=${apiKey}`;
      html += `<img src="${mapUrl}" style="max-width: 100%; height: auto; border-radius: 4px; margin-top: 8px;" alt="Location map">`;
    } else {
      html += '<div style="font-size: 12px; color: #999; margin-top: 8px;">Map key required</div>';
    }

    html += "</div>";
  }

  html += "</div>";

  panel.innerHTML = html || "<p>No additional details available.</p>";
  loadTodayTerritoryPlan(true);
}

function loadTodayTerritoryPlan(isFromEventExpand) {
  if (isFromEventExpand && window._todayPlanLoaded) {
    return;
  }

  try {
    const today = new Date();
    const dateIso = today.toISOString().split("T")[0];

    api
      .withSuccessHandler((plan) => {
        renderTodayTerritoryPlan(plan);
        window._todayPlanLoaded = true;
      })
      .withFailureHandler((err) => {
        console.warn("[Territory Plan] Load failed", err);
        window._todayPlanLoaded = true;
      })
      .getCalendarDayPlan({ dateIso });
  } catch (e) {
    console.warn("[Territory Plan] Load error", e);
  }
}

function renderTodayTerritoryPlan(plan) {
  if (!plan) return;

  const panel = document.getElementById("calendar-event-details");
  if (!panel) return;

  try {
    let html = '<div style="margin-top: 16px; padding: 12px; background: #f0f7ff; border-radius: 4px; border-left: 4px solid #2196f3;">';
    html += '<div style="font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #1a1a1a;">📍 Today\'s Territory Plan</div>';

    if (plan.warnings && plan.warnings.length > 0) {
      html += '<div style="margin-bottom: 8px; padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; color: #856404; font-size: 12px;">';
      html += "<strong>⚠️ Notes:</strong><br>";
      for (const warning of plan.warnings) {
        html += `${escapeHtml_(warning)}<br>`;
      }
      html += "</div>";
    }

    html += `<div style="margin-bottom: 8px; font-size: 13px; color: #333;"><strong>Events Today:</strong> ${plan.eventCount}</div>`;

    if (plan.eventCount === 0) {
      html += '<div style="color: #999; font-size: 12px;">No calendar events scheduled for today.</div>';
      html += "</div>";
      appendToPanelContent_(panel, html);
      return;
    }

    html += '<div style="margin-bottom: 8px; padding: 8px; background: #fff9c4; border-radius: 3px; font-size: 12px; color: #333;">';
    html += "<strong>Travel Optimization:</strong><br>";
    html += `📅 Sequential Route: ${plan.totals.chronoTravelMinutes} min, ${plan.totals.chronoDistanceMiles} mi<br>`;
    html += `🚗 Optimized Route: ${plan.totals.optimizedTravelMinutes} min, ${plan.totals.optimizedDistanceMiles} mi<br>`;
    const saved = plan.totals.chronoTravelMinutes - plan.totals.optimizedTravelMinutes;
    if (saved > 0) {
      html += `<strong style="color: #2e7d32;">✓ Savings: ${saved} min</strong>`;
    }
    html += "</div>";

    html += '<div style="margin-bottom: 8px; font-size: 12px; color: #333;"><strong>Recommended Stop Order:</strong>';
    html += '<ol style="margin: 6px 0 0 20px; padding: 0;">';

    for (let i = 0; i < plan.optimizedRoute.length; i++) {
      const stop = plan.optimizedRoute[i];
      html += '<li style="margin-bottom: 6px; line-height: 1.4;">';
      html += `<strong>${escapeHtml_(stop.title)}</strong>`;

      if (stop.startTime) {
        html += ` <span style="color: #666;">@ ${escapeHtml_(stop.startTime)}</span>`;
      }

      if (stop.recommendedArrivalTime) {
        html += `<br><span style="font-size: 11px; color: #ff9800;">↓ Arrive by: ${stop.recommendedArrivalTime}</span>`;
      }

      if (stop.location) {
        html += `<br><span style="font-size: 11px; color: #1976d2;">${escapeHtml_(stop.location)}</span>`;
      }

      if (stop.travelMinutesFromPrevious && i > 0) {
        html += `<br><span style="font-size: 11px; color: #666;">↻ ${stop.travelMinutesFromPrevious} min from previous</span>`;
      }

      html += "</li>";
    }

    html += "</ol></div></div>";
    appendToPanelContent_(panel, html);
  } catch (e) {
    console.warn("[Territory Plan] Render error", e);
  }
}

function appendToPanelContent_(panel, html) {
  if (!panel) return;
  const currentContent = panel.innerHTML || "";
  panel.innerHTML = currentContent + html;
}

function escapeHtml_(text) {
  if (typeof text !== "string") return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/** ========= AI ========= **/
function loadAI() {
  api
    .withSuccessHandler((html) => {
      const el = document.getElementById("ai-content");
      if (el) el.innerHTML = html;
    })
    .withFailureHandler((err) => console.error(err))
    .getAIInsights();
}

/** ========= UI HELPERS ========= **/
function filterCurrentTable(containerId, query) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const rows = container.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(query.toLowerCase()) ? "" : "none";
  });
}

function toggleMapExpand() {
  const el = document.getElementById("map-card");
  if (el) el.classList.toggle("expanded");
}

function setMapMode(mode) {
  document.querySelectorAll(".map-toggle").forEach((btn) => btn.classList.remove("active"));
  const el = document.getElementById(`map-toggle-${mode}`);
  if (el) el.classList.add("active");
  setRouteMapMode(mode);
}

/** ========= FORMATTERS ========= **/
function money(v) {
  if (v == null || isNaN(v)) return "—";
  return `$${Number(v).toLocaleString()}`;
}

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

function safeNumber(v) {
  return (v == null || isNaN(v)) ? "—" : v;
}

const bindActionHandlers = () => {
  document.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    switch (action) {
      case "switch-view":
        if (actionEl.dataset.mode) {
          APP_MODE = actionEl.dataset.mode;
        }
        switchView(actionEl.dataset.view);
        break;
      case "refresh":
        refreshCurrent();
        break;
      case "healthcheck":
        runHealthcheck();
        break;
      case "map-mode":
        setMapMode(actionEl.dataset.mapMode);
        break;
      case "map-expand":
        toggleMapExpand();
        break;
      case "build-route":
        buildRoute();
        break;
      case "ai-schedule":
        aiSchedule();
        break;
      case "open-view":
        switchView(actionEl.dataset.view);
        break;
      case "hub-subpage":
        navigateToSubPage(actionEl.dataset.view, actionEl.dataset.source);
        break;
      case "hub-salesops":
        navigateToSalesOpsView(actionEl.dataset.view);
        break;
      case "open-vendors":
        openVendorManagement();
        break;
      case "back-hub":
        backToHub();
        break;
      case "add-row":
        handleAddRow(actionEl.dataset.sheet, actionEl.dataset.view);
        break;
      case "reload-view":
        loadTabData(actionEl.dataset.view);
        break;
      case "filter-table":
        filterCurrentTable(actionEl.dataset.target, actionEl.dataset.query);
        break;
      case "switch-territory-day":
        switchTerritoryDay(actionEl.dataset.date);
        break;
      case "toggle-shield-ai":
        toggleShieldAI();
        break;
      case "placeholder":
        showPlaceholder(actionEl.dataset.feature);
        break;
      case "add-contact":
        handleAddContact();
        break;
      case "load-calendar":
        loadCalendar();
        break;
      default:
        break;
    }
  });

  document.querySelectorAll("[data-filter-target]").forEach((input) => {
    if (input.tagName.toLowerCase() === "input") {
      input.addEventListener("input", (event) => {
        filterCurrentTable(input.dataset.filterTarget, event.target.value);
      });
    }
  });

  const invoiceUpload = document.getElementById("invoice-upload");
  if (invoiceUpload) {
    invoiceUpload.addEventListener("change", (event) => {
      handleInvoiceUpload(event.target.files);
    });
  }

  const shieldToggle = document.getElementById("shield-ai-toggle");
  if (shieldToggle) {
    shieldToggle.addEventListener("mouseenter", () => {
      shieldToggle.style.transform = "scale(1.1)";
      shieldToggle.style.boxShadow = "0 12px 32px rgba(34, 211, 238, 0.6)";
    });
    shieldToggle.addEventListener("mouseleave", () => {
      shieldToggle.style.transform = "scale(1)";
      shieldToggle.style.boxShadow = "0 8px 24px rgba(34, 211, 238, 0.5)";
    });
  }
};

const exposeGlobals = () => {
  Object.assign(window, {
    switchView,
    refreshCurrent,
    runHealthcheck,
    setMapMode,
    toggleMapExpand,
    buildRoute,
    aiSchedule,
    navigateToSubPage,
    navigateToSalesOpsView,
    backToHub,
    loadActiveJobs,
    loadCrm,
    loadWorkOrders,
    loadInvoices,
    loadCalendar,
    loadVendors,
    loadProcurements,
    loadJobERP,
    loadUsers,
    filterCurrentTable,
    handleAddRow,
    handleAddContact,
    openVendorManagement,
    showPlaceholder,
    toggleShieldAI,
    switchTerritoryDay,
  });
};

exposeGlobals();

/** ========= INIT ========= **/
document.addEventListener("DOMContentLoaded", () => {
  bindActionHandlers();
  refreshDashboard();
  renderShieldAIHintBubble();
});
