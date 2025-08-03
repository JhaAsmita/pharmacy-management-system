// This script, `billing.js`, is the core for the billing and point-of-sale (POS) functionality of a pharmacy management system.
// It handles user authentication, fetching product data, managing the billing table, processing sales, and generating invoices.

// --- Module Imports ---
// Import Firebase authentication and database services.
import { auth, database } from "./firebase-config.js";
// Import a custom module to render the admin sidebar navigation.
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";
// Import a custom module to ensure the user is authenticated, redirecting them if they are not.
import { requireAuth } from "./auth.js";

// Immediately check for authentication; if the user is not logged in, they will be redirected.
requireAuth();

// --- Global State Variables ---
// `medicinesData`: An object that will store all medicine data fetched from the Firebase database.
// It is used for searching and populating the billing table.
let medicinesData = {};
// `pharmacyDetailsList`: An object storing details of all B2B customers (pharmacies).
// It's used for the B2B customer search feature.
let pharmacyDetailsList = {};
// `currentUser`: Stores the authenticated Firebase user object after successful login.
let currentUser = null;

// `lineItems`: An array of objects representing the items currently added to the bill.
// Each object contains the medicine's ID, its data, and the quantity being sold.
let lineItems = [];
// `isProcessingSale`: A boolean flag to prevent users from submitting the same sale multiple times.
// It is set to `true` when a sale starts and `false` when it's completed.
let isProcessingSale = false;

// --- DOM Element References ---
// These variables store references to key HTML elements, making them easy to access and manipulate throughout the script.
const searchEl = document.getElementById("medicine-search"); // The search input field for medicines.
const suggestionBox = document.getElementById("suggestions"); // The container for search suggestions.
const billingTableBody = document.querySelector("#billing-table tbody"); // The `<tbody>` element of the billing table.
const printInvoiceBtn = document.getElementById("print-invoice-btn"); // The button to finalize the sale.

const salesTypeSelect = document.getElementById("sales-type"); // Dropdown to select "retail" or "b2b" sales.
const retailInfoContainer = document.getElementById("retail-customer-info"); // Container for retail customer inputs.
const b2bInfoContainer = document.getElementById("b2b-customer-info"); // Container for B2B customer inputs.
const b2bSearchInput = document.getElementById("b2b-search"); // Search input for B2B customers.
const b2bSuggestionBox = document.getElementById("b2b-suggestions"); // Container for B2B customer suggestions.
const b2bDetailsContent = document.getElementById("b2b-details-content"); // Area to display details of a selected B2B customer.

const discountInput = document.getElementById("discount"); // Input for discount percentage.
const vatInput = document.getElementById("vat"); // Input for VAT percentage.

const paymentTypeSelect = document.getElementById("payment-type"); // Dropdown for payment method (e.g., Cash, Card).
const paymentStatusSelect = document.getElementById("payment-status"); // Dropdown for payment status (e.g., Paid, Left).
const amountPaidInput = document.getElementById("amount-paid"); // Input for the amount paid.
const amountPaidGroup = document.getElementById("amount-paid-group"); // Container for the amount paid input.
const amountLeftInput = document.getElementById("amount-left"); // Input for the remaining amount.
const amountLeftGroup = document.getElementById("amount-left-group"); // Container for the amount left input.

// Modal Elements - References to the info and confirmation modals and their components.
const infoModal = document.getElementById("info-modal"); // The info modal container.
const infoModalTitle = document.getElementById("info-modal-title"); // The title of the info modal.
const infoModalBody = document.getElementById("info-modal-body"); // The body/message of the info modal.
const infoModalOkBtn = document.getElementById("info-modal-ok"); // The "OK" button for the info modal.

const confirmModal = document.getElementById("confirm-modal"); // The confirmation modal container.
const confirmModalTitle = document.getElementById("confirm-modal-title"); // The title of the confirmation modal.
const confirmModalBody = document.getElementById("confirm-modal-body"); // The body/message of the confirmation modal.
const confirmModalOkBtn = document.getElementById("confirm-ok"); // The "OK" button for the confirmation modal.
const confirmModalCancelBtn = document.getElementById("confirm-cancel"); // The "Cancel" button for the confirmation modal.

// --- Initialization and Data Loading ---
// This block runs when the user's authentication state changes. It's the main entry point for the app's logic.
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user; // Set the current user.
    renderAdminSidebar("sidebar-container", user.email || user.displayName); // Render the sidebar with the user's details.

    // Fetch all medicine data from Firebase once, as it's a large dataset.
    const medsSnap = await database.ref("medicines").once("value");
    medicinesData = medsSnap.val() || {};

    // Fetch all pharmacy details (B2B customers) from Firebase once.
    const pharmSnap = await database.ref("pharmacyDetailsList").once("value");
    pharmacyDetailsList = pharmSnap.val() || {};

    // Once all data is loaded, set up the interactive event listeners.
    setupEventListeners();
  } else {
    // If no user is logged in, `requireAuth()` will redirect them to the login page.
  }
});

// `DOMContentLoaded` listener for general page setup, separate from auth state.
document.addEventListener("DOMContentLoaded", () => {
  // Zoom out the page on certain screen sizes for better visibility.
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%";
  } else {
    document.body.style.zoom = "80%";
  }

  // A second `auth.onAuthStateChanged` block to handle admin-specific access control.
  // This is a safety measure to ensure only admins can use this page.
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html"; // Redirect to login if no user.
      return;
    }

    // Fetch the user's role from the database.
    const roleSnapshot = await database
      .ref(`users/${user.uid}/role`)
      .once("value");
    const role = roleSnapshot.val();

    // If the user is not an admin, deny access and log them out.
    if (role !== "admin") {
      alert("Access denied. Admins only.");
      logout(); // logout() function is not defined in this snippet but assumed to exist in auth.js or globally.
      return;
    }

    // Update the sidebar and user information on the page.
    renderAdminSidebar(
      "sidebar-container",
      user.email || user.displayName || "Admin"
    );

    document.getElementById("user-name").textContent =
      user.displayName || "Admin User";
    document.getElementById("user-email").textContent = user.email || "-";
    document.getElementById("user-role").textContent = role || "-";

    // Add event listener for the logout button.
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      logout();
    });

    // Assumed function to load dashboard stats (not relevant to billing but included in original code).
    await loadDashboardStats();
  });
});

// --- Event Listeners Setup ---
function setupEventListeners() {
  // `salesTypeSelect` listener: Shows/hides retail or B2B customer info based on the selected sales type.
  salesTypeSelect.addEventListener("change", () => {
    const type = salesTypeSelect.value;
    retailInfoContainer.style.display = type === "retail" ? "block" : "none";
    b2bInfoContainer.style.display = type === "b2b" ? "block" : "none";
  });

  // `searchEl` listener: Handles medicine search.
  searchEl.addEventListener("input", () => {
    suggestionBox.innerHTML = ""; // Clear previous suggestions.
    const q = searchEl.value.trim().toLowerCase();
    if (!q) {
      suggestionBox.style.display = "none";
      return;
    }

    // Filter `medicinesData` for matching names, ensuring quantity is > 0 and expiry is at least 10 days away.
    const matches = Object.entries(medicinesData)
      .filter(
        ([_, m]) => m.name?.toLowerCase().includes(q) && (m.quantity ?? 0) > 0
      )
      .filter(([_, m]) => {
        const expiryDate = new Date(m.expiry);
        const today = new Date();
        const diffDays = (expiryDate - today) / (1000 * 60 * 60 * 24);
        return diffDays >= 10;
      });

    suggestionBox.style.display = matches.length ? "block" : "none";

    // Create and append suggestion items to the suggestion box.
    matches.slice(0, 20).forEach(([id, m]) => {
      const div = document.createElement("div");
      div.classList.add("suggestion-item");
      div.innerHTML = `<strong>${m.name} || Expiry: ${
        m.expiry || "N/A"
      } || Qty: ${m.quantity ?? 0} || Rack: ${m.rack || "N/A"} || Category: ${
        m.category || "N/A"
      } || ${m.supplierName || m.supplier || "N/A"}</strong>
      <div class="suggestion-desc">${m.description || ""}</div>`;
      div.dataset.id = id;
      suggestionBox.appendChild(div);
    });
  });

  // `suggestionBox` listener: Handles clicks on medicine suggestions.
  suggestionBox.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (item?.dataset.id) {
      const id = item.dataset.id;
      const med = medicinesData[id];
      const expiryDate = new Date(med.expiry);
      const today = new Date();
      const diffDays = (expiryDate - today) / (1000 * 60 * 60 * 24);

      // Prevent adding medicines with an expiry date less than 10 days from now.
      if (diffDays < 10) {
        showInfoModal(
          "Expired/Near Expiry",
          "Cannot add expired or near-expiry medicine (less than 10 days remaining)."
        );
        return;
      }

      addLineItem(id, med); // Add the selected item to the bill.
      searchEl.value = "";
      suggestionBox.innerHTML = "";
      suggestionBox.style.display = "none";
    }
  });

  // `b2bSearchInput` listener: Handles search for B2B customers.
  b2bSearchInput.addEventListener("input", () => {
    b2bSuggestionBox.innerHTML = "";
    const q = b2bSearchInput.value.trim().toLowerCase();
    if (!q) {
      b2bSuggestionBox.style.display = "none";
      return;
    }

    // Filter `pharmacyDetailsList` for matches and display them as suggestions.
    const matches = Object.values(pharmacyDetailsList).filter(
      (p) =>
        p.pharmacyName?.toLowerCase().includes(q) ||
        p.ownerName?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
    );

    b2bSuggestionBox.style.display = matches.length ? "block" : "none";

    matches.slice(0, 20).forEach((p) => {
      const div = document.createElement("div");
      div.classList.add("b2b-suggestion-item");
      div.innerHTML = `<strong>${p.pharmacyName}</strong>
        <div class="b2b-suggestion-details">
          <span>Owner: ${p.ownerName}</span>
          <span>Phone: ${p.phone}</span>
          <span>Address: ${p.address}</span>
          <span>Email: ${p.email}</span>
          <span>Reg#: ${p.registrationNumber}</span>
        </div>`;
      div.dataset.name = p.pharmacyName;
      div.dataset.details = JSON.stringify(p);
      b2bSuggestionBox.appendChild(div);
    });
  });

  // `b2bSuggestionBox` listener: Fills customer details when a B2B suggestion is clicked.
  b2bSuggestionBox.addEventListener("click", (e) => {
    const item = e.target.closest(".b2b-suggestion-item");
    if (item) {
      b2bSearchInput.value = item.dataset.name;
      b2bSuggestionBox.innerHTML = "";
      b2bSuggestionBox.style.display = "none";

      const p = JSON.parse(item.dataset.details || "{}");
      b2bDetailsContent.innerHTML = `
        <div><strong>Owner:</strong> ${p.ownerName || "N/A"}</div>
        <div><strong>Phone:</strong> ${p.phone || "N/A"}</div>
        <div><strong>Address:</strong> ${p.address || "N/A"}</div>
        <div><strong>Email:</strong> ${p.email || "N/A"}</div>
        <div><strong>Reg. No:</strong> ${p.registrationNumber || "N/A"}</div>
      `;
    }
  });

  // `discountInput` and `vatInput` listeners: Recalculate the grand total whenever these values change.
  discountInput.addEventListener("input", () => {
    const subTotal = lineItems.reduce(
      (acc, li) => acc + li.qty * li.med.sellingPrice,
      0
    );
    calculateAndUpdateGrandTotal(subTotal);
  });
  vatInput.addEventListener("input", () => {
    const subTotal = lineItems.reduce(
      (acc, li) => acc + li.qty * li.med.sellingPrice,
      0
    );
    calculateAndUpdateGrandTotal(subTotal);
  });

  // `paymentStatusSelect` listener: Toggles the visibility of "amount paid" and "amount left" inputs.
  paymentStatusSelect.addEventListener("change", () => {
    if (paymentStatusSelect.value === "left") {
      amountPaidGroup.style.display = "flex";
      amountLeftGroup.style.display = "flex";
      amountPaidInput.value = "";
      amountLeftInput.value = "";
    } else {
      amountPaidGroup.style.display = "none";
      amountLeftGroup.style.display = "none";
      amountPaidInput.value = "";
      amountLeftInput.value = "0.00";
    }
    const subTotal = lineItems.reduce(
      (acc, li) => acc + li.qty * li.med.sellingPrice,
      0
    );
    calculateAndUpdateGrandTotal(subTotal);
  });

  // `amountPaidInput` listener: Automatically calculates the "amount left" as the user types.
  amountPaidInput.addEventListener("input", () => {
    const totalText = document.getElementById("grand-total").textContent || "";
    const total = parseFloat(totalText.replace(/[^\d.-]/g, "")) || 0;
    const paid = parseFloat(amountPaidInput.value) || 0;
    const left = total - paid;
    amountLeftInput.value = left >= 0 ? left.toFixed(2) : "0.00";
  });

  // `printInvoiceBtn` listener: Calls the main function to handle the entire sale process.
  printInvoiceBtn.onclick = handlePrintInvoice;

  // Generic modal close button listeners.
  document.querySelectorAll(".close-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const modalId = e.target.dataset.modalId;
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        modalElement.classList.remove("active");
        if (modalElement.resolvePromise) {
          modalElement.resolvePromise(false); // Resolve promise with `false` if the modal is closed via the button.
          modalElement.resolvePromise = null;
        }
        if (modalElement.rejectPromise) {
          modalElement.rejectPromise();
          modalElement.rejectPromise = null;
        }
      }
    });
  });

  // `modal-container` listener: Closes the modal if the user clicks outside of it.
  document.querySelectorAll(".modal-container").forEach((modalContainer) => {
    modalContainer.addEventListener("click", (e) => {
      if (e.target === modalContainer) {
        modalContainer.classList.remove("active");
        if (modalContainer.resolvePromise) {
          modalContainer.resolvePromise(false);
          modalContainer.resolvePromise = null;
        }
        if (modalContainer.rejectPromise) {
          modalContainer.rejectPromise();
          modalContainer.rejectPromise = null;
        }
      }
    });
  });

  // `infoModalOkBtn` listener: Closes the info modal and resolves its promise.
  infoModalOkBtn.addEventListener("click", () => {
    infoModal.classList.remove("active");
    if (infoModal.resolvePromise) {
      infoModal.resolvePromise();
      infoModal.resolvePromise = null;
    }
  });

  // `keydown` listener: Prevents form submission on "Enter" and handles closing modals with the Enter key.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (infoModal.classList.contains("active")) {
        e.preventDefault();
        infoModalOkBtn.click();
        return;
      }
      if (confirmModal.classList.contains("active")) {
        e.preventDefault();
        confirmModalOkBtn.click();
        return;
      }
      // e.preventDefault(); // Optional line to prevent all 'Enter' key form submissions.
    }
  });

  // `confirmModalOkBtn` listener: Resolves the confirmation modal's promise with `true`.
  confirmModalOkBtn.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    if (confirmModal.resolvePromise) {
      confirmModal.resolvePromise(true);
      confirmModal.resolvePromise = null;
      confirmModal.rejectPromise = null;
    }
  });
  // `confirmModalCancelBtn` listener: Resolves the confirmation modal's promise with `false`.
  confirmModalCancelBtn.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    if (confirmModal.resolvePromise) {
      confirmModal.resolvePromise(false);
      confirmModal.resolvePromise = null;
      confirmModal.rejectPromise = null;
    }
  });
}

// --- Modal Functions ---
// These functions use Promises to create a modal-based workflow, allowing the code to pause and wait for user interaction.

// `showInfoModal`: Displays a modal with a title and message. Returns a Promise that resolves when the user clicks "OK".
function showInfoModal(title, message) {
  return new Promise((resolve) => {
    infoModalTitle.textContent = title;
    infoModalBody.textContent = message;
    infoModal.classList.add("active");
    infoModal.resolvePromise = resolve;
    infoModalOkBtn.focus();
  });
}

// `showConfirmModal`: Displays a modal with "OK" and "Cancel" buttons. Returns a Promise that resolves to `true` or `false`.
function showConfirmModal(title, message) {
  return new Promise((resolve, reject) => {
    confirmModalTitle.textContent = title;
    confirmModalBody.textContent = message;
    confirmModal.classList.add("active");
    confirmModal.resolvePromise = resolve;
    confirmModal.rejectPromise = reject;
    confirmModalOkBtn.focus();
  });
}

// --- Cart Handling ---
// `addLineItem`: Adds a medicine to the `lineItems` array.
// It checks for stock availability and adds to the quantity if the item is already in the cart.
function addLineItem(id, med) {
  const idx = lineItems.findIndex((li) => li.id === id);
  if (idx > -1) {
    // If the item exists, increment the quantity.
    if (lineItems[idx].qty + 1 > (med.quantity ?? 0)) {
      // Check for stock limit.
      showInfoModal(
        "Stock Limit",
        `Cannot add more ${med.name}. Only ${med.quantity ?? 0} in stock.`
      );
      return;
    }
    lineItems[idx].qty++;
  } else {
    // If the item is new, add it to the array.
    if ((med.quantity ?? 0) === 0) {
      showInfoModal("Out of Stock", `${med.name} is out of stock.`);
      return;
    }
    lineItems.push({ id, med, qty: 1 });
  }
  renderTable(); // Update the billing table display.
}

// `renderTable`: Renders the `lineItems` array into the HTML billing table.
// It also calculates the subtotal and attaches event listeners to the quantity inputs and remove buttons.
function renderTable() {
  billingTableBody.innerHTML = "";
  let subTotal = 0;

  if (lineItems.length === 0) {
    // Display a message if no items are in the bill.
    billingTableBody.innerHTML =
      '<tr><td colspan="12" style="text-align: center;">No items added to the bill.</td></tr>';
    calculateAndUpdateGrandTotal(0);
    return;
  }

  // Loop through `lineItems` and create a table row for each.
  lineItems.forEach((li, i) => {
    const total = li.qty * li.med.sellingPrice;
    subTotal += total;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(li.med.name)}</td>
      <td><input type="number" min="1" max="${li.med.quantity ?? 0}" value="${
      li.qty
    }" class="qty-input"  style="width:auto;" data-id="${li.id}"></td>
      <td>${escapeHtml(li.med.expiry || "")}</td>
      <td>${escapeHtml(li.med.rack || "")}</td>
      <td>${escapeHtml(li.med.category || "")}</td>
      <td>${escapeHtml(li.med.description || "")}</td>
      <td>Rs ${li.med.sellingPrice.toFixed(2)}</td>
      <td>${li.med.quantity ?? 0}</td>
      <td>Rs ${total.toFixed(2)}</td>
      <td><button class="action-btn remove-btn" data-id="${
        li.id
      }">Remove</button></td>
    `;
    billingTableBody.appendChild(tr);
  });

  // Add `onchange` listener to each quantity input to update the quantity and re-render the table.
  document.querySelectorAll(".qty-input").forEach((input) => {
    input.onchange = () => {
      const id = input.dataset.id;
      const li = lineItems.find((x) => x.id === id);
      if (li) {
        const stock = li.med.quantity ?? 0;
        let val = Math.max(1, parseInt(input.value) || 1);
        val = Math.min(val, stock); // Ensure quantity does not exceed stock.
        if (val !== li.qty) {
          li.qty = val;
          input.value = val;
          renderTable();
        }
      }
    };
  });

  // Add `onclick` listener to each remove button. It shows a confirmation modal before removing the item.
  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.onclick = () => {
      showConfirmModal(
        "Remove Item",
        "Are you sure you want to remove this item from the bill?"
      ).then((confirmed) => {
        if (confirmed) {
          lineItems = lineItems.filter((x) => x.id !== btn.dataset.id);
          renderTable(); // Re-render the table after removal.
        }
      });
    };
  });

  calculateAndUpdateGrandTotal(subTotal); // Update the final totals.
}

// `calculateAndUpdateGrandTotal`: Calculates and updates the grand total based on subtotal, discount, and VAT.
function calculateAndUpdateGrandTotal(subTotal) {
  const discountPercent = parseFloat(discountInput.value) || 0;
  const vatPercent = parseFloat(vatInput.value) || 0;
  const discountAmt = (subTotal * discountPercent) / 100;
  const vatAmt = ((subTotal - discountAmt) * vatPercent) / 100;
  const grandTotal = subTotal - discountAmt + vatAmt;

  document.getElementById("grand-total").textContent = `Rs ${grandTotal.toFixed(
    2
  )}`;

  // Update the amount left if the payment status is "left".
  if (paymentStatusSelect.value === "left") {
    const paid = parseFloat(amountPaidInput.value) || 0;
    const left = grandTotal - paid;
    amountLeftInput.value = left >= 0 ? left.toFixed(2) : "0.00";
  } else {
    amountLeftInput.value = "0.00";
  }
}

// --- Invoice Handling ---
// `handlePrintInvoice`: The main function to process a sale.
// It performs extensive validation, saves the data to Firebase, updates stock, and generates an invoice.
async function handlePrintInvoice() {
  // Check the `isProcessingSale` flag to prevent duplicate submissions.
  if (isProcessingSale) {
    console.log("Sale already in progress. Please wait.");
    return;
  }
  isProcessingSale = true; // Set the flag.

  try {
    const type = salesTypeSelect.value;
    // --- Validation Checks ---
    if (!type) {
      await showInfoModal(
        "Validation Error",
        "Please select Retail or B2B first."
      );
      return;
    }
    if (!lineItems.length) {
      await showInfoModal(
        "Validation Error",
        "No medicines added to the bill!"
      );
      return;
    }
    // Validate retail customer information.
    if (type === "retail") {
      const custName = document
        .getElementById("retail-customer-name")
        .value.trim();
      const custPhone = document
        .getElementById("retail-customer-phone")
        .value.trim();

      if (!custName) {
        await showInfoModal(
          "Validation Error",
          "Please enter retail customer name."
        );
        return;
      }
      if (!/^[A-Za-z\s]{1,200}$/.test(custName)) {
        await showInfoModal(
          "Validation Error",
          "Customer name must be alphabets & spaces only (max 200 characters)."
        );
        return;
      }
      if (custPhone && !/^\d{1,14}$/.test(custPhone)) {
        await showInfoModal(
          "Validation Error",
          "Customer phone must be numbers only (max 14 digits)."
        );
        return;
      }
    }
    // Validate B2B customer information.
    if (type === "b2b") {
      const name = b2bSearchInput.value.trim();
      const found = Object.values(pharmacyDetailsList).find(
        (p) => p.pharmacyName === name
      );
      if (!found) {
        await showInfoModal(
          "Validation Error",
          "Please select a valid B2B customer from the suggestions."
        );
        return;
      }
    }
    // Validate payment information.
    if (!paymentTypeSelect.value) {
      await showInfoModal("Validation Error", "Please select a payment type.");
      return;
    }
    if (!paymentStatusSelect.value) {
      await showInfoModal(
        "Validation Error",
        "Please select a payment status."
      );
      return;
    }
    if (paymentStatusSelect.value === "left") {
      if (!amountPaidInput.value.trim()) {
        await showInfoModal(
          "Validation Error",
          "Please enter the amount paid."
        );
        return;
      }
      const paid = parseFloat(amountPaidInput.value);
      const totalText =
        document.getElementById("grand-total").textContent || "";
      const total = parseFloat(totalText.replace(/[^\d.-]/g, "")) || 0;

      if (isNaN(paid) || paid < 0 || paid > total) {
        await showInfoModal(
          "Validation Error",
          "Please enter a valid amount paid (must be between 0 and Grand Total)."
        );
        return;
      }
    }
    // Final check for stock availability for each item.
    for (const li of lineItems) {
      if (li.qty > (li.med.quantity ?? 0)) {
        await showInfoModal(
          "Stock Error",
          `Not enough stock for ${li.med.name}. Requested: ${
            li.qty
          }, Available: ${li.med.quantity ?? 0}.`
        );
        return;
      }
    }

    // --- Data Preparation and Storage ---
    // Calculate final totals.
    const subTotal = lineItems.reduce(
      (acc, li) => acc + li.qty * li.med.sellingPrice,
      0
    );
    const discountPercent = parseFloat(discountInput.value) || 0;
    const vatPercent = parseFloat(vatInput.value) || 0;
    const discountAmt = (subTotal * discountPercent) / 100;
    const vatAmt = ((subTotal - discountAmt) * vatPercent) / 100;
    const grandTotal = subTotal - discountAmt + vatAmt;

    // Create the `salesData` object to be saved to the database.
    const salesData = {
      createdAt: new Date().toISOString(),
      soldBy: currentUser?.email || "unknown",
      salesType: type,
      discountPercent,
      vatPercent,
      discountAmount: discountAmt,
      vatAmount: vatAmt,
      subTotal,
      grandTotal,
      payment: {
        type: paymentTypeSelect.value,
        status: paymentStatusSelect.value,
        amountPaid:
          paymentStatusSelect.value === "left"
            ? parseFloat(amountPaidInput.value) || 0
            : grandTotal,
        amountLeft:
          paymentStatusSelect.value === "left"
            ? parseFloat(amountLeftInput.value) || 0
            : 0,
      },
      customerInfo: {},
      items: lineItems.map((li) => ({
        medicineId: li.id,
        name: li.med.name,
        qty: li.qty,
        unitPrice: li.med.sellingPrice,
        totalPrice: li.qty * li.med.sellingPrice,
      })),
    };

    // Add specific customer info based on sales type.
    if (type === "retail") {
      salesData.customerInfo = {
        type: "retail",
        name: document.getElementById("retail-customer-name").value.trim(),
        phone:
          document.getElementById("retail-customer-phone").value.trim() ||
          "N/A",
      };
    } else {
      const name = b2bSearchInput.value.trim();
      const found = Object.values(pharmacyDetailsList).find(
        (p) => p.pharmacyName === name
      );
      salesData.customerInfo = { type: "b2b", ...found };
    }

    // Save the sale record to the `sales` collection in Firebase.
    await database.ref("sales").push(salesData);

    // Update medicine quantities in Firebase and the local `medicinesData` object.
    const updates = {};
    lineItems.forEach((li) => {
      const newQty = (li.med.quantity ?? 0) - li.qty;
      updates[`medicines/${li.id}/quantity`] = newQty;
      medicinesData[li.id].quantity = newQty;
    });
    await database.ref().update(updates);

    // --- Post-Sale Actions ---
    // Show a success message and wait for the user to close the modal.
    await showInfoModal(
      "Sale Completed!",
      "The invoice has been successfully recorded and printed."
    );

    // Open a new window to display and print the invoice.
    openInvoicePrintWindow(salesData);

    // Reset the form and billing table to their initial state.
    lineItems = [];
    renderTable();
    discountInput.value = "0";
    vatInput.value = "0";
    paymentTypeSelect.value = "";
    paymentStatusSelect.value = "";
    amountPaidInput.value = "";
    amountLeftInput.value = "0.00";
    amountPaidGroup.style.display = "none";
    amountLeftGroup.style.display = "none";
    document
      .querySelectorAll("#retail-customer-info input")
      .forEach((i) => (i.value = ""));
    b2bSearchInput.value = "";
    b2bDetailsContent.innerHTML = "";
    salesTypeSelect.value = "";
    retailInfoContainer.style.display = "none";
    b2bInfoContainer.style.display = "none";
  } catch (err) {
    // Catch any errors that occur during the sale process.
    console.error("Error completing sale:", err);
    await showInfoModal("Error", `Failed to complete sale: ${err.message}`);
  } finally {
    isProcessingSale = false; // Reset the flag, allowing new sales to be processed.
  }
}

// `openInvoicePrintWindow`: Creates a new window, generates HTML for an invoice, and opens the print dialog.
function openInvoicePrintWindow(data) {
  // Placeholder pharmacy details. These should ideally be fetched from the database.
  const pharmacy = {
    name: "Your Pharmacy Name",
    owner: "Pharmacy Owner",
    address: "Pharmacy Address, City, Country",
    phone: "98XXXXXXXX",
    email: "your@email.com",
    reg: "PMS-REG-12345",
    hours: "9 AM – 10 PM",
  };

  // Open a new blank window.
  const win = window.open("", "Invoice", "width=800,height=900");
  // Write the complete HTML content for the invoice into the new window.
  win.document.write(`
    <html><head><title>Invoice</title>
      <style>
        /* CSS for the invoice styling, including print-specific rules. */
        body { font-family: 'Poppins', sans-serif; padding: 25px; margin: 0; color: #333; }
        .invoice-container { max-width: 750px; margin: 0 auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 15px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2d7bb1; padding-bottom: 20px;}
        .header h1 { color: #2d7bb1; font-size: 2.5em; margin: 0 0 5px 0; }
        .header p { font-size: 0.9em; margin: 2px 0; color: #555; }
        .invoice-details, .customer-info, .payment-info { margin-bottom: 20px; font-size: 0.95em; line-height: 1.6; }
        .invoice-details div, .customer-info div, .payment-info div { margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 25px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 0.9em; }
        th { background: #2d7bb1; color: white; font-weight: 600; }
        tfoot td { font-weight: 600; background-color: #f9f9f9; }
        .total-row td { font-size: 1.1em; background-color: #e6f2fa; color: #2d7bb1; }
        .text-right { text-align: right; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ccc; font-size: 0.85em; color: #777; }

        @media print {
            body { -webkit-print-color-adjust: exact; } /* Force CSS colors to be printed. */
            .invoice-container { box-shadow: none; border: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <h1>${escapeHtml(pharmacy.name)}</h1>
          <p>Owner: ${escapeHtml(pharmacy.owner)} | Phone: ${escapeHtml(
    pharmacy.phone
  )}</p>
          <p>${escapeHtml(pharmacy.address)} | Email: ${escapeHtml(
    pharmacy.email
  )}</p>
          <p>Reg#: ${escapeHtml(pharmacy.reg)} | Hours: ${escapeHtml(
    pharmacy.hours
  )}</p>
          <h2 style="margin-top:25px; color: #2d7bb1;">TAX INVOICE</h2>
        </div>

        <div class="invoice-details">
          <div><strong>Invoice Date:</strong> ${new Date(
            data.createdAt
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</div>
          <div><strong>Invoice Time:</strong> ${new Date(
            data.createdAt
          ).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}</div>
          <div><strong>Sold By:</strong> ${escapeHtml(data.soldBy)}</div>
          <div><strong>Sales Type:</strong> ${escapeHtml(
            data.salesType.toUpperCase()
          )}</div>
        </div>

        <div class="customer-info">
          <h3>Customer Information:</h3>
          ${
            data.salesType === "retail"
              ? `<div><strong>Name:</strong> ${escapeHtml(
                  data.customerInfo.name
                )}</div>
                 <div><strong>Phone:</strong> ${escapeHtml(
                   data.customerInfo.phone
                 )}</div>`
              : `<div><strong>Pharmacy:</strong> ${escapeHtml(
                  data.customerInfo.pharmacyName || "N/A"
                )}</div>
                 <div><strong>Owner:</strong> ${escapeHtml(
                   data.customerInfo.ownerName || "N/A"
                 )}</div>
                 <div><strong>Phone:</strong> ${escapeHtml(
                   data.customerInfo.phone || "N/A"
                 )}</div>
                 <div><strong>Email:</strong> ${escapeHtml(
                   data.customerInfo.email || "N/A"
                 )}</div>
                 <div><strong>Address:</strong> ${escapeHtml(
                   data.customerInfo.address || "N/A"
                 )}</div>`
          }
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Medicine Name</th>
              <th>Qty</th>
              <th>Unit Price (Rs)</th>
              <th>Total (Rs)</th>
            </tr>
          </thead>
          <tbody>
            ${data.items
              .map(
                (item, i) =>
                  `<tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${item.qty}</td>
                    <td>${item.unitPrice.toFixed(2)}</td>
                    <td>${item.totalPrice.toFixed(2)}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-right">Subtotal:</td>
              <td>Rs ${data.subTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="4" class="text-right">Discount (${
                data.discountPercent
              }%):</td>
              <td>Rs ${data.discountAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="4" class="text-right">VAT (${data.vatPercent}%):</td>
              <td>Rs ${data.vatAmount.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td colspan="4" class="text-right">Grand Total:</td>
              <td>Rs ${data.grandTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="payment-info" style="margin-top: 25px;">
            <div><strong>Payment Type:</strong> ${escapeHtml(
              data.payment.type
            )}</div>
            <div><strong>Payment Status:</strong> ${escapeHtml(
              data.payment.status
            )}</div>
            <div><strong>Amount Paid:</strong> Rs ${data.payment.amountPaid.toFixed(
              2
            )}</div>
            <div><strong>Amount Left:</strong> Rs ${data.payment.amountLeft.toFixed(
              2
            )}</div>
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>This is a computer-generated invoice, no signature is required.</p>
        </div>
      </div>
    </body></html>
  `);
  win.document.close();
  win.print(); // Trigger the browser's print dialog.
}

// --- Utility Functions ---

// `escapeHtml`: A security utility function to prevent Cross-Site Scripting (XSS) attacks.
// It replaces HTML special characters with their entity equivalents.
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
