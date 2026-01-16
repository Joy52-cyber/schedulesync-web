/**
 * TruCal Chrome Extension - Gmail Content Script
 * Injects "Insert Available Times" button into Gmail compose window
 */

console.log('🎯 TruCal content script loaded');

let trucalButtonInjected = false;
let currentComposeWindow = null;

// Wait for Gmail to load
setTimeout(initTruCal, 2000);

function initTruCal() {
  console.log('🚀 Initializing TruCal Gmail integration');

  // Watch for Gmail compose windows
  watchForComposeWindows();
}

/**
 * Watch for Gmail compose windows appearing
 */
function watchForComposeWindows() {
  const observer = new MutationObserver((mutations) => {
    // Check if a compose window is open
    const composeWindow = document.querySelector('.M9');

    if (composeWindow && !composeWindow.dataset.trucalInjected) {
      console.log('📝 Compose window detected');
      injectTruCalButton(composeWindow);
      composeWindow.dataset.trucalInjected = 'true';
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also check immediately
  const existingCompose = document.querySelector('.M9');
  if (existingCompose && !existingCompose.dataset.trucalInjected) {
    console.log('📝 Found existing compose window');
    injectTruCalButton(existingCompose);
    existingCompose.dataset.trucalInjected = 'true';
  }
}

/**
 * Inject TruCal button into Gmail compose toolbar
 */
function injectTruCalButton(composeWindow) {
  // Find the toolbar
  const toolbar = composeWindow.querySelector('.btC') ||
                  composeWindow.querySelector('div[role="toolbar"]');

  if (!toolbar) {
    console.log('⚠️ Toolbar not found, retrying...');
    setTimeout(() => injectTruCalButton(composeWindow), 500);
    return;
  }

  // Check if button already exists
  if (toolbar.querySelector('.trucal-button')) {
    return;
  }

  console.log('✅ Injecting TruCal button');

  // Create TruCal button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'trucal-button-container';
  buttonContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px;';

  // Create main button
  const button = document.createElement('button');
  button.className = 'trucal-button';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 6px;">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
      <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2"/>
    </svg>
    <span>TruCal</span>
  `;
  button.title = 'Insert available times from TruCal';

  buttonContainer.appendChild(button);

  // Insert button into toolbar
  toolbar.appendChild(buttonContainer);

  // Add click handler
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleTruCalButtonClick(composeWindow);
  });

  currentComposeWindow = composeWindow;
}

/**
 * Handle TruCal button click
 */
async function handleTruCalButtonClick(composeWindow) {
  console.log('🔘 TruCal button clicked');

  // Check authentication status
  const authStatus = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAuthStatus' }, resolve);
  });

  if (!authStatus.isAuthenticated) {
    showNotification('Please log in to TruCal extension first', 'error', composeWindow);
    return;
  }

  // Show duration picker
  showDurationPicker(composeWindow);
}

/**
 * Show duration picker dropdown
 */
function showDurationPicker(composeWindow) {
  // Remove existing picker if any
  const existing = document.querySelector('.trucal-duration-picker');
  if (existing) {
    existing.remove();
  }

  const picker = document.createElement('div');
  picker.className = 'trucal-duration-picker';
  picker.innerHTML = `
    <div class="trucal-picker-header">Meeting Duration</div>
    <button class="trucal-duration-option" data-duration="15">15 minutes</button>
    <button class="trucal-duration-option" data-duration="30">30 minutes ⭐</button>
    <button class="trucal-duration-option" data-duration="45">45 minutes</button>
    <button class="trucal-duration-option" data-duration="60">1 hour</button>
  `;

  // Position near the TruCal button
  const button = composeWindow.querySelector('.trucal-button');
  const rect = button.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 5}px`;
  picker.style.left = `${rect.left}px`;

  document.body.appendChild(picker);

  // Prevent picker from closing when clicking inside it
  picker.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Add click handlers
  picker.querySelectorAll('.trucal-duration-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const duration = parseInt(option.dataset.duration);
      picker.remove();
      insertAvailableTimes(composeWindow, duration);
    });
  });

  // Close on click outside (wait longer to avoid immediate close)
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!picker.contains(e.target) && !button.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 500);
}

/**
 * Insert available times into email body
 */
async function insertAvailableTimes(composeWindow, duration) {
  console.log(`📅 Inserting times for ${duration} min meeting`);

  // Show loading state
  showNotification('Loading your available times...', 'info', composeWindow);

  try {
    // Fetch slots from background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getAvailableSlots', duration, count: 5 },
        resolve
      );
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch slots');
    }

    if (!response.slots || response.slots.length === 0) {
      throw new Error('No available times found. Please check your TruCal availability settings.');
    }

    // Find the compose body
    const composeBody = composeWindow.querySelector('.Am.Al.editable') ||
                       composeWindow.querySelector('div[aria-label="Message Body"]') ||
                       composeWindow.querySelector('div[contenteditable="true"]');

    if (!composeBody) {
      throw new Error('Could not find email body');
    }

    // Generate HTML for slots
    const slotsHTML = generateSlotsHTML(response.slots, duration);

    // Insert into email
    const selection = window.getSelection();
    const range = document.createRange();

    // Insert at cursor or at the end
    if (composeBody.contains(selection.anchorNode)) {
      range.setStart(selection.anchorNode, selection.anchorOffset);
    } else {
      range.selectNodeContents(composeBody);
      range.collapse(false);
    }

    const fragment = range.createContextualFragment(slotsHTML);
    range.insertNode(fragment);

    // Move cursor to end
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    showNotification(`✓ Inserted ${response.slots.length} available times`, 'success', composeWindow);
  } catch (error) {
    console.error('❌ Error inserting times:', error);
    showNotification(error.message, 'error', composeWindow);
  }
}

/**
 * Generate HTML for time slots
 */
function generateSlotsHTML(slots, duration) {
  const slotsHtml = slots.map((slot, index) => {
    const isFirst = index === 0;
    const buttonStyle = isFirst
      ? 'display: block; padding: 12px 16px; background: linear-gradient(90deg, #7c3aed, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center;'
      : 'display: block; padding: 12px 16px; background: #f3f4f6; color: #111827; text-decoration: none; border-radius: 8px; font-weight: 500; text-align: center;';

    return `
      <tr>
        <td style="padding: 6px 0;">
          <a href="${slot.bookUrl}" style="${buttonStyle}">
            ${isFirst ? '✓ ' : ''}${slot.label}
          </a>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; margin: 16px 0; padding: 0;">
      <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">Here are some times that work for me:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 420px; border-collapse: collapse;">
        ${slotsHtml}
      </table>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #9ca3af;">
        Powered by <a href="https://www.trucal.xyz" target="_blank" style="color: #7c3aed; text-decoration: none;">TruCal</a>
      </p>
    </div>
    <br>
  `;
}

/**
 * Show notification in compose window
 */
function showNotification(message, type = 'info', composeWindow) {
  // Remove existing notification
  const existing = document.querySelector('.trucal-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `trucal-notification trucal-notification-${type}`;
  notification.textContent = message;

  const button = composeWindow.querySelector('.trucal-button');
  if (button) {
    const rect = button.getBoundingClientRect();
    notification.style.top = `${rect.top - 45}px`;
    notification.style.left = `${rect.left}px`;
  }

  document.body.appendChild(notification);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.remove();
  }, 4000);
}

console.log('✅ TruCal content script ready');
