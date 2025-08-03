// Import Firebase Authentication and Database modules
import { auth, database } from "./firebase-config.js";

// Import a function to render the admin sidebar UI
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";

// Import a function that ensures the user is authenticated (redirects if not)
import { requireAuth } from "./auth.js";

// Call requireAuth to verify user is logged in before running script
requireAuth();

// Initialize references to Firebase database nodes
let medicinesRef = null; // Will hold the 'medicines' node ref once user is confirmed as admin
let categoriesRef = database.ref("medicine-category"); // Reference to categories node
let suppliersRef = database.ref("suppliers"); // Reference to suppliers node
let usersRef = database.ref("users"); // Reference to users node for roles and permissions

// Objects to store loaded data locally for quick access and filtering
let medicinesData = {}; // All medicines data keyed by id
let categories = {}; // Categories list
let suppliers = {}; // Suppliers list keyed by id

// Monitor Firebase Authentication state changes (login/logout)
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is logged in - check if the user has admin role
    usersRef.child(user.uid).once("value", (snapshot) => {
      const userData = snapshot.val();
      if (userData && userData.role === "admin") {
        // User is admin - render sidebar with user info (email/displayName fallback)
        renderAdminSidebar(
          "sidebar-container",
          user.email || user.displayName || "Admin"
        );
        // Now set medicinesRef after admin verification
        medicinesRef = database.ref("medicines");

        // Load data and set up listeners
        loadCategories(); // Load and listen to categories
        loadSuppliers(); // Load and listen to suppliers
        setupMedicinesListener(); // Listen to medicines node changes
        setupModals(); // Initialize modal dialogs functionality
        setupEventListeners(); // Set up form, filters, buttons event listeners
      } else {
        // Not an admin - redirect user to homepage or a non-admin page
        window.location.href = "index.html";
      }
    });
  } else {
    // No user logged in - optionally redirect to login page (handled in requireAuth)
    // window.location.href = "login.html";
  }
});

// Adjust page zoom on DOM content loaded based on window width for better UI on different devices
window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    // For tablet / medium screens zoom out more (60%)
    document.body.style.zoom = "60%";
  } else {
    // For small or large screens zoom to 80%
    document.body.style.zoom = "80%";
  }
});

// --- DOM ELEMENTS ---

// Main medicine form and its fields for adding or editing medicine data
const form = document.getElementById("medicine-form");
const formTitle = document.getElementById("form-title"); // Title that toggles Add/Edit Medicine
const medicineIdInput = document.getElementById("medicine-id"); // Hidden input to track editing id

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
const rackInput = document.getElementById("medicine-rack");

const addCategoryBtn = document.getElementById("add-category-btn"); // Button to open add category modal
const medicineTableBody = document.getElementById("medicine-table"); // Table body where medicines are rendered

// Filter inputs to filter medicine list
const searchFilter = document.getElementById("search-filter");
const expiryFilter = document.getElementById("expiry-filter");
const quantityFilter = document.getElementById("quantity-filter");
const categoryFilter = document.getElementById("category-filter");
const supplierFilter = document.getElementById("supplier-filter");

// Buttons to clear filters and export/import medicines data JSON
const clearFiltersBtn = document.getElementById("btn-clear-filters");
const exportBtn = document.getElementById("btn-export");
const importBtn = document.getElementById("btn-import");
const fileInput = document.getElementById("file-input"); // Hidden file input for import

// Modals
const categoryModal = document.getElementById("category-modal");
const newCategoryInput = document.getElementById("new-category-name");
const confirmAddCategoryBtn = document.getElementById("confirm-add-category");

const alertModal = document.getElementById("alert-modal");
const alertModalTitle = document.getElementById("alert-modal-title");
const alertModalMessage = document.getElementById("alert-modal-message");
const alertModalOkBtn = document.getElementById("alert-modal-ok");

const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalMessage = document.getElementById("confirm-modal-message");
const confirmModalOkBtn = document.getElementById("confirm-modal-ok");
const confirmModalCancelBtn = document.getElementById("confirm-modal-cancel");

/**
 * showAlertModal: Displays a custom alert modal with a title and message.
 * Returns a Promise that resolves when the user clicks OK.
 * Used for showing validation errors, info, or any message that requires user acknowledgement.
 */
function showAlertModal(title, message) {
  return new Promise((resolve) => {
    alertModalTitle.textContent = title;
    alertModalMessage.textContent = message;
    alertModal.style.display = "flex";

    // Handler for closing modal when OK or X is clicked
    const handleOk = () => {
      alertModal.style.display = "none";
      alertModalOkBtn.removeEventListener("click", handleOk);
      document
        .querySelector("#alert-modal .close-modal")
        .removeEventListener("click", handleOk);
      resolve();
    };

    alertModalOkBtn.addEventListener("click", handleOk);
    document
      .querySelector("#alert-modal .close-modal")
      .addEventListener("click", handleOk);
  });
}

/**
 * showConfirmModal: Displays a custom confirmation modal with title and message.
 * Returns a Promise that resolves to true if user confirms (OK),
 * or false if user cancels or closes the modal.
 * Used for confirming destructive actions like deletion or overwriting data.
 */
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModal.style.display = "flex";

    // Confirm button handler
    const handleConfirm = () => {
      confirmModal.style.display = "none";
      cleanup();
      resolve(true);
    };

    // Cancel button handler
    const handleCancel = () => {
      confirmModal.style.display = "none";
      cleanup();
      resolve(false);
    };

    // Clean up event listeners after action
    function cleanup() {
      confirmModalOkBtn.removeEventListener("click", handleConfirm);
      confirmModalCancelBtn.removeEventListener("click", handleCancel);
      document
        .querySelector("#confirm-modal .close-modal")
        .removeEventListener("click", handleCancel);
    }

    confirmModalOkBtn.addEventListener("click", handleConfirm);
    confirmModalCancelBtn.addEventListener("click", handleCancel);
    document
      .querySelector("#confirm-modal .close-modal")
      .addEventListener("click", handleCancel);
  });
}

/**
 * setupModals: Sets up all modal dialog related event listeners,
 * including opening, closing, and confirming modal actions.
 */
function setupModals() {
  // Open category modal on "Add Category" button click
  addCategoryBtn.addEventListener("click", () => {
    categoryModal.style.display = "flex";
    newCategoryInput.focus(); // Focus input for better UX
  });

  // Close modal when any element with "close-modal" class is clicked (X buttons)
  document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modalId = e.target.dataset.modal;
      if (modalId) {
        document.getElementById(modalId).style.display = "none";
        if (modalId === "category-modal") {
          newCategoryInput.value = ""; // Clear input field on close
        }
      }
    });
  });

  // Confirm adding new category
  confirmAddCategoryBtn.addEventListener("click", async () => {
    const newCat = newCategoryInput.value.trim();
    if (!newCat) {
      await showAlertModal("Input Error", "Category name cannot be empty.");
      return;
    }
    // Check for duplicate category ignoring case
    if (
      Object.values(categories).some(
        (cat) => cat.toLowerCase() === newCat.toLowerCase()
      )
    ) {
      await showAlertModal(
        "Duplicate Category",
        "This category already exists."
      );
      return;
    }

    try {
      // Add new category to Firebase
      await categoriesRef.push(newCat);
      categoryModal.style.display = "none";
      newCategoryInput.value = "";
      showToast("Category added successfully!", "success");
    } catch (error) {
      showToast("Failed to add category: " + error.message, "error");
    }
  });

  // Close category modal if clicking outside modal content area
  window.addEventListener("click", (e) => {
    if (e.target === categoryModal) {
      categoryModal.style.display = "none";
      newCategoryInput.value = "";
    }
  });
}

/**
 * loadCategories: Loads categories from Firebase realtime database,
 * updates the categories object and updates the category select elements options.
 */
function loadCategories() {
  categoriesRef.on("value", (snap) => {
    categories = snap.val() || {};
    // Reset category select dropdowns with default option
    categorySelect.innerHTML = `<option value="">Select Category *</option>`;
    categoryFilter.innerHTML = `<option value="">Filter by category</option>`;

    // Add all categories as options
    Object.values(categories).forEach((cat) => {
      categorySelect.innerHTML += `<option value="${escapeHtml(
        cat
      )}">${escapeHtml(cat)}</option>`;
      categoryFilter.innerHTML += `<option value="${escapeHtml(
        cat
      )}">${escapeHtml(cat)}</option>`;
    });
  });
}

/**
 * loadSuppliers: Loads suppliers data from Firebase,
 * updates suppliers object and populates supplier select and filter options.
 */
function loadSuppliers() {
  suppliersRef.on("value", (snap) => {
    suppliers = snap.val() || {};
    // Reset supplier dropdowns with default options
    supplierSelect.innerHTML = `<option value="">Select Supplier *</option>`;
    supplierFilter.innerHTML = `<option value="">Filter by supplier</option>`;

    // Add suppliers as options
    Object.entries(suppliers).forEach(([id, sup]) => {
      const company = sup.company || "Unknown";
      supplierSelect.innerHTML += `<option value="${escapeHtml(
        id
      )}">${escapeHtml(company)}</option>`;
      supplierFilter.innerHTML += `<option value="${escapeHtml(
        company
      )}">${escapeHtml(company)}</option>`;
    });
  });
}

/**
 * setupMedicinesListener: Sets up realtime listener on medicines node,
 * updates medicinesData and calls renderMedicinesTable whenever medicines change.
 */
function setupMedicinesListener() {
  medicinesRef.on("value", (snapshot) => {
    medicinesData = snapshot.val() || {};
    renderMedicinesTable();
  });
}

/**
 * renderMedicinesTable: Clears and renders the medicines table based on
 * filtered medicines from applyFilters function.
 * Also attaches event listeners to edit and delete buttons in the table.
 */
function renderMedicinesTable() {
  const filtered = applyFilters();
  medicineTableBody.innerHTML = "";

  // Create a table row for each medicine entry
  Object.entries(filtered).forEach(([id, med]) => {
    // Check if medicine expiry date is past today (expired)
    const isExpired = med.expiry && new Date(med.expiry) < new Date();

    // Get supplier details from suppliers object or fallback values
    const supplier = suppliers[med.supplier] || {};
    const supplierName = supplier.company || "Unknown";
    const supplierGST = supplier.gst || "N/A";

    // Construct table row with all medicine data
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
      <td data-label="Actions" class="actions">
        <button class="action-btn edit-btn" data-id="${id}" aria-label="Edit medicine">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete-btn" data-id="${id}" aria-label="Delete medicine">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    medicineTableBody.appendChild(tr);
  });

  // Attach event listeners for edit and delete buttons in each row
  medicineTableBody
    .querySelectorAll(".edit-btn")
    .forEach((btn) => btn.addEventListener("click", onEditMedicine));
  medicineTableBody
    .querySelectorAll(".delete-btn")
    .forEach((btn) => btn.addEventListener("click", onDeleteMedicine));
}

/**
 * applyFilters: Applies all active filter values to medicinesData,
 * returning only medicines that pass all filters.
 */
function applyFilters() {
  const searchVal = searchFilter.value.trim().toLowerCase();
  const expiryVal = expiryFilter.value;
  const quantityVal = quantityFilter.value;
  const categoryVal = categoryFilter.value;
  const supplierVal = supplierFilter.value;

  // Filter medicines using multiple conditions
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

      return true; // Passed all filters
    })
  );
}

/**
 * setupEventListeners: Sets up all static event listeners like form submit,
 * filter changes, buttons clicks (clear, export, import), and file input change.
 */
function setupEventListeners() {
  // Medicine form submission handler for add or update medicine
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get ID from hidden input - empty means adding new medicine, else editing
    const id = medicineIdInput.value.trim();

    // Validate inputs with regex and rules
    const nameVal = nameInput.value.trim();
    const batchVal = batchInput.value.trim();
    const rackVal = rackInput.value.trim();
    const descriptionVal = descriptionInput.value.trim();

    // Name must only have alphabets and spaces, max 200 chars
    if (!/^[A-Za-z\s]{1,200}$/.test(nameVal)) {
      await showAlertModal(
        "Validation Error",
        "Name must only contain alphabets and spaces, maximum 200 characters."
      );
      return;
    }

    // Batch: zero or one alphabet followed by up to 4 digits
    if (!/^[A-Za-z]?\d{1,4}$/.test(batchVal)) {
      await showAlertModal(
        "Validation Error",
        "Batch No must have 0 or 1 alphabet followed by up to 4 numbers. (e.g. A1234 or 1234)"
      );
      return;
    }

    // Rack: zero or one alphabet followed by up to 4 digits
    if (!/^[A-Za-z]?\d{1,4}$/.test(rackVal)) {
      await showAlertModal(
        "Validation Error",
        "Rack must have 0 or 1 alphabet followed by up to 4 numbers. (e.g. R1234 or 1234)"
      );
      return;
    }

    // Description max 200 words check
    const wordCount = descriptionVal.split(/\s+/).filter(Boolean).length;
    if (wordCount > 200) {
      await showAlertModal(
        "Validation Error",
        `Description must be a maximum of 200 words. Current count: ${wordCount}`
      );
      return;
    }

    // Prepare medicine object to save/update
    const newMed = {
      name: nameVal,
      batch: batchVal,
      quantity: Number(quantityInput.value),
      expiry: expiryInput.value,
      manufacturer: manufacturerInput.value.trim(),
      buyingPrice: buyingPriceInput.value
        ? Number(buyingPriceInput.value)
        : null,
      sellingPrice: Number(sellingPriceInput.value),
      category: categorySelect.value,
      supplier: supplierSelect.value,
      description: descriptionVal,
      rack: rackVal,
      // Keep original dateAdded if editing, else set to today
      dateAdded: id
        ? medicinesData[id].dateAdded
        : new Date().toISOString().slice(0, 10),
    };

    // Required fields check before saving
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

    try {
      if (id) {
        // Update existing medicine
        await medicinesRef.child(id).update(newMed);
        showToast("Medicine updated successfully", "success");
      } else {
        // Add new medicine
        await medicinesRef.push(newMed);
        showToast("Medicine added successfully", "success");
      }

      // Reset form after save
      form.reset();
      medicineIdInput.value = "";
      formTitle.textContent = "Add Medicine";
    } catch (err) {
      showToast("Error saving: " + err.message, "error");
    }
  });

  // Cancel button resets form and switches title back to Add Medicine
  document.getElementById("btn-cancel").addEventListener("click", () => {
    form.reset();
    medicineIdInput.value = "";
    formTitle.textContent = "Add Medicine";
  });

  // Attach filter inputs to re-render medicines table on change/input
  searchFilter.addEventListener("input", renderMedicinesTable);
  expiryFilter.addEventListener("change", renderMedicinesTable);
  quantityFilter.addEventListener("change", renderMedicinesTable);
  categoryFilter.addEventListener("change", renderMedicinesTable);
  supplierFilter.addEventListener("change", renderMedicinesTable);

  // Clear filters and reset table to show all medicines
  clearFiltersBtn.addEventListener("click", () => {
    searchFilter.value = "";
    expiryFilter.value = "";
    quantityFilter.value = "";
    categoryFilter.value = "";
    supplierFilter.value = "";
    renderMedicinesTable();
  });

  // Export medicines data as JSON file download
  exportBtn.addEventListener("click", () => {
    const dataStr = JSON.stringify(medicinesData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medicines_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export completed successfully", "success");
  });

  // Trigger hidden file input when import button is clicked
  importBtn.addEventListener("click", () => fileInput.click());

  // Handle file input change (when user selects a JSON file to import)
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);

        // Validate JSON format - must be an object (not array)
        if (typeof importedData !== "object" || Array.isArray(importedData)) {
          await showAlertModal(
            "Import Error",
            "Invalid JSON format. Please upload a valid object."
          );
          return;
        }

        // Confirm with user before overwriting current inventory
        const confirmed = await showConfirmModal(
          "Confirm Import",
          "This will overwrite your current inventory. Are you sure you want to continue?"
        );
        if (confirmed) {
          await medicinesRef.set(importedData);
          showToast("Import completed successfully", "success");
        } else {
          showToast("Import cancelled", "info");
        }
      } catch (err) {
        await showAlertModal(
          "Import Failed",
          "Failed to import file: " + err.message
        );
      } finally {
        fileInput.value = ""; // Reset file input so same file can be selected again
      }
    };
    reader.readAsText(file);
  });
}

/**
 * onEditMedicine: Handler called when user clicks the edit button
 * on a medicine row. Loads medicine data into the form for editing.
 */
function onEditMedicine(e) {
  const id = e.currentTarget.dataset.id;
  const med = medicinesData[id];
  if (!med) return;

  medicineIdInput.value = id; // Store id to detect editing mode
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
  rackInput.value = med.rack || "";
  formTitle.textContent = "Edit Medicine";

  // Scroll form into view for better UX when editing
  form.scrollIntoView({ behavior: "smooth" });
}

/**
 * onDeleteMedicine: Handler for delete button click on medicine row.
 * Asks for confirmation and deletes the medicine record from Firebase.
 */
async function onDeleteMedicine(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) return;

  // Confirm deletion from user
  const confirmed = await showConfirmModal(
    "Confirm Deletion",
    "Are you sure you want to delete this medicine?"
  );
  if (!confirmed) return;

  try {
    // Remove medicine from Firebase realtime DB
    await medicinesRef.child(id).remove();
    showToast("Medicine deleted successfully", "success");
  } catch (err) {
    showToast("Failed to delete: " + err.message, "error");
  }
}

/**
 * escapeHtml: Escapes HTML special characters in strings to prevent XSS
 * when inserting user-generated content into the DOM.
 */
function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"]/g, (m) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return map[m];
  });
}

/**
 * showToast: Displays a temporary toast notification on the page.
 * @param {string} message - Text message to display
 * @param {string} type - Type of toast: success, error, info (controls styling)
 */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show the toast with animation after a short delay
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Hide and remove the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}
