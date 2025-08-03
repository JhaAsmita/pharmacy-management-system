// Firebase project configuration object
const firebaseConfig = {
  // API key used to authenticate requests from your app
  apiKey: "AIzaSyD7I04kPAae_FndwmW76PhobAoAJx_Of2c",

  // Auth domain used for Firebase Authentication
  authDomain: "pms-project-6th-sem.firebaseapp.com",

  // URL for accessing Firebase Realtime Database
  databaseURL:
    "https://pms-project-6th-sem-default-rtdb.asia-southeast1.firebasedatabase.app",

  // Unique ID for your Firebase project
  projectId: "pms-project-6th-sem",

  // Storage bucket for file uploads (e.g., images, PDFs)
  storageBucket: "pms-project-6th-sem.appspot.com",

  // Identifier used for messaging (Firebase Cloud Messaging)
  messagingSenderId: "512821104496",

  // Unique ID for this specific web app within your Firebase project
  appId: "1:512821104496:web:26936e1b3d4994b87e09b5",
};

// Initialize the main/default Firebase app with the above config
const app = firebase.initializeApp(firebaseConfig);

// Optional: Initialize a **secondary Firebase app instance**
// This can be used if you want to connect to another Firebase project
// or use different auth/database setups within the same app
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");

// Initialize the Firebase Authentication service from the default app
const auth = firebase.auth();

// Initialize the Realtime Database service from the default app
const database = firebase.database();

// Export the `auth` and `database` instances so they can be imported
// and used in other JavaScript modules/files
export { auth, database };
