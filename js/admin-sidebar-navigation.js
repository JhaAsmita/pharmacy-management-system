// Import the logout function from the authentication module (auth.js)
import { logout } from "./auth.js";

/**
 * escapeHtml function
 * Prevents Cross-Site Scripting (XSS) attacks by escaping special HTML characters in strings.
 * @param {string} text - The input string to sanitize
 * @returns {string} - The escaped string safe to insert into HTML
 */
function escapeHtml(text) {
  if (!text) return ""; // Return empty string if input is falsy (null, undefined, "")
  return text.replace(/[&<>"]+/g, (m) => {
    // Replace any &, <, >, or " characters with HTML entities
    const map = {
      "&": "&amp;", // & becomes &amp;
      "<": "&lt;", // < becomes &lt;
      ">": "&gt;", // > becomes &gt;
      '"': "&quot;", // " becomes &quot;
    };
    return map[m]; // Return corresponding escaped entity
  });
}

/**
 * renderAdminSidebar function
 * Dynamically builds and renders the admin sidebar navigation inside the specified container element.
 * It highlights the current page link, displays logged-in user info, and manages sidebar toggling.
 *
 * @param {string} containerId - The HTML element ID where sidebar will be injected.
 * @param {string} userDisplayNameOrEmail - The logged-in user's display name or email to show in sidebar.
 * @param {boolean} [startCollapsed=false] - Optional flag to start sidebar in collapsed state.
 */
export function renderAdminSidebar(
  containerId,
  userDisplayNameOrEmail,
  startCollapsed = false
) {
  // Get the container element by ID
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found.`); // Log error if container missing
    return;
  }

  // Get current page filename to highlight active navigation link
  const currentPage = window.location.pathname.split("/").pop();

  // Inject sidebar HTML structure dynamically inside container
  container.innerHTML = `
    <button class="menu-toggle" aria-label="Toggle sidebar" aria-expanded="${!startCollapsed}">
      <i class="fas fa-bars"></i>
    </button>
    <aside class="sidebar ${
      startCollapsed ? "collapsed" : ""
    }" role="navigation" aria-label="Admin Sidebar Navigation">
      <div class="logo" aria-label="Application Logo">PMS</div>
      <nav>
        <a href="admin.html" id="nav-users" class="${
          currentPage === "admin.html" ? "active" : ""
        }" aria-current="${currentPage === "admin.html" ? "page" : "false"}">
          <i class="fas fa-users"></i><span style="color:white">Users</span>
        </a>
        <a href="pharmacy-details.html" id="nav-pharmacy-details" class="${
          currentPage === "pharmacy-details.html" ? "active" : ""
        }" aria-current="${
    currentPage === "pharmacy-details.html" ? "page" : "false"
  }">
          <i class="fas fa-clinic-medical"></i><span style="color:white">Pharmacy Details</span>
        </a>
        <a href="dashboard.html" id="nav-dashboard" class="${
          currentPage === "dashboard.html" ? "active" : ""
        }" aria-current="${
    currentPage === "dashboard.html" ? "page" : "false"
  }">
          <i class="fas fa-chart-line"></i><span style="color:white">Dashboard</span>
        </a>
        <a href="inventory.html" id="nav-inventory" class="${
          currentPage === "inventory.html" ? "active" : ""
        }" aria-current="${
    currentPage === "inventory.html" ? "page" : "false"
  }">
          <i class="fas fa-boxes"></i><span style="color:white">Inventory</span>
        </a>
        <a href="supplier-management.html" id="nav-billing" class="${
          currentPage === "supplier-management.html" ? "active" : ""
        }" aria-current="${
    currentPage === "supplier-management.html" ? "page" : "false"
  }">
          <i class="fas fa-file-invoice"></i><span style="color:white">Suppliers</span>
        </a>
        <a href="billing.html" id="nav-cart" class="${
          currentPage === "billing.html" ? "active" : ""
        }" aria-current="${currentPage === "billing.html" ? "page" : "false"}">
          <i class="fas fa-shopping-cart"></i><span style="color:white">Billing</span>
        </a>
        <a href="payment-management.html" id="nav-cart" class="${
          currentPage === "payment-management.html" ? "active" : ""
        }" aria-current="${
    currentPage === "payment-management.html" ? "page" : "false"
  }">
          <i class="fas fa-money-bill-wave"></i><span style="color:white">Payments</span>
        </a>
        <a href="report.html" id="nav-reports" class="${
          currentPage === "report.html" ? "active" : ""
        }" aria-current="${currentPage === "report.html" ? "page" : "false"}">
          <i class="fas fa-chart-pie"></i><span style="color:white">Reports</span>
        </a>
      </nav>
      <div class="user-info" aria-live="polite">
        Logged in as: <br /><strong style="color:white">${escapeHtml(
          userDisplayNameOrEmail
        )}</strong>
      </div>
      <button class="logout-btn" id="logoutBtn" aria-label="Logout">
        <i class="fas fa-sign-out-alt"></i><span>Logout</span>
      </button>
    </aside>
  `;

  // Store references to sidebar and toggle button for later use
  const sidebar = container.querySelector(".sidebar");
  const toggleBtn = container.querySelector(".menu-toggle");

  // Add click listener on toggle button to open/collapse sidebar
  toggleBtn.addEventListener("click", () => {
    const isMobile = window.innerWidth <= 992; // Check if screen is mobile size

    if (isMobile) {
      // On mobile: toggle sidebar open/close by toggling 'open' class
      const isOpen = sidebar.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", isOpen); // Update ARIA for accessibility
    } else {
      // On desktop: toggle sidebar collapse by toggling 'collapsed' class
      const isCollapsed = sidebar.classList.toggle("collapsed");
      toggleBtn.setAttribute("aria-expanded", !isCollapsed); // ARIA expanded is true if sidebar is NOT collapsed
    }
  });

  // Click outside sidebar closes it on mobile for better UX
  document.addEventListener("click", (e) => {
    const isMobile = window.innerWidth <= 992;
    // If clicked outside sidebar and toggle button
    if (
      isMobile &&
      !sidebar.contains(e.target) &&
      !toggleBtn.contains(e.target)
    ) {
      if (sidebar.classList.contains("open")) {
        sidebar.classList.remove("open"); // Close sidebar
        toggleBtn.setAttribute("aria-expanded", "false"); // Update ARIA
      }
    }
  });

  // Attach logout function to logout button click
  container.querySelector("#logoutBtn").addEventListener("click", logout);

  // Keyboard accessibility: allow Enter or Space keys to activate nav links
  container.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); // Prevent default scroll behavior
        link.click(); // Trigger link click programmatically
      }
    });
  });
}

/**
 * toggleSidebarCollapse function
 * Programmatically toggles the collapsed state of the sidebar.
 *
 * @param {string} containerId - The ID of the container that holds the sidebar.
 * @param {boolean} collapsed - True to collapse sidebar, false to expand.
 */
export function toggleSidebarCollapse(containerId, collapsed) {
  const container = document.getElementById(containerId);
  if (!container) return; // If container missing, exit

  const sidebar = container.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("collapsed", collapsed); // Add or remove 'collapsed' class based on boolean
  }
}
