import { api } from "./apiClient.js";
import { apiCreateEstimate, apiGetEstimates } from "./apiClient.js";
import {
  initEstimatorMap,
  estimatorSetMapType,
  estimatorStartDrawing,
  estimatorFinishDrawing,
} from "./map.js";

export const estimatorState = {
  map: null,
  drawingManager: null,
  polylines: [],
  markers: [],
  currentMode: "new",
  selectedCustomer: null,
  selectedJob: null,
  mapInitialized: false,
  isDrawing: false,
};

export const setEstimatorMode = (mode) => {
  estimatorState.currentMode = mode;

  const newBtn = document.getElementById("mode-new-btn");
  const existingBtn = document.getElementById("mode-existing-btn");
  const jobWrapper = document.getElementById("estimate-job-wrapper");
  const revisionBtn = document.getElementById("create-revision-btn");

  if (!newBtn || !existingBtn || !jobWrapper || !revisionBtn) {
    return;
  }

  if (mode === "new") {
    newBtn.classList.add("primary-btn");
    newBtn.classList.remove("ghost-btn");
    existingBtn.classList.remove("primary-btn");
    existingBtn.classList.add("ghost-btn");
    jobWrapper.style.display = "none";
    revisionBtn.style.display = "none";
  } else {
    existingBtn.classList.add("primary-btn");
    existingBtn.classList.remove("ghost-btn");
    newBtn.classList.remove("primary-btn");
    newBtn.classList.add("ghost-btn");
    jobWrapper.style.display = "block";
    revisionBtn.style.display = "block";
  }
};

export const estimatorLoadCustomers = () => {
  api
    .withSuccessHandler((customers) => {
      const select = document.getElementById("estimate-customer-select");
      if (!select) return;
      select.innerHTML = '<option value="">-- Select Customer --</option>';

      (customers || []).forEach((customer, idx) => {
        const option = document.createElement("option");
        option.value = String(idx);
        option.textContent = `${customer.name} (${customer.address})`;
        select.appendChild(option);
      });
    })
    .withFailureHandler((error) => {
      console.error("Error loading customers:", error);
    })
    .getCustomersForEstimator();
};

export const estimatorLoadJobs = () => {
  const customerSelect = document.getElementById("estimate-customer-select");
  if (!customerSelect || !customerSelect.value) return;

  api
    .withSuccessHandler((jobs) => {
      const select = document.getElementById("estimate-job-select");
      if (!select) return;
      select.innerHTML = '<option value="">-- Select Job --</option>';

      (jobs || []).forEach((job) => {
        const option = document.createElement("option");
        option.value = job.jobId;
        option.textContent = `[${job.status}] ${job.workOrder} - ${job.address}`;
        select.appendChild(option);
      });
    })
    .withFailureHandler((error) => {
      console.error("Error loading jobs:", error);
    })
    .getJobsByCustomerForEstimator(parseInt(customerSelect.value, 10) + 1);
};

export const estimatorRecalculate = () => {
  const totalFeet = estimatorState.polylines.reduce((sum, p) => sum + p.data.length, 0);
  const priceEl = document.getElementById("estimate-price-per-foot");
  const multiplierEl = document.getElementById("estimate-multiplier");

  const pricePerFoot = priceEl ? parseFloat(priceEl.value) || 12.5 : 12.5;
  const multiplier = multiplierEl ? parseFloat(multiplierEl.value) || 1.0 : 1.0;

  const subtotal = totalFeet * pricePerFoot;
  const total = subtotal * multiplier;

  const totalFeetEl = document.getElementById("estimate-total-feet");
  const totalPriceEl = document.getElementById("estimate-total-price");
  const polylineCountEl = document.getElementById("polyline-count");

  if (totalFeetEl) totalFeetEl.textContent = `${Math.round(totalFeet)} ft`;
  if (totalPriceEl) totalPriceEl.textContent = total.toFixed(2);
  if (polylineCountEl) polylineCountEl.textContent = String(estimatorState.polylines.length);
};

export const estimatorSaveEstimate = () => {
  if (estimatorState.polylines.length === 0) {
    alert("Please draw at least one gutter run.");
    return;
  }

  const customerSelect = document.getElementById("estimate-customer-select");
  const jobSelect = document.getElementById("estimate-job-select");
  const addressDisplay = document.getElementById("estimate-address-display");
  const notesInput = document.getElementById("estimate-notes");
  const priceEl = document.getElementById("estimate-price-per-foot");
  const multiplierEl = document.getElementById("estimate-multiplier");
  const totalFeetEl = document.getElementById("estimate-total-feet");

  if (!customerSelect || !jobSelect || !addressDisplay || !notesInput || !priceEl || !multiplierEl || !totalFeetEl) {
    alert("Estimator inputs are missing.");
    return;
  }

  if (!customerSelect.value && estimatorState.currentMode === "existing") {
    alert("Please select a customer.");
    return;
  }

  const customerOption = customerSelect.options[customerSelect.selectedIndex];
  const payload = {
    jobId: estimatorState.currentMode === "existing" ? jobSelect.value : `NEW-${Date.now()}`,
    customerId: customerSelect.value,
    customerName: customerOption ? customerOption.text : "",
    address: addressDisplay.textContent,
    polylines: estimatorState.polylines.map((p) => p.data),
    totalLinearFeet: parseFloat(totalFeetEl.textContent),
    pricePerLinearFoot: parseFloat(priceEl.value),
    multiplier: parseFloat(multiplierEl.value),
    notes: notesInput.value,
  };

  apiCreateEstimate(payload)
    .then((result) => {
      alert(`Estimate saved: ${result.estimateId} (v${result.version || 1})`);
      estimatorClearAllPolylines();
      estimatorLoadHistory();
    })
    .catch((error) => {
      alert(`Error saving estimate: ${error.message || error}`);
    });
};

export const estimatorSaveAsNewJob = () => {
  const addressDisplay = document.getElementById("estimate-address-display");
  if (!addressDisplay) return;

  const address = addressDisplay.textContent;
  if (!address || address === "(auto-populated from map search)") {
    alert("Please search and select an address first.");
    return;
  }

  const jobName = prompt("Enter a name/description for this job:", `Gutter Project - ${address}`);
  if (!jobName) return;

  estimatorSaveEstimate();
};

export const estimatorCreateRevision = () => {
  const jobSelect = document.getElementById("estimate-job-select");
  if (!jobSelect || !jobSelect.value) {
    alert("Please select a job to create a revision for.");
    return;
  }

  api
    .withSuccessHandler((history) => {
      if (!history || history.length === 0) {
        alert("No existing estimates for this job.");
        return;
      }

      estimatorSaveEstimate();
    })
    .withFailureHandler((error) => {
      console.error("Error loading history:", error);
    })
    .getEstimatorHistory(jobSelect.value);
};

export const estimatorExportPDF = () => {
  const totalFeetEl = document.getElementById("estimate-total-feet");
  const totalPriceEl = document.getElementById("estimate-total-price");
  const addressDisplay = document.getElementById("estimate-address-display");

  if (!totalFeetEl || !totalPriceEl || !addressDisplay) return;

  const pdfContent = `
    GUTTER GUYS ESTIMATOR REPORT
    =============================

    Address: ${addressDisplay.textContent}
    Total Linear Feet: ${totalFeetEl.textContent}
    Estimated Price: $${totalPriceEl.textContent}

    Generated: ${new Date().toLocaleString()}
  `;

  alert(`Export to PDF functionality coming soon.\n\n${pdfContent}`);
};

export const estimatorLoadHistory = () => {
  const jobSelect = document.getElementById("estimate-job-select");
  if (!jobSelect || !jobSelect.value) return;

  apiGetEstimates(jobSelect.value)
    .then((result) => {
      const container = document.getElementById("estimate-history-container");
      if (!container) return;

      const history = result && result.estimates ? result.estimates : [];
      if (!history || history.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No estimates yet</h3></div>';
        return;
      }

      let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
      history.forEach((est) => {
        const version = est.version || 1;
        const totalFeet = est.totalLinearFeet || 0;
        const price = (est.pricePerLinearFoot || 0) * (est.multiplier || 1) * totalFeet;

        html += '<div style="padding: 12px; background: rgba(15,23,42,0.6); border-radius: 6px; border-left: 3px solid var(--accent);">';
        html += `<div style="display: flex; justify-content: space-between;"><span style="font-weight: 600;">${est.id}</span><span style="color: var(--text-soft); font-size: 11px;">v${version}</span></div>`;
        html += `<div style="margin-top: 4px; font-size: 12px;"><span style="color: var(--text-soft);">Linear Feet:</span> <strong>${Math.round(totalFeet)} ft</strong></div>`;
        html += `<div style="font-size: 12px;"><span style="color: var(--text-soft);">Price:</span> <strong>$${price.toFixed(2)}</strong></div>`;
        html += "</div>";
      });
      html += "</div>";
      container.innerHTML = html;
    })
    .catch((error) => {
      console.error("Error loading history:", error);
    });
};

export const estimatorClearLastPolyline = () => {
  if (estimatorState.polylines.length > 0) {
    const last = estimatorState.polylines.pop();
    last.polylineObject.setMap(null);
    estimatorRecalculate();
  }
};

export const estimatorClearAllPolylines = () => {
  estimatorState.polylines.forEach((p) => p.polylineObject.setMap(null));
  estimatorState.polylines = [];
  estimatorRecalculate();
};

const bindEstimatorEvents = () => {
  const initMapBtn = document.querySelector('[data-action="init-estimator-map"]');
  if (initMapBtn) {
    initMapBtn.addEventListener("click", () => initEstimatorMap());
  }

  const newModeBtn = document.getElementById("mode-new-btn");
  if (newModeBtn) {
    newModeBtn.addEventListener("click", () => setEstimatorMode("new"));
  }

  const existingModeBtn = document.getElementById("mode-existing-btn");
  if (existingModeBtn) {
    existingModeBtn.addEventListener("click", () => setEstimatorMode("existing"));
  }

  const mapTypeSelect = document.getElementById("estimate-map-type");
  if (mapTypeSelect) {
    mapTypeSelect.addEventListener("change", (event) => {
      estimatorSetMapType(event.target.value);
    });
  }

  const customerSelect = document.getElementById("estimate-customer-select");
  if (customerSelect) {
    customerSelect.addEventListener("change", estimatorLoadJobs);
  }

  const priceInput = document.getElementById("estimate-price-per-foot");
  if (priceInput) {
    priceInput.addEventListener("change", estimatorRecalculate);
  }

  const multiplierSelect = document.getElementById("estimate-multiplier");
  if (multiplierSelect) {
    multiplierSelect.addEventListener("change", estimatorRecalculate);
  }

  const drawBtn = document.getElementById("draw-mode-btn");
  if (drawBtn) {
    drawBtn.addEventListener("click", estimatorStartDrawing);
  }

  const finishBtn = document.getElementById("finish-draw-btn");
  if (finishBtn) {
    finishBtn.addEventListener("click", estimatorFinishDrawing);
  }

  const undoBtn = document.querySelector('[data-action="estimator-undo"]');
  if (undoBtn) {
    undoBtn.addEventListener("click", estimatorClearLastPolyline);
  }

  const clearBtn = document.querySelector('[data-action="estimator-clear"]');
  if (clearBtn) {
    clearBtn.addEventListener("click", estimatorClearAllPolylines);
  }

  const saveBtn = document.querySelector('[data-action="estimator-save"]');
  if (saveBtn) {
    saveBtn.addEventListener("click", estimatorSaveEstimate);
  }

  const saveNewBtn = document.querySelector('[data-action="estimator-save-new"]');
  if (saveNewBtn) {
    saveNewBtn.addEventListener("click", estimatorSaveAsNewJob);
  }

  const revisionBtn = document.getElementById("create-revision-btn");
  if (revisionBtn) {
    revisionBtn.addEventListener("click", estimatorCreateRevision);
  }

  const exportBtn = document.querySelector('[data-action="estimator-export"]');
  if (exportBtn) {
    exportBtn.addEventListener("click", estimatorExportPDF);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindEstimatorEvents();
});

Object.assign(window, {
  setEstimatorMode,
  estimatorSaveEstimate,
  estimatorSaveAsNewJob,
  estimatorCreateRevision,
  estimatorExportPDF,
  estimatorClearLastPolyline,
  estimatorClearAllPolylines,
  estimatorLoadHistory,
});
