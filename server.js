// ✅ Load environment variables (always from the backend folder)
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
// console.log('✅ Loaded MONGO_URI:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIO = require('socket.io');
const cloudinary = require('cloudinary').v2;

// ✅ Import all models to ensure they're registered
const Buyer = require('./models/Buyer');
const Vendor = require('./models/vendorModel');
const Agent = require('./models/Agent');
const Token = require('./models/Token');
const Notification = require('./models/Notification');
const ShareAnalytics = require('./models/ShareAnalytics');
const Staff = require('./models/Staff'); // Temporary model for debugging

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
app.use(cookieParser());

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
const agentRoutes = require('./routes/agentRoutes');
const buyerOrderRoutes = require('./routes/buyerOrderRoutes');
const vendorOrderRoutes = require('./routes/vendorOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vendorProductRoutes = require("./routes/vendorProductRoutes");
const walletRoutes = require('./routes/walletRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vendorCartRoutes = require('./routes/vendorCartRoutes');
const vendorCheckoutRoutes = require('./routes/vendorCheckoutRoutes');
const agentProductRoutes = require('./routes/agentProductRoutes');
const agentCartRoutes = require('./routes/agentCartRoutes');
const agentOrderRoutes = require('./routes/agentOrderRoutes');
const agentCheckoutRoutes = require('./routes/agentCheckoutRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const bankAccountRoutes = require('./routes/bankAccountRoutes');
const authRoutes = require('./routes/authRoutes');
const paystackRoutes = require('./routes/paystackRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const staffDisputeRoutes = require('./routes/staffDisputeRoutes');
const staffAuthRoutes = require('./routes/staffAuthRoutes');
const chatRoutes = require('./routes/chatRoutes');
const supportRoutes = require('./routes/supportRoutes');
const autoAssignmentService = require('./services/autoAssignmentService');


// ✅ Mount API routes
app.use('/api/buyers', buyerRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/buyer-orders', buyerOrderRoutes);
app.use('/api/vendor-orders', vendorOrderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/vendor-products', vendorProductRoutes);
app.use('/api/vendor-cart', vendorCartRoutes);
app.use('/api/vendor-checkout', vendorCheckoutRoutes);
app.use('/api/agent-products', agentProductRoutes);
app.use('/api/agent-cart', agentCartRoutes);
app.use('/api/agent-orders', agentOrderRoutes);
app.use('/api/agent-checkout', agentCheckoutRoutes);
app.use('/api/vendor-payout', payoutRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/paystack', paystackRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/staff', staffAuthRoutes);
app.use('/api/staff', staffDisputeRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin-ads', require('./routes/adminAdRoutes'));
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

  // Chat events
  socket.on('join_chat', async (data) => {
    try {
      const { chatId, userId } = data;
      const room = `chat_${chatId}`;
      socket.join(room);
      console.log(`✅ User ${userId} joined chat ${chatId}`);
    } catch (error) {
      console.error('🔥 Join chat error:', error);
    }
  });

  socket.on('leave_chat', (data) => {
    const { chatId, userId } = data;
    const room = `chat_${chatId}`;
    socket.leave(room);
    console.log(`❌ User ${userId} left chat ${chatId}`);
  });

  socket.on('typing_start', (data) => {
    const { chatId, userId, userName } = data;
    const room = `chat_${chatId}`;
    socket.to(room).emit('user_typing', {
      chatId,
      userId,
      userName,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    const { chatId, userId, userName } = data;
    const room = `chat_${chatId}`;
    socket.to(room).emit('user_typing', {
      chatId,
      userId,
      userName,
      isTyping: false
    });
  });

  socket.on('message_read', async (data) => {
    try {
      const { messageId, chatId, userId } = data;
      const room = `chat_${chatId}`;
      
      // Emit to other participants
      socket.to(room).emit('message_read_status', {
        messageId,
        chatId,
        userId,
        readAt: new Date()
      });
    } catch (error) {
      console.error('🔥 Message read error:', error);
    }
  });

  // Support ticket events
  socket.on('join_support', async (data) => {
    try {
      const { ticketId, userId, userType } = data;
      const room = `support_${ticketId}`;
      socket.join(room);
      console.log(`✅ User ${userId} (${userType}) joined support ticket ${ticketId}`);
    } catch (error) {
      console.error('🔥 Join support error:', error);
    }
  });

  socket.on('leave_support', (data) => {
    const { ticketId, userId } = data;
    const room = `support_${ticketId}`;
    socket.leave(room);
    console.log(`❌ User ${userId} left support ticket ${ticketId}`);
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
  
  // Start auto-assignment service
  autoAssignmentService.start();
});
