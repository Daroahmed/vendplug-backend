// backend/worker.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let BullMQ;
try { BullMQ = require('bullmq'); } catch (e) {
  console.error('❌ BullMQ not installed. Run: npm install bullmq');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('❌ REDIS_URL not found in environment variables.');
  console.error('   Please set REDIS_URL in your .env file.');
  console.error('   Format examples:');
  console.error('   - redis://localhost:6379');
  console.error('   - redis://username:password@host:port');
  console.error('   - rediss://host:port (for SSL)');
  process.exit(1);
}

// Validate REDIS_URL format
const redisUrl = process.env.REDIS_URL.trim();
if (!redisUrl.match(/^rediss?:\/\//)) {
  console.error('❌ Invalid REDIS_URL format. Must start with redis:// or rediss://');
  console.error(`   Current value: ${redisUrl.substring(0, 50)}...`);
  process.exit(1);
}

const QueueEvents = BullMQ.QueueEvents;
const Worker = BullMQ.Worker;

// Create connection config - BullMQ v5 supports URL format
let connection;
try {
  connection = { connection: { url: redisUrl } };
} catch (err) {
  console.error('❌ Failed to create Redis connection config:', err.message);
  process.exit(1);
}

const { sendVerificationEmail, sendPasswordResetEmail, sendPinResetEmail } = require('./utils/emailService');
const { sendNotification } = require('./utils/notificationHelper');

// Email worker
const emailWorker = new Worker('emails', async job => {
  console.log('📧 [Job:start] Email job', job.id, job.data.type);
  if (job.data.type === 'verify') {
    return await sendVerificationEmail(job.data.email, job.data.token);
  }
  if (job.data.type === 'reset') {
    return await sendPasswordResetEmail(job.data.email, job.data.token);
  }
  if (job.data.type === 'pin') {
    return await sendPinResetEmail(job.data.email, job.data.resetCode, job.data.userType);
  }
  throw new Error('Unknown email job type');
}, connection);

// Notification worker
const notificationWorker = new Worker('notifications', async job => {
  console.log('🔔 [Job:start] Notification job', job.id, job.data.notificationType);
  // io is always null in the worker, but createNotification works without socket
  return await sendNotification(null, job.data);
}, connection);

emailWorker.on('completed', (job, result) => console.log('✅ [Job:done] Email', job.id));
emailWorker.on('failed', (job, err) =>   console.error('❌ [Job:fail] Email', job?.id, err?.message));
emailWorker.on('error', (err) => console.error('❌ [Worker:error] Email worker error:', err.message));

notificationWorker.on('completed', (job, result) => console.log('✅ [Job:done] Notification', job.id));
notificationWorker.on('failed', (job, err) =>   console.error('❌ [Job:fail] Notification', job?.id, err?.message));
notificationWorker.on('error', (err) => console.error('❌ [Worker:error] Notification worker error:', err.message));

// Test connection on startup
emailWorker.on('ready', () => {
  console.log('✅ Email worker connected to Redis');
});

notificationWorker.on('ready', () => {
  console.log('✅ Notification worker connected to Redis');
});

console.log('🚀 Worker(s) for email and notification queues started');
console.log(`📡 Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs
