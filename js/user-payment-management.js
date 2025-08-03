import { auth, database } from "./firebase-config.js";
import { renderUserSidebar } from "./user-sidebar-navigation.js";
import { requireAuth } from "./auth.js";

requireAuth(); // Ensure user is authenticated

// --- DOM Elements ---
const unpaidTotalEl = document.getElementById("unpaid-total");
const pendingCountEl = document.getElementById("pending-count");
const paymentsTableBody = document.getElementById("payments-table-body");

const modal = document.getElementById("updatePaymentModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const updatePaymentForm = document.getElementById("update-payment-form");
const amountPaidInput = document.getElementById("amountPaidInput");
const saleDescriptionInput = document.getElementById("saleDescriptionInput");
const maxAmountLabel = document.getElementById("maxAmountLabel");

const filterForm = document.getElementById("filterForm");
const searchInput = document.getElementById("searchInput");
const customerTypeFilter = document.getElementById("customerTypeFilter");
const minAmountFilter = document.getElementById("minAmountFilter");
const maxAmountFilter = document.getElementById("maxAmountFilter");
const dateFromFilter = document.getElementById("dateFromFilter");
const dateToFilter = document.getElementById("dateToFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

let allSales = [];
let selectedSale = null;
let isLoadingSales = false;
let currentUser = null; // Declare currentUser

// Initialize
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    renderUserSidebar("sidebar-container", user.email);
    await loadSales();
  } else {
    window.location.href = "index.html";
  }
});

async function loadSales() {
  isLoadingSales = true;
  // Display loading message
  paymentsTableBody.innerHTML =
    '<tr><td colspan="10" style="text-align:center;color:#888;">Loading payments...</td></tr>'; // Adjusted colspan

  const snapshot = await database.ref("sales").once("value");
  const data = snapshot.val() || {};

  allSales = Object.entries(data)
    .map(([id, sale]) => ({ saleId: id, ...sale }))
    .filter((sale) => Number(sale.payment?.amountLeft || 0) > 0);

  renderTable(allSales);
  updateSummary(allSales);
  isLoadingSales = false;
}

window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out to 80%
  } else {
    document.body.style.zoom = "80%"; // Zoom out to 80%
  }
});

function renderTable(sales) {
  paymentsTableBody.innerHTML = sales.length
    ? sales
        .map((sale) => {
          const {
            saleId,
            createdAt,
            grandTotal = 0,
            discountAmount = 0,
            payment = {},
            salesType = "N/A",
            customerInfo = {},
          } = sale;

          return `
          <tr>
            <td>${escapeHtml(
              customerInfo.pharmacyName || customerInfo.name || "N/A"
            )}</td>
            <td>${escapeHtml(customerInfo.phone || "N/A")}</td>
            <td>${new Date(createdAt).toLocaleDateString()}</td>
            <td>${escapeHtml(salesType)}</td>
            <td>${Number(grandTotal).toFixed(2)}</td>
            <td>${Number(discountAmount).toFixed(2)}</td>
            <td>${Number(payment.amountPaid || 0).toFixed(2)}</td>
            <td>${Number(payment.amountLeft || 0).toFixed(2)}</td>
            <td>${escapeHtml(saleId)}</td>
            <td><button class="btn-update" data-id="${saleId}">Update</button></td>
          </tr>
        `;
        })
        .join("")
    : `<tr><td colspan="10" style="text-align:center;color:#888;">No pending payments</td></tr>`; // Adjusted colspan

  document.querySelectorAll(".btn-update").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (isLoadingSales) {
        // Use a modal for alerts
        showInfoModal(
          "Loading",
          "Please wait until payments are fully loaded."
        );
        return;
      }
      onEditClick(btn.dataset.id);
    })
  );
}

function updateSummary(sales) {
  const unpaidTotal = sales.reduce(
    (sum, s) => sum + Number(s.payment?.amountLeft || 0),
    0
  );
  const customers = new Set(
    sales.map((s) => s.customerInfo?.name || s.customerInfo?.pharmacyName)
  );
  unpaidTotalEl.textContent = unpaidTotal.toFixed(2);
  pendingCountEl.textContent = customers.size;
}

function escapeHtml(str) {
  if (typeof str !== "string") return str; // Handle non-string inputs
  return str?.replace(
    /[&<>"']/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
        tag
      ] || tag)
  );
}

async function onEditClick(saleId) {
  const ref = database.ref(`sales/${saleId}`);
  let snap = await ref.once("value");
  let data = snap.val();

  if (!data) {
    // Wait and retry once
    await new Promise((res) => setTimeout(res, 500));
    snap = await ref.once("value");
    data = snap.val();
  }

  if (!data || !data.payment) {
    showInfoModal("Error", "Sale not found or payment data is missing.");
    return;
  }

  selectedSale = { id: saleId, ...data };

  const left = Number(data.payment.amountLeft || 0);
  maxAmountLabel.textContent = `(Max: Rs. ${left.toFixed(2)})`;
  amountPaidInput.value = "";
  saleDescriptionInput.value = "";
  amountPaidInput.max = left;
  amountPaidInput.min = 1;
  updatePaymentForm.querySelector("button[type=submit]").disabled = true;

  modal.style.display = "flex"; // Show the modal
  modal.classList.add("active"); // Add active class for CSS transition
  amountPaidInput.focus();
}

amountPaidInput.addEventListener("input", () => {
  const val = parseFloat(amountPaidInput.value);
  updatePaymentForm.querySelector("button[type=submit]").disabled =
    isNaN(val) || val <= 0 || val > Number(amountPaidInput.max);
});

updatePaymentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const paid = parseFloat(amountPaidInput.value);
  const note = saleDescriptionInput.value.trim();

  if (!selectedSale || isNaN(paid)) {
    showInfoModal("Validation Error", "Please enter a valid amount to pay.");
    return;
  }

  try {
    const ref = database.ref(`sales/${selectedSale.id}`);

    // Fetch fresh data before updating (avoid stale data)
    const snap = await ref.once("value");
    const freshData = snap.val();
    if (!freshData) {
      showInfoModal("Error", "Sale not found before update. Please try again.");
      return;
    }

    const newPaid = Number(freshData.payment.amountPaid || 0) + paid;
    const newLeft = Number(freshData.payment.amountLeft || 0) - paid;

    if (newPaid > freshData.grandTotal + 0.01 || newLeft < -0.01) {
      // Allow for tiny floating point errors
      showInfoModal(
        "Invalid Amount",
        "Invalid payment amount. Overpayment detected or amount exceeds remaining balance."
      );
      return;
    }

    const updatedData = {
      ...freshData,
      payment: {
        ...freshData.payment,
        amountPaid: newPaid,
        amountLeft: newLeft < 0.01 ? 0 : newLeft, // Ensure amountLeft is 0 if very small negative
        status: newLeft < 0.01 ? "paid" : "left", // Mark as paid if amount left is negligible
      },
    };

    if (note) {
      updatedData.paymentNotes = [
        ...(freshData.paymentNotes || []),
        {
          text: note,
          timestamp: new Date().toISOString(),
          paidAmount: paid,
          updatedBy: currentUser.email,
        },
      ];
    }

    await ref.set(updatedData);

    // After successful update, reload sales before closing modal and alert
    await loadSales();

    selectedSale = null;
    modal.classList.remove("active"); // Hide modal with CSS transition

    showInfoModal("Success", "Payment updated successfully.");
  } catch (err) {
    console.error("Update error:", err);
    showInfoModal("Error", `Failed to update payment: ${err.message}`);
  }
});

modalCloseBtn.addEventListener("click", () => {
  selectedSale = null;
  modal.classList.remove("active"); // Hide modal with CSS transition
});

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    selectedSale = null;
    modal.classList.remove("active"); // Hide modal with CSS transition
  }
});

filterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  applyFilters();
});

clearFiltersBtn.addEventListener("click", () => {
  filterForm.reset();
  renderTable(allSales);
  updateSummary(allSales);
});

function applyFilters() {
  let filtered = [...allSales];
  const search = searchInput.value.trim().toLowerCase();
  const custType = customerTypeFilter.value.toLowerCase();
  const min = parseFloat(minAmountFilter.value);
  const max = parseFloat(maxAmountFilter.value);
  const from = dateFromFilter.value ? new Date(dateFromFilter.value) : null;
  const to = dateToFilter.value ? new Date(dateToFilter.value) : null;

  if (search) {
    filtered = filtered.filter((s) =>
      [
        s.customerInfo?.name,
        s.customerInfo?.pharmacyName,
        s.customerInfo?.phone,
        s.saleId,
      ].some((f) => f?.toLowerCase().includes(search))
    );
  }
  if (custType) {
    filtered = filtered.filter(
      (s) => s.customerInfo?.type?.toLowerCase() === custType
    );
  }
  if (!isNaN(min)) {
    filtered = filtered.filter(
      (s) => Number(s.payment?.amountLeft || 0) >= min
    );
  }
  if (!isNaN(max)) {
    filtered = filtered.filter(
      (s) => Number(s.payment?.amountLeft || 0) <= max
    );
  }
  if (from) {
    // Set time to start of day for 'from' filter
    const fromDate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    );
    filtered = filtered.filter((s) => new Date(s.createdAt) >= fromDate);
  }
  if (to) {
    // Set time to end of day for 'to' filter
    const toDate = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      23,
      59,
      59,
      999
    );
    filtered = filtered.filter((s) => new Date(s.createdAt) <= toDate);
  }

  renderTable(filtered);
  updateSummary(filtered);
}

// --- Modal Functions (Copied from previous interactions for consistency) ---
const infoModal = document.getElementById("info-modal");
const infoModalTitle = document.getElementById("info-modal-title");
const infoModalBody = document.getElementById("info-modal-body");
const infoModalOkBtn = document.getElementById("info-modal-ok");

const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalBody = document.getElementById("confirm-modal-body");
const confirmModalOkBtn = document.getElementById("confirm-ok");
const confirmModalCancelBtn = document.getElementById("confirm-cancel");

/**
 * Shows a custom info/alert modal.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message to display.
 * @returns {Promise<void>} A promise that resolves when the user clicks OK or closes the modal.
 */
function showInfoModal(title, message) {
  return new Promise((resolve) => {
    infoModalTitle.textContent = title;
    infoModalBody.textContent = message;
    infoModal.classList.add("active");
    infoModal.resolvePromise = resolve; // Store the resolve function
  });
}

/**
 * Shows a custom confirmation modal.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message to display.
 * @returns {Promise<boolean>} A promise that resolves with true if 'Yes', false if 'Cancel' or modal closed.
 */
function showConfirmModal(title, message) {
  return new Promise((resolve, reject) => {
    confirmModalTitle.textContent = title;
    confirmModalBody.textContent = message;
    confirmModal.classList.add("active");
    confirmModal.resolvePromise = resolve; // Store the resolve function
    confirmModal.rejectPromise = reject; // Store reject function for closing via X/backdrop
  });
}
