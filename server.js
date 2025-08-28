// ✅ Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });
console.log('✅ Loaded MONGO_URI:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const cloudinary = require('cloudinary').v2;
const Notification = require('./models/Notification');

// ✅ Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Express app
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve static frontend files
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Import routes
const buyerRoutes = require('./routes/buyerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const agentRoutes = require('./routes/agentRoutes');
const buyerOrderRoutes = require('./routes/buyerOrderRoutes');
const vendorOrderRoutes = require('./routes/vendorOrderRoutes');
const productRoutes = require('./routes/productRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vendorProductRoutes = require("./routes/vendorProductRoutes");
const walletRoutes = require('./routes/walletRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vendorCartRoutes = require('./routes/vendorCartRoutes');
const vendorCheckoutRoutes = require('./routes/vendorCheckoutRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const authRoutes = require('./routes/authRoutes');
const paystackRoutes = require('./routes/paystackRoutes');


// ✅ Mount API routes
app.use('/api/buyers', buyerRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/buyer-orders', buyerOrderRoutes);
app.use('/api/vendor-orders', vendorOrderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/vendor-products', vendorProductRoutes);
app.use('/api/vendor-cart', vendorCartRoutes);
app.use('/api/vendor-checkout', vendorCheckoutRoutes)
app.use('/api/vendor-payout', payoutRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/paystack', paystackRoutes);
// ✅ Test route
app.get('/', (req, res) => res.send('Backend is running 🚀'));

// ✅ HTTP Server + Socket.IO
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});


// Function to emit pending notifications
async function emitPendingNotifications(userId, socket) {
  try {
    // Find unread notifications for this user
    const notifications = await Notification.find({
      recipientId: userId,
      read: false
    })
    .sort('-createdAt')
    .limit(10);

    // Emit each unread notification
    notifications.forEach(notification => {
      socket.emit('new-notification', notification);
    });
  } catch (error) {
    console.error('❌ Error emitting pending notifications:', error);
  }
}

// ✅ Socket.IO connection
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Handle user registration for notifications
  socket.on('register', (userId) => {
    if (!userId) {
      console.warn('⚠️ Registration attempted without userId');
      return;
    }

    // Join user-specific room
    const room = `user:${userId}`;
    socket.join(room);
    console.log(`✅ User ${userId} joined room ${room}`);

    // Send any pending notifications
    emitPendingNotifications(userId, socket);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('🔥 Socket error:', error);
  });
});

// Make io instance available to other modules
app.set('io', io);

// ✅ Global Error Handling
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// ✅ 404 for unmatched routes
app.use((req, res) => {
  console.warn('⚠️ Unmatched route:', req.method, req.originalUrl);
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
