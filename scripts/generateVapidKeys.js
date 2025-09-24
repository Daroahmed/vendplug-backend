

const webpush = require('web-push');

try {
  const keys = webpush.generateVAPIDKeys();
  console.log('VAPID_PUBLIC_KEY=', keys.publicKey);
  console.log('VAPID_PRIVATE_KEY=', keys.privateKey);
  console.log('\nAdd these to your .env file and restart the server.');
} catch (e) {
  console.error('Failed to generate VAPID keys:', e.message);
  process.exit(1);
}


