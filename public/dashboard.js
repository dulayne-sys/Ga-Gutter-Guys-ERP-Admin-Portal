// dashboard.js
import { getIdToken } from "./apiClient.js";

export async function loadEstimates() {
  const token = await getIdToken();

  const res = await fetch(
    "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net/getEstimates",
    {
      headers: {
        Authorization: "Bearer " + token
      }
    }
  );

  const data = await res.json();

  const tbody = document.getElementById("estimates-table");
  tbody.innerHTML = "";

  data.forEach((est) => {
    const row = `
      <tr>
        <td>${est.totalFeet}</td>
        <td>$${est.totalPrice}</td>
        <td>${new Date(est.createdAt).toLocaleDateString()}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

export async function loadAnalytics() {
  const token = await getIdToken();

  const res = await fetch(
    "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net/getDashboardAnalytics",
    {
      headers: {
        Authorization: "Bearer " + token
      }
    }
  );

  const data = await res.json();

  document.getElementById("kpi-total-revenue").textContent =
    "$" + data.totalRevenue;

  document.getElementById("kpi-total-estimates").textContent =
    data.totalEstimates;
}