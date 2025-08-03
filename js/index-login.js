// Import the `login` function from auth.js to handle Firebase login
import { login } from "./auth.js";

// Import the `redirectBasedOnRole` function to redirect users to different dashboards based on role
import { redirectBasedOnRole } from "./auth-handler.js";

// Attach an event listener to the login form's submit event
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault(); // Prevent the default form submission which would reload the page

    const btn = this.querySelector('button[type="submit"]'); // Select the submit button inside the form
    const errorMsg = document.getElementById("error-msg"); // Element to display error messages

    // Indicate loading: disable the button and optionally show a spinner via class
    btn.classList.add("btn-loading");
    btn.disabled = true;
    errorMsg.style.display = "none"; // Hide any previous error message

    // Get input values from the form
    const email = document.getElementById("username").value; // Get value of email input
    const password = document.getElementById("password").value; // Get value of password input

    try {
      // Try to login the user with provided email and password
      const { user } = await login(email, password);

      // If login succeeds, redirect user based on role (admin, user, etc.)
      await redirectBasedOnRole(user);
    } catch (error) {
      // If an error occurs during login (e.g., wrong password), handle it here

      errorMsg.textContent = error.message; // Display error message returned from Firebase
      errorMsg.style.display = "block"; // Make error visible

      // Optional animation: shake the form to indicate failure visually
      const formContainer = document.querySelector(".login-container"); // Get the form container
      formContainer.classList.add("shake"); // Add shake effect

      // Remove shake class after 500ms to allow it to animate again later
      setTimeout(() => {
        formContainer.classList.remove("shake");
      }, 500);
    } finally {
      // Reset button loading state regardless of success/failure
      btn.classList.remove("btn-loading");
      btn.disabled = false;
    }
  });

// Set the footer year dynamically to current year
document.getElementById("year").textContent = new Date().getFullYear();

// Add visual interaction effects to input fields (focus/blur)
document.querySelectorAll(".input-group input").forEach((input) => {
  // When user clicks/focuses on the input
  input.addEventListener("focus", function () {
    // Change the associated label's color to primary to indicate active field
    this.parentElement.querySelector("label").style.color =
      "var(--primary-color)";
  });

  // When user leaves the input field
  input.addEventListener("blur", function () {
    // Reset the label color back to default light text color
    this.parentElement.querySelector("label").style.color = "var(--text-light)";
  });
});

// Add a gentle pulsing animation to login wrapper every 5 seconds
setInterval(() => {
  const wrapper = document.querySelector(".login-wrapper"); // Select the login container
  wrapper.style.transform = "translateY(-2px)"; // Slight upward movement

  // After 1 second, bring it back to original position
  setTimeout(() => {
    wrapper.style.transform = "translateY(0)";
  }, 1000);
}, 5000); // Repeat every 5 seconds
