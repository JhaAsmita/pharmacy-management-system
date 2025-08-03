// Import Firebase authentication and database references from config
import { auth, database } from "./firebase-config.js";

// Import the function to render the admin sidebar navigation UI
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";

// Import the function to ensure user is authenticated before access
import { requireAuth } from "./auth.js";

// Immediately require authentication before anything else runs
requireAuth(); // Ensures only logged-in users can access this script

// --- DOM ELEMENT REFERENCES ---
// Grab elements from the DOM to display totals and manage UI
const unpaidTotalEl = document.getElementById("unpaid-total"); // Displays total unpaid amount
const pendingCountEl = document.getElementById("pending-count"); // Displays count of pending customers
const paymentsTableBody = document.getElementById("payments-table-body"); // Table body to display payment rows

// Modal elements for updating payments
const modal = document.getElementById("updatePaymentModal"); // Modal container element
const modalCloseBtn = document.getElementById("modalCloseBtn"); // Close button for modal
const updatePaymentForm = document.getElementById("update-payment-form"); // Form inside modal to update payments
const amountPaidInput = document.getElementById("amountPaidInput"); // Input for amount paid
const saleDescriptionInput = document.getElementById("saleDescriptionInput"); // Input for payment notes
const maxAmountLabel = document.getElementById("maxAmountLabel"); // Label showing max amount allowed to pay

// Filter form elements for searching and filtering sales
const filterForm = document.getElementById("filterForm"); // The entire filter form element
const searchInput = document.getElementById("searchInput"); // Search text input
const customerTypeFilter = document.getElementById("customerTypeFilter"); // Dropdown to filter by customer type
const minAmountFilter = document.getElementById("minAmountFilter"); // Min amount filter input
const maxAmountFilter = document.getElementById("maxAmountFilter"); // Max amount filter input
const dateFromFilter = document.getElementById("dateFromFilter"); // Start date filter input
const dateToFilter = document.getElementById("dateToFilter"); // End date filter input
const clearFiltersBtn = document.getElementById("clearFiltersBtn"); // Button to clear all filters

// Variables to hold application state
let allSales = []; // Array to hold all sales fetched from database
let selectedSale = null; // Currently selected sale object for updating payment
let isLoadingSales = false; // Flag to indicate loading state
let currentUser = null; // Current logged-in Firebase user info

// Listen for auth state changes - triggered on login/logout or page reload
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // User is logged in
    const usersRef = database.ref("users");
    // Fetch user data from database by uid
    const snapshot = await usersRef.child(user.uid).once("value");
    const userData = snapshot.val();

    if (userData && userData.role === "admin") {
      // User is admin, allow access
      currentUser = user; // Save user info
      renderAdminSidebar("sidebar-container", user.email); // Render sidebar UI for admin
      await loadSales(); // Load sales data from database
      // If you have an event listener setup function for buttons etc., call here
      // e.g. setupEventListeners();
    } else {
      // Not admin, redirect away from page
      window.location.href = "index.html";
    }
  } else {
    // No user logged in, redirect to login/index page
    window.location.href = "index.html";
  }
});

// DOMContentLoaded event to apply zoom based on screen width for UI scaling
window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    // For medium screen sizes, zoom out more
    document.body.style.zoom = "60%";
  } else {
    // For others, zoom out to 80%
    document.body.style.zoom = "80%";
  }
});

// Load sales data from Firebase Realtime Database
async function loadSales() {
  isLoadingSales = true; // Set loading flag
  // Show loading message in table body while data fetches
  paymentsTableBody.innerHTML =
    '<tr><td colspan="10" style="text-align:center;color:#888;">Loading payments...</td></tr>';

  // Fetch all sales snapshot from "sales" node in database
  const snapshot = await database.ref("sales").once("value");
  const data = snapshot.val() || {}; // If no data, default to empty object

  // Convert sales object into array, adding saleId as a property
  // Then filter sales where amountLeft is greater than zero (pending payments only)
  allSales = Object.entries(data)
    .map(([id, sale]) => ({ saleId: id, ...sale }))
    .filter((sale) => Number(sale.payment?.amountLeft || 0) > 0);

  renderTable(allSales); // Render the filtered sales into the table
  updateSummary(allSales); // Update summary stats like unpaid total and customer count
  isLoadingSales = false; // Clear loading flag
}

// Render table rows from given sales data array
function renderTable(sales) {
  // If sales exist, create table rows, else show no pending payments message
  paymentsTableBody.innerHTML = sales.length
    ? sales
        .map((sale) => {
          // Destructure sale properties with defaults
          const {
            saleId,
            createdAt,
            grandTotal = 0,
            discountAmount = 0,
            payment = {},
            salesType = "N/A",
            customerInfo = {},
          } = sale;

          // Return a table row string with escaped and formatted values
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
        .join("") // Join all rows into a single string for innerHTML
    : `<tr><td colspan="10" style="text-align:center;color:#888;">No pending payments</td></tr>`; // No pending payments message

  // Add click event listeners to all "Update" buttons after rendering rows
  document.querySelectorAll(".btn-update").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (isLoadingSales) {
        // If still loading sales, show modal informing user to wait
        showInfoModal(
          "Loading",
          "Please wait until payments are fully loaded."
        );
        return; // Prevent further action
      }
      onEditClick(btn.dataset.id); // Handle update button click with sale ID
    })
  );
}

// Update the summary section with total unpaid amount and number of unique customers
function updateSummary(sales) {
  // Sum amountLeft from all sales for unpaid total
  const unpaidTotal = sales.reduce(
    (sum, s) => sum + Number(s.payment?.amountLeft || 0),
    0
  );
  // Create a Set of unique customer names or pharmacy names for pending count
  const customers = new Set(
    sales.map((s) => s.customerInfo?.name || s.customerInfo?.pharmacyName)
  );
  unpaidTotalEl.textContent = unpaidTotal.toFixed(2); // Update total unpaid display
  pendingCountEl.textContent = customers.size; // Update number of customers display
}

// Escape HTML special characters to prevent XSS attacks
function escapeHtml(str) {
  if (typeof str !== "string") return str; // Return as is if not a string
  return str?.replace(
    /[&<>"']/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
        tag
      ] || tag)
  );
}

// Handler for clicking the "Update" button in a sale row
async function onEditClick(saleId) {
  // Reference the sale by id in Firebase database
  const ref = database.ref(`sales/${saleId}`);
  let snap = await ref.once("value"); // Fetch sale data once
  let data = snap.val();

  if (!data) {
    // If no data, wait 500ms and try fetching again (retry logic)
    await new Promise((res) => setTimeout(res, 500));
    snap = await ref.once("value");
    data = snap.val();
  }

  // If still no data or missing payment info, show error modal
  if (!data || !data.payment) {
    showInfoModal("Error", "Sale not found or payment data is missing.");
    return;
  }

  selectedSale = { id: saleId, ...data }; // Store currently selected sale

  // Extract amount left to pay, display max allowed in modal label
  const left = Number(data.payment.amountLeft || 0);
  maxAmountLabel.textContent = `(Max: Rs. ${left.toFixed(2)})`;

  // Clear inputs in modal form for fresh entry
  amountPaidInput.value = "";
  saleDescriptionInput.value = "";

  // Set min and max attributes on amount paid input to validate range
  amountPaidInput.max = left;
  amountPaidInput.min = 1;

  // Disable submit button initially until valid input entered
  updatePaymentForm.querySelector("button[type=submit]").disabled = true;

  // Show the modal by setting display flex and adding active class for CSS animation
  modal.style.display = "flex";
  modal.classList.add("active");

  // Automatically focus the amount input for user convenience
  amountPaidInput.focus();
}

// Event listener on amount input to enable/disable submit button based on validation
amountPaidInput.addEventListener("input", () => {
  const val = parseFloat(amountPaidInput.value);
  updatePaymentForm.querySelector("button[type=submit]").disabled =
    isNaN(val) || val <= 0 || val > Number(amountPaidInput.max);
});

// Submit event handler for the payment update form
updatePaymentForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // Prevent form default submission behavior

  const paid = parseFloat(amountPaidInput.value); // Get entered paid amount
  const note = saleDescriptionInput.value.trim(); // Get optional payment note text

  if (!selectedSale || isNaN(paid)) {
    // Validate that a sale is selected and amount is valid number
    showInfoModal("Validation Error", "Please enter a valid amount to pay.");
    return;
  }

  try {
    const ref = database.ref(`sales/${selectedSale.id}`);

    // Fetch latest data from database to avoid overwriting concurrent updates
    const snap = await ref.once("value");
    const freshData = snap.val();
    if (!freshData) {
      showInfoModal("Error", "Sale not found before update. Please try again.");
      return;
    }

    // Calculate new paid and left amounts
    const newPaid = Number(freshData.payment.amountPaid || 0) + paid;
    const newLeft = Number(freshData.payment.amountLeft || 0) - paid;

    // Validation: prevent overpayment or negative left amounts (with floating point tolerance)
    if (newPaid > freshData.grandTotal + 0.01 || newLeft < -0.01) {
      showInfoModal(
        "Invalid Amount",
        "Invalid payment amount. Overpayment detected or amount exceeds remaining balance."
      );
      return;
    }

    // Prepare updated payment data with new paid/left amounts and status
    const updatedData = {
      ...freshData,
      payment: {
        ...freshData.payment,
        amountPaid: newPaid,
        amountLeft: newLeft < 0.01 ? 0 : newLeft, // Avoid negative zero
        status: newLeft < 0.01 ? "paid" : "left", // Mark as paid if fully paid
      },
    };

    // Append payment note if provided by user
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

    // Write the updated sale data back to Firebase
    await ref.set(updatedData);

    // Reload sales to update UI with latest data
    await loadSales();

    selectedSale = null; // Clear selected sale state

    // Hide modal with CSS transition
    modal.classList.remove("active");

    // Show success confirmation modal
    showInfoModal("Success", "Payment updated successfully.");
  } catch (err) {
    // Catch and log errors, show error modal
    console.error("Update error:", err);
    showInfoModal("Error", `Failed to update payment: ${err.message}`);
  }
});

// Close modal when clicking close button
modalCloseBtn.addEventListener("click", () => {
  selectedSale = null; // Clear selected sale
  modal.classList.remove("active"); // Hide modal
});

// Close modal when clicking outside modal content (on backdrop)
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    selectedSale = null;
    modal.classList.remove("active");
  }
});

// Handle filter form submission - apply filters and update table
filterForm.addEventListener("submit", (e) => {
  e.preventDefault(); // Prevent page reload
  applyFilters(); // Run filtering logic
});

// Clear filters and reset table and summary
clearFiltersBtn.addEventListener("click", () => {
  filterForm.reset(); // Reset form inputs
  renderTable(allSales); // Render full sales list again
  updateSummary(allSales); // Update summary with full data
});

// Function to apply all filters to the sales list and update table
function applyFilters() {
  let filtered = [...allSales]; // Start with all sales

  // Retrieve filter values from inputs
  const search = searchInput.value.trim().toLowerCase();
  const custType = customerTypeFilter.value.toLowerCase();
  const min = parseFloat(minAmountFilter.value);
  const max = parseFloat(maxAmountFilter.value);
  const from = dateFromFilter.value ? new Date(dateFromFilter.value) : null;
  const to = dateToFilter.value ? new Date(dateToFilter.value) : null;

  // Filter by search keyword against customer name, pharmacy name, phone, or sale ID
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

  // Filter by customer type if selected
  if (custType) {
    filtered = filtered.filter(
      (s) => s.customerInfo?.type?.toLowerCase() === custType
    );
  }

  // Filter by minimum amount left to pay
  if (!isNaN(min)) {
    filtered = filtered.filter(
      (s) => Number(s.payment?.amountLeft || 0) >= min
    );
  }

  // Filter by maximum amount left to pay
  if (!isNaN(max)) {
    filtered = filtered.filter(
      (s) => Number(s.payment?.amountLeft || 0) <= max
    );
  }

  // Filter by createdAt date greater than or equal to 'from' date (start of day)
  if (from) {
    const fromDate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    );
    filtered = filtered.filter((s) => new Date(s.createdAt) >= fromDate);
  }

  // Filter by createdAt date less than or equal to 'to' date (end of day)
  if (to) {
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

  // Render the filtered sales data and update summary accordingly
  renderTable(filtered);
  updateSummary(filtered);
}

// --- Info and Confirmation Modals ---
// Elements related to the custom info modal (for alerts/info)
const infoModal = document.getElementById("info-modal");
const infoModalTitle = document.getElementById("info-modal-title");
const infoModalBody = document.getElementById("info-modal-body");
const infoModalOkBtn = document.getElementById("info-modal-ok");

// Elements related to the custom confirmation modal (for yes/no confirmations)
const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalBody = document.getElementById("confirm-modal-body");
const confirmModalOkBtn = document.getElementById("confirm-ok");
const confirmModalCancelBtn = document.getElementById("confirm-cancel");

/**
 * Shows a custom info/alert modal.
 * Displays a title and message and returns a Promise that resolves when user clicks OK.
 * @param {string} title - Title text for modal header.
 * @param {string} message - Message content for modal body.
 * @returns {Promise<void>} Resolves on user confirmation.
 */
function showInfoModal(title, message) {
  return new Promise((resolve) => {
    infoModalTitle.textContent = title; // Set title text
    infoModalBody.textContent = message; // Set message text
    infoModal.classList.add("active"); // Show modal via CSS class
    infoModal.resolvePromise = resolve; // Store promise resolver for later use
  });
}

/**
 * Shows a custom confirmation modal with Yes/Cancel buttons.
 * Returns a Promise resolving to true if user clicks Yes, false if Cancel or closes modal.
 * @param {string} title - Modal title text.
 * @param {string} message - Modal body message.
 * @returns {Promise<boolean>} Resolves with user's choice.
 */
function showConfirmModal(title, message) {
  return new Promise((resolve, reject) => {
    confirmModalTitle.textContent = title; // Set confirmation modal title
    confirmModalBody.textContent = message; // Set message body
    confirmModal.classList.add("active"); // Show modal
    confirmModal.resolvePromise = resolve; // Store resolve function
    confirmModal.rejectPromise = reject; // Store reject function for modal cancel/close
  });
}
