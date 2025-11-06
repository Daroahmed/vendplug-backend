let QueueImpl = null;
try { QueueImpl = require('bullmq'); } catch(_) { QueueImpl = null; }

const queues = {};

// Check if worker is disabled (saves Redis quota)
const isWorkerDisabled = process.env.DISABLE_WORKER === 'true';

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
  const q = createQueue('emails');
  // If worker disabled or queue not available, return false for synchronous fallback
  if (isWorkerDisabled || !QueueImpl || !process.env.REDIS_URL) {
    return false; // Queue not available, return false for fallback
  }
  try {
    await q.add('send', payload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    return true;
  } catch (err) {
    console.error('❌ Failed to enqueue email:', err.message);
    return false;
  }
}

async function enqueueNotification(payload) {
  const q = createQueue('notifications');
  // If worker disabled or queue not available, return false for synchronous fallback
  if (isWorkerDisabled || !QueueImpl || !process.env.REDIS_URL) {
    return false; // Queue not available, return false for fallback
  }
  try {
    await q.add('notify', payload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    return true;
  } catch (err) {
    console.error('❌ Failed to enqueue notification:', err.message);
    return false;
  }
}

module.exports = {
  enqueueEmail,
  enqueueNotification,
};


