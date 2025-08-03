// Import Firebase auth and database from config, logout function, and sidebar renderer
import { auth, database } from "./firebase-config.js";
import { logout } from "./auth.js";
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";

// DOM elements for showing admin email, messages, user list, form, logout button, and modal elements
const adminEmailElem = document.getElementById("admin-email");
const noAuthorityMsg = document.getElementById("noAuthorityMessage");
const content = document.querySelector("main");
const usersList = document.getElementById("usersList");
const addUserForm = document.getElementById("addUserForm");
const logoutBtn = document.getElementById("logout-btn");

// Modal elements (info and confirm modals)
const backdrop = document.getElementById("modal-backdrop");
const infoModal = document.getElementById("info-modal");
const infoTitle = document.getElementById("info-modal-title");
const infoBody = document.getElementById("info-modal-body");
const infoClose = document.getElementById("info-modal-close");

const confirmModal = document.getElementById("confirm-modal");
const confirmTitle = document.getElementById("confirm-modal-title");
const confirmBody = document.getElementById("confirm-modal-body");
const confirmYes = document.getElementById("confirm-yes");
const confirmNo = document.getElementById("confirm-no");

/* ===== Modal helper functions ===== */
// Show given modal and backdrop
function showModal(modal) {
  backdrop.classList.remove("hidden");
  modal.classList.remove("hidden");
}
// Hide given modal and backdrop
function hideModal(modal) {
  backdrop.classList.add("hidden");
  modal.classList.add("hidden");
}

// Show info modal with title and message
function showInfoModal(title, message) {
  infoTitle.textContent = title;
  infoBody.textContent = message;
  showModal(infoModal);
}

// Show confirm modal with title, message, and a callback for "Yes" click
function showConfirmModal(title, message, onYes) {
  confirmTitle.textContent = title;
  confirmBody.textContent = message;
  showModal(confirmModal);

  confirmYes.onclick = () => {
    hideModal(confirmModal);
    onYes();
  };
  confirmNo.onclick = () => hideModal(confirmModal);
}

// Close info modal when "OK" button clicked
infoClose.addEventListener("click", () => hideModal(infoModal));

/* ===== Responsive table labeling ===== */
// Adds data-label attribute to each <td> for responsive display on small screens
function applyResponsiveTableLabels(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
    th.textContent.trim()
  );
  table.querySelectorAll("tbody tr").forEach((tr) => {
    Array.from(tr.children).forEach((td, idx) => {
      // Skip cells that span all columns (like loading row)
      if (td.getAttribute("colspan") !== "3") {
        td.setAttribute("data-label", headers[idx]);
      }
    });
  });
}

/* ===== Authentication and authorization ===== */
auth.onAuthStateChanged((user) => {
  // If not logged in, hide main content and show message
  if (!user) {
    content.style.display = "none";
    noAuthorityMsg.style.display = "block";
    noAuthorityMsg.textContent = "You must be logged in to view this page.";
    return;
  }

  // Check user's role from database
  database
    .ref("users/" + user.uid)
    .once("value")
    .then((snap) => {
      const data = snap.val();
      // Show admin content only if user role is 'admin'
      if (data && data.role === "admin") {
        content.style.display = "block";
        renderAdminSidebar("sidebar-container", user.email); // Render sidebar with user email
        adminEmailElem.textContent = user.email;
        loadUsers(); // Load staff users
      } else {
        content.style.display = "none";
        noAuthorityMsg.style.display = "block";
        noAuthorityMsg.textContent = "You do not have authority.";
      }
    });
});

/* ===== Initialization on DOM load ===== */
document.addEventListener("DOMContentLoaded", () => {
  renderAdminSidebar("sidebar-container", "Loading...");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // Redirect if not logged in
      window.location.href = "index.html";
      return;
    }

    // Get user role to confirm admin access
    const roleSnapshot = await database
      .ref(`users/${user.uid}/role`)
      .once("value");
    const role = roleSnapshot.val();

    if (role !== "admin") {
      alert("Access denied. Admins only.");
      logout();
      return;
    }

    // Render sidebar and display user info in UI
    renderAdminSidebar(
      "sidebar-container",
      user.email || user.displayName || "Admin"
    );

    document.getElementById("user-name").textContent =
      user.displayName || "Admin User";
    document.getElementById("user-email").textContent = user.email || "-";
    document.getElementById("user-role").textContent = role || "-";

    // Attach logout button event
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      logout();
    });

    // Load any dashboard stats (function assumed defined elsewhere)
    await loadDashboardStats();
  });
});

/* ===== Responsive zoom for mobile/tablet ===== */
window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out on medium screens
  } else {
    document.body.style.zoom = "80%"; // Zoom out default for others
  }
});

/* ===== Add new user handler ===== */
addUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get input values
  const email = document.getElementById("newEmail").value.trim();
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("newRole").value;

  // Validation: email format and password rules
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

  if (!emailRegex.test(email)) {
    showInfoModal("Validation Error", "Please enter a valid email address.");
    return;
  }

  if (!passwordRegex.test(password)) {
    showInfoModal(
      "Validation Error",
      "Password must be at least 6 characters long and include at least one letter and one number."
    );
    return;
  }

  try {
    // Check if email already registered with Firebase Auth
    const methods = await auth.fetchSignInMethodsForEmail(email);

    if (methods.length > 0) {
      // If user exists, check if they have a role assigned in the database
      const usersSnapshot = await database
        .ref("users")
        .orderByChild("email")
        .equalTo(email)
        .once("value");

      if (usersSnapshot.exists()) {
        let roleAssigned = false;
        let uid = null;

        usersSnapshot.forEach((childSnap) => {
          if (childSnap.val().role) roleAssigned = true;
          uid = childSnap.key;
        });

        if (roleAssigned) {
          showInfoModal("Error", "Email already exists and has a role.");
        } else {
          // Assign role to user in database if none assigned yet
          await database.ref("users/" + uid).update({ role });
          showInfoModal("Success", "User role updated successfully.");
          loadUsers();
        }
      } else {
        showInfoModal("Error", "Email exists in Auth but not in database.");
      }
    } else {
      // If email is new, create user with secondary Firebase app instance
      const secondaryApp = firebase.app("Secondary");
      const secondaryAuth = secondaryApp.auth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(
        email,
        password
      );
      // Save user email and role in database
      await database.ref("users/" + cred.user.uid).set({ email, role });
      showInfoModal("Success", "User added successfully.");
      addUserForm.reset();
      loadUsers();
    }
  } catch (err) {
    showInfoModal("Error", err.message);
  }
});

/* ===== Load and display staff users in table ===== */
function loadUsers() {
  usersList.innerHTML = `<tr><td colspan="3">Loading...</td></tr>`;

  database
    .ref("users")
    .once("value")
    .then((snap) => {
      usersList.innerHTML = "";

      if (!snap.exists()) {
        usersList.innerHTML = `<tr><td colspan="3">No staff found.</td></tr>`;
        return;
      }

      snap.forEach((child) => {
        const u = child.val();
        // Skip admins, show only staff users
        if (u.role !== "admin") {
          const row = document.createElement("tr");
          row.innerHTML = ` 
            <td>${escapeHtml(u.email)}</td> 
            <td>${escapeHtml(u.role)}</td> 
            <td> 
              <button class="delete-btn" 
                onclick="deleteUser('${child.key}','${escapeHtml(u.email)}')"> 
                Delete 
              </button> 
            </td>`;
          usersList.appendChild(row);
        }
      });

      // Show message if no staff users found
      if (!usersList.hasChildNodes()) {
        usersList.innerHTML = `<tr><td colspan="3">No staff members found.</td></tr>`;
      }

      // Add responsive labels to table cells for mobile display
      applyResponsiveTableLabels("staffTable");
    })
    .catch((err) => {
      usersList.innerHTML = `<tr><td colspan="3">${escapeHtml(
        err.message
      )}</td></tr>`;
    });
}

/* ===== Delete user confirmation and removal ===== */
window.deleteUser = (uid, email) => {
  showConfirmModal("Delete User", `Delete ${email}?`, () => {
    database
      .ref("users/" + uid)
      .remove()
      .then(() => {
        showInfoModal("Deleted", "User deleted successfully.");
        loadUsers(); // Reload list after deletion
      })
      .catch((err) => {
        showInfoModal("Error", err.message);
      });
  });
};

/* ===== Attach logout event to logout button ===== */
logoutBtn.addEventListener("click", logout);

/* ===== Helper: escape HTML special characters for safe output ===== */
function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"]/g, (ch) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return map[ch];
  });
}
