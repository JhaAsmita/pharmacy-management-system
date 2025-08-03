import { auth, database } from "./firebase-config.js";
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";
import { logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  renderAdminSidebar("sidebar-container", "Loading...");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const roleSnapshot = await database
      .ref(`users/${user.uid}/role`)
      .once("value");
    const role = roleSnapshot.val();

    if (role !== "admin") {
      alert("Access denied. Admins only.");
      logout();
      return;
    }

    renderAdminSidebar(
      "sidebar-container",
      user.email || user.displayName || "Admin"
    );

    document.getElementById("user-name").textContent =
      user.displayName || "Admin User";
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

  const pharmacySnap = await database.ref("pharmacyDetailsList").once("value");
  const pharmacies = pharmacySnap.val() || {};

  const requestsSnap = await database.ref("requests").once("value");
  const requests = requestsSnap.val() || {};

  const salesSnap = await database.ref("sales").once("value");
  const sales = salesSnap.val() || {};

  // Counters and lists
  let totalMedicines = 0;
  let finishedStock = 0;
  let expiredCount = 0;
  let nearExpiryCount = 0;
  let lowStockCount = 0;

  // Table bodies
  const expiredListEl = document.getElementById("expired-list");
  const nearExpiryListEl = document.getElementById("near-expiry-list");
  const lowStockListEl = document.getElementById("low-stock-list");
  const finishedStockListEl = document.getElementById("finished-stock-list");

  // Clear tables
  expiredListEl.innerHTML = "";
  nearExpiryListEl.innerHTML = "";
  lowStockListEl.innerHTML = "";
  finishedStockListEl.innerHTML = "";

  const today = new Date();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  for (const id in medicines) {
    const med = medicines[id];
    const qty = Number(med.quantity) || 0;

    if (qty > 0) totalMedicines++;
    else finishedStock++;

    const expiryDate = med.expiry ? new Date(med.expiry) : null;
    const batch = med.batch || "-";
    const rack = med.rack || "-";

    if (expiryDate && expiryDate < today) {
      expiredCount++;
      expiredListEl.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td>${escapeHtml(med.name)}</td>
          <td>${escapeHtml(batch)}</td>
          <td>${escapeHtml(med.expiry)}</td>
          <td>${qty}</td>
          <td>${escapeHtml(rack)}</td>
        </tr>`
      );
    }

    if (expiryDate) {
      const diffDays = Math.floor((expiryDate - today) / MS_PER_DAY);
      if (diffDays >= 0 && diffDays <= 10) {
        nearExpiryCount++;
        nearExpiryListEl.insertAdjacentHTML(
          "beforeend",
          `<tr>
            <td>${escapeHtml(med.name)}</td>
            <td>${escapeHtml(batch)}</td>
            <td>${escapeHtml(med.expiry)}</td>
            <td>${diffDays}</td>
            <td>${escapeHtml(rack)}</td>
          </tr>`
        );
      }
    }

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
  if (expiredCount === 0)
    expiredListEl.innerHTML = `<tr><td colspan="5">No expired medicines.</td></tr>`;
  if (nearExpiryCount === 0)
    nearExpiryListEl.innerHTML = `<tr><td colspan="5">No medicines near expiry.</td></tr>`;
  if (lowStockCount === 0)
    lowStockListEl.innerHTML = `<tr><td colspan="4">No low stock medicines.</td></tr>`;
  if (finishedStock === 0)
    finishedStockListEl.innerHTML = `<tr><td colspan="4">No finished medicines.</td></tr>`;

  // Update summary counts
  document.getElementById("total-medicines").textContent = totalMedicines;
  document.getElementById("finished-stock").textContent = finishedStock;
  document.getElementById("expired-count").textContent = expiredCount;
  document.getElementById("near-expiry-count").textContent = nearExpiryCount;
  document.getElementById("low-stock-count").textContent = lowStockCount;

  // Pharmacy count
  const pharmacyCount = Object.keys(pharmacies).length;
  document.getElementById("pharmacy-count").textContent = pharmacyCount;

  // B2B Requests count (fixed: count total requests)
  const b2bRequestsCount = Object.keys(requests).length;
  document.getElementById("b2b-request-count").textContent = b2bRequestsCount;

  // Sales stats: totals for today, month, year & pending payments
  let salesToday = 0;
  let salesMonth = 0;
  let salesYear = 0;

  let unpaidTotal = 0;
  const unpaidCustomersSet = new Set();

  const now = new Date();
  for (const saleId in sales) {
    const sale = sales[saleId];
    const createdAt = new Date(
      sale.createdAt || sale.dateAdded || sale.date || ""
    );
    if (isNaN(createdAt)) continue;

    const grandTotal = Number(sale.grandTotal) || 0;

    if (
      createdAt.getFullYear() === now.getFullYear() &&
      createdAt.getMonth() === now.getMonth() &&
      createdAt.getDate() === now.getDate()
    ) {
      salesToday += grandTotal;
    }
    if (
      createdAt.getFullYear() === now.getFullYear() &&
      createdAt.getMonth() === now.getMonth()
    ) {
      salesMonth += grandTotal;
    }
    if (createdAt.getFullYear() === now.getFullYear()) {
      salesYear += grandTotal;
    }

    if (sale.payment && sale.payment.status === "left") {
      unpaidTotal += Number(sale.payment.amountLeft) || 0;

      const cust = sale.customerInfo || {};
      let custId = cust.phone || cust.email || cust.name || saleId;
      unpaidCustomersSet.add(custId);
    }
  }

  document.getElementById("sales-today").textContent = salesToday.toFixed(2);
  document.getElementById("sales-month").textContent = salesMonth.toFixed(2);
  document.getElementById("sales-year").textContent = salesYear.toFixed(2);

  document.getElementById("unpaid-total").textContent = unpaidTotal.toFixed(2);
  document.getElementById("pending-count").textContent =
    unpaidCustomersSet.size;
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
