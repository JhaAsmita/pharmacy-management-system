import { logout } from "./auth.js";

/**
 * Utility function to escape HTML special characters to prevent XSS attacks.
 * @param {string} text - The input text to sanitize
 * @returns {string} - The escaped text safe for inserting into HTML
 */
function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"]+/g, (m) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return map[m];
  });
}

/**
 * Function to render the user sidebar navigation dynamically
 * @param {string} containerId - The ID of the container to render the sidebar into
 * @param {string} userDisplayNameOrEmail - The display name or email of the user
 * @param {boolean} [startCollapsed=false] - Whether to start in collapsed state (for desktop)
 */
export function renderUserSidebar(
  containerId,
  userDisplayNameOrEmail,
  startCollapsed = false
) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found.`);
    return;
  }

  const currentPage = window.location.pathname.split("/").pop();

  container.innerHTML = `
    <button class="menu-toggle" aria-label="Toggle sidebar" aria-expanded="${!startCollapsed}">
      <i class="fas fa-bars"></i>
    </button>
    <aside class="sidebar ${
      startCollapsed ? "collapsed" : ""
    }" role="navigation" aria-label="User Sidebar Navigation">
      <div class="logo">PMS</div>
      <nav>
        <a href="user-dashboard.html" id="nav-dashboard" class="${
          currentPage === "user-dashboard.html" ? "active" : ""
        }" aria-current="${
    currentPage === "user-dashboard.html" ? "page" : "false"
  }">
          <i class="fas fa-tachometer-alt"></i><span style="color:white">Dashboard</span>
        </a>
        <a href="user-inventory.html" id="nav-inventory" class="${
          currentPage === "user-inventory.html" ? "active" : ""
        }" aria-current="${
    currentPage === "user-inventory.html" ? "page" : "false"
  }">
          <i class="fas fa-boxes"></i><span style="color:white">Inventory</span>
        </a>
        <a href="cart.html" id="nav-cart" style="display:none;" class="${
          currentPage === "cart.html" ? "active" : ""
        }" aria-current="${currentPage === "cart.html" ? "page" : "false"}">
          <i class="fas fa-shopping-cart"></i><span>Cart</span>
        </a>
        <a href="user-billing.html" id="nav-billing"  class="${
          currentPage === "user-billing.html" ? "active" : ""
        }">
          <i class="fas fa-file-invoice-dollar" "></i><span style="color:white">Billing</span>
        </a>
        <a href="user-payment-management.html" id="nav-cart" class="${
          currentPage === "user-payment-management.html" ? "active" : ""
        }" aria-current="${
    currentPage === "user-payment-management.html" ? "page" : "false"
  }">
          <i class="fas fa-money-bill-wave"></i><span style="color:white">Payments</span>
        </a>
      </nav>
      <div class="user-info" aria-live="polite">
        Logged in as: <br /><strong>${escapeHtml(
          userDisplayNameOrEmail
        )}</strong>
      </div>
      <button class="logout-btn" id="logoutBtn" aria-label="Logout">
        <i class="fas fa-sign-out-alt"></i><span>Logout</span>
      </button>
    </aside>
  `;

  // Sidebar toggle logic
  const sidebar = container.querySelector(".sidebar");
  const toggleBtn = container.querySelector(".menu-toggle");

  toggleBtn.addEventListener("click", () => {
    const isMobile = window.innerWidth <= 992;

    if (isMobile) {
      const isOpen = sidebar.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", isOpen);
    } else {
      const isCollapsed = sidebar.classList.toggle("collapsed");
      toggleBtn.setAttribute("aria-expanded", !isCollapsed);
    }
  });

  // Close sidebar on mobile when clicking outside
  document.addEventListener("click", (e) => {
    const isMobile = window.innerWidth <= 992;

    if (
      isMobile &&
      !sidebar.contains(e.target) &&
      !toggleBtn.contains(e.target)
    ) {
      if (sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Logout button handler
  container.querySelector("#logoutBtn").addEventListener("click", logout);

  // Keyboard accessibility
  container.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        link.click();
      }
    });
  });
}
