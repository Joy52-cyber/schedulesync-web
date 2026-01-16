/**
 * TruCal Chrome Extension - Popup Script
 * Handles login, settings, and user preferences
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Popup loaded');

  // TEMPORARY: Auto-inject token for testing
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb3lsYWNhYmE1MkBnbWFpbC5jb20iLCJuYW1lIjoiSm95bWllIEJlcnNhbGVzIiwiaWF0IjoxNzY4NTczMjQ3LCJleHAiOjE3NzExNjUyNDd9.atpZE0odP4oC8OpwdgStPsDAvLogiwVuBBBeUSHMvCs";
  const user = {email: "joylacaba52@gmail.com", name: "Joymie Bersales", username: "joylacaba"};

  chrome.storage.local.set({trucal_token: token, trucal_user: user, trucal_prefs: {duration: 30, slotCount: 5}}, () => {
    console.log('✅ Auto-login injected');
    checkAuthStatus();
    setupEventListeners();
  });
});

/**
 * Check if user is authenticated
 */
async function checkAuthStatus() {
  chrome.storage.local.get(['trucal_token', 'trucal_user', 'trucal_prefs'], (result) => {
    if (result.trucal_token && result.trucal_user) {
      showSettingsView(result.trucal_user, result.trucal_prefs);
    } else {
      showLoginView();
    }
  });
}

/**
 * Show login view
 */
function showLoginView() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('settingsView').style.display = 'none';
}

/**
 * Show settings view
 */
function showSettingsView(user, prefs = {}) {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('settingsView').style.display = 'flex';

  // Populate user info
  document.getElementById('userName').textContent = user.name || 'User';
  document.getElementById('userEmail').textContent = user.email || '';

  // Populate preferences
  document.getElementById('defaultDuration').value = prefs.duration || 30;
  document.getElementById('slotCount').value = prefs.slotCount || 5;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', handleLogin);

  // Logout button
  const logoutButton = document.getElementById('logoutButton');
  logoutButton.addEventListener('click', handleLogout);

  // Save preferences
  const saveButton = document.getElementById('savePreferences');
  saveButton.addEventListener('click', handleSavePreferences);

  // Google login button
  const googleLoginButton = document.getElementById('googleLoginButton');
  if (googleLoginButton) {
    googleLoginButton.addEventListener('click', handleGoogleLogin);
  }

  // Open website button
  const openWebsiteButton = document.getElementById('openWebsiteButton');
  if (openWebsiteButton) {
    openWebsiteButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.trucal.xyz/login' });
    });
  }

  // Signup link
  const signupLink = document.getElementById('signupLink');
  if (signupLink) {
    signupLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://www.trucal.xyz/signup' });
    });
  }

  // Manage availability link
  const manageAvailabilityLink = document.getElementById('manageAvailabilityLink');
  if (manageAvailabilityLink) {
    manageAvailabilityLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://www.trucal.xyz/settings' });
    });
  }
}

/**
 * Handle login
 */
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const loginButton = document.getElementById('loginButton');
  const errorMessage = document.getElementById('errorMessage');

  // Show loading state
  loginButton.disabled = true;
  loginButton.innerHTML = '<div class="spinner"></div>';
  errorMessage.style.display = 'none';

  try {
    // Send message to background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'login', email, password },
        resolve
      );
    });

    if (response.success) {
      // Load preferences
      chrome.storage.local.get(['trucal_prefs'], (result) => {
        showSettingsView(response.user, result.trucal_prefs);
      });
    } else {
      throw new Error(response.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.textContent = error.message;
    errorMessage.style.display = 'block';
  } finally {
    loginButton.disabled = false;
    loginButton.innerHTML = '<span>Log In</span>';
  }
}

/**
 * Handle Google login
 */
async function handleGoogleLogin() {
  const googleLoginButton = document.getElementById('googleLoginButton');
  const errorMessage = document.getElementById('errorMessage');

  googleLoginButton.disabled = true;
  googleLoginButton.innerHTML = '<div class="spinner"></div>';
  errorMessage.style.display = 'none';

  try {
    // Send message to background script to start OAuth flow
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'googleLogin' }, resolve);
    });

    if (response.success) {
      // OAuth flow will complete in background, listen for success
      chrome.storage.local.get(['trucal_prefs'], (result) => {
        showSettingsView(response.user, result.trucal_prefs);
      });
    } else {
      throw new Error(response.error || 'Google login failed');
    }
  } catch (error) {
    console.error('Google login error:', error);
    errorMessage.textContent = error.message;
    errorMessage.style.display = 'block';
  } finally {
    googleLoginButton.disabled = false;
    googleLoginButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.55 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/></svg><span>Sign in with Google</span>';
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  const logoutButton = document.getElementById('logoutButton');

  logoutButton.disabled = true;
  logoutButton.innerHTML = '<div class="spinner"></div>';

  try {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'logout' }, resolve);
    });

    // Clear preferences
    chrome.storage.local.remove(['trucal_prefs'], () => {
      showLoginView();
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    logoutButton.disabled = false;
    logoutButton.innerHTML = '<span>Log Out</span>';
  }
}

/**
 * Handle save preferences
 */
async function handleSavePreferences() {
  const duration = parseInt(document.getElementById('defaultDuration').value);
  const slotCount = parseInt(document.getElementById('slotCount').value);
  const saveButton = document.getElementById('savePreferences');

  saveButton.disabled = true;
  const originalText = saveButton.innerHTML;
  saveButton.innerHTML = '<div class="spinner"></div>';

  try {
    const prefs = { duration, slotCount };

    await new Promise((resolve) => {
      chrome.storage.local.set({ trucal_prefs: prefs }, resolve);
    });

    // Show success feedback
    saveButton.innerHTML = '<span>✓ Saved!</span>';
    setTimeout(() => {
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
    }, 1500);
  } catch (error) {
    console.error('Save preferences error:', error);
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}
