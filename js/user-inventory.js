import { auth, database } from "./firebase-config.js";
import { renderUserSidebar } from "./user-sidebar-navigation.js";
import { requireAuth } from "./auth.js";

requireAuth();

let medicinesRef = null;
let categoriesRef = database.ref("medicine-category");
let suppliersRef = database.ref("suppliers");

let medicinesData = {};
let categories = {};
let suppliers = {};

auth.onAuthStateChanged((user) => {
  if (user) {
    renderUserSidebar(
      "sidebar-container",
      user.email || user.displayName || "User"
    );
    medicinesRef = database.ref("medicines");
    loadCategories();
    loadSuppliers();
    setupMedicinesListener();
    setupModal();
  }
});

// Form elements
const form = document.getElementById("medicine-form");
const formTitle = document.getElementById("form-title");
const medicineIdInput = document.getElementById("medicine-id");

const nameInput = document.getElementById("medicine-name");
const batchInput = document.getElementById("medicine-batch");
const quantityInput = document.getElementById("medicine-quantity");
const expiryInput = document.getElementById("medicine-expiry");
const manufacturerInput = document.getElementById("medicine-manufacturer");
const buyingPriceInput = document.getElementById("medicine-buying-price");
const sellingPriceInput = document.getElementById("medicine-selling-price");
const categorySelect = document.getElementById("medicine-category");
const supplierSelect = document.getElementById("medicine-supplier");
const descriptionInput = document.getElementById("medicine-description");
const rackInput = document.getElementById("medicine-rack"); // New Field

const addCategoryBtn = document.getElementById("add-category-btn");
const medicineTableBody = document.getElementById("medicine-table");

const searchFilter = document.getElementById("search-filter");
const expiryFilter = document.getElementById("expiry-filter");
const quantityFilter = document.getElementById("quantity-filter");
const categoryFilter = document.getElementById("category-filter");
const supplierFilter = document.getElementById("supplier-filter");

const clearFiltersBtn = document.getElementById("btn-clear-filters");
const exportBtn = document.getElementById("btn-export");
const importBtn = document.getElementById("btn-import");
const fileInput = document.getElementById("file-input");

// Modal elements
const categoryModal = document.getElementById("category-modal");
const closeModalBtn = document.querySelector(".close-modal");
const newCategoryInput = document.getElementById("new-category-name");
const confirmAddCategoryBtn = document.getElementById("confirm-add-category");

function setupModal() {
  addCategoryBtn.addEventListener("click", () => {
    categoryModal.style.display = "flex";
    newCategoryInput.focus();
  });

  closeModalBtn.addEventListener("click", () => {
    categoryModal.style.display = "none";
    newCategoryInput.value = "";
  });

  confirmAddCategoryBtn.addEventListener("click", () => {
    const newCat = newCategoryInput.value.trim();
    if (newCat) {
      categoriesRef.push(newCat);
      categoryModal.style.display = "none";
      newCategoryInput.value = "";
    }
  });

  window.addEventListener("click", (e) => {
    if (e.target === categoryModal) {
      categoryModal.style.display = "none";
      newCategoryInput.value = "";
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out to 80%
  } else {
    document.body.style.zoom = "80%"; // Zoom out to 80%
  }
});

function loadCategories() {
  categoriesRef.on("value", (snap) => {
    categories = snap.val() || {};
    categorySelect.innerHTML = `<option value="">Select Category *</option>`;
    categoryFilter.innerHTML = `<option value="">Filter by category</option>`;
    Object.values(categories).forEach((cat) => {
      categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  });
}

function loadSuppliers() {
  suppliersRef.on("value", (snap) => {
    suppliers = snap.val() || {};
    supplierSelect.innerHTML = `<option value="">Select Supplier *</option>`;
    supplierFilter.innerHTML = `<option value="">Filter by supplier</option>`;
    Object.entries(suppliers).forEach(([id, sup]) => {
      const company = sup.company || "Unknown";
      supplierSelect.innerHTML += `<option value="${id}">${company}</option>`;
      supplierFilter.innerHTML += `<option value="${company}">${company}</option>`;
    });
  });
}

function setupMedicinesListener() {
  medicinesRef.on("value", (snapshot) => {
    medicinesData = snapshot.val() || {};
    renderMedicinesTable();
  });
}

function renderMedicinesTable() {
  const filtered = applyFilters();
  medicineTableBody.innerHTML = "";

  Object.entries(filtered).forEach(([id, med]) => {
    const isExpired = med.expiry && new Date(med.expiry) < new Date();
    const supplier = suppliers[med.supplier] || {};
    const supplierName = supplier.company || "Unknown";
    const supplierGST = supplier.gst || "N/A";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Name">${escapeHtml(med.name)}</td>
      <td data-label="Batch No">${escapeHtml(med.batch || "")}</td>
      <td data-label="Qty">${med.quantity}</td>
      <td data-label="Expiry" class="${isExpired ? "expired" : ""}">${
      med.expiry || ""
    }</td>
      <td data-label="Manufacturer">${escapeHtml(med.manufacturer || "")}</td>
      <td data-label="Buy Price">${med.buyingPrice?.toFixed(2) || ""}</td>
      <td data-label="Sell Price">${med.sellingPrice?.toFixed(2) || ""}</td>
      <td data-label="Category">${escapeHtml(med.category || "")}</td>
      <td data-label="Supplier">${escapeHtml(supplierName)}</td>
      <td data-label="GST">${escapeHtml(supplierGST)}</td>
      <td data-label="Description">${escapeHtml(med.description || "")}</td>
      <td data-label="Rack">${escapeHtml(med.rack || "")}</td>
      <td data-label="Date Added">${med.dateAdded || ""}</td>

    `;
    medicineTableBody.appendChild(tr);
  });

  medicineTableBody
    .querySelectorAll(".edit-btn")
    .forEach((btn) => btn.addEventListener("click", onEditMedicine));
  medicineTableBody
    .querySelectorAll(".delete-btn")
    .forEach((btn) => btn.addEventListener("click", onDeleteMedicine));
}

function applyFilters() {
  const searchVal = searchFilter.value.trim().toLowerCase();
  const expiryVal = expiryFilter.value;
  const quantityVal = quantityFilter.value;
  const categoryVal = categoryFilter.value;
  const supplierVal = supplierFilter.value;

  return Object.fromEntries(
    Object.entries(medicinesData).filter(([_, med]) => {
      if (searchVal && !med.name.toLowerCase().includes(searchVal))
        return false;
      if (expiryVal) {
        const expired = med.expiry && new Date(med.expiry) < new Date();
        if (expiryVal === "expired" && !expired) return false;
        if (expiryVal === "valid" && expired) return false;
      }
      if (quantityVal === "low" && med.quantity >= 10) return false;
      if (quantityVal === "sufficient" && med.quantity < 10) return false;
      if (categoryVal && med.category !== categoryVal) return false;
      if (supplierVal) {
        const supplierName = suppliers[med.supplier]?.company;
        if (supplierName !== supplierVal) return false;
      }
      return true;
    })
  );
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = medicineIdInput.value.trim();

  // Validation regex & checks
  const nameVal = nameInput.value.trim();
  const batchVal = batchInput.value.trim();
  const rackVal = rackInput.value.trim();
  const descriptionVal = descriptionInput.value.trim();

  // Name: Only alphabets and spaces, max 200 characters
  if (!/^[A-Za-z\s]{1,200}$/.test(nameVal)) {
    await showAlertModal(
      "Validation Error",
      "Name must only contain alphabets and spaces, maximum 200 characters."
    );
    return;
  }

  // Batch No: 0 or 1 alphabet + up to 4 numbers
  if (!/^[A-Za-z]?\d{1,4}$/.test(batchVal)) {
    await showAlertModal(
      "Validation Error",
      "Batch No must have 0 or 1 alphabet followed by up to 4 numbers. (e.g. A1234 or 1234)"
    );
    return;
  }

  // Rack: 0 or 1 alphabet + up to 4 numbers
  if (!/^[A-Za-z]?\d{1,4}$/.test(rackVal)) {
    await showAlertModal(
      "Validation Error",
      "Rack must have 0 or 1 alphabet followed by up to 4 numbers. (e.g. R1234 or 1234)"
    );
    return;
  }

  // Description: Max 200 words
  const wordCount = descriptionVal.split(/\s+/).filter(Boolean).length;
  if (wordCount > 200) {
    await showAlertModal(
      "Validation Error",
      `Description must be a maximum of 200 words. Current count: ${wordCount}`
    );
    return;
  }

  // Prepare new medicine object after validation
  const newMed = {
    name: nameVal,
    batch: batchVal,
    quantity: Number(quantityInput.value),
    expiry: expiryInput.value,
    manufacturer: manufacturerInput.value.trim(),
    buyingPrice: buyingPriceInput.value ? Number(buyingPriceInput.value) : null,
    sellingPrice: Number(sellingPriceInput.value),
    category: categorySelect.value,
    supplier: supplierSelect.value,
    description: descriptionVal,
    rack: rackVal,
    dateAdded: id
      ? medicinesData[id].dateAdded
      : new Date().toISOString().slice(0, 10),
  };

  // Required fields check
  if (
    !newMed.name ||
    newMed.quantity < 0 ||
    !newMed.expiry ||
    isNaN(newMed.sellingPrice) ||
    !newMed.category ||
    !newMed.supplier
  ) {
    await showAlertModal(
      "Validation Error",
      "Please fill all required fields correctly."
    );
    return;
  }

  // Save or update
  try {
    if (id) {
      await medicinesRef.child(id).update(newMed);
      showToast("Medicine updated successfully", "success");
    } else {
      await medicinesRef.push(newMed);
      showToast("Medicine added successfully", "success");
    }
    form.reset();
    medicineIdInput.value = "";
    formTitle.textContent = "Add Medicine";
  } catch (err) {
    showToast("Error saving: " + err.message, "error");
  }
});

document.getElementById("btn-cancel").addEventListener("click", () => {
  form.reset();
  medicineIdInput.value = "";
  formTitle.textContent = "Add Medicine";
});

function onEditMedicine(e) {
  const id = e.currentTarget.dataset.id;
  const med = medicinesData[id];
  if (!med) return;

  medicineIdInput.value = id;
  nameInput.value = med.name || "";
  batchInput.value = med.batch || "";
  quantityInput.value = med.quantity ?? "";
  expiryInput.value = med.expiry || "";
  manufacturerInput.value = med.manufacturer || "";
  buyingPriceInput.value = med.buyingPrice ?? "";
  sellingPriceInput.value = med.sellingPrice ?? "";
  categorySelect.value = med.category || "";
  supplierSelect.value = med.supplier || "";
  descriptionInput.value = med.description || "";
  rackInput.value = med.rack || ""; // Load into form
  formTitle.textContent = "Edit Medicine";
  form.scrollIntoView({ behavior: "smooth" });
}

async function onDeleteMedicine(e) {
  const id = e.currentTarget.dataset.id;
  if (!id || !confirm("Are you sure you want to delete this medicine?")) return;
  try {
    await medicinesRef.child(id).remove();
    showToast("Medicine deleted successfully");
  } catch (err) {
    showToast("Failed to delete: " + err.message, "error");
  }
}

searchFilter.addEventListener("input", renderMedicinesTable);
expiryFilter.addEventListener("change", renderMedicinesTable);
quantityFilter.addEventListener("change", renderMedicinesTable);
categoryFilter.addEventListener("change", renderMedicinesTable);
supplierFilter.addEventListener("change", renderMedicinesTable);

clearFiltersBtn.addEventListener("click", () => {
  searchFilter.value = "";
  expiryFilter.value = "";
  quantityFilter.value = "";
  categoryFilter.value = "";
  supplierFilter.value = "";
  renderMedicinesTable();
});

exportBtn.addEventListener("click", () => {
  const dataStr = JSON.stringify(medicinesData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medicines_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Export completed successfully");
});

importBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const importedData = JSON.parse(evt.target.result);
      if (typeof importedData !== "object" || Array.isArray(importedData)) {
        showToast("Invalid JSON format", "error");
        return;
      }

      if (confirm("This will overwrite your current inventory. Continue?")) {
        await medicinesRef.set(importedData);
        showToast("Import completed successfully");
      }
    } catch (err) {
      showToast("Import failed: " + err.message, "error");
    }
    fileInput.value = "";
  };
  reader.readAsText(file);
});

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"]/g, (m) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return map[m];
  });
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}
