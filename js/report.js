// js/report.js

// Importing necessary modules from other files:
// - auth and database from firebase-config.js for Firebase authentication and database access
// - logout function for signing out users
// - renderAdminSidebar to render the admin sidebar navigation
import { auth, database } from "./firebase-config.js";
import { logout } from "./auth.js";
import { renderAdminSidebar } from "./admin-sidebar-navigation.js";

// --- DOM Elements ---
// Grabbing DOM elements by their IDs or selectors for later manipulation

const adminEmailElem = document.getElementById("admin-email"); // Element displaying admin email
const userEmailElem = document.getElementById("userEmail"); // Sidebar user email display
const noAuthorityMsg = document.getElementById("noAuthorityMessage"); // Message shown if user unauthorized
const mainContent = document.querySelector("main.content"); // Main content section
const contentWrapper = document.querySelector(
  ".main-content-and-panel-wrapper"
); // Wrapper element that contains main content and right detail panel

// KPI Elements - Showing Key Performance Indicators on the dashboard
const totalSalesAmountElem = document.getElementById("totalSalesAmount");
const totalProfitAmountElem = document.getElementById("totalProfitAmount");
const totalTransactionsElem = document.getElementById("totalTransactions");
const unpaidTransactionsCountElem = document.getElementById(
  "unpaidTransactionsCount"
);
const unpaidAmountElem = document.getElementById("unpaidAmount");

// Chart Contexts - Canvas 2D contexts for Chart.js charts (used for drawing charts)
const dailySalesTrendChartCtx = document
  .getElementById("dailySalesTrendChart")
  .getContext("2d");
const monthlySalesTrendChartCtx = document
  .getElementById("monthlySalesTrendChart")
  .getContext("2d");
const yearlySalesTrendChartCtx = document
  .getElementById("yearlySalesTrendChart")
  .getContext("2d");
const inventoryStatusChartCtx = document
  .getElementById("inventoryStatusChart")
  .getContext("2d");
const profitByCategoryChartCtx = document
  .getElementById("profitByCategoryChart")
  .getContext("2d");

// Chart Instances - Variables to store active Chart.js instances, start with null
// Prevents errors from trying to destroy or access charts before initialization
let dailySalesTrendChartInstance = null;
let monthlySalesTrendChartInstance = null;
let yearlySalesTrendChartInstance = null;
let inventoryStatusChartInstance = null;
let profitByCategoryChartInstance = null; // Fixed typo here (if previously duplicated)

// Chart Container Elements - These hold the chart canvases and can be hidden/shown
const dailySalesChartContainer = document.getElementById(
  "dailySalesChartContainer"
);
const monthlySalesChartContainer = document.getElementById(
  "monthlySalesChartContainer"
);
const yearlySalesChartContainer = document.getElementById(
  "yearlySalesChartContainer"
);
const inventoryChartContainer = document.getElementById(
  "inventoryChartContainer"
);
const profitChartContainer = document.getElementById("profitChartContainer");

// Sales Table & Filter Elements - For the sales list table and filter controls
const salesList = document.getElementById("salesList");
const salesSearchInput = document.getElementById("salesSearch");
const soldByFilter = document.getElementById("soldByFilter");
const salesTypeFilter = document.getElementById("salesTypeFilter");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const minAmountInput = document.getElementById("minAmount");
const maxAmountInput = document.getElementById("maxAmount");
const applySalesFiltersBtn = document.getElementById("applySalesFilters");
const resetSalesFiltersBtn = document.getElementById("resetSalesFilters");

// Other Table Elements for pharmacy and supplier lists
const pharmacyList = document.getElementById("pharmacyList");
const supplierList = document.getElementById("supplierList");

// Right Detail Panel Elements - Sidebar panel showing detailed info on demand
const rightDetailPanel = document.getElementById("right-detail-panel");
const panelTitle = document.getElementById("panel-title");
const panelContent = document.getElementById("panel-content");
const closePanelBtn = document.getElementById("close-panel-btn");
const printPanelBtn = document.getElementById("print-panel-btn");

// Global Data Storage - variables to hold all fetched data from Firebase
let allSalesData = []; // Array of all sales records
let allMedicinesData = {}; // Object mapping medicineId => medicine details
let allCategoriesData = {}; // Object mapping categoryId => category name
let allSuppliersData = {}; // Object mapping supplierId => supplier details
let allPharmacyDetails = []; // Array of pharmacy objects
let allUsersData = {}; // Object mapping userId => user details

const LOW_STOCK_THRESHOLD = 10; // Threshold to consider stock as low

// Event listener to run when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Render the admin sidebar navigation placeholder initially with "Loading..."
  renderAdminSidebar("sidebar-container", "Loading...");

  // Listen for Firebase auth state changes (user login/logout)
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // If not logged in, redirect to login page (index.html)
      window.location.href = "index.html";
      return;
    }

    // Fetch user role from Firebase realtime database at users/{uid}/role
    const roleSnapshot = await database
      .ref(`users/${user.uid}/role`)
      .once("value");
    const role = roleSnapshot.val();

    // If user is not admin, deny access and logout
    if (role !== "admin") {
      alert("Access denied. Admins only.");
      logout();
      return;
    }

    // If admin, render sidebar with their email or displayName
    renderAdminSidebar(
      "sidebar-container",
      user.email || user.displayName || "Admin"
    );

    // Display user info on dashboard
    document.getElementById("user-name").textContent =
      user.displayName || "Admin User";
    document.getElementById("user-email").textContent = user.email || "-";
    document.getElementById("user-role").textContent = role || "-";

    // Attach logout button click event
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      logout();
    });

    // Load dashboard stats after user verified
    await loadDashboardStats();
  });
});

// Another DOMContentLoaded listener for zoom behavior on page load
window.addEventListener("DOMContentLoaded", () => {
  // Zoom out the page based on screen width for better readability
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    document.body.style.zoom = "60%"; // Zoom out more on small-medium screens
  } else {
    document.body.style.zoom = "80%"; // Zoom out less on larger screens
  }
});

// --- Utility Functions ---

/**
 * Escape special HTML characters to prevent XSS when inserting text into DOM
 * @param {string} text - input text to escape
 * @returns {string} escaped text safe for HTML
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

/**
 * Format a number as currency in Rs with 2 decimals
 * @param {number|string} amount
 * @returns {string} formatted currency string
 */
function formatCurrency(amount) {
  return `Rs ${(parseFloat(amount) || 0).toFixed(2)}`; // Format as Rs XX.XX
}

/**
 * Format ISO date string to locale date string, or show fallback text
 * @param {string} isoString - ISO date string
 * @returns {string} formatted date string or fallback text
 */
function formatDate(isoString) {
  if (!isoString || isoString === "N/A") return "N/A";
  try {
    const date = new Date(isoString);
    if (isNaN(date)) {
      return "Invalid Date";
    }
    return date.toLocaleDateString();
  } catch (e) {
    return "N/A";
  }
}

// --- Right Detail Panel Helpers ---

/**
 * Show the right detail panel with active class and adjust main content layout
 */
function showPanel() {
  rightDetailPanel.classList.add("active");
  contentWrapper.classList.add("panel-active"); // Shift main content to make space for panel
}

/**
 * Hide the right detail panel and reset content and layout
 */
function hidePanel() {
  rightDetailPanel.classList.remove("active");
  contentWrapper.classList.remove("panel-active"); // Restore main content to full width
  panelTitle.textContent = "Details"; // Reset panel title
  panelContent.innerHTML = "<p>Click on a table row to view details here.</p>"; // Clear panel content
}

// Attach click listener to close panel button to hide the panel
closePanelBtn.addEventListener("click", hidePanel);

/**
 * Print the content of the right detail panel only
 */
printPanelBtn.addEventListener("click", () => {
  // Hide all other elements except main wrapper and sidebar before printing
  const elementsToHide = document.querySelectorAll(
    "body > *:not(.main-content-and-panel-wrapper):not(#sidebar-container)"
  );
  elementsToHide.forEach((el) => (el.style.display = "none"));

  // Hide the main content within the wrapper for clean printing
  mainContent.style.display = "none";

  // Modify panel styles for printing (remove fixed positioning etc)
  rightDetailPanel.style.position = "static";
  rightDetailPanel.style.width = "100%";
  rightDetailPanel.style.height = "auto";
  rightDetailPanel.style.boxShadow = "none";
  rightDetailPanel.style.border = "none";
  rightDetailPanel.style.overflow = "visible";
  rightDetailPanel.style.transform = "none";

  // Hide panel header (title and buttons) for cleaner print
  const panelHeader = rightDetailPanel.querySelector(".panel-header");
  if (panelHeader) panelHeader.style.display = "none";

  // Trigger print dialog
  window.print();

  // Restore original styles after printing
  elementsToHide.forEach((el) => (el.style.display = ""));
  mainContent.style.display = "";

  rightDetailPanel.style.position = "fixed";
  rightDetailPanel.style.width = "";
  rightDetailPanel.style.height = "100vh";
  rightDetailPanel.style.boxShadow = "";
  rightDetailPanel.style.border = "";
  rightDetailPanel.style.overflow = "auto";
  rightDetailPanel.style.transform = "";

  if (panelHeader) panelHeader.style.display = "";
});

// --- Responsive Table Labels (No-op as per user request) ---
/**
 * Adds data-label attributes to table cells for responsive layouts
 * This function currently does nothing but kept for future use.
 * @param {string} tableId - ID of the table
 */
function applyResponsiveTableLabels(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const headers = Array.from(table.querySelectorAll("thead th"))
    .map((th) => th.textContent.trim())
    .filter((header) => header !== "");

  table.querySelectorAll("tbody tr").forEach((tr) => {
    Array.from(tr.children).forEach((td, idx) => {
      if (headers[idx] && !td.hasAttribute("data-label")) {
        td.setAttribute("data-label", headers[idx]);
      }
    });
  });
}

// --- Chart Rendering Function ---

/**
 * Render all charts by destroying old instances, ensuring containers are visible,
 * then calling individual chart rendering functions and resizing charts.
 */
function renderAllCharts() {
  // Destroy existing chart instances to avoid duplicates or conflicts
  if (dailySalesTrendChartInstance) dailySalesTrendChartInstance.destroy();
  if (monthlySalesTrendChartInstance) monthlySalesTrendChartInstance.destroy();
  if (yearlySalesTrendChartInstance) yearlySalesTrendChartInstance.destroy();
  if (inventoryStatusChartInstance) inventoryStatusChartInstance.destroy(); // Fixed typo here (was inventoryStatusChartChartInstance)
  if (profitByCategoryChartInstance) profitByCategoryChartInstance.destroy();

  // Make sure all chart containers are visible by removing 'hidden' class
  dailySalesChartContainer.classList.remove("hidden");
  monthlySalesChartContainer.classList.remove("hidden");
  yearlySalesChartContainer.classList.remove("hidden");
  inventoryChartContainer.classList.remove("hidden");
  profitChartContainer.classList.remove("hidden");

  // Use requestAnimationFrame for smoother rendering and layout completion
  requestAnimationFrame(() => {
    // Call functions that draw each chart, defined elsewhere in code
    renderDailySalesTrendChart();
    if (dailySalesTrendChartInstance) {
      dailySalesTrendChartInstance.resize();
    }

    renderMonthlySalesTrendChart();
    if (monthlySalesTrendChartInstance) {
      monthlySalesTrendChartInstance.resize();
    }

    renderYearlySalesTrendChart();
    if (yearlySalesTrendChartInstance) {
      yearlySalesTrendChartInstance.resize();
    }

    renderInventoryStatusChart();
    if (inventoryStatusChartInstance) {
      inventoryStatusChartInstance.resize();
    }

    renderProfitByCategoryChart();
    if (profitByCategoryChartInstance) {
      profitByCategoryChartInstance.resize();
    }

    // Trigger a window resize event asynchronously as a safeguard to re-layout charts
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 0);
  });
}

// --- Authentication and Initial Data Load ---

/**
 * On authentication state change, check user and load report data accordingly.
 * If user is admin or staff, show main content and load data.
 * Otherwise, show no authority message.
 */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // If not logged in, hide main content and show message
    mainContent.style.display = "none";
    noAuthorityMsg.classList.remove("hidden");
    noAuthorityMsg.textContent = "You must be logged in to view this page.";
    return;
  }

  try {
    // Fetch user data from Firebase realtime database
    const userSnap = await database.ref("users/" + user.uid).once("value");
    const userData = userSnap.val();

    if (userData && (userData.role === "admin" || userData.role === "staff")) {
      // If authorized role, show main content, hide noAuthority message
      mainContent.style.display = "block";
      noAuthorityMsg.classList.add("hidden");

      // Display email in admin and sidebar email elements
      adminEmailElem.textContent = user.email;
      userEmailElem.textContent = user.email;

      // Render sidebar with user email
      renderAdminSidebar("sidebar-container", user.email);

      // Load all report data and attach event listeners
      await loadReportData();
      attachTableEventListeners();
    } else {
      // If not authorized, hide main content and show no authority message
      mainContent.style.display = "none";
      noAuthorityMsg.classList.remove("hidden");
      noAuthorityMsg.textContent =
        "You do not have sufficient authority to view this page.";
    }
  } catch (error) {
    // Handle any errors during auth or data loading
    console.error("Authentication or data loading error:", error);

    // If noAuthorityMsg hidden, show error in right panel
    if (noAuthorityMsg.classList.contains("hidden")) {
      panelTitle.textContent = "Error";
      panelContent.innerHTML = `<p>Failed to verify user authority or load data: ${escapeHtml(
        error.message
      )}</p>`;
      showPanel();
    }

    mainContent.style.display = "none";
    noAuthorityMsg.classList.remove("hidden");
    noAuthorityMsg.textContent = `An error occurred: ${escapeHtml(
      error.message
    )}. Please try again later.`;
  }
});

// --- Load All Report Data ---

/**
 * Fetch all required data for reports from Firebase database:
 * - sales, medicines, pharmacyDetails, suppliers, categories, users
 * Then stores them into global variables and updates UI accordingly.
 */
async function loadReportData() {
  try {
    // Fetch all data in parallel using Promise.all for better performance
    const [
      salesSnap,
      medicinesSnap,
      pharmacyListSnap,
      suppliersSnap,
      categoriesSnap,
      usersSnap,
    ] = await Promise.all([
      database.ref("sales").once("value"),
      database.ref("medicines").once("value"),
      database.ref("pharmacyDetailsList").once("value"),
      database.ref("suppliers").once("value"),
      database.ref("medicine-category").once("value"),
      database.ref("users").once("value"),
    ]);

    // Get raw data values or fallback to empty objects/arrays
    const salesDataFromFirebase = salesSnap.val() || {};
    // Convert sales data object into array with Firebase keys as 'id' properties
    allSalesData = Object.entries(salesDataFromFirebase).map(([id, sale]) => ({
      id: id, // Assign Firebase key as id property
      ...sale, // Spread rest of sale details
    }));

    allMedicinesData = medicinesSnap.val() || {};

    // Convert pharmacyDetails object to array with id property from keys
    const pharmacyDetailsRaw = pharmacyListSnap.val() || {};
    allPharmacyDetails = Object.entries(pharmacyDetailsRaw).map(
      ([id, pharmacy]) => ({
        id: id,
        ...pharmacy,
      })
    );

    allCategoriesData = categoriesSnap.val() || {}; // categoryId => categoryName mapping
    allUsersData = usersSnap.val() || {};

    // Convert suppliers object into object with 'id' property added for each supplier
    const suppliersRaw = suppliersSnap.val() || {};
    allSuppliersData = Object.entries(suppliersRaw).reduce(
      (acc, [id, supplier]) => {
        acc[id] = { id: id, ...supplier };
        return acc;
      },
      {}
    );

    // Populate Sold By filter dropdown with staff/admin emails
    populateSoldByFilter();

    // Update KPIs and charts based on loaded data
    updateKPIsAndCharts();

    // Load sales records into the sales table
    loadSalesRecords();

    // Load pharmacy and supplier tables with their respective data
    loadPharmacyDetails(allPharmacyDetails);
    loadSuppliers(Object.values(allSuppliersData)); // Pass array of supplier objects
  } catch (error) {
    // Log and display error if data loading fails
    console.error("Error loading report data:", error);
    panelTitle.textContent = "Data Load Error";
    panelContent.innerHTML = `<p>Failed to load report data: ${escapeHtml(
      error.message
    )}</p>`;
    showPanel();
  }
}

// --- Populate Sold By Filter ---

/**
 * Populate the "Sold By" dropdown filter with emails of users with role admin or staff
 * Starts with a default "All Staff" option (empty value)
 */
function populateSoldByFilter() {
  soldByFilter.innerHTML = '<option value="">All Staff</option>'; // Default option

  const staffEmails = new Set();

  // Collect unique emails of admin or staff users
  Object.values(allUsersData).forEach((user) => {
    if (user.email && (user.role === "admin" || user.role === "staff")) {
      staffEmails.add(user.email);
    }
  });

  // Sort emails alphabetically and append them as options
  Array.from(staffEmails)
    .sort()
    .forEach((email) => {
      const option = document.createElement("option");
      option.value = email;
      option.textContent = email;
      soldByFilter.appendChild(option);
    });
}

// --- Update KPIs and Charts Data ---
// This function calculates summary statistics (KPIs) from all sales data
// and then triggers rendering of all charts to reflect updated data.
function updateKPIsAndCharts() {
  // Initialize accumulators for totals and counts
  let totalSales = 0; // Total sales amount sum
  let totalProfit = 0; // Total profit sum
  let totalUnpaidTransactions = 0; // Count of unpaid transactions
  let totalUnpaidAmount = 0; // Sum of unpaid amounts

  // Loop over each sale record in allSalesData array
  allSalesData.forEach((sale) => {
    // Add sale's grand total (or 0 if missing) to totalSales
    totalSales += sale.grandTotal || 0;

    // Calculate profit for each item sold in this sale
    if (sale.items) {
      sale.items.forEach((item) => {
        // Get medicine info from allMedicinesData using medicineId
        const medicine = allMedicinesData[item.medicineId];
        if (medicine) {
          // Parse buying and selling prices and quantity safely
          const buyingPrice = parseFloat(medicine.buyingPrice) || 0;
          const sellingPrice = parseFloat(medicine.sellingPrice) || 0;
          const qty = parseInt(item.qty) || 0;

          // Calculate profit for this item: (selling - buying) * quantity
          const itemProfit = (sellingPrice - buyingPrice) * qty;
          // Add to running total profit
          totalProfit += itemProfit;
        }
      });
    }

    // Check if this sale is unpaid or partially paid
    if (
      sale.payment?.status?.toLowerCase() === "unpaid" || // Payment status is "unpaid"
      (sale.payment?.amountLeft || 0) > 0 // Or there is an amount left unpaid
    ) {
      totalUnpaidTransactions++; // Increment count of unpaid transactions
      totalUnpaidAmount += sale.payment?.amountLeft || 0; // Add unpaid amount
    }
  });

  // Update KPI elements in DOM with formatted currency or counts
  totalSalesAmountElem.textContent = formatCurrency(totalSales);
  totalProfitAmountElem.textContent = formatCurrency(totalProfit);
  totalTransactionsElem.textContent = allSalesData.length;
  unpaidTransactionsCountElem.textContent = totalUnpaidTransactions;
  unpaidAmountElem.textContent = formatCurrency(totalUnpaidAmount);

  // Call function to render all charts now that KPI data is ready
  renderAllCharts();
}

// --- Specific Chart Rendering Functions ---

// Render daily sales line chart showing sales totals per day
function renderDailySalesTrendChart() {
  // Destroy existing chart instance if present to avoid duplicates
  if (dailySalesTrendChartInstance) dailySalesTrendChartInstance.destroy();

  // Aggregate sales by date (formatted as YYYY-MM-DD)
  const salesByDate = {};
  allSalesData.forEach((sale) => {
    // Convert sale createdAt date to ISO-like date string (YYYY-MM-DD)
    const saleDate = new Date(sale.createdAt).toLocaleDateString("en-CA");
    // Accumulate grandTotal for this date
    salesByDate[saleDate] =
      (salesByDate[saleDate] || 0) + (sale.grandTotal || 0);
  });
  // Sort dates ascending for chart labels
  const dates = Object.keys(salesByDate).sort();
  // Map dates to their sales totals
  const totals = dates.map((date) => salesByDate[date]);

  // Create new Chart.js line chart with prepared data and options
  dailySalesTrendChartInstance = new Chart(dailySalesTrendChartCtx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Daily Sales (Rs)",
          data: totals,
          borderColor: "#2c7ac9", // Blue line color
          backgroundColor: "rgba(44, 122, 201, 0.1)", // Light blue fill under line
          fill: true,
          tension: 0.3, // Smooth curved lines
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { mode: "index", intersect: false }, // Show tooltip on hover
      },
      scales: {
        x: { title: { display: true, text: "Date" } }, // X axis label
        y: {
          beginAtZero: true, // Y axis starts at zero
          title: { display: true, text: "Sales Amount (Rs)" }, // Y axis label
        },
      },
    },
  });
}

// Render monthly sales bar chart showing sales totals per month
function renderMonthlySalesTrendChart() {
  if (monthlySalesTrendChartInstance) monthlySalesTrendChartInstance.destroy();

  // Aggregate sales by month in format YYYY-MM
  const salesByMonth = {};
  allSalesData.forEach((sale) => {
    const date = new Date(sale.createdAt);
    const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    salesByMonth[monthYear] =
      (salesByMonth[monthYear] || 0) + (sale.grandTotal || 0);
  });
  // Sort months ascending
  const months = Object.keys(salesByMonth).sort();
  // Map months to totals
  const totals = months.map((month) => salesByMonth[month]);

  // Create bar chart for monthly sales
  monthlySalesTrendChartInstance = new Chart(monthlySalesTrendChartCtx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          label: "Monthly Sales (Rs)",
          data: totals,
          backgroundColor: "#4CAF50", // Green bars
          borderColor: "#388E3C", // Darker green borders
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { title: { display: true, text: "Month" } },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Sales Amount (Rs)" },
        },
      },
    },
  });
}

// Render yearly sales bar chart showing sales totals per year
function renderYearlySalesTrendChart() {
  if (yearlySalesTrendChartInstance) yearlySalesTrendChartInstance.destroy();

  // Aggregate sales by year (YYYY)
  const salesByYear = {};
  allSalesData.forEach((sale) => {
    const year = new Date(sale.createdAt).getFullYear().toString();
    salesByYear[year] = (salesByYear[year] || 0) + (sale.grandTotal || 0);
  });
  // Sort years ascending
  const years = Object.keys(salesByYear).sort();
  // Map years to totals
  const totals = years.map((year) => salesByYear[year]);

  // Create bar chart for yearly sales
  yearlySalesTrendChartInstance = new Chart(yearlySalesTrendChartCtx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          label: "Yearly Sales (Rs)",
          data: totals,
          backgroundColor: "#FFC107", // Amber bars
          borderColor: "#FFA000", // Darker amber borders
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { title: { display: true, text: "Year" } },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Sales Amount (Rs)" },
        },
      },
    },
  });
}

// Render inventory status pie chart showing counts of medicines by stock status
function renderInventoryStatusChart() {
  if (inventoryStatusChartInstance) inventoryStatusChartInstance.destroy();

  // Counters for different stock levels
  let lowStock = 0;
  let inStock = 0;
  let outOfStock = 0;

  // Loop over all medicines to count stock status
  Object.values(allMedicinesData).forEach((med) => {
    const quantity = parseInt(med.quantity) || 0;
    if (quantity === 0) {
      outOfStock++;
    } else if (quantity > 0 && quantity <= LOW_STOCK_THRESHOLD) {
      lowStock++;
    } else {
      inStock++;
    }
  });

  // Create pie chart for inventory stock status
  inventoryStatusChartInstance = new Chart(inventoryStatusChartCtx, {
    type: "pie",
    data: {
      labels: ["Low Stock", "In Stock", "Out of Stock"],
      datasets: [
        {
          data: [lowStock, inStock, outOfStock],
          backgroundColor: ["#ffc107", "#28a745", "#dc3545"], // Yellow, green, red
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.label || "";
              if (label) label += ": ";
              if (context.parsed !== null) label += context.parsed;
              return label;
            },
          },
        },
      },
      // On clicking a pie segment, show filtered inventory list in right panel
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const label = inventoryStatusChartInstance.data.labels[index];
          filterAndShowInventory(label);
        }
      },
    },
  });
}

// Show a filtered inventory list in right detail panel based on stock status
function filterAndShowInventory(status) {
  let filteredMedicines = [];
  let title = "Inventory List";

  // Filter medicines based on clicked status from pie chart
  if (status === "Out of Stock") {
    filteredMedicines = Object.values(allMedicinesData).filter(
      (med) => (parseInt(med.quantity) || 0) === 0
    );
    title = "Out of Stock Medicines";
  } else if (status === "Low Stock") {
    filteredMedicines = Object.values(allMedicinesData).filter((med) => {
      const qty = parseInt(med.quantity) || 0;
      return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
    });
    title = `Low Stock Medicines (Threshold: ${LOW_STOCK_THRESHOLD})`;
  } else if (status === "In Stock") {
    filteredMedicines = Object.values(allMedicinesData).filter(
      (med) => (parseInt(med.quantity) || 0) > LOW_STOCK_THRESHOLD
    );
    title = "In Stock Medicines";
  } else {
    filteredMedicines = Object.values(allMedicinesData);
  }

  // Update right panel title
  panelTitle.textContent = title;
  // Render table with filtered medicines, or show 'no items' message if empty
  panelContent.innerHTML = `
    <div class="table-responsive">
        <table id="inventoryListTable" class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Expiry</th>
                    <th>Rack</th>
                    <th>Buying Price</th>
                    <th>Selling Price</th>
                    <th>Manufacturer</th>
                </tr>
            </thead>
            <tbody id="inventoryListBody">
                ${
                  filteredMedicines.length === 0
                    ? `<tr><td colspan="8">No items found for '${escapeHtml(
                        status
                      )}' status.</td></tr>`
                    : ""
                }
            </tbody>
        </table>
    </div>
  `;

  // If medicines found, populate table body with rows for each medicine
  if (filteredMedicines.length > 0) {
    const inventoryListBody = panelContent.querySelector("#inventoryListBody");
    filteredMedicines.forEach((med) => {
      // Lookup category name from allCategoriesData, fallback to ID or "N/A"
      const categoryName =
        allCategoriesData[med.category] || med.category || "N/A";
      // Create a table row element with escaped and formatted data
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${escapeHtml(med.name || "N/A")}</td>
                <td>${escapeHtml(categoryName)}</td>
                <td>${med.quantity || 0}</td>
                <td>${formatDate(med.expiry)}</td>
                <td>${escapeHtml(med.rack || "N/A")}</td>
                <td>${formatCurrency(med.buyingPrice)}</td>
                <td>${formatCurrency(med.sellingPrice)}</td>
                <td>${escapeHtml(med.manufacturer || "N/A")}</td>
            `;
      inventoryListBody.appendChild(row);
    });
    // Apply responsive table labels for better mobile/tablet UX
    applyResponsiveTableLabels("inventoryListTable");
  }
  // Show the right side panel with inventory details
  showPanel();
}

// Render profit by category bar chart showing profits for each medicine category
function renderProfitByCategoryChart() {
  if (profitByCategoryChartInstance) profitByCategoryChartInstance.destroy();

  // Aggregate profit by medicine category
  const profitByCategory = {};
  allSalesData.forEach((sale) => {
    if (sale.items) {
      sale.items.forEach((item) => {
        const medicine = allMedicinesData[item.medicineId];
        if (medicine) {
          // Calculate profit for each item sold
          const buyingPrice = parseFloat(medicine.buyingPrice) || 0;
          const sellingPrice = parseFloat(medicine.sellingPrice) || 0;
          const qty = parseInt(item.qty) || 0;

          const itemProfit = (sellingPrice - buyingPrice) * qty;
          const categoryKey = medicine.category;
          const categoryName =
            allCategoriesData[categoryKey] || categoryKey || "Unknown";
          // Add profit for this item to the category total
          profitByCategory[categoryName] =
            (profitByCategory[categoryName] || 0) + itemProfit;
        }
      });
    }
  });

  // Extract categories and corresponding profits as arrays
  const categories = Object.keys(profitByCategory);
  const profits = Object.values(profitByCategory);

  // Create bar chart with category labels and profit values
  profitByCategoryChartInstance = new Chart(profitByCategoryChartCtx, {
    type: "bar",
    data: {
      labels: categories,
      datasets: [
        {
          label: "Profit (Rs)",
          data: profits,
          backgroundColor: "#2c7ac9", // Blue bars
          borderColor: "#2264ad",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { title: { display: true, text: "Medicine Category" } },
        y: { beginAtZero: true, title: { display: true, text: "Profit (Rs)" } },
      },
    },
  });
}

// --- Sales Records Table & Filters ---
// Attach event listeners to filter and reset buttons for sales records table
applySalesFiltersBtn.addEventListener("click", loadSalesRecords);
resetSalesFiltersBtn.addEventListener("click", resetSalesFilters);

// Filter sales data array based on multiple filter criteria from input fields
function filterSalesData() {
  // Read filter values from input elements and normalize
  const searchTerm = salesSearchInput.value.toLowerCase().trim();
  const soldBy = soldByFilter.value;
  const salesType = salesTypeFilter.value;
  // Parse start and end dates if provided, set time boundaries
  const startDate = startDateInput.value
    ? new Date(startDateInput.value + "T00:00:00")
    : null;
  const endDate = endDateInput.value
    ? new Date(endDateInput.value + "T23:59:59")
    : null;
  // Parse min and max amounts with fallback values
  const minAmount = parseFloat(minAmountInput.value) || 0;
  const maxAmount = parseFloat(maxAmountInput.value) || Infinity;

  // Return filtered and sorted sales data array
  return (
    allSalesData
      .filter((sale) => {
        // Prepare various fields for filtering (lowercased)
        const customerName = (
          sale.customerInfo?.pharmacyName ||
          sale.customerInfo?.name ||
          ""
        ).toLowerCase();
        const saleSoldBy = (sale.soldBy || "").toLowerCase();
        const saleSalesType = (sale.salesType || "").toLowerCase();
        const saleGrandTotal = parseFloat(sale.grandTotal) || 0;
        const saleDate = new Date(sale.createdAt);
        const saleId = (sale.id || "").toLowerCase(); // Correct sale ID from Firebase

        // Check if search term matches sale id, customer name, soldBy, or item names
        const matchesSearch =
          searchTerm === "" ||
          saleId.includes(searchTerm) ||
          customerName.includes(searchTerm) ||
          saleSoldBy.includes(searchTerm) ||
          (sale.items &&
            sale.items.some((item) =>
              (item.name || "").toLowerCase().includes(searchTerm)
            ));

        // Check if soldBy filter matches or is empty (all)
        const matchesSoldBy =
          soldBy === "" || saleSoldBy === soldBy.toLowerCase();

        // Check sales type filter or empty (all)
        const matchesSalesType =
          salesType === "" || saleSalesType === salesType;

        // Check date range filter, allowing open-ended dates
        const matchesDate =
          (!startDate || saleDate >= startDate) &&
          (!endDate || saleDate <= endDate);

        // Check if sale total amount is within min/max range
        const matchesAmount =
          saleGrandTotal >= minAmount && saleGrandTotal <= maxAmount;

        // Return true only if all filter conditions match
        return (
          matchesSearch &&
          matchesSoldBy &&
          matchesSalesType &&
          matchesDate &&
          matchesAmount
        );
      })
      // Sort filtered sales descending by createdAt date (latest first)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  );
}

// Load and render sales records table with current filter settings
function loadSalesRecords() {
  // Show "Filtering..." message while processing
  salesList.innerHTML = `<tr><td colspan="7">Filtering sales records...</td></tr>`;
  // Get filtered sales data array
  const filteredSales = filterSalesData();

  // If no records found, display friendly message
  if (filteredSales.length === 0) {
    salesList.innerHTML = `<tr><td colspan="7" class="no-records">No sales records found matching your criteria.</td></tr>`;
    return;
  }

  // Clear table body
  salesList.innerHTML = "";
  // Loop through filtered sales and create table rows
  filteredSales.forEach((sale) => {
    // Create table row element, store sale ID as dataset attribute
    const row = document.createElement("tr");
    row.dataset.saleId = sale.id; // Use correct Firebase sale ID

    // Determine payment status text to display based on payment data
    let paymentStatus = sale.payment?.status || "N/A";
    if (sale.payment?.amountLeft > 0) {
      paymentStatus = `Partial (Rs ${sale.payment.amountLeft.toFixed(2)} left)`;
    } else if (
      sale.payment?.status?.toLowerCase() === "paid" ||
      sale.payment?.status?.toLowerCase() === "done"
    ) {
      paymentStatus = "Paid";
    } else if (sale.payment?.status?.toLowerCase() === "unpaid") {
      paymentStatus = "Unpaid";
    }

    // Populate row cells with sale info, using helper functions for formatting
    row.innerHTML = `
      <td>${escapeHtml(sale.id || "N/A")}</td>
      <td>${formatDate(sale.createdAt)}</td>
      <td>${escapeHtml(
        sale.customerInfo?.pharmacyName ||
          sale.customerInfo?.name ||
          "Individual Customer"
      )}</td>
      <td>${escapeHtml(sale.salesType || "Retail")}</td>
      <td>${escapeHtml(sale.soldBy || "N/A")}</td>
      <td>${formatCurrency(sale.grandTotal)}</td>
      <td>${escapeHtml(paymentStatus)}</td>
    `;
    // Append this row to the sales list table body
    salesList.appendChild(row);
  });
  // Apply responsive table labels for better UX on small screens
  applyResponsiveTableLabels("salesTable");
}

// Reset all sales filter input fields to default empty values and reload full sales list
function resetSalesFilters() {
  salesSearchInput.value = "";
  soldByFilter.value = "";
  salesTypeFilter.value = "";
  startDateInput.value = "";
  endDateInput.value = "";
  minAmountInput.value = "";
  maxAmountInput.value = "";
  loadSalesRecords(); // Reload all sales without filters
}

// --- Attach event listeners to table elements ---
// This function sets up click event listeners on the sales, pharmacy, and supplier tables
// to handle row clicks and show details in the right panel.
function attachTableEventListeners() {
  salesList.addEventListener("click", handleSalesTableRowClick);
  pharmacyList.addEventListener("click", handlePharmacyTableRowClick);
  supplierList.addEventListener("click", handleSupplierTableRowClick);
}

// --- Handle clicks on sales table rows ---
// Uses event delegation: when any part inside salesList is clicked,
// find the closest <tr> element and get its dataset.saleId to show details.
function handleSalesTableRowClick(event) {
  const row = event.target.closest("tr");
  if (row && row.dataset.saleId) {
    viewSaleDetails(row.dataset.saleId); // Show details for clicked sale
  }
}

/* ===== Sales Detail Panel Content ===== */
// Show detailed info for a specific sale in the right side panel,
// fetching from allSalesData using the saleId.
function viewSaleDetails(saleId) {
  // Find the sale object by its Firebase ID from the global array
  const sale = allSalesData.find((s) => s.id === saleId);
  if (!sale) {
    // If sale not found, show error message in panel and exit
    panelTitle.textContent = "Error";
    panelContent.innerHTML = "<p>Sale details not found.</p>";
    showPanel();
    return;
  }

  // Set the panel title with escaped sale ID
  panelTitle.textContent = `Sale Details (ID: ${escapeHtml(sale.id)})`;

  // Build HTML list of items sold in this sale
  let itemsHtml =
    sale.items && sale.items.length > 0
      ? sale.items
          .map((item) => {
            // Lookup medicine details for each item to show batch, expiry, category
            const medicine = allMedicinesData[item.medicineId] || {};
            const categoryName =
              allCategoriesData[medicine.category] ||
              medicine.category ||
              "N/A";
            return `
    <li>
      <strong>${escapeHtml(item.name)}</strong> (${escapeHtml(
              categoryName
            )})<br>
      Qty: ${item.qty}, Unit Price: ${formatCurrency(
              item.unitPrice
            )}, Total: ${formatCurrency(item.totalPrice)}<br>
      Batch: ${escapeHtml(medicine.batch || "N/A")}, Expiry: ${formatDate(
              medicine.expiry || "N/A"
            )}
    </li>
  `;
          })
          .join("")
      : "<p>No items found for this sale.</p>"; // Fallback message

  // Build HTML list of payment notes if any
  let paymentNotesHtml =
    sale.paymentNotes && sale.paymentNotes.length > 0
      ? sale.paymentNotes
          .map(
            (note) => `
    <li>${escapeHtml(note.text || "N/A")} - <strong>${formatCurrency(
              note.paidAmount || 0
            )}</strong> paid on ${formatDate(note.timestamp)} by ${escapeHtml(
              note.updatedBy || "N/A"
            )}</li>
  `
          )
          .join("")
      : "<p>No payment notes.</p>"; // Fallback if no payment notes

  // Fill the panel content with all relevant sale information:
  // - Date/time, sales type, sold by
  // - Customer info: name, type, email, phone, address, registration no.
  // - Items sold list
  // - Billing summary (subtotal, discount, VAT, grand total)
  // - Payment info and notes
  panelContent.innerHTML = `
    <p><strong>Date & Time:</strong> ${new Date(
      sale.createdAt
    ).toLocaleString()}</p>
    <p><strong>Sales Type:</strong> ${escapeHtml(
      sale.salesType || "Retail"
    )}</p>
    <p><strong>Sold By:</strong> ${escapeHtml(sale.soldBy || "N/A")}</p>
    <hr>
    <h4>Customer Information:</h4>
    <p><strong>Name:</strong> ${escapeHtml(
      sale.customerInfo?.pharmacyName ||
        sale.customerInfo?.name ||
        "Individual Customer"
    )}</p>
    <p><strong>Type:</strong> ${escapeHtml(
      sale.customerInfo?.type || "Individual"
    )}</p>
    ${
      sale.customerInfo?.email
        ? `<p><strong>Email:</strong> ${escapeHtml(
            sale.customerInfo.email
          )}</p>`
        : ""
    }
    ${
      sale.customerInfo?.phone
        ? `<p><strong>Phone:</strong> ${escapeHtml(
            sale.customerInfo.phone
          )}</p>`
        : ""
    }
    ${
      sale.customerInfo?.address
        ? `<p><strong>Address:</strong> ${escapeHtml(
            sale.customerInfo.address
          )}</p>`
        : ""
    }
    ${
      sale.customerInfo?.registrationNumber
        ? `<p><strong>Registration No.:</strong> ${escapeHtml(
            sale.customerInfo.registrationNumber
          )}</p>`
        : ""
    }
    <hr>
    <h4>Items Sold:</h4>
    <ul>${itemsHtml}</ul>
    <hr>
    <h4>Billing Summary:</h4>
    <p><strong>Sub Total:</strong> ${formatCurrency(sale.subTotal)}</p>
    <p><strong>Discount:</strong> ${
      sale.discountPercent || 0
    }% (${formatCurrency(sale.discountAmount)})</p>
    <p><strong>VAT:</strong> ${sale.vatPercent || 0}% (${formatCurrency(
    sale.vatAmount
  )})</p>
    <p><strong>Grand Total:</strong> <strong>${formatCurrency(
      sale.grandTotal
    )}</strong></p>
    <hr>
    <h4>Payment Information:</h4>
    <p><strong>Status:</strong> ${escapeHtml(
      sale.payment?.status || "Unpaid"
    )}</p>
    <p><strong>Type:</strong> ${escapeHtml(sale.payment?.type || "N/A")}</p>
    <p><strong>Amount Paid:</strong> ${formatCurrency(
      sale.payment?.amountPaid
    )}</p>
    <p><strong>Amount Left:</strong> ${formatCurrency(
      sale.payment?.amountLeft
    )}</p>
    <h5>Payment Notes:</h5>
    <ul>${paymentNotesHtml}</ul>
  `;
  showPanel(); // Display the right side panel with sale details
}

/* ===== Pharmacy Details List ===== */
// Populate the pharmacy table with a list of pharmacies passed as argument
function loadPharmacyDetails(pharmacies) {
  pharmacyList.innerHTML = "";
  if (pharmacies.length === 0) {
    // Show a message if no pharmacies available
    pharmacyList.innerHTML = `<tr><td colspan="4" class="no-records">No pharmacy details found.</td></tr>`;
    return;
  }

  pharmacies.forEach((pharmacy) => {
    const row = document.createElement("tr");
    // Use Firebase ID if available, else fallback to pharmacyName as identifier
    row.dataset.pharmacyId = pharmacy.id || pharmacy.pharmacyName;
    row.innerHTML = `
      <td>${escapeHtml(pharmacy.pharmacyName || "N/A")}</td>
      <td>${escapeHtml(pharmacy.email || "N/A")}</td>
      <td>${escapeHtml(pharmacy.phone || "N/A")}</td>
      <td>${escapeHtml(pharmacy.registrationNumber || "N/A")}</td>
    `;
    pharmacyList.appendChild(row);
  });
  applyResponsiveTableLabels("pharmacyTable"); // Make table responsive for mobile devices
}

// Handle clicks on pharmacy table rows to show pharmacy-specific sales
function handlePharmacyTableRowClick(event) {
  const row = event.target.closest("tr");
  // Check if row has pharmacyId attribute
  if (row && row.dataset.pharmacyId) {
    viewPharmacySales(row.dataset.pharmacyId);
  }
}

// Show sales filtered by a specific pharmacy's ID or name
function viewPharmacySales(identifier) {
  // Find pharmacy object either by Firebase ID or by pharmacyName
  const pharmacy = allPharmacyDetails.find(
    (p) => p.id === identifier || p.pharmacyName === identifier
  );
  const pharmacyName = pharmacy?.pharmacyName || identifier; // For display

  // Set panel title for the selected pharmacy
  panelTitle.textContent = `Sales for ${escapeHtml(pharmacyName)}`;
  // Setup table with headers to list sales for this pharmacy
  panelContent.innerHTML = `
    <div class="table-responsive">
        <table id="pharmacySalesTable" class="data-table">
            <thead>
                <tr>
                    <th>Sale ID</th>
                    <th>Date</th>
                    <th>Customer Type</th>
                    <th>Grand Total</th>
                    <th>Sold By</th>
                    <th>Payment Status</th>
                </tr>
            </thead>
            <tbody id="pharmacySalesList">
                <tr><td colspan="6">No sales found for this pharmacy.</td></tr>
            </tbody>
        </table>
    </div>
  `;

  // Get tbody element to append rows dynamically
  const pharmacySalesList = panelContent.querySelector("#pharmacySalesList");

  // Filter all sales by pharmacyName in customerInfo (usually how sales are linked)
  const salesForPharmacy = allSalesData.filter(
    (sale) => sale.customerInfo?.pharmacyName === pharmacyName
  );

  if (salesForPharmacy.length === 0) {
    // If no sales found, just show panel with "no sales" message from tbody
    showPanel();
    return;
  }

  // Sort sales newest first
  salesForPharmacy.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  pharmacySalesList.innerHTML = ""; // Clear placeholder message

  salesForPharmacy.forEach((sale) => {
    const row = document.createElement("tr");
    row.dataset.saleId = sale.id; // Use Firebase sale ID

    // Determine payment status text to display, considering partial payments
    let paymentStatus = sale.payment?.status || "N/A";
    if (sale.payment?.amountLeft > 0) {
      paymentStatus = `Partial (Rs ${sale.payment.amountLeft.toFixed(2)} left)`;
    } else if (
      sale.payment?.status?.toLowerCase() === "paid" ||
      sale.payment?.status?.toLowerCase() === "done"
    ) {
      paymentStatus = "Paid";
    } else if (sale.payment?.status?.toLowerCase() === "unpaid") {
      paymentStatus = "Unpaid";
    }

    // Fill row cells with sale info
    row.innerHTML = `
      <td>${escapeHtml(sale.id || "N/A")}</td>
      <td>${formatDate(sale.createdAt)}</td>
      <td>${escapeHtml(sale.customerInfo?.type || "N/A")}</td>
      <td>${formatCurrency(sale.grandTotal)}</td>
      <td>${escapeHtml(sale.soldBy || "N/A")}</td>
      <td>${escapeHtml(paymentStatus)}</td>
    `;
    pharmacySalesList.appendChild(row);
  });
  applyResponsiveTableLabels("pharmacySalesTable"); // Responsive table design
  showPanel(); // Show the right side panel with pharmacy sales list
}

/* ===== Supplier List ===== */
// Load suppliers data into the supplier list table
function loadSuppliers(suppliers) {
  supplierList.innerHTML = "";
  if (suppliers.length === 0) {
    // Show no suppliers found message if empty array
    supplierList.innerHTML = `<tr><td colspan="4" class="no-records">No suppliers found.</td></tr>`;
    return;
  }

  suppliers.forEach((supplier) => {
    const row = document.createElement("tr");
    // Use Firebase supplier ID for dataset attribute
    row.dataset.supplierId = supplier.id;
    row.innerHTML = `
      <td>${escapeHtml(supplier.company || "N/A")}</td>
      <td>${escapeHtml(supplier.name || "N/A")}</td>
      <td>${escapeHtml(supplier.email || "N/A")}</td>
      <td>${escapeHtml(supplier.contact || "N/A")}</td>
    `;
    supplierList.appendChild(row);
  });
  applyResponsiveTableLabels("supplierTable"); // Responsive design
}

// Handle click on supplier rows to show their inventory
function handleSupplierTableRowClick(event) {
  const row = event.target.closest("tr");
  if (row && row.dataset.supplierId) {
    viewSupplierInventory(row.dataset.supplierId); // Show inventory for supplier
  }
}

// Show inventory table filtered by supplierId
function viewSupplierInventory(supplierId) {
  // Look up supplier details from allSuppliersData dictionary by ID
  const supplier = allSuppliersData[supplierId];
  if (!supplier) {
    // Show error message if supplier not found
    panelTitle.textContent = "Error";
    panelContent.innerHTML = "<p>Supplier not found.</p>";
    showPanel();
    return;
  }

  // Set panel title using supplier company or name
  panelTitle.textContent = `Inventory from ${escapeHtml(
    supplier.company || supplier.name
  )}`;

  // Set up table structure for inventory list
  panelContent.innerHTML = `
    <div class="table-responsive">
        <table id="supplierInventoryTable" class="data-table">
            <thead>
                <tr>
                    <th>Medicine Name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Buying Price</th>
                    <th>Selling Price</th>
                    <th>Manufacturer</th>
                    <th>Expiry Date</th>
                </tr>
            </thead>
            <tbody id="supplierInventoryList">
                <tr><td colspan="7">No inventory found for this supplier.</td></tr>
            </tbody>
        </table>
    </div>
  `;

  const supplierInventoryList = panelContent.querySelector(
    "#supplierInventoryList"
  );

  // Filter all medicines to find those supplied by this supplierId
  const inventoryFromSupplier = Object.values(allMedicinesData).filter(
    (medicine) => medicine.supplier === supplierId
  );

  if (inventoryFromSupplier.length === 0) {
    // If no inventory found, just show the panel with "no inventory" message
    showPanel();
    return;
  }

  supplierInventoryList.innerHTML = ""; // Clear placeholder

  inventoryFromSupplier.forEach((medicine) => {
    const categoryName =
      allCategoriesData[medicine.category] || medicine.category || "N/A";
    const row = document.createElement("tr");
    // Fill table row with medicine details
    row.innerHTML = `
      <td>${escapeHtml(medicine.name || "N/A")}</td>
      <td>${escapeHtml(categoryName)}</td>
      <td>${medicine.quantity || 0}</td>
      <td>${formatCurrency(medicine.buyingPrice)}</td>
      <td>${formatCurrency(medicine.sellingPrice)}</td>
      <td>${escapeHtml(medicine.manufacturer || "N/A")}</td>
      <td>${formatDate(medicine.expiry)}</td>
    `;
    supplierInventoryList.appendChild(row);
  });
  applyResponsiveTableLabels("supplierInventoryTable"); // Responsive table UI
  showPanel(); // Display the panel with supplier inventory details
}

// --- Logout Button ---
// Attach click event to the logout button that calls the logout function
document.getElementById("logoutBtn").addEventListener("click", logout);
