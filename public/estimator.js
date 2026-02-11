// estimator.js
import { getIdToken } from "./apiClient.js";

export async function createEstimate() {
  const totalFeet = parseFloat(
    document.getElementById("total-feet").textContent
  );

  const pricePerFoot = parseFloat(
    document.getElementById("price-per-foot").value
  );

  const multiplier = parseFloat(
    document.getElementById("multiplier").value
  );

  const totalPrice = totalFeet * pricePerFoot * multiplier;

  const token = await getIdToken();

  const response = await fetch(
    "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net/createEstimate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        totalFeet,
        pricePerFoot,
        multiplier,
        totalPrice
      })
    }
  );

  const data = await response.json();
  alert("Estimate Saved: " + data.id);
}