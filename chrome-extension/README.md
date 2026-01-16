# TruCal Chrome Extension

Insert your available meeting times directly into Gmail compose windows.

## Features

- **One-Click Time Slot Insertion**: Add available meeting times to your emails
- **Customizable Duration**: Choose between 15, 30, 45, or 60-minute meetings
- **Smart Availability**: Only shows slots when you're actually available
- **Beautiful UI**: Premium purple/pink gradient design matching TruCal branding
- **Direct Booking Links**: Recipients can click to instantly book time slots

## Installation (Development Mode)

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click the three dots menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder: `C:\Users\joyla\OneDrive\schedulesync-web\chrome-extension`

4. **Pin the Extension** (Optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "TruCal - Insert Available Times"
   - Click the pin icon to keep it visible

## Setup

1. **Login to TruCal**
   - Click the TruCal extension icon in your Chrome toolbar
   - Enter your TruCal email and password
   - Click "Log In"

2. **Configure Preferences**
   - Set your default meeting duration (15/30/45/60 minutes)
   - Choose how many time slots to show (3/5/7 slots)
   - Click "Save Preferences"

## Usage

1. **Open Gmail**
   - Go to https://mail.google.com

2. **Compose a New Email**
   - Click "Compose" to start a new email

3. **Insert Available Times**
   - Look for the purple "TruCal" button in the compose toolbar (bottom of compose window)
   - Click the TruCal button
   - Select your desired meeting duration
   - Click "Insert Times"

4. **Time Slots Inserted**
   - Available time slots are inserted into your email body
   - First slot is highlighted (purple gradient)
   - Each slot is a clickable booking link
   - Includes "Powered by TruCal" footer

## How It Works

### For You (Sender)
1. Click TruCal button in Gmail compose window
2. Choose meeting duration
3. Extension fetches your real availability from TruCal
4. Inserts formatted time slots into email

### For Recipients
1. Receive email with time slot buttons
2. Click a time slot that works for them
3. Redirected to TruCal confirmation page
4. Booking is instantly confirmed
5. Both parties receive calendar invites

## Troubleshooting

### TruCal Button Not Showing
- Refresh Gmail page
- Make sure you're in a compose window
- Check that extension is enabled at `chrome://extensions/`

### "Not authenticated" Error
- Click extension icon and login again
- Make sure you're using correct TruCal credentials
- Check that you have internet connection

### No Time Slots Available
- Verify your availability settings at https://www.trucal.xyz/settings
- Make sure you have future availability configured
- Check that you completed TruCal onboarding (username set)

### Times Showing in Wrong Timezone
- Update your timezone in TruCal settings
- Extension uses your TruCal account timezone
- Recipients see times in their own timezone automatically

## Files Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (API calls, auth)
├── content.js             # Gmail injection script
├── styles/
│   └── gmail.css         # Styles for Gmail UI
├── popup/
│   ├── popup.html        # Login/settings UI
│   ├── popup.css         # Popup styles
│   └── popup.js          # Popup logic
├── icons/
│   ├── icon16.png        # Toolbar icon
│   ├── icon48.png        # Extension management
│   └── icon128.png       # Chrome Web Store
└── README.md             # This file
```

## Tech Stack

- **Manifest V3**: Modern Chrome extension architecture
- **Chrome Storage API**: Local token and preference storage
- **JWT Authentication**: Secure API communication
- **Luxon**: Timezone-aware date handling
- **MutationObserver**: Detect Gmail compose windows

## API Endpoints

- `POST /api/auth/login` - User authentication
- `GET /api/extension/slots?duration=30&count=5` - Fetch available slots

## Security

- JWT tokens stored in Chrome local storage
- Tokens sent via Authorization Bearer header
- HTTPS-only communication with TruCal API
- No sensitive data in extension code

## Development

### Generate Icons
```bash
cd chrome-extension
node generate-icons.js
```

### Update API URL
Edit `background.js` line 5 to change API base URL:
```javascript
const API_BASE_URL = 'https://www.trucal.xyz';
```

## Support

Issues? Questions?
- Visit: https://www.trucal.xyz/settings
- Email: support@trucal.xyz

---

**Version**: 1.0.0
**Built with**: Chrome Extension Manifest V3
**Powered by**: TruCal Scheduling Platform
