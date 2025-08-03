// Import Firebase auth and database from your firebase-config.js file
import { auth, database } from "./firebase-config.js";
// Import authentication helpers: requireAuth to check login, logout function
import { requireAuth, logout } from "./auth.js";
// Import a function to render the admin sidebar UI, passing container ID and user email
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";

// Ensure the user is authenticated before running any admin logic
requireAuth();

/* ===== Modal System (Info & Confirm) ===== */
// Modal backdrop element (dark semi-transparent background)
const backdrop = document.getElementById("modal-backdrop");

// Info modal elements (for showing messages)
const infoModal = document.getElementById("info-modal");
const infoTitle = document.getElementById("info-modal-title");
const infoBody = document.getElementById("info-modal-body");
const infoClose = document.getElementById("info-modal-close");

// Confirm modal elements (for confirmation dialogs)
const confirmModal = document.getElementById("confirm-modal");
const confirmTitle = document.getElementById("confirm-modal-title");
const confirmBody = document.getElementById("confirm-modal-body");
const confirmYes = document.getElementById("confirm-yes");
const confirmNo = document.getElementById("confirm-no");

// Show a given modal and the backdrop by removing "hidden" class
function showModal(modal) {
  backdrop.classList.remove("hidden");
  modal.classList.remove("hidden");
}
// Hide a given modal and the backdrop by adding "hidden" class
function hideModal(modal) {
  backdrop.classList.add("hidden");
  modal.classList.add("hidden");
}

// Show an informational modal with a title and message
function showInfoModal(title, message) {
  infoTitle.textContent = title || "Message"; // Default title if none provided
  infoBody.textContent = message || ""; // Default empty message
  showModal(infoModal); // Show the info modal and backdrop
}
// Close info modal when user clicks the close button
infoClose.addEventListener("click", () => hideModal(infoModal));

// Show a confirmation modal with title, message and callback for "Yes" button
function showConfirmModal(title, message, onYes) {
  confirmTitle.textContent = title || "Confirm"; // Default title
  confirmBody.textContent = message || ""; // Message body
  showModal(confirmModal); // Show modal & backdrop

  // When Yes is clicked: hide modal, run callback safely with try-catch
  confirmYes.onclick = () => {
    hideModal(confirmModal);
    try {
      onYes && onYes();
    } catch (e) {
      console.error(e);
    }
  };
  // When No is clicked: just hide the modal
  confirmNo.onclick = () => hideModal(confirmModal);
}

// On page load, adjust zoom level depending on viewport width
window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out to 60% on medium screen sizes
  } else {
    document.body.style.zoom = "80%"; // Zoom out to 80% on small or large screens
  }
});

/* ===== Auth / Role / Sidebar ===== */
// Listen to Firebase auth state changes (user sign-in/sign-out)
auth.onAuthStateChanged(async (user) => {
  // Cache important DOM elements for showing/hiding content
  const adminContent = document.getElementById("adminContent");
  const noAuth = document.getElementById("noAuthorityMessage");
  const userEmail = document.getElementById("userEmail");
  const logoutBtn = document.getElementById("logoutBtn");

  // If user not signed in
  if (!user) {
    adminContent.style.display = "none"; // Hide admin content
    noAuth.textContent = "You must be logged in to view this page."; // Show message
    noAuth.style.display = "block";
    return; // Exit early
  }

  try {
    // Fetch user's role from database using UID
    const roleSnap = await database
      .ref("users/" + user.uid + "/role")
      .once("value");
    const role = roleSnap.val();

    // If user is not admin, deny access
    if (role !== "admin") {
      adminContent.style.display = "none"; // Hide admin content
      noAuth.textContent = "You do not have permission to view this page."; // Show permission error
      noAuth.style.display = "block";
      return;
    }

    // Render sidebar with user's email (or fallback "Admin")
    renderAdminSidebar("sidebar-container", user.email || "Admin");

    // Show admin content and hide no-auth message
    adminContent.style.display = "block";
    noAuth.style.display = "none";

    // Set displayed user email if element exists
    if (userEmail) userEmail.textContent = user.email || "Admin";

    // Load pharmacy data and requests
    loadPharmacyDetails();
    loadPharmacyRequests();
    loadPharmacyList();

    // Attach logout button event listener
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
  } catch (err) {
    // Show error if any failure occurs fetching role or data
    adminContent.style.display = "none";
    noAuth.textContent = "Error loading page.";
    noAuth.style.display = "block";
    console.error(err);
  }
});

/* ===== Doctor/Staff row helpers (global) ===== */
// Add a doctor row with name and specialization inputs, plus remove button
export function addDoctor(name = "", specialization = "") {
  const container = document.getElementById("doctorsContainer");
  const div = document.createElement("div");
  div.classList.add("row"); // style as a row with grid
  // Insert inputs and remove button; values escaped to prevent HTML injection
  div.innerHTML = `
    <input class="form-control" placeholder="Doctor Name" value="${escapeHtml(
      name
    )}" />
    <input class="form-control" placeholder="Specialization" value="${escapeHtml(
      specialization
    )}" />
    <button type="button" class="delete-btn" title="Remove">Remove</button>
  `;
  // Remove the row when button is clicked
  div.querySelector("button").onclick = () => div.remove();
  container.appendChild(div); // Add row to container
}
window.addDoctor = addDoctor; // Expose globally for inline calls

// Add a staff row with name and role inputs, plus remove button
export function addStaff(name = "", role = "") {
  const container = document.getElementById("staffContainer");
  const div = document.createElement("div");
  div.classList.add("row");
  div.innerHTML = `
    <input class="form-control" placeholder="Staff Name" value="${escapeHtml(
      name
    )}" />
    <input class="form-control" placeholder="Role" value="${escapeHtml(
      role
    )}" />
    <button type="button" class="delete-btn" title="Remove">Remove</button>
  `;
  div.querySelector("button").onclick = () => div.remove();
  container.appendChild(div);
}
window.addStaff = addStaff;

/* ===== Load master Pharmacy details (single record) ===== */
export async function loadPharmacyDetails() {
  // Fetch pharmacy details snapshot from database
  const snap = await database.ref("pharmacyDetails").once("value");
  const data = snap.val();
  if (!data) return; // Exit if no data found

  // Set individual form field values from fetched data
  setVal("pharmacyName", data.pharmacyName);
  setVal("registrationNumber", data.registrationNumber);
  setVal("address", data.address);
  setVal("phone", data.phone);
  setVal("email", data.email);
  setVal("operatingHours", data.operatingHours);
  setVal("ownerName", data.ownerName);
  setVal("pharmacyType", data.pharmacyType);

  // Clear existing doctors and staff containers
  document.getElementById("doctorsContainer").innerHTML = "";
  document.getElementById("staffContainer").innerHTML = "";

  // Add doctor rows if array exists
  if (Array.isArray(data.doctors)) {
    data.doctors.forEach((d) => addDoctor(d.name, d.specialization));
  }
  // Add staff rows if array exists
  if (Array.isArray(data.staff)) {
    data.staff.forEach((s) => addStaff(s.name, s.role));
  }
}
window.loadPharmacyDetails = loadPharmacyDetails;

/* ===== Validation function ===== */
// Validate pharmacy profile inputs before saving
function validatePharmacyProfile() {
  // Get all form field values trimmed
  const pharmacyName = getVal("pharmacyName");
  const registrationNumber = getVal("registrationNumber");
  const address = getVal("address");
  const operatingHours = getVal("operatingHours");
  const phone = getVal("phone");
  const ownerName = getVal("ownerName");
  const pharmacyType = getVal("pharmacyType");
  const email = getVal("email");

  // Pharmacy Name: only alphabets and spaces allowed
  if (!/^[A-Za-z\s]+$/.test(pharmacyName)) {
    showInfoModal(
      "Validation Error",
      "Pharmacy Name can only contain alphabets and spaces."
    );
    return false;
  }

  // Registration Number: digits only
  if (!/^\d+$/.test(registrationNumber)) {
    showInfoModal(
      "Validation Error",
      "Registration Number can only contain numbers."
    );
    return false;
  }

  // Address: letters, numbers, spaces, hyphens; max length 128
  if (!/^[A-Za-z0-9\s-]{1,128}$/.test(address)) {
    showInfoModal(
      "Validation Error",
      "Address can only contain alphabets, numbers, spaces, and hyphens, max 128 characters."
    );
    return false;
  }
  // Check max 2 digits in address
  const numbersInAddress = (address.match(/\d/g) || []).length;
  if (numbersInAddress > 2) {
    showInfoModal("Validation Error", "Address can contain at most 2 numbers.");
    return false;
  }

  // Operating Hours: format like "9AM - 5PM"
  if (
    !/^\d{1,2}\s?(AM|PM|am|pm)\s?-\s?\d{1,2}\s?(AM|PM|am|pm)$/.test(
      operatingHours
    )
  ) {
    showInfoModal(
      "Validation Error",
      "Operating Hours must be in format like '9AM - 5PM'."
    );
    return false;
  }

  // Phone: max 14 characters, digits, plus, minus, spaces allowed
  if (!/^[\d+\-\s]{1,14}$/.test(phone)) {
    showInfoModal(
      "Validation Error",
      "Phone number must be maximum 14 characters and can include digits, +, -, and spaces."
    );
    return false;
  }

  // Owner Name: alphabets and spaces only
  if (!/^[A-Za-z\s]+$/.test(ownerName)) {
    showInfoModal(
      "Validation Error",
      "Owner Name can only contain alphabets and spaces."
    );
    return false;
  }

  // Pharmacy Type: alphabets and spaces only
  if (!/^[A-Za-z\s]+$/.test(pharmacyType)) {
    showInfoModal(
      "Validation Error",
      "Pharmacy Type can only contain alphabets and spaces."
    );
    return false;
  }

  // Email: simple pattern to validate something@alphabets.alphabets
  if (!/^[^@]+@[A-Za-z]+\.[A-Za-z]+$/.test(email)) {
    showInfoModal(
      "Validation Error",
      "Email must be in format something@alphabet.alphabet"
    );
    return false;
  }

  // All validations passed
  return true;
}

/* ===== Save master Pharmacy details ===== */
export async function saveAllInfo() {
  // Get currently authenticated user
  const user = auth.currentUser;
  if (!user) {
    showInfoModal("Login Required", "Please sign in to continue.");
    return;
  }

  // Verify user role is admin before allowing save
  const roleSnap = await database
    .ref("users/" + user.uid + "/role")
    .once("value");
  if (roleSnap.val() !== "admin") {
    showInfoModal("Permission Denied", "Only admins can save.");
    return;
  }

  // Run validation; if fails, stop saving
  if (!validatePharmacyProfile()) {
    return;
  }

  // Prepare data object from form values and doctors/staff rows
  const data = {
    pharmacyName: getVal("pharmacyName"),
    registrationNumber: getVal("registrationNumber"),
    address: getVal("address"),
    phone: getVal("phone"),
    email: getVal("email"),
    operatingHours: getVal("operatingHours"),
    ownerName: getVal("ownerName"),
    pharmacyType: getVal("pharmacyType"),
    doctors: Array.from(
      document.querySelectorAll("#doctorsContainer .row")
    ).map((row) => ({
      name: (row.children[0].value || "").trim(),
      specialization: (row.children[1].value || "").trim(),
    })),
    staff: Array.from(document.querySelectorAll("#staffContainer .row")).map(
      (row) => ({
        name: (row.children[0].value || "").trim(),
        role: (row.children[1].value || "").trim(),
      })
    ),
  };

  try {
    // Save the data to Firebase database under "pharmacyDetails" node
    await database.ref("pharmacyDetails").set(data);
    showInfoModal("Saved", "Pharmacy details have been saved successfully.");
  } catch (err) {
    showInfoModal("Error", err.message || "Failed to save details.");
  }
}
window.saveAllInfo = saveAllInfo; // Expose globally

/* ===== Requests / List Realtime ===== */
// References to Firebase paths for pharmacy requests and pharmacy list
const reqRef = database.ref("requests");
const listRef = database.ref("pharmacyDetailsList");

// Arrays to hold all requests and pharmacies fetched from DB realtime
let allPharmacyRequests = [];
let allPharmacyList = [];

// Load pharmacy requests from DB, update allPharmacyRequests and render UI
window.loadPharmacyRequests = function () {
  reqRef.on("value", (snapshot) => {
    allPharmacyRequests = [];
    snapshot.forEach((child) => {
      allPharmacyRequests.push({ id: child.key, data: child.val() });
    });
    renderFilteredRequests(); // render after fetching
  });
};

// Load pharmacy list from DB, update allPharmacyList and render UI
window.loadPharmacyList = function () {
  listRef.on("value", (snapshot) => {
    allPharmacyList = [];
    snapshot.forEach((child) => {
      allPharmacyList.push({ id: child.key, data: child.val() });
    });
    renderFilteredList(); // render after fetching
  });
};

// Listen to input changes in search box and re-render filtered requests and list
document
  .getElementById("pharmacySearchInput")
  .addEventListener("input", function () {
    renderFilteredRequests();
    renderFilteredList();
  });

// Render filtered requests that match search term into the requests section
function renderFilteredRequests() {
  const searchTerm = (
    document.getElementById("pharmacySearchInput").value || ""
  )
    .toLowerCase()
    .trim();
  const section = document.getElementById("pharmacyRequests");
  section.innerHTML = ""; // clear old content

  allPharmacyRequests.forEach(({ id, data }) => {
    // Convert data to string and check if search term is included
    if (
      JSON.stringify(data || {})
        .toLowerCase()
        .includes(searchTerm)
    ) {
      section.appendChild(buildCard(data, id, true)); // true = isRequest
    }
  });
}

// Render filtered pharmacy list that match search term into the list section
function renderFilteredList() {
  const searchTerm = (
    document.getElementById("pharmacySearchInput").value || ""
  )
    .toLowerCase()
    .trim();
  const section = document.getElementById("pharmacyList");
  section.innerHTML = ""; // clear old content

  allPharmacyList.forEach(({ id, data }) => {
    if (
      JSON.stringify(data || {})
        .toLowerCase()
        .includes(searchTerm)
    ) {
      section.appendChild(buildCard(data, id, false)); // false = isRequest
    }
  });
}

/* ===== Card Builder ===== */
// Builds a collapsible card element displaying pharmacy/request info with action buttons
function buildCard(data, id, isRequest) {
  // Extract relevant fields with fallbacks
  const name = data.name || data.pharmacyName || "Unnamed Pharmacy";
  const owner = data.owner || data.ownerName || "-";
  const email = data.email || "-";
  const phone = data.phone || "-";
  const address = data.address || "-";
  const reg = data.registrationNumber || "-";
  const type = data.type || data.pharmacyType || "-";

  // Create main card container div and add styling class
  const card = document.createElement("div");
  card.className = "collapsible-card";

  // Fill card inner HTML with heading and hidden details container
  card.innerHTML = `
    <h3>${escapeHtml(name)}</h3>
    <div class="card-content">
      <p><strong>Owner:</strong> ${escapeHtml(owner)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Address:</strong> ${escapeHtml(address)}</p>
      ${
        isRequest
          ? "" // Requests do not show registration number and type
          : `<p><strong>Registration Number:</strong> ${escapeHtml(reg)}</p>
             <p><strong>Type:</strong> ${escapeHtml(type)}</p>`
      }
    </div>
  `;

  // Create button container div for card actions
  const btnGroup = document.createElement("div");
  btnGroup.className = "card-buttons card-content";

  if (isRequest) {
    // If card represents a pharmacy request, show Approve and Reject buttons

    // Approve button pushes request data to pharmacy list and removes request from DB
    const approve = document.createElement("button");
    approve.className = "approve-btn";
    approve.textContent = "Approve";
    approve.onclick = async (e) => {
      e.stopPropagation(); // prevent card collapse toggle
      try {
        await listRef.push(data); // Add request to pharmacy list
        await reqRef.child(id).remove(); // Remove request from requests
        showInfoModal("Approved", "Pharmacy request approved.");
        loadPharmacyRequests(); // Refresh requests
        loadPharmacyList(); // Refresh pharmacy list
      } catch (err) {
        showInfoModal("Error", err.message || "Failed to approve request.");
      }
    };

    // Reject button shows confirm modal; if yes, deletes request from DB
    const reject = document.createElement("button");
    reject.className = "reject-btn";
    reject.textContent = "Reject";
    reject.onclick = (e) => {
      e.stopPropagation();
      showConfirmModal(
        "Reject Request",
        "Are you sure you want to reject this request?",
        async () => {
          try {
            await reqRef.child(id).remove();
            showInfoModal("Rejected", "Pharmacy request rejected.");
            loadPharmacyRequests();
          } catch (err) {
            showInfoModal("Error", err.message || "Failed to reject request.");
          }
        }
      );
    };

    // Append approve/reject buttons to button group
    btnGroup.appendChild(approve);
    btnGroup.appendChild(reject);
  } else {
    // If card represents an approved pharmacy, show Edit and Remove buttons

    // Edit button opens modal pre-filled with pharmacy data for editing
    const editBtn = document.createElement("button");
    editBtn.className = "primary";
    editBtn.textContent = "Edit";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openEditModal(id, data);
    };

    // Remove button shows confirm modal; if yes, deletes pharmacy from DB
    const removeBtn = document.createElement("button");
    removeBtn.className = "delete-btn";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      showConfirmModal(
        "Remove Pharmacy",
        `Are you sure you want to remove "${name}"?`,
        async () => {
          try {
            await listRef.child(id).remove();
            showInfoModal("Removed", "Pharmacy removed successfully.");
            loadPharmacyList();
          } catch (err) {
            showInfoModal("Error", err.message || "Failed to remove pharmacy.");
          }
        }
      );
    };

    // Append Edit and Remove buttons to button group
    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(removeBtn);
  }

  // Append button group to the card element
  card.appendChild(btnGroup);

  // Add click listener on card to toggle expanded/collapsed details
  card.addEventListener("click", () => {
    card.classList.toggle("expanded");
  });

  return card; // Return constructed card element for appending in UI
}

/* ===== Edit Modal ===== */
// Open modal dialog to edit a pharmacy's details, pre-fill form inputs
function openEditModal(id, data) {
  const modal = document.getElementById("editPharmacyModal");
  const form = document.getElementById("editPharmacyForm");
  const cancelBtn = document.getElementById("editCancelBtn");
  const saveBtn = document.getElementById("editSaveBtn");

  // Set form inputs values with existing pharmacy data (fallbacks included)
  form.name.value = data.pharmacyName || data.name || "";
  form.owner.value = data.ownerName || data.owner || "";
  form.email.value = data.email || "";
  form.phone.value = data.phone || "";
  form.address.value = data.address || "";
  form.registrationNumber.value = data.registrationNumber || "";
  form.type.value = data.pharmacyType || data.type || "";

  showModal(modal); // Show edit modal & backdrop

  // Cancel button hides the modal without saving
  cancelBtn.onclick = () => hideModal(modal);

  // Save button collects form data and updates DB, then closes modal
  saveBtn.onclick = async () => {
    const updated = {
      pharmacyName: form.name.value.trim(),
      ownerName: form.owner.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      registrationNumber: form.registrationNumber.value.trim(),
      pharmacyType: form.type.value.trim(),
    };
    try {
      await database.ref("pharmacyDetailsList/" + id).update(updated); // Update data in DB
      hideModal(modal);
      showInfoModal("Updated", "Pharmacy updated successfully.");
    } catch (err) {
      showInfoModal("Error", err.message || "Failed to update pharmacy.");
    }
  };
}

/* ===== Small utils ===== */
// Set value of input element by ID, default to empty string if undefined/null
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v || "";
}
// Get trimmed value of input element by ID, default to empty string if no value
function getVal(id) {
  const el = document.getElementById(id);
  return (el && el.value ? el.value : "").trim();
}
// Escape HTML special characters to prevent injection in rendered text
function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"]/g, (ch) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return map[ch];
  });
}

/* Expose for inline buttons (if any) */
window.showInfoModal = showInfoModal;
window.showConfirmModal = showConfirmModal;
window.saveAllInfo = saveAllInfo;
window.loadPharmacyDetails = loadPharmacyDetails;
window.loadPharmacyRequests = window.loadPharmacyRequests;
window.loadPharmacyList = window.loadPharmacyList;
