// ========================================
// FIREBASE AUTHENTICATION LOGIC
// ========================================

// Initialize Firebase
if (window.firebase && window.firebaseConfig) {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(window.firebaseConfig);
        }
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        console.log("Firebase Initialized");
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }
}

// Global Auth State
window.currentUser = null;
window.confirmationResult = null; // For Phone Auth

// ========================================
// PROVIDERS
// ========================================

async function loginWithGoogle() {
    if (!window.auth) return alert("Firebase not initialized");
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        window.closeLoginModal();
    } catch (error) {
        console.error("Google Login Failed:", error);
        alert(error.message);
    }
}

async function loginWithGitHub() {
    if (!window.auth) return alert("Firebase not initialized");
    const provider = new firebase.auth.GithubAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        window.closeLoginModal();
    } catch (error) {
        console.error("GitHub Login Failed:", error);
        alert(error.message);
    }
}

async function loginWithEmail() {
    const email = document.getElementById('email-in').value;
    const pass = document.getElementById('pass-in').value;
    if (!email || !pass) return alert("Please enter email and password");

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        window.closeLoginModal();
    } catch (error) {
        // If user not found, try sign up? Or just alert error
        if (error.code === 'auth/user-not-found') {
            // Optional: Auto sign up
            try {
                await auth.createUserWithEmailAndPassword(email, pass);
                window.closeLoginModal();
            } catch (createErr) {
                alert(createErr.message);
            }
        } else {
            alert(error.message);
        }
    }
}

function initRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        });
    }
}

async function loginWithPhone() {
    const phoneNumber = document.getElementById('phone-in').value;
    if (!phoneNumber) return alert("Enter phone number (e.g., +1 555 555 5555)");

    initRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    try {
        window.confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, appVerifier);
        const code = prompt("Enter the SMS code you received:");
        if (code) {
            await window.confirmationResult.confirm(code);
            window.closeLoginModal();
        }
    } catch (error) {
        console.error("Phone Login Failed:", error);
        alert("SMS Failed. Did you enable Phone Auth in Firebase Console? \n" + error.message);
        // Reset recaptcha
        if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
    }
}

function loginAsGuest() {
    window.closeLoginModal();
    // Guest mode just works with localStorage
}

// ========================================
// STATE LISTENER
// ========================================

// Logout Function
function logout() {
    if (!window.auth) return;
    auth.signOut().then(() => {
        console.log("Logged out");
        window.location.reload();
    });
}

// Auth State Listener
if (window.auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.currentUser = user;
            updateAuthUI(user);
            if (window.loadFromCloud) window.loadFromCloud();
        } else {
            window.currentUser = null;
            updateAuthUI(null);
        }
    });
}

function updateAuthUI(user) {
    const dock = document.querySelector('.dock-container');
    const existingAuthBtn = document.getElementById('auth-btn');
    if (existingAuthBtn) existingAuthBtn.remove();

    const authBtn = document.createElement('button');
    authBtn.className = 'dock-item';
    authBtn.id = 'auth-btn';

    if (user) {
        const photo = user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || user.email || 'U');
        authBtn.innerHTML = `<img src="${photo}" style="width:24px;border-radius:50%">`;
        authBtn.title = `Logged in as ${user.displayName || user.email}`;
        authBtn.onclick = () => {
            if (confirm(`Logout from ${user.email || 'Account'}?`)) logout();
        };
    } else {
        authBtn.innerHTML = `<i data-lucide="log-in"></i>`;
        authBtn.title = "Login / Sync";
        // OPEN THE MODAL with Safety Check
        authBtn.onclick = () => {
            console.log("Login clicked");
            // Capture current tool
            window.lastActiveTool = document.querySelector('.dock-item.active')?.dataset.tool;

            if (typeof window.renderLoginModal === 'function') {
                window.renderLoginModal();
            } else {
                alert("Error: Login Modal missing. Check widgets.js");
                console.error("window.renderLoginModal is not defined");
            }
        };
    }

    if (dock) dock.insertBefore(authBtn, dock.firstChild);
    if (window.lucide) lucide.createIcons();
}
