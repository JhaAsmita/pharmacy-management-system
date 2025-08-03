// js/auth.js

// Import the Firebase authentication module from the config file
import { auth } from "./firebase-config.js";

/**
 * Logs in a user using Firebase Authentication with email and password.
 *
 * @param {string} email - The user's email address.
 * @param {string} password - The user's password.
 * @returns {Promise<firebase.auth.UserCredential>} - A promise that resolves with the user credentials on successful login.
 */
export function login(email, password) {
  // Uses Firebase method to sign in with email and password
  return auth.signInWithEmailAndPassword(email, password);
}

/**
 * Logs out the current user and redirects to the login page.
 *
 * @returns {Promise<void>} - A promise that resolves once logout is complete.
 */
export function logout() {
  // Calls Firebase's signOut method
  return auth.signOut().then(() => {
    // After successful logout, redirect to login page
    window.location.href = "index.html";
  });
}

/**
 * Returns the currently logged-in user as a promise.
 * Useful for awaiting user state in async/await patterns.
 *
 * @returns {Promise<firebase.User|null>} - Resolves with the user object or null if not logged in.
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe(); // Unsubscribe after getting the current state (one-time use)
      resolve(user); // Resolve with the user object
    });
  });
}

/**
 * Ensures a user is logged in. If not, redirect to login page.
 * Typically used to protect dashboard or private routes.
 *
 * @param {string} redirectTo - URL to redirect to if user is not authenticated (default is "index.html").
 */
export function requireAuth(redirectTo = "index.html") {
  auth.onAuthStateChanged((user) => {
    // If user is not logged in, redirect to login page
    if (!user) {
      window.location.href = redirectTo;
    }
    // If user is logged in, do nothing and allow access
  });
}
