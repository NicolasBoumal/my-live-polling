import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function initAdminAuth(app, db, uiElements, options = {}) {
    const auth = getAuth(app);
    let wasDenied = false; // Tracks if the user was just kicked out

    // Helper to safely manipulate DOM elements if they exist
    const safeSet = (element, action, value = null) => {
        if (!element) return;
        if (action === 'hide') element.classList.add('hidden');
        if (action === 'show') element.classList.remove('hidden');
        if (action === 'text') element.innerText = value;
    };

    const login = () => {
        wasDenied = false;
        safeSet(uiElements.authMessage, 'text', "");
        
        const provider = new GoogleAuthProvider();
        if (navigator.userAgent.includes("OBS")) {
            // The OBS browser blocks popups, so we must use redirect
            signInWithRedirect(auth, provider).catch(err => console.error(err));
        } else {
            // Standard browsers should use a popup to avoid cross-site cookie blocking
            signInWithPopup(auth, provider).catch(err => console.error(err));
        }
    };

    const logout = () => signOut(auth);

    // Bind standard UI click events
    if (uiElements.loginBtn) uiElements.loginBtn.addEventListener('click', login);
    if (uiElements.logoutBtn) uiElements.logoutBtn.addEventListener('click', logout);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // If signed in but anonymous (e.g., if the clicker was
            // opened in the same browser), ignore that: do as if
            // the user wasn't logged it at all.
            // This is to avoid an infinite loop of automatic
            // anonymous log in and log out if the clicker and the
            // remote are open in the same browser.
            if (user.isAnonymous) {
                safeSet(uiElements.loginSection, 'show');
                safeSet(uiElements.loginBtn, 'show');
                return;
            }

            safeSet(uiElements.authMessage, 'text', "Checking permissions...");
            safeSet(uiElements.loginBtn, 'hide');

            try {
                // Try to read an admin-only document
                await getDoc(doc(db, "state", "display"));
                
                // Success: the user is an admin
                wasDenied = false;
                safeSet(uiElements.loginSection, 'hide');
                safeSet(uiElements.authMessage, 'text', "");
                
                if (options.onAdminSuccess) options.onAdminSuccess(user);

            } catch (error) {
                // Denied: the user is logged in but is not an admin
                wasDenied = true;
                
                // Auto-logout: the code below will also be called automatically
                await signOut(auth);
                safeSet(uiElements.authMessage, 'text', `Access Denied: ${user.email} is not an admin. You have been logged out.`);
            }
        } else {
            // --- LOGGED OUT ---
            safeSet(uiElements.loginSection, 'show');
            safeSet(uiElements.loginBtn, 'show');
            
            // Only clear the message if they intentionally logged out (not kicked out by the above)
            if (!wasDenied) {
                safeSet(uiElements.authMessage, 'text', "");
            }
            
            if (options.onLoggedOut) options.onLoggedOut();
        }
    });

    return { login, logout };
}
