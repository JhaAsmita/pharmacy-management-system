// js/auth-handler.js

// Import Firebase Authentication and Realtime Database from firebase-config.js
import { auth, database } from "./firebase-config.js";

/**
 * Listen for authentication state changes (user logged in/out),
 * and retrieve the user's role from Firebase Realtime Database.
 *
 * @param {function} callback - Function to execute with (user, role)
 * @param {string} redirectIfNoUser - Page to redirect if user is not authenticated (default is "index.html")
 */
export function onAuthStateChangedWithRole(
  callback,
  redirectIfNoUser = "index.html"
) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // User is not logged in, redirect to login page
      window.location.href = redirectIfNoUser;
      callback(null, null); // Pass nulls to the callback
      return;
    }

    try {
      // Retrieve user's role from the Realtime Database
      const roleSnapshot = await database
        .ref(`users/${user.uid}/role`)
        .once("value");
      const role = roleSnapshot.val(); // Get the role value ("admin", "user", etc.)
      callback(user, role); // Pass user and role to the callback
    } catch (err) {
      // If role cannot be fetched, log error and return user with null role
      console.error("Error fetching user role:", err);
      callback(user, null);
    }
  });
}

/**
 * After successful login, determine the user's role and redirect to the correct dashboard.
 *
 * @param {object} user - Firebase user object returned after login
 */
export async function redirectBasedOnRole(user) {
  try {
    // Retrieve user's role from database
    const roleSnap = await database
      .ref("users/" + user.uid + "/role")
      .once("value");
    const role = roleSnap.val(); // Extract the role value

    // Redirect based on role
    if (role === "admin") {
      window.location.href = "dashboard.html"; // Admin dashboard
    } else if (role === "user") {
      window.location.href = "user-dashboard.html"; // User dashboard
    } else {
      // If no valid role found, show alert, log out, and redirect to login
      alert("No role assigned.");
      await auth.signOut();
      window.location.href = "index.html";
    }
  } catch (err) {
    // Handle error in retrieving role
    console.error("Error determining role:", err);
    alert("Login failed.");
  }
}
