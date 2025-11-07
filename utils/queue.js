let QueueImpl = null;
try { QueueImpl = require('bullmq'); } catch(_) { QueueImpl = null; }

const queues = {};

// Check if worker is disabled (saves Redis quota)
const isWorkerDisabled = process.env.DISABLE_WORKER === 'true';

// Log queue status on module load
if (isWorkerDisabled) {
  console.log('⚠️  Queue system DISABLED (DISABLE_WORKER=true)');
  console.log('   → Emails and notifications will be sent synchronously');
  console.log('   → Zero Redis usage');
} else if (QueueImpl && process.env.REDIS_URL) {
  console.log('✅ Queue system ENABLED - using Redis for background jobs');
} else {
  console.log('⚠️  Queue system UNAVAILABLE - using synchronous fallback');
  if (!QueueImpl) console.log('   → BullMQ not installed');
  if (!process.env.REDIS_URL) console.log('   → REDIS_URL not set');
}

function createQueue(name) {
  // If worker is disabled or queue not available, return no-op
  if (isWorkerDisabled || !QueueImpl || !process.env.REDIS_URL) {
    // No-op queue
    return {
      add: async () => {},
      on: () => {},
    };
  }
  if (!queues[name]) {
    const redisUrl = process.env.REDIS_URL.trim();
    // Validate URL format
    if (!redisUrl.match(/^rediss?:\/\//)) {
      console.warn(`⚠️ Invalid REDIS_URL format for queue "${name}". Queue will not work.`);
      return {
        add: async () => {},
        on: () => {},
      };
    }
    try {
      const connection = { connection: { url: redisUrl } };
      queues[name] = new QueueImpl.Queue(name, connection);
    } catch (err) {
      console.error(`❌ Failed to create queue "${name}":`, err.message);
      return {
        add: async () => {},
        on: () => {},
      };
    }
  }
  return queues[name];
}

async function enqueueEmail(payload) {
  // Check if worker is disabled FIRST - don't even try to create queue
  // This prevents any Redis connection attempts when disabled
  if (isWorkerDisabled) {
    console.log('📧 Worker disabled: Email will be sent synchronously');
    return false; // Return false to trigger synchronous fallback
  }
  
  // Check if queue system is available
  if (!QueueImpl || !process.env.REDIS_URL) {
    return false; // Queue not available, return false for fallback
  }
  
  try {
    const q = createQueue('emails');
    await q.add('send', payload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    return true;
  } catch (err) {
    console.error('❌ Failed to enqueue email:', err.message);
    return false; // Fallback to synchronous
  }
}

async function enqueueNotification(payload) {
  // Check if worker is disabled FIRST - don't even try to create queue
  // This prevents any Redis connection attempts when disabled
  if (isWorkerDisabled) {
    // Silent fallback for notifications (they're less critical)
    return false; // Return false to trigger synchronous fallback
  }
  
  // Check if queue system is available
  if (!QueueImpl || !process.env.REDIS_URL) {
    return false; // Queue not available, return false for fallback
  }
  
  try {
    const q = createQueue('notifications');
    await q.add('notify', payload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    return true;
  } catch (err) {
    console.error('❌ Failed to enqueue notification:', err.message);
    return false; // Fallback to synchronous
  }
}

module.exports = {
  enqueueEmail,
  enqueueNotification,
};


