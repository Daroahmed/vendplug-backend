// ✅ Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });
console.log('✅ Loaded MONGO_URI:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');




// ✅ Initialize Express app
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend static files
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use(express.static(path.join(__dirname, '../frontend')));


// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Import routes
const escrowRoutes = require('./routes/escrowRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const guestEscrowRoutes = require('./routes/guestEscrowRoutes');
const adminRoutes = require('./routes/adminAuth');
const orderRoutes = require('./routes/orderRoutes');
const agentRoutes = require('./routes/agentRoutes');
const productRoutes = require('./routes/productRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vendorProductRoutes = require("./routes/vendorProductRoutes");
const walletRoutes = require('./routes/walletRoutes');
const transactionRoutes = require('./routes/transactionRoutes');


const vendorRoutes = require('./routes/vendorRoutes');

// ✅ Mount routes
app.use('/api/buyers', buyerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/escrows', escrowRoutes);
app.use('/api/guest-escrow', guestEscrowRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);


// ✅ Basic test route
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// ✅ Create HTTP Server + Attach Socket.IO
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' } // Update origin for production
});

app.set('io', io); // Make io accessible in controllers

// ✅ Socket.IO Real-time Communication
io.on('connection', socket => {
  socket.on('join-agent-room', agentId => {
    socket.join(`agent_${agentId}`);
    console.log(`✅ Agent joined room: agent_${agentId}`);

});


  // Buyer joins their own notification room
  socket.on('register-buyer', buyerId => {
    socket.join(`buyer_${buyerId}`);
    console.log(`🧍 Buyer ${buyerId} joined room buyer_${buyerId}`);
  });

  // Agent joins their room for order notifications
  socket.on('register-agent', agentId => {
    socket.join(`agent_${agentId}`);
    console.log(`🧍 Agent ${agentId} joined room agent_${agentId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5007;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
