// Quick test script to verify queue disable feature
// Run: node backend/test-queue-disable.js

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { enqueueEmail, enqueueNotification } = require('./utils/queue');

console.log('\n🧪 Testing Queue Disable Feature\n');
console.log('DISABLE_WORKER:', process.env.DISABLE_WORKER);
console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set (hidden)' : 'Not set');
console.log('');

async function test() {
  console.log('1. Testing email enqueue...');
  const emailResult = await enqueueEmail({ type: 'test', email: 'test@example.com' });
  console.log('   Result:', emailResult ? '✅ Queued' : '✅ Synchronous fallback (expected when disabled)');
  
  console.log('\n2. Testing notification enqueue...');
  const notifResult = await enqueueNotification({ notificationType: 'TEST' });
  console.log('   Result:', notifResult ? '✅ Queued' : '✅ Synchronous fallback (expected when disabled)');
  
  console.log('\n✅ Test complete!');
  console.log('\nIf DISABLE_WORKER=true:');
  console.log('  - Both should return false (synchronous fallback)');
  console.log('  - No Redis connections should be made');
  console.log('  - Check server logs for "Worker disabled" messages');
}

test().catch(console.error);

