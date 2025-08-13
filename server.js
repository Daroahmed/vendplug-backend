// ✅ Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });
console.log('✅ Loaded MONGO_URI:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve static frontend files
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve static files (like images)
app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')));



// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Import routes
const buyerRoutes = require('./routes/buyerRoutes');
const adminRoutes = require('./routes/adminAuth');
const orderRoutes = require('./routes/orderRoutes');
const agentRoutes = require('./routes/agentRoutes');
const productRoutes = require('./routes/productRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vendorProductRoutes = require("./routes/vendorProductRoutes");
const walletRoutes = require('./routes/walletRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const payoutRoutes = require('./routes/payoutRoutes');


// ✅ Mount API routes
app.use('/api/buyers', buyerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/wallet/payout', payoutRoutes);
app.use('/api/vendor-products', vendorProductRoutes);



// ✅ Test route
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// ✅ Create HTTP Server and Attach Socket.IO
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' } // Adjust for production
});

app.set('io', io); // Make io accessible in controllers

// ✅ Socket.IO setup
io.on('connection', (socket) => {
  console.log(`✅ Socket connected: ${socket.id}`);

  // Buyer joins notification room
  socket.on('register-buyer', (buyerId) => {
    socket.join(`buyer_${buyerId}`);
    console.log(`🧍 Buyer ${buyerId} joined room buyer_${buyerId}`);
  });

  // Agent joins notification room
  socket.on('register-agent', (agentId) => {
    socket.join(`agent_${agentId}`);
    console.log(`🧍 Agent ${agentId} joined room agent_${agentId}`);
  });

  // Vendor joins notification room
  socket.on('register-vendor', (vendorId) => {
    socket.join(`vendor_${vendorId}`);
    console.log(`🏬 Vendor ${vendorId} joined room vendor_${vendorId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// ✅ Global Error Handling
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// ✅ 404 for unmatched routes
app.use((req, res, next) => {
  console.warn('⚠️ Unmatched route:', req.method, req.originalUrl);
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
