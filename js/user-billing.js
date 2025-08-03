import { auth, database } from "./firebase-config.js";
import { renderUserSidebar } from "./user-sidebar-navigation.js";
import { requireAuth } from "./auth.js";

requireAuth();

let medicinesData = {};
let pharmacyDetailsList = {};
let currentUser = null;

// --- DOM Elements ---
const searchEl = document.getElementById("medicine-search");
const suggestionBox = document.getElementById("suggestions");
const billingTableBody = document.querySelector("#billing-table tbody");
const printInvoiceBtn = document.getElementById("print-invoice-btn");

const salesTypeSelect = document.getElementById("sales-type");
const retailInfoContainer = document.getElementById("retail-customer-info");
const b2bInfoContainer = document.getElementById("b2b-customer-info");
const b2bSearchInput = document.getElementById("b2b-search");
const b2bSuggestionBox = document.getElementById("b2b-suggestions");
const b2bDetailsContent = document.getElementById("b2b-details-content");

const discountInput = document.getElementById("discount");
const vatInput = document.getElementById("vat");

const paymentTypeSelect = document.getElementById("payment-type");
const paymentStatusSelect = document.getElementById("payment-status");
const amountPaidInput = document.getElementById("amount-paid");
const amountPaidGroup = document.getElementById("amount-paid-group");
const amountLeftInput = document.getElementById("amount-left");
const amountLeftGroup = document.getElementById("amount-left-group");

// Modal Elements
const infoModal = document.getElementById("info-modal");
const infoModalTitle = document.getElementById("info-modal-title");
const infoModalBody = document.getElementById("info-modal-body");
const infoModalOkBtn = document.getElementById("info-modal-ok");

const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalBody = document.getElementById("confirm-modal-body");
const confirmModalOkBtn = document.getElementById("confirm-ok");
const confirmModalCancelBtn = document.getElementById("confirm-cancel");

let lineItems = [];
let isProcessingSale = false; // Flag to prevent multiple submissions

// --- Initialization ---
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    renderUserSidebar("sidebar-container", user.email || user.displayName);

    const medsSnap = await database.ref("medicines").once("value");
    medicinesData = medsSnap.val() || {};

    const pharmSnap = await database.ref("pharmacyDetailsList").once("value");
    pharmacyDetailsList = pharmSnap.val() || {};

    setupEventListeners();
  } else {
    // User is signed out, requireAuth will handle redirection
  }
});

window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out to 80%
  } else {
    document.body.style.zoom = "80%"; // Zoom out to 80%
  }
});

// --- Event Listeners ---
function setupEventListeners() {
  salesTypeSelect.addEventListener("change", () => {
    const type = salesTypeSelect.value;
    retailInfoContainer.style.display = type === "retail" ? "block" : "none";
    b2bInfoContainer.style.display = type === "b2b" ? "block" : "none";
  });

  searchEl.addEventListener("input", () => {
    suggestionBox.innerHTML = "";
    const q = searchEl.value.trim().toLowerCase();
    if (!q) {
      suggestionBox.style.display = "none";
      return;
    }

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

  suggestionBox.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (item?.dataset.id) {
      const id = item.dataset.id;
      const med = medicinesData[id];
      const expiryDate = new Date(med.expiry);
      const today = new Date();
      const diffDays = (expiryDate - today) / (1000 * 60 * 60 * 24);

      if (diffDays < 10) {
        showInfoModal(
          "Expired/Near Expiry",
          "Cannot add expired or near-expiry medicine (less than 10 days remaining)."
        );
        return;
      }

      addLineItem(id, med);
      searchEl.value = "";
      suggestionBox.innerHTML = "";
      suggestionBox.style.display = "none";
    }
  });

  b2bSearchInput.addEventListener("input", () => {
    b2bSuggestionBox.innerHTML = "";
    const q = b2bSearchInput.value.trim().toLowerCase();
    if (!q) {
      b2bSuggestionBox.style.display = "none";
      return;
    }

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

  amountPaidInput.addEventListener("input", () => {
    const totalText = document.getElementById("grand-total").textContent || "";
    const total = parseFloat(totalText.replace(/[^\d.-]/g, "")) || 0;
    const paid = parseFloat(amountPaidInput.value) || 0;
    const left = total - paid;
    amountLeftInput.value = left >= 0 ? left.toFixed(2) : "0.00";
  });

  printInvoiceBtn.onclick = handlePrintInvoice;

  document.querySelectorAll(".close-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const modalId = e.target.dataset.modalId;
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        modalElement.classList.remove("active");
        if (modalElement.resolvePromise) {
          modalElement.resolvePromise(false);
          modalElement.resolvePromise = null;
        }
        if (modalElement.rejectPromise) {
          modalElement.rejectPromise();
          modalElement.rejectPromise = null;
        }
      }
    });
  });

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

  // Handle "Enter" key press specifically for the info modal
  infoModalOkBtn.addEventListener("click", () => {
    infoModal.classList.remove("active");
    if (infoModal.resolvePromise) {
      infoModal.resolvePromise();
      infoModal.resolvePromise = null;
    }
  });

  // Prevent default form submission behaviour for all inputs when Enter is pressed
  // This is a common issue where pressing enter in an input can submit the page
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // If a modal is currently active, prevent default behavior
      if (infoModal.classList.contains("active")) {
        e.preventDefault(); // Stop default form submission
        infoModalOkBtn.click(); // Programmatically click the OK button
        return; // Exit to prevent further processing
      }
      if (confirmModal.classList.contains("active")) {
        e.preventDefault(); // Stop default form submission
        confirmModalOkBtn.click(); // Programmatically click the OK button
        return; // Exit to prevent further processing
      }
      // Optional: Prevent enter key from submitting for other general inputs
      // e.preventDefault();
    }
  });

  confirmModalOkBtn.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    if (confirmModal.resolvePromise) {
      confirmModal.resolvePromise(true);
      confirmModal.resolvePromise = null;
      confirmModal.rejectPromise = null;
    }
  });
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

function showInfoModal(title, message) {
  return new Promise((resolve) => {
    infoModalTitle.textContent = title;
    infoModalBody.textContent = message;
    infoModal.classList.add("active");
    infoModal.resolvePromise = resolve;
    // Set focus to the OK button to allow Enter to close it
    infoModalOkBtn.focus();
  });
}

function showConfirmModal(title, message) {
  return new Promise((resolve, reject) => {
    confirmModalTitle.textContent = title;
    confirmModalBody.textContent = message;
    confirmModal.classList.add("active");
    confirmModal.resolvePromise = resolve;
    confirmModal.rejectPromise = reject;
    // Set focus to the OK button
    confirmModalOkBtn.focus();
  });
}

// --- Cart Handling ---
function addLineItem(id, med) {
  const idx = lineItems.findIndex((li) => li.id === id);
  if (idx > -1) {
    if (lineItems[idx].qty + 1 > (med.quantity ?? 0)) {
      showInfoModal(
        "Stock Limit",
        `Cannot add more ${med.name}. Only ${med.quantity ?? 0} in stock.`
      );
      return;
    }
    lineItems[idx].qty++;
  } else {
    if ((med.quantity ?? 0) === 0) {
      showInfoModal("Out of Stock", `${med.name} is out of stock.`);
      return;
    }
    lineItems.push({ id, med, qty: 1 });
  }
  renderTable();
}

function renderTable() {
  billingTableBody.innerHTML = "";
  let subTotal = 0;

  if (lineItems.length === 0) {
    billingTableBody.innerHTML =
      '<tr><td colspan="12" style="text-align: center;">No items added to the bill.</td></tr>';
    calculateAndUpdateGrandTotal(0);
    return;
  }

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

  document.querySelectorAll(".qty-input").forEach((input) => {
    input.onchange = () => {
      const id = input.dataset.id;
      const li = lineItems.find((x) => x.id === id);
      if (li) {
        const stock = li.med.quantity ?? 0;
        let val = Math.max(1, parseInt(input.value) || 1);
        val = Math.min(val, stock);
        if (val !== li.qty) {
          li.qty = val;
          input.value = val;
          renderTable();
        }
      }
    };
  });

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.onclick = () => {
      showConfirmModal(
        "Remove Item",
        "Are you sure you want to remove this item from the bill?"
      ).then((confirmed) => {
        if (confirmed) {
          lineItems = lineItems.filter((x) => x.id !== btn.dataset.id);
          renderTable();
        }
      });
    };
  });

  calculateAndUpdateGrandTotal(subTotal);
}

function calculateAndUpdateGrandTotal(subTotal) {
  const discountPercent = parseFloat(discountInput.value) || 0;
  const vatPercent = parseFloat(vatInput.value) || 0;
  const discountAmt = (subTotal * discountPercent) / 100;
  const vatAmt = ((subTotal - discountAmt) * vatPercent) / 100;
  const grandTotal = subTotal - discountAmt + vatAmt;

  document.getElementById("grand-total").textContent = `Rs ${grandTotal.toFixed(
    2
  )}`;

  if (paymentStatusSelect.value === "left") {
    const paid = parseFloat(amountPaidInput.value) || 0;
    const left = grandTotal - paid;
    amountLeftInput.value = left >= 0 ? left.toFixed(2) : "0.00";
  } else {
    amountLeftInput.value = "0.00";
  }
}

// --- Invoice Handling ---
async function handlePrintInvoice() {
  if (isProcessingSale) {
    console.log("Sale already in progress. Please wait.");
    return; // Prevent re-entry if already processing
  }
  isProcessingSale = true; // Set flag to true at the start

  try {
    const type = salesTypeSelect.value;
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

    const subTotal = lineItems.reduce(
      (acc, li) => acc + li.qty * li.med.sellingPrice,
      0
    );
    const discountPercent = parseFloat(discountInput.value) || 0;
    const vatPercent = parseFloat(vatInput.value) || 0;
    const discountAmt = (subTotal * discountPercent) / 100;
    const vatAmt = ((subTotal - discountAmt) * vatPercent) / 100;
    const grandTotal = subTotal - discountAmt + vatAmt;

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

    // Save sale record
    await database.ref("sales").push(salesData);

    // Update medicine quantities
    const updates = {};
    lineItems.forEach((li) => {
      const newQty = (li.med.quantity ?? 0) - li.qty;
      updates[`medicines/${li.id}/quantity`] = newQty;
      medicinesData[li.id].quantity = newQty;
    });
    await database.ref().update(updates);

    // After successful sale, show info modal. AWAIT its closure.
    await showInfoModal(
      "Sale Completed!",
      "The invoice has been successfully recorded and printed."
    );

    openInvoicePrintWindow(salesData); // Open print window after user acknowledges modal

    // Reset form only AFTER the user closes the success modal
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
    console.error("Error completing sale:", err);
    await showInfoModal("Error", `Failed to complete sale: ${err.message}`);
  } finally {
    isProcessingSale = false; // Reset flag regardless of success or failure
  }
}

// Invoice Window Print
function openInvoicePrintWindow(data) {
  const pharmacy = {
    name: "Your Pharmacy Name",
    owner: "Pharmacy Owner",
    address: "Pharmacy Address, City, Country",
    phone: "98XXXXXXXX",
    email: "your@email.com",
    reg: "PMS-REG-12345",
    hours: "9 AM – 10 PM",
  };

  const win = window.open("", "Invoice", "width=800,height=900");
  win.document.write(`
    <html><head><title>Invoice</title>
      <style>
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
            body { -webkit-print-color-adjust: exact; }
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
  win.print();
}

// --- Utility Functions ---

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
