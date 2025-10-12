require('dotenv').config(); // 👈 Load .env at the top
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ DB connected');
  const Order = require('./Order');
  console.log('✅ Order model loaded');
  process.exit(0);
})
.catch((err) => {
  console.error('❌ DB connection failed:', err);
  process.exit(1);
});

