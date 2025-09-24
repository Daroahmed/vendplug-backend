const WebPushSubscription = require('../models/WebPushSubscription');
const webpush = require('web-push');

// Expect VAPID keys from env for production; can be generated locally for dev
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:support@vendplug.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

exports.getVapidPublicKey = async (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
};

exports.subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }
    const userId = req.user?._id || req.admin?._id;
    const userType = req.user ? (req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)) : (req.admin ? 'Admin' : null);
    if (!userId || !userType) return res.status(401).json({ message: 'Unauthorized' });

    await WebPushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, user: userId, userType },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('Push subscribe error:', e);
    res.status(500).json({ message: 'Failed to save subscription' });
  }
};

exports.sendPush = async ({ userId, userType, title, message, url }) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    const subs = await WebPushSubscription.find({ user: userId, userType });
    await Promise.all(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, message, url }))
      .catch((err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          return WebPushSubscription.deleteOne({ _id: s._id });
        }
      })));
  } catch (e) {
    console.error('Send push error:', e.message);
  }
};


