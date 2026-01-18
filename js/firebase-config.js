// ========================================
// FIREBASE CONFIGURATION
// ========================================
// 1. Follow the 'firebase_setup_guide.md' to get your keys.
// 2. PASTE the 'const firebaseConfig = { ... }' block below.

const firebaseConfig = {
  apiKey: "AIzaSyCMwCFS4_3ucyRgjVzrzw2aImwKv-ckJ20",
  authDomain: "ticktask-id.firebaseapp.com",
  projectId: "ticktask-id",
  storageBucket: "ticktask-id.firebasestorage.app",
  messagingSenderId: "94177300519",
  appId: "1:94177300519:web:07f6a438d877eea29cfe02",
  measurementId: "G-Q7WSS20HVF"
};
// Expose to window for auth.js and app.js
window.firebaseConfig = firebaseConfig;
