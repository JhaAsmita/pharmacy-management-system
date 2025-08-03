// Import Firebase Authentication and Database references from config file
import { auth, database } from "./firebase-config.js";

// Import function to render admin sidebar navigation
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";

// Import function to require authentication before accessing page
import { requireAuth } from "./auth.js";

// Enforce authentication before allowing access to this page
requireAuth(); // If not logged in, user will be redirected

// Reference to 'suppliers' node in Firebase Realtime Database
const suppliersRef = database.ref("suppliers");

// Reference to 'users' node in Firebase Realtime Database to check user roles
const usersRef = database.ref("users");

// --- DOM ELEMENTS ---
// Form element to add new supplier
const supplierForm = document.getElementById("supplierForm");

// Input fields within the add supplier form
const supplierNameInput = document.getElementById("supplierName");
const supplierCompanyInput = document.getElementById("supplierCompany");
const supplierEmailInput = document.getElementById("supplierEmail");
const supplierContactInput = document.getElementById("supplierContact");
const supplierGSTInput = document.getElementById("supplierGST");
const supplierAddressInput = document.getElementById("supplierAddress");

// Container element where all supplier cards will be appended/displayed
const suppliersContainer = document.getElementById("suppliersContainer");

// Input field used to filter/search suppliers by text
const searchInput = document.getElementById("searchSupplier");

// --- Edit Modal DOM Elements ---
// Modal container element for editing a supplier
const editModal = document.getElementById("editModal");

// Form inside edit modal to update supplier details
const editSupplierForm = document.getElementById("editSupplierForm");

// Hidden input to hold supplier ID for editing reference
const editSupplierIdInput = document.getElementById("editSupplierId");

// Input fields inside the edit modal form for supplier details
const editSupplierNameInput = document.getElementById("editSupplierName");
const editSupplierCompanyInput = document.getElementById("editSupplierCompany");
const editSupplierEmailInput = document.getElementById("editSupplierEmail");
const editSupplierContactInput = document.getElementById("editSupplierContact");
const editSupplierGSTInput = document.getElementById("editSupplierGST");
const editSupplierAddressInput = document.getElementById("editSupplierAddress");

// --- Alert & Confirm Modal Elements ---
// Alert modal elements for displaying messages to user
const alertModal = document.getElementById("alert-modal");
const alertModalTitle = document.getElementById("alert-modal-title");
const alertModalMessage = document.getElementById("alert-modal-message");
const alertModalOkBtn = document.getElementById("alert-modal-ok");

// Confirm modal elements for asking user to confirm or cancel actions
const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalMessage = document.getElementById("confirm-modal-message");
const confirmModalOkBtn = document.getElementById("confirm-modal-ok");
const confirmModalCancelBtn = document.getElementById("confirm-modal-cancel");

// --- INIT ---
// Run after DOM fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Listen for Firebase authentication state changes (login/logout)
  auth.onAuthStateChanged((user) => {
    if (user) {
      // If user is logged in, fetch user data from database to check role
      usersRef.child(user.uid).once("value", (snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.role === "admin") {
          // If user is admin, render sidebar, setup modals, load suppliers & event listeners
          renderAdminSidebar("sidebar-container", user.email || "Admin");
          setupModals();
          loadSuppliers(); // Load all suppliers from DB and display
          setupEventListeners(); // Attach all event listeners only for admins
        } else {
          // If user is not admin, redirect to homepage or login page
          window.location.href = "index.html";
        }
      });
    } else {
      // If no user is logged in, redirect to homepage or login page
      window.location.href = "index.html";
    }
  });
});

// --- SETUP EVENT LISTENERS ---
// Attach event listeners to UI elements for user interaction
function setupEventListeners() {
  // Listen for form submit to add new supplier
  supplierForm.addEventListener("submit", handleAddSupplier);

  // Listen for input on search box to filter suppliers dynamically
  searchInput.addEventListener("input", filterSuppliers);

  // Listen for submit on edit supplier form inside modal
  editSupplierForm.addEventListener("submit", handleEditSupplier);

  // Attach click listeners to all close buttons in modals to close them on click
  document.querySelectorAll(".close-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // Dataset modalId attribute tells which modal to close
      const modalId = e.target.dataset.modalId;
      if (modalId) document.getElementById(modalId).classList.remove("active");
    });
  });

  // Clicking outside modal content (on modal container background) also closes modal
  document.querySelectorAll(".modal-container").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });
  });
}

// --- PAGE ZOOM ADJUSTMENT ---
// Adjust zoom on page load depending on viewport width (for responsiveness)
window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out to 60% on medium screens
  } else {
    document.body.style.zoom = "80%"; // Zoom out to 80% on others
  }
});

// --- SETUP MODALS ---
// Attach event listeners to alert & confirm modal buttons for interaction
function setupModals() {
  // Clicking OK button in alert modal closes it
  alertModalOkBtn.addEventListener("click", () =>
    alertModal.classList.remove("active")
  );

  // Confirm modal OK button resolves promise with true (confirmed)
  confirmModalOkBtn.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    if (confirmModal.resolvePromise) confirmModal.resolvePromise(true);
  });

  // Confirm modal Cancel button resolves promise with false (canceled)
  confirmModalCancelBtn.addEventListener("click", () => {
    confirmModal.classList.remove("active");
    if (confirmModal.resolvePromise) confirmModal.resolvePromise(false);
  });
}

// --- ALERT MODAL ---
// Show an alert modal with title and message, returns a promise resolved when closed
function showAlertModal(title, message) {
  return new Promise((resolve) => {
    alertModalTitle.textContent = title; // Set modal title text
    alertModalMessage.textContent = message; // Set modal message text
    alertModal.classList.add("active"); // Show modal by adding 'active' class

    // Use onclick to handle OK button click
    alertModalOkBtn.onclick = () => {
      alertModal.classList.remove("active"); // Hide modal
      resolve(); // Resolve promise so caller knows modal closed
    };

    // Also handle modal close via 'X' button
    document.querySelector("#alert-modal .close-btn")?.addEventListener(
      "click",
      function handleClose() {
        alertModal.classList.remove("active");
        alertModalOkBtn.onclick = null; // Clean event handler to avoid leaks
        this.removeEventListener("click", handleClose); // Remove this listener
        resolve(); // Resolve promise on close
      },
      { once: true } // Ensure listener fires only once
    );
  });
}

// --- CONFIRM MODAL ---
// Show confirm modal with title and message, returns a promise resolved with true (ok) or false (cancel)
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    confirmModalTitle.textContent = title; // Set confirm modal title
    confirmModalMessage.textContent = message; // Set confirm modal message
    confirmModal.classList.add("active"); // Show modal

    // Store resolver so buttons can resolve promise later
    confirmModal.resolvePromise = resolve;

    // Attach OK button click: hide modal and resolve true
    confirmModalOkBtn.onclick = () => {
      confirmModal.classList.remove("active");
      resolve(true);
    };

    // Attach Cancel button click: hide modal and resolve false
    confirmModalCancelBtn.onclick = () => {
      confirmModal.classList.remove("active");
      resolve(false);
    };

    // Also allow modal close with 'X' button to resolve false (cancel)
    document.querySelector("#confirm-modal .close-btn")?.addEventListener(
      "click",
      function handleClose() {
        confirmModal.classList.remove("active");
        confirmModalOkBtn.onclick = null;
        confirmModalCancelBtn.onclick = null;
        this.removeEventListener("click", handleClose);
        resolve(false);
      },
      { once: true }
    );
  });
}

// --- LOAD SUPPLIERS ---
// Load all suppliers from Firebase and render supplier cards on the page
function loadSuppliers() {
  // Show loading text while fetching data
  suppliersContainer.innerHTML = "<p>Loading suppliers...</p>";

  // Attach a realtime listener on 'suppliers' node - updates UI whenever data changes
  suppliersRef.on("value", (snapshot) => {
    suppliersContainer.innerHTML = ""; // Clear container before adding new cards

    // If no suppliers found, show message
    if (!snapshot.exists()) {
      suppliersContainer.innerHTML = "<p>No suppliers found.</p>";
      return;
    }

    // Collect supplier objects from snapshot for sorting/display
    const suppliers = [];
    snapshot.forEach((child) => {
      const val = child.val() || {};
      suppliers.push({
        id: child.key, // Firebase unique key
        name: val.name || "",
        company: val.company || "",
        email: val.email || "",
        contact: val.contact || "",
        gst: val.gst || "",
        address: val.address || "",
      });
    });

    // Sort suppliers alphabetically by company name (safe with fallback empty string)
    suppliers.sort((a, b) => (a.company || "").localeCompare(b.company || ""));

    // For each supplier, create a card element and append to container
    suppliers.forEach((supplier) => {
      try {
        const card = createSupplierCard(supplier);
        suppliersContainer.appendChild(card);
      } catch (err) {
        console.error("Error rendering supplier:", supplier, err);
      }
    });

    // After loading, apply any active search filter to suppliers
    filterSuppliers();
  });
}

// --- CREATE SUPPLIER CARD ---
// Creates a single supplier card DOM element including details, edit & delete buttons
function createSupplierCard(supplier) {
  const card = document.createElement("div");
  card.className = "supplier-card";

  // Use innerHTML to add the structure of supplier info and hidden details
  card.innerHTML = `
    <div class="supplier-header">
      ${escapeHtml(supplier.name || "-")} (${escapeHtml(
    supplier.company || "-"
  )})
    </div>
    <div class="supplier-details" style="display:none;">
      <p><strong>Email:</strong> ${escapeHtml(supplier.email || "-")}</p>
      <p><strong>Contact:</strong> ${escapeHtml(supplier.contact || "-")}</p>
      <p><strong>GST:</strong> ${escapeHtml(supplier.gst || "-")}</p>
      <p><strong>Address:</strong> ${escapeHtml(supplier.address || "-")}</p>
      <div class="supplier-actions">
        <button class="primary-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
    </div>`;

  // Toggle showing supplier details on header click (show/hide)
  card.querySelector(".supplier-header").addEventListener("click", () => {
    const details = card.querySelector(".supplier-details");
    details.style.display =
      details.style.display === "block" ? "none" : "block";
  });

  // Attach click event to Edit button to open edit modal with supplier data
  card
    .querySelector(".primary-btn")
    .addEventListener("click", () => openEditModal(supplier));

  // Attach click event to Delete button with confirmation modal before deleting
  card.querySelector(".delete-btn").addEventListener("click", async () => {
    const confirmed = await showConfirmModal(
      "Delete Supplier",
      "Are you sure you want to delete this supplier?"
    ); // Explicit confirm message
    if (confirmed) {
      try {
        await suppliersRef.child(supplier.id).remove(); // Remove supplier from DB
        showToast("Supplier deleted successfully!", "success"); // Show success toast
      } catch (error) {
        showToast("Error deleting supplier: " + error.message, "error"); // Show error toast
      }
    }
  });

  return card;
}

// --- HANDLE ADD SUPPLIER ---
// Processes add supplier form submission, validates inputs, and adds to DB
async function handleAddSupplier(e) {
  e.preventDefault(); // Prevent form default submission

  // Collect trimmed input values into an object
  const data = {
    name: supplierNameInput.value.trim(),
    company: supplierCompanyInput.value.trim(),
    email: supplierEmailInput.value.trim(),
    contact: supplierContactInput.value.trim(),
    gst: supplierGSTInput.value.trim(),
    address: supplierAddressInput.value.trim(),
  };

  // VALIDATIONS
  // Name: alphabets & spaces only, max 200 chars
  if (!/^[A-Za-z\s]{1,200}$/.test(data.name)) {
    return showAlertModal("Error", "Supplier Name: alphabets only (max 200).");
  }
  // Company: alphanumeric & spaces only, max 300 chars
  if (!/^[A-Za-z0-9\s]{1,300}$/.test(data.company)) {
    return showAlertModal(
      "Error",
      "Company Name: alphabets/numbers (max 300)."
    );
  }
  // Email: simple validation for format "text@text.text"
  if (!/^[^@]+@[A-Za-z]+\.[A-Za-z]+$/.test(data.email)) {
    return showAlertModal("Error", "Enter a valid email.");
  }
  // Contact: optional but if present only digits max 14
  if (data.contact && !/^\d{1,14}$/.test(data.contact)) {
    return showAlertModal("Error", "Contact: numbers only (max 14 digits).");
  }
  // GST: optional but if present only digits max 30
  if (data.gst && !/^\d{1,30}$/.test(data.gst)) {
    return showAlertModal("Error", "GST: numbers only (max 30 digits).");
  }
  // Address: letters, numbers, spaces and some punctuation (.,#-) allowed max 300 chars
  if (!/^[A-Za-z0-9\s.,#-]{1,300}$/.test(data.address)) {
    return showAlertModal(
      "Error",
      "Address: letters/numbers/spaces/.,#/- only (max 300)."
    );
  }

  // If all validations pass, add data to Firebase DB
  try {
    await suppliersRef.push(data); // Push new supplier under suppliers node
    showToast("Supplier Added!", "success"); // Show success toast
    supplierForm.reset(); // Reset form for new input
  } catch (error) {
    // On error show error toast message
    showToast("Failed to add supplier: " + error.message, "error");
  }
}

// --- OPEN EDIT MODAL ---
// Populate edit modal inputs with supplier data and show modal
function openEditModal(supplier) {
  editSupplierIdInput.value = supplier.id; // Store supplier id in hidden input
  editSupplierNameInput.value = supplier.name || ""; // Populate all fields
  editSupplierCompanyInput.value = supplier.company || "";
  editSupplierEmailInput.value = supplier.email || "";
  editSupplierContactInput.value = supplier.contact || "";
  editSupplierGSTInput.value = supplier.gst || "";
  editSupplierAddressInput.value = supplier.address || "";
  editModal.classList.add("active"); // Show the edit modal by adding 'active' class
}

// --- HANDLE EDIT SUPPLIER ---
// Process edit supplier form submission, validate inputs, and update DB
async function handleEditSupplier(e) {
  e.preventDefault();

  // Get supplier id to update
  const id = editSupplierIdInput.value;

  // Get edited values, trimmed
  const data = {
    name: editSupplierNameInput.value.trim(),
    company: editSupplierCompanyInput.value.trim(),
    email: editSupplierEmailInput.value.trim(),
    contact: editSupplierContactInput.value.trim(),
    gst: editSupplierGSTInput.value.trim(),
    address: editSupplierAddressInput.value.trim(),
  };

  // VALIDATIONS (same as adding supplier)
  if (!/^[A-Za-z\s]{1,200}$/.test(data.name)) {
    return showAlertModal("Error", "Supplier Name: alphabets only (max 200).");
  }
  if (!/^[A-Za-z0-9\s]{1,300}$/.test(data.company)) {
    return showAlertModal(
      "Error",
      "Company Name: alphabets/numbers (max 300)."
    );
  }
  if (!/^[^@]+@[A-Za-z]+\.[A-Za-z]+$/.test(data.email)) {
    return showAlertModal("Error", "Enter a valid email.");
  }
  if (data.contact && !/^\d{1,14}$/.test(data.contact)) {
    return showAlertModal("Error", "Contact: numbers only (max 14 digits).");
  }
  if (data.gst && !/^\d{1,30}$/.test(data.gst)) {
    return showAlertModal("Error", "GST: numbers only (max 30 digits).");
  }
  if (!/^[A-Za-z0-9\s.,#-]{1,300}$/.test(data.address)) {
    return showAlertModal(
      "Error",
      "Address: letters/numbers/spaces/.,#/- only (max 300)."
    );
  }

  // Update supplier in database
  try {
    await suppliersRef.child(id).update(data); // Update supplier with new data
    showToast("Supplier Updated!", "success"); // Show success toast
    editModal.classList.remove("active"); // Hide edit modal after updating
  } catch (error) {
    showToast("Failed to update supplier: " + error.message, "error"); // Show error toast
  }
}

// --- FILTER SUPPLIERS ---
// Filters supplier cards based on search input value
function filterSuppliers() {
  const query = searchInput.value.toLowerCase(); // Lowercase for case-insensitive search
  suppliersContainer.querySelectorAll(".supplier-card").forEach((card) => {
    // Check entire card text content for match to query
    const cardText = card.textContent.toLowerCase();
    card.style.display = cardText.includes(query) ? "block" : "none"; // Show or hide card
  });
}

// --- UTILS ---
// Escape HTML special characters to prevent XSS when inserting dynamic content
function escapeHtml(text) {
  return text
    ? text.replace(
        /[&<>"']/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          }[m]) // Map each char to escaped entity
      )
    : "";
}

// --- TOAST NOTIFICATIONS ---
// Show a temporary toast message of given type ('info', 'success', 'error')
function showToast(message, type = "info") {
  // Check if toast container exists
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    // If not, create one dynamically and add basic styles
    console.warn("Toast container not found. Creating a default one.");
    const body = document.querySelector("body");
    const container = document.createElement("div");
    container.id = "toast-container";
    body.appendChild(container);

    // Basic fixed positioning & layout
    container.style.position = "fixed";
    container.style.bottom = "20px";
    container.style.right = "20px";
    container.style.zIndex = "1000";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
  }

  // Create toast element with message and class for styling
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Append to container and trigger show animation
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      toast.remove(); // Remove after fade-out
    }, 2500); // Duration of toast visibility
  }, 50); // Small delay to allow CSS transition effect
}
