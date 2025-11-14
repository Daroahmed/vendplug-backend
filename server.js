// ✅ Load environment variables (always from the backend folder)
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
// console.log('✅ Loaded MONGO_URI:', process.env.MONGO_URI);

// Prefer IPv4 when resolving hostnames to avoid rare IPv6 DNS issues in some environments
try { require('dns').setDefaultResultOrder('ipv4first'); } catch (_) {}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIO = require('socket.io');
const cloudinary = require('cloudinary').v2;

// Optional Sentry (loaded only if installed)
let Sentry = null;
try { Sentry = require('@sentry/node'); } catch (_) { Sentry = null; }

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

// If behind a reverse proxy (e.g., Nginx/DO LB), trust the X-Forwarded-* headers
// This ensures rate limiters and IP-based logic use the real client IP
app.set('trust proxy', 1);
// Initialize Sentry if DSN is provided
if (Sentry && process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  app.use(Sentry.Handlers.requestHandler());
}

// ✅ Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(express.json());
app.use(cookieParser());

// ✅ Attach a simple request ID for tracing
app.use((req, res, next) => {
  const id = (Math.random().toString(16).slice(2)) + Date.now().toString(16);
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
});

// ✅ Apply general API rate limiting (protects all routes except browsing/search endpoints)
const { apiLimiter } = require('./middleware/rateLimiter');
const rateLimit = require('express-rate-limit');

// Custom apiLimiter that skips browsing endpoints and sensitive/auth endpoints (they have their own limiter)
const rateLimitEnabled = String(process.env.RATE_LIMIT_ENABLED || 'true').toLowerCase() !== 'false';

// Small diagnostic header to confirm limiter state in responses (helps field debugging)
app.use((req, res, next) => {
  try { res.setHeader('x-app-rate-limit-enabled', String(rateLimitEnabled)); } catch (_) {}
  next();
});
const generalApiLimiter = rateLimitEnabled ? rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // Higher ceiling for general API traffic
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for browsing/search endpoints (they have their own limiter)
    // When middleware is mounted at /api, req.path is relative (e.g., /vendors/shop-vendors)
    // req.originalUrl includes full path (e.g., /api/vendors/shop-vendors)
    // Check both to handle different Express path contexts
    const originalPath = req.originalUrl?.split('?')[0] || '';
    const relativePath = req.path || req.url?.split('?')[0] || '';
    const path = originalPath || relativePath;
    
    // Skip browsing/search endpoints (they have browsingLimiter)
    const isBrowsingEndpoint = path.includes('/shop-vendors') || 
                                path.includes('/shop-agents') || 
                                path.includes('/vendor-products/shop') ||
                                path.includes('/agent-products/shop') ||
                                // direct product lists for a single vendor/agent (public shop views)
                                path.includes('/vendor-products/vendor/') ||
                                path.includes('/agent-products/agent/') ||
                                path.includes('/products/search') ||
                                path.includes('/product-search');
    
    // Skip auth endpoints (they have dedicated limiters)
    const isAuthEndpoint =
      path.includes('/auth/') || // /api/auth/...
      /\/(vendors|agents|buyers|staff|admin)\/login/i.test(path) ||
      /\/(vendors|agents|buyers)\/register/i.test(path) ||
      path.includes('/logout');
    // Skip refresh token endpoint (it has refreshLimiter)
    const isRefreshEndpoint = path.includes('/auth/refresh');
    // Skip webhook endpoints (external systems)
    const isWebhook = path.includes('/webhooks') || path.includes('/paystack/webhook');
    // Skip health checks
    const isHealth = path.endsWith('/health') || path === '/api/health';
    // Skip Paystack banks endpoint (we add server-side caching)
    const isBanks = path.includes('/paystack/banks');
    
    // Skip dashboard endpoints (they have dashboardLimiter)
    // These are authenticated endpoints that are polled frequently
    const isDashboardEndpoint = path.includes('/vendor-orders') ||
                                path.includes('/agent-orders') ||
                                path.includes('/buyer-orders') ||
                                // Frequently polled profile endpoints for dashboards/onboarding
                                path.includes('/vendors/profile') ||
                                path.includes('/agents/profile') ||
                                path.includes('/vendor-payout') ||
                                path.includes('/stats') ||
                                path.includes('/notifications') ||
                                path.includes('/analytics') ||
                                path.includes('/wallet') ||
                                path.includes('/transactions') ||
                                // Unread chat badge polling
                                path.includes('/chats/unread-count');

    // Additional safe skips for public/read-only GET endpoints to avoid accidental throttling
    const isAds = req.method === 'GET' && path.includes('/admin-ads');
    const isCategories = req.method === 'GET' && path.includes('/categories');
    // Carts (badges) are lightweight; skip to avoid surprising throttles
    const isCart = path.includes('/vendor-cart') || path.includes('/agent-cart');

    // Public vendor/agent profile pages (direct entity fetch for shop/business views)
    // Treat these like browsing endpoints to avoid surprising rate-limits during discovery
    const isPublicProfileEndpoint =
      /\/vendors\/[a-f0-9]{24}$/i.test(path) ||
      /\/agents\/[a-f0-9]{24}$/i.test(path);
    
    return (
      isBrowsingEndpoint ||
      isAuthEndpoint ||
      isRefreshEndpoint ||
      isWebhook ||
      isHealth ||
      isBanks ||
      isPublicProfileEndpoint ||
      isDashboardEndpoint ||
      isAds ||
      isCategories ||
      isCart
    );
  }
}) : (req, res, next) => next();

app.use('/api', generalApiLimiter); // Apply to all /api routes (with exceptions)

// ✅ Serve static frontend files (with caching)
const staticCache = { maxAge: '7d', etag: true, immutable: true };
app.use('/css', express.static(path.join(__dirname, '../frontend/css'), staticCache));
app.use('/js', express.static(path.join(__dirname, '../frontend/js'), staticCache));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets'), staticCache));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1h', etag: true }));
app.use(express.static(path.join(__dirname, '../frontend'), { maxAge: '1h', etag: true }));

// ✅ MongoDB Connection with optimized settings
const mongooseOptions = {
  // Connection pool settings
  maxPoolSize: 5, // Keep pool small for canary; raise later if needed
  minPoolSize: 2, // Minimum number of connections to maintain
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  
  // Timeout settings
  serverSelectionTimeoutMS: 30000, // How long to try selecting a server (30 seconds)
  socketTimeoutMS: 45000, // How long to wait for socket operations (45 seconds)
  connectTimeoutMS: 30000, // How long to wait for initial connection (30 seconds)
  
  // Retry settings
  retryWrites: true,
  retryReads: true,
  
  // Note: In Mongoose 7.x, bufferCommands is deprecated but we handle connection checks manually
};

async function connectToMongoDB() {
  try {
    // Avoid duplicate connects
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      return;
    }
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    console.log('✅ Connected to MongoDB');
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    
    // Provide specific error diagnostics
    if (err.message.includes('ETIMEOUT') || err.message.includes('queryTxt')) {
      console.error('   ⚠️  DNS/Network timeout detected');
      console.error('   💡 Possible causes:');
      console.error('      - Network connectivity issues');
      console.error('      - DNS resolution problems');
      console.error('      - Firewall blocking MongoDB Atlas');
      console.error('      - MongoDB Atlas service issues');
    } else if (err.message.includes('authentication')) {
      console.error('   ⚠️  Authentication failed');
      console.error('   💡 Check your MongoDB username and password');
    } else if (err.message.includes('ENOTFOUND')) {
      console.error('   ⚠️  Host not found');
      console.error('   💡 Check your MONGO_URI connection string');
    }
  }
}

// Initial connection
connectToMongoDB();

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connection established');
  reconnectAttempts = 0; // Reset on successful connection
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Mongoose will attempt to reconnect automatically...');
  // Rely on Mongoose auto-reconnect (no manual reconnect loop)
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed through app termination');
  process.exit(0);
});

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
const productSearchRoutes = require('./routes/productSearchRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
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
app.use('/api/products', productSearchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin-ads', require('./routes/adminAdRoutes'));
app.use('/api/commission', require('./routes/commissionRoutes'));
app.use('/api/paystack-wallet', require('./routes/paystackWalletRoutes'));

// ✅ Admin routes
app.get('/admin/wallet-management', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/paystack-wallet-management.html'));
});

// ✅ Test route
app.get('/', (req, res) => res.send('Backend is running 🚀'));
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ✅ HTTP Server + Socket.IO
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});


// Function to emit pending notifications
async function emitPendingNotifications(userId, socket) {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB not connected, skipping pending notifications');
      return;
    }

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

// Attach Sentry error handler if enabled
if (Sentry && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// ✅ Global Error Handling
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message, requestId: req.requestId });
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

  // Lightweight payout queue processor (runs every 60s)
  try {
    const { processPayoutQueue } = require('./controllers/payoutController');
    setInterval(() => {
      // Fire-and-forget; internal guards prevent duplicate transfers
      processPayoutQueue();
    }, 60 * 1000);
    console.log('⏱️  Payout queue processor started (every 60s)');
  } catch (e) {
    console.error('⚠️ Failed to start payout queue processor:', e.message);
  }
});
