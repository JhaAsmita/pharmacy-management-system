// Import the Firebase database and authentication modules from your firebase-config.js
import { database, auth } from "./firebase-config.js";

// Select the form element with id 'b2bForm'
const form = document.getElementById("b2bForm");

// Select the div to show messages to user (success/error)
const formMessage = document.getElementById("formMessage");

// Select the "Go to Login" button
const goToLoginBtn = document.getElementById("goToLoginBtn");

// Clear any previous messages and reset message color to default
formMessage.textContent = "";
formMessage.style.color = "inherit";

// Define regex patterns to validate user input fields

// Allows only alphabets (A-Z, a-z) and spaces for names
const alphaSpaceRegex = /^[A-Za-z\s]+$/;

// Allows only digits for numeric fields
const digitsRegex = /^\d+$/;

// Basic email validation pattern: something@something.something
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Address can include letters, numbers, spaces, commas, periods, and hyphens
const addressRegex = /^[A-Za-z0-9\s,.\-]+$/;

// On page load (DOMContentLoaded), adjust zoom level based on screen width
window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 374 && window.innerWidth < 1024) {
    // For medium screen sizes (mobile/tablet), zoom out to 60%
    document.body.style.zoom = "60%";
  } else {
    // For others (desktop or very small screens), zoom out to 80%
    document.body.style.zoom = "80%";
  }
});

// Listen for form submission event
form.addEventListener("submit", async (e) => {
  // Prevent default form submit (which refreshes page)
  e.preventDefault();

  // Clear previous message
  formMessage.textContent = "";

  // Get trimmed values from form inputs
  const companyName = document.getElementById("companyName").value.trim();
  const regNo = document.getElementById("regNo").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const email = document.getElementById("email").value.trim();
  const address = document.getElementById("address").value.trim();
  const owner = document.getElementById("owner").value.trim();

  // Check if any required field is empty
  if (!companyName || !regNo || !contact || !email || !address || !owner) {
    showMessage("❌ Please fill out all fields.", false);
    return; // Stop submission
  }

  // Validate Company Name: only alphabets + spaces, max 200 characters
  if (companyName.length > 200 || !alphaSpaceRegex.test(companyName)) {
    showMessage(
      "❌ Company Name must be alphabetic and up to 200 characters.",
      false
    );
    return;
  }

  // Validate Registration Number: numeric digits only, max 15 digits
  if (regNo.length > 15 || !digitsRegex.test(regNo)) {
    showMessage(
      "❌ Registration Number must be numeric and up to 15 digits.",
      false
    );
    return;
  }

  // Validate Contact Number: numeric digits only, max 10 digits
  if (contact.length > 10 || !digitsRegex.test(contact)) {
    showMessage(
      "❌ Contact Number must be numeric and up to 10 digits.",
      false
    );
    return;
  }

  // Validate Email format using regex pattern
  if (!emailRegex.test(email)) {
    showMessage("❌ Please enter a valid email address.", false);
    return;
  }

  // Validate Address: max 200 characters, allowed letters, digits, spaces, comma, period, hyphen
  if (address.length > 200 || !addressRegex.test(address)) {
    showMessage(
      "❌ Address can contain letters, numbers, spaces, commas, periods, hyphens (max 200 chars).",
      false
    );
    return;
  }

  // Validate Owner Name: alphabets and spaces only, max 200 characters
  if (owner.length > 200 || !alphaSpaceRegex.test(owner)) {
    showMessage(
      "❌ Owner name must be alphabetic and up to 200 characters.",
      false
    );
    return;
  }

  // If all validations pass, attempt to submit data to Firebase Realtime Database
  try {
    // Get currently authenticated user from Firebase Auth (if any)
    const user = auth.currentUser;

    // Prepare data object to save
    const requestData = {
      pharmacyName: companyName, // Company name input
      registrationNumber: regNo, // Registration number input
      phone: contact, // Contact number input
      email: email, // Email input
      address: address, // Company address input
      ownerName: owner, // Owner's name input
      operatingHours: "", // Empty string, placeholder for future use
      pharmacyType: "Retail", // Hardcoded pharmacy type as Retail
      submittedBy: user ? user.email : "anonymous", // Email of logged in user or anonymous if no user
      timestamp: new Date().toISOString(), // Current timestamp in ISO format
    };

    // Push the requestData object to the "requests" node in Firebase realtime database
    await database.ref("requests").push(requestData);

    // Show success message to user
    showMessage("✅ Request submitted!", true);

    // Reset form fields after successful submission
    form.reset();
  } catch (err) {
    // Log error in console for debugging
    console.error("Error submitting request:", err);

    // Show error message to user
    showMessage("❌ Something went wrong. Try again.", false);
  }
});

// Function to show messages on the form (green for success, red for error)
function showMessage(message, isSuccess) {
  formMessage.textContent = message; // Set message text
  formMessage.style.color = isSuccess ? "green" : "red"; // Set color based on success
}

// "Go to Login" button click event: redirect user to login page
goToLoginBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});
