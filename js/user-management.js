import { auth, database } from "./firebase-config.js";

// Create a new user only if the currently logged-in user is an admin
export async function addUser(email, password, role) {
  const currentUser = auth.currentUser;
  if (!currentUser) return alert("Not logged in."); // Check if someone is logged in

  // Check if the current user has admin role
  const roleSnap = await database
    .ref("users/" + currentUser.uid + "/role")
    .once("value");
  if (roleSnap.val() !== "admin") return alert("Access denied. Admins only.");

  // Use secondary Firebase app instance to create user without affecting main auth
  const secondaryApp = firebase.app("Secondary");
  const secondaryAuth = secondaryApp.auth();

  try {
    // Create new user with provided email and password using secondary auth
    const { user } = await secondaryAuth.createUserWithEmailAndPassword(
      email,
      password
    );
    // Save new user info and role to Realtime Database under "users"
    await database.ref("users/" + user.uid).set({ email, role });
    alert("User created successfully!");
    loadUsers(); // Refresh the user list display
    document.getElementById("addUserForm").reset(); // Clear the form inputs
  } catch (err) {
    alert("Error: " + err.message); // Show error message if user creation fails
  }
}

// Load all users from the database and display them in a list (for admin page)
export async function loadUsers() {
  const usersList = document.getElementById("usersList");
  usersList.innerHTML = "Loading..."; // Show loading indicator

  try {
    // Fetch all users data from Realtime Database
    const snapshot = await database.ref("users").once("value");
    usersList.innerHTML = ""; // Clear the list before adding users

    // Iterate through each user and add to the list
    snapshot.forEach((child) => {
      const { email, role } = child.val();
      const li = document.createElement("li");
      li.textContent = `${email} (${role})`;
      usersList.appendChild(li);
    });
  } catch (err) {
    // Display error message if loading users fails
    usersList.innerHTML = "Error loading users: " + err.message;
  }
}
