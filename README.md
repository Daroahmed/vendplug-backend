# Vendplug-escrow

## PWA Push Notifications Setup

1. Backend dependencies include `web-push`.
2. Generate VAPID keys:
   - Run: `node backend/scripts/generateVapidKeys.js`
   - Copy the output into your `.env` file:
     - `VAPID_PUBLIC_KEY=...`
     - `VAPID_PRIVATE_KEY=...`
3. Restart the backend.
4. Open `frontend/public-buyer-home.html` (HTTPS/localhost), allow notifications when prompted.
5. Existing notifications will now also send Web Push to subscribed devices.
