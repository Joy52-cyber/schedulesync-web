/**
 * TruCal Chrome Extension - Background Service Worker
 * Handles API calls, authentication, and message passing
 */

const API_BASE_URL = 'https://schedulesync-web-production.up.railway.app';
const TRUCAL_URL = 'https://www.trucal.xyz';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request.action);

  if (request.action === 'getAvailableSlots') {
    handleGetSlots(request.duration, request.count)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  if (request.action === 'getAuthStatus') {
    getAuthToken()
      .then(token => sendResponse({ success: true, isAuthenticated: !!token }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'login') {
    handleLogin(request.email, request.password)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'logout') {
    handleLogout()
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'googleLogin') {
    handleGoogleLogin()
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Get authentication token from storage
 */
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['trucal_token'], (result) => {
      resolve(result.trucal_token || null);
    });
  });
}

/**
 * Set authentication token
 */
async function setAuthToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ trucal_token: token }, () => {
      console.log('✅ Token saved');
      resolve();
    });
  });
}

/**
 * Get user info from storage
 */
async function getUserInfo() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['trucal_user'], (result) => {
      resolve(result.trucal_user || null);
    });
  });
}

/**
 * Set user info
 */
async function setUserInfo(user) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ trucal_user: user }, () => {
      console.log('✅ User info saved');
      resolve();
    });
  });
}

/**
 * Get user preferences
 */
async function getPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['trucal_prefs'], (result) => {
      resolve(result.trucal_prefs || { duration: 30, slotCount: 5 });
    });
  });
}

/**
 * Handle login
 */
async function handleLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.success && data.token) {
      await setAuthToken(data.token);
      await setUserInfo(data.user);
      return { success: true, user: data.user };
    }

    throw new Error('Invalid response from server');
  } catch (error) {
    console.error('❌ Login error:', error);
    throw error;
  }
}

/**
 * Handle Google OAuth login
 */
async function handleGoogleLogin() {
  try {
    console.log('🔐 Starting Google OAuth flow...');

    // Get the Chrome extension redirect URL
    const redirectUri = chrome.identity.getRedirectURL();
    console.log('🔗 Redirect URI:', redirectUri);

    // Get OAuth URL from backend with extension redirect URI
    const urlResponse = await fetch(
      `${API_BASE_URL}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    const urlData = await urlResponse.json();

    if (!urlResponse.ok || !urlData.url) {
      throw new Error('Failed to get OAuth URL');
    }

    console.log('📱 Opening OAuth URL...');

    // Open OAuth flow in new tab and wait for redirect
    const redirectUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: urlData.url,
          interactive: true
        },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(callbackUrl);
          }
        }
      );
    });

    console.log('✅ OAuth redirect received:', redirectUrl);

    // Extract code from callback URL
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('No authorization code received');
    }

    console.log('🔑 Exchanging code for token...');

    // Exchange code for token with the same redirect URI
    const tokenResponse = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error || 'Failed to exchange code for token');
    }

    if (tokenData.success && tokenData.token) {
      await setAuthToken(tokenData.token);
      await setUserInfo(tokenData.user);
      console.log('✅ Google login successful');
      return { success: true, user: tokenData.user };
    }

    throw new Error('Invalid response from server');
  } catch (error) {
    console.error('❌ Google login error:', error);
    throw error;
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['trucal_token', 'trucal_user'], () => {
      console.log('✅ Logged out');
      resolve({ success: true });
    });
  });
}

/**
 * Fetch available time slots from TruCal API
 */
async function handleGetSlots(duration = 30, count = 5) {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in to TruCal extension.');
    }

    const prefs = await getPreferences();
    const finalDuration = duration || prefs.duration || 30;
    const finalCount = count || prefs.slotCount || 5;

    console.log(`📅 Fetching slots: ${finalDuration}min, ${finalCount} slots`);

    const response = await fetch(
      `${API_BASE_URL}/api/extension/slots?duration=${finalDuration}&count=${finalCount}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear it
        await handleLogout();
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error(data.error || 'Failed to fetch slots');
    }

    console.log('✅ Slots fetched:', data.slots?.length || 0);
    return { success: true, slots: data.slots };
  } catch (error) {
    console.error('❌ Error fetching slots:', error);
    throw error;
  }
}

// Log when service worker is ready
console.log('🚀 TruCal extension background service worker ready');
