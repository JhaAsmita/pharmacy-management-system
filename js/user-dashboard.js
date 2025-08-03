import { auth, database } from "./firebase-config.js";
import { renderUserSidebar } from "./user-sidebar-navigation.js";
import { logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  renderUserSidebar("sidebar-container", "Loading...");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const roleSnapshot = await database
      .ref(`users/${user.uid}/role`)
      .once("value");
    const role = roleSnapshot.val();

    renderUserSidebar(
      "sidebar-container",
      user.email || user.displayName || "User"
    );

    document.getElementById("user-name").textContent =
      user.displayName || "User";
    document.getElementById("user-email").textContent = user.email || "-";
    document.getElementById("user-role").textContent = role || "-";

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      logout();
    });

    await loadDashboardStats();
  });
});

window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out to 80%
  } else {
    document.body.style.zoom = "80%"; // Zoom out to 80%
  }
});

async function loadDashboardStats() {
  const medicinesSnap = await database.ref("medicines").once("value");
  const medicines = medicinesSnap.val() || {};

  // Counters and lists
  let totalMedicines = 0;
  let finishedStock = 0;
  let lowStockCount = 0;

  // Table bodies
  const lowStockListEl = document.getElementById("low-stock-list");
  const finishedStockListEl = document.getElementById("finished-stock-list");

  // Clear tables
  lowStockListEl.innerHTML = "";
  finishedStockListEl.innerHTML = "";

  for (const id in medicines) {
    const med = medicines[id];
    const qty = Number(med.quantity) || 0;

    if (qty > 0) totalMedicines++;
    else finishedStock++;

    const batch = med.batch || "-";
    const rack = med.rack || "-";

    if (qty < 10 && qty > 0) {
      lowStockCount++;
      lowStockListEl.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td>${escapeHtml(med.name)}</td>
          <td>${escapeHtml(batch)}</td>
          <td>${qty}</td>
          <td>${escapeHtml(rack)}</td>
        </tr>`
      );
    }

    if (qty === 0) {
      finishedStockListEl.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td>${escapeHtml(med.name)}</td>
          <td>${escapeHtml(batch)}</td>
          <td>${escapeHtml(med.expiry || "-")}</td>
          <td>${escapeHtml(rack)}</td>
        </tr>`
      );
    }
  }

  // Placeholders if empty
  if (lowStockCount === 0)
    lowStockListEl.innerHTML = `<tr><td colspan="4">No low stock medicines.</td></tr>`;
  if (finishedStock === 0)
    finishedStockListEl.innerHTML = `<tr><td colspan="4">No finished medicines.</td></tr>`;

  // Update summary counts
  document.getElementById("total-medicines").textContent = totalMedicines;
  document.getElementById("finished-stock").textContent = finishedStock;
  document.getElementById("low-stock-count").textContent = lowStockCount;
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"]/g, (m) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return map[m];
  });
}
