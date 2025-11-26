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

// ✅ If global rate limiting is disabled, scrub any RateLimit-* headers set by deeper middleware
(() => {
  const RATE_LIMIT_ENABLED = String(process.env.RATE_LIMIT_ENABLED || 'true').toLowerCase() !== 'false';
  if (!RATE_LIMIT_ENABLED) {
    app.use((req, res, next) => {
      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) => {
        const key = String(name || '').toLowerCase();
        if (key.startsWith('ratelimit-')) {
          // Drop RateLimit-* headers when globally disabled
          return;
        }
        return originalSetHeader(name, value);
      };
      // Signal header scrub is active
      try { res.setHeader('x-app-ratelimit-scrub', 'true'); } catch (_) {}
      next();
    });
  }
})();

// ✅ Apply general API rate limiting with a kill‑switch and broad skip list
const { apiLimiter } = require('./middleware/rateLimiter');
const RATE_LIMIT_ENABLED = String(process.env.RATE_LIMIT_ENABLED || 'true').toLowerCase() !== 'false';

const generalApiLimiter = (req, res, next) => {
  // Diagnostic header so we can verify on live with curl -I
  try { res.setHeader('x-app-rate-limit-enabled', String(RATE_LIMIT_ENABLED)); } catch (_) {}
  if (!RATE_LIMIT_ENABLED) return next();

  const originalPath = req.originalUrl?.split('?')[0] || '';
  const relativePath = req.path || req.url?.split('?')[0] || '';
  const path = originalPath || relativePath;

  // Browsing/search/public endpoints (skip)
  const isBrowsingEndpoint =
    path.includes('/shop-vendors') ||
    path.includes('/shop-agents') ||
    path.includes('/vendor-products/shop') ||
    path.includes('/agent-products/shop') ||
    path.includes('/vendor-products/vendor/') ||
    path.includes('/agent-products/agent/') ||
    path.includes('/products/search') ||
    path.includes('/product-search');

  // Public product reads used by detail pages
  const isProductsPublic =
    path.includes('/vendor-products/public/') ||
    path.includes('/agent-products/public/');

  // Auth and sensitive endpoints (handled by dedicated limiters)
  const isAuthEndpoint =
    path.includes('/auth/') ||
    /\/(vendors|agents|buyers|staff|admin)\/login/i.test(path) ||
    /\/(vendors|agents|buyers)\/register/i.test(path) ||
    path.includes('/logout');
  const isRefreshEndpoint = path.includes('/auth/refresh');

  // Infra/utility
  const isWebhook = path.includes('/webhooks') || path.includes('/paystack/webhook');
  const isHealth = path.endsWith('/health') || path === '/api/health';
  const isBanks = path.includes('/paystack/banks');

  // Dashboard polling
  const isDashboardEndpoint =
    path.includes('/vendor-orders') ||
    path.includes('/agent-orders') ||
    path.includes('/buyer-orders') ||
    path.includes('/vendors/profile') ||
    path.includes('/agents/profile') ||
    path.includes('/vendor-payout') ||
    path.includes('/stats') ||
    path.includes('/notifications') ||
    path.includes('/analytics') ||
    path.includes('/wallet') ||
    path.includes('/transactions') ||
    path.includes('/chats/unread-count');

  // Public content
  const isAds = req.method === 'GET' && path.includes('/admin-ads');
  const isCategories = req.method === 'GET' && path.includes('/categories');
  const isCart = path.includes('/vendor-cart') || path.includes('/agent-cart');

  // Public entity fetch
  const isPublicProfileEndpoint =
    /\/vendors\/[a-f0-9]{24}$/i.test(path) ||
    /\/agents\/[a-f0-9]{24}$/i.test(path);

  if (
    isBrowsingEndpoint ||
    isProductsPublic ||
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
  ) {
    return next();
  }
  return apiLimiter(req, res, next);
};

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
const deviceRoutes = require('./routes/deviceRoutes');


// ✅ Explicit public category endpoints (inline handler with DB and static fallback)
(() => {
  let handler;
  try {
    const CategoryModel = require('./models/Category');
    handler = async (req, res) => {
      try {
        const { type } = req.query; // 'vendor' | 'agent' | 'both' | undefined
        const filter = { isActive: true };
        if (type === 'vendor') {
          filter.$or = [{ type: 'vendor' }, { type: 'both' }];
        } else if (type === 'agent') {
          filter.$or = [{ type: 'agent' }, { type: 'both' }];
        }
        const categories = await CategoryModel.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
        res.set('x-category-source', 'db-model');
        return res.json({ success: true, categories });
      } catch (err) {
        console.error('Category public handler (db) error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load categories' });
      }
    };
    console.log('✅ Category model found; DB-backed public category route will be used');
  } catch (e) {
    console.warn('⚠️ Category model not found, attempting inline schema:', e.message);
    try {
      const mongoose = require('mongoose');
      const inlineSchema = new mongoose.Schema({
        name: { type: String, required: true },
        imageUrl: { type: String, default: '' },
        groupName: { type: String, default: 'Uncategorized' },
        type: { type: String, default: 'both' },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 }
      }, { collection: 'categories', timestamps: false });
      const CategoryInline = mongoose.models.Category || mongoose.model('Category', inlineSchema);
      handler = async (req, res) => {
        try {
          const { type } = req.query;
          const filter = { isActive: true };
          if (type === 'vendor') {
            filter.$or = [{ type: 'vendor' }, { type: 'both' }];
          } else if (type === 'agent') {
            filter.$or = [{ type: 'agent' }, { type: 'both' }];
          }
          const categories = await CategoryInline.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
          res.set('x-category-source', 'db-inline');
          return res.json({ success: true, categories });
        } catch (err) {
          console.error('Category public handler (inline schema) error:', err.message);
          // Final fallback to static list if DB query fails
          const fallbackNames = [
            'Phones & Accessories / Laptops & Computers','Game Consoles & Accessories','Solar & Inverters','CCTV & Security Devices',
            'Boutiques','Thrift / Okrika / Gonjo','Tokunbo / Belgium Products','Shoes and Bags','Jewelry & Accessories','Tailoring & Fashion Design','Textiles & Fabrics','Wigs & Hair','Cosmetics & Skincare','Perfumes, Incense & Fragrances','Nigerian Caps e.g. Zana',
            'Supermarkets/Groceries and Provisions','Soft Drinks & Water','Kitchen Utensils & Plastics','Tea & Spices','Fruits & Vegetables','Grains',
            'Suya, Kebabs & Balango','Raw Meat Sellers','Poultry (Chicken, Eggs, Turkey)','Livestock (Goat, Ram, Cow)','Fish & Seafood',
            'Restaurants','Catering & Small Chops','Hotels & Apartments','Event Rentals (Canopies, Chairs)',
            'Furniture','Home Appliances','Interior Decor & Curtains','Cleaning Services','Flowers & Gardens',
            'Building Materials','Aluminium & Roofing','Cement, Blocks & Interlock','Gravel, Sharp Sand & Quarry','Electrical Supplies','Plumbing Materials','Tiles & Paints','Metal & Iron Works','Carpenters & Artisans',
            'Pharmacy & Patent Stores','Hospital & Medical Equipment','Herbal Medicine','Maternity & Clinics','Fitness & Supplements',
            'Printing Press','Stationery & Office Supplies','Internet & Data Services','Freelancers & Digital Services',
            'Car Dealers / New, Tokunbo $ Used Cars ','Car Spare Parts','Auto Mechanics','Tyres, Batteries & Accessories','Car Wash & Detailing',
            'Laundry Services','Dry Cleaning','House Cleaning',
            'Animal Feed & Supplements','Fish Farming',
            'Pets (Dogs, Cats, Birds)','Pet Food & Accessories','Veterinary Clinics','Pet Grooming',
            'Real Estate Agents','Rentals & Sales','Facility Management','Movers & Packers',
            'Legal Services','Accounting & Tax','Private Tutors','Event Planners','Photography & Videography','Tech Repairs'
          ];
        res.set('x-category-source', 'static-fallback-inline-error');
          const fallbackCategories = fallbackNames.map(n => ({ name: n, type: 'both', imageUrl: '', groupName: '' }));
          return res.json({ success: true, categories: fallbackCategories });
        }
      };
      console.log('✅ Using inline Category schema for public category route');
    } catch (schemaErr) {
      console.warn('⚠️ Inline schema failed; falling back to static category list:', schemaErr.message);
      const fallbackNames = [
        'Phones & Accessories / Laptops & Computers','Game Consoles & Accessories','Solar & Inverters','CCTV & Security Devices',
        'Boutiques','Thrift / Okrika / Gonjo','Tokunbo / Belgium Products','Shoes and Bags','Jewelry & Accessories','Tailoring & Fashion Design','Textiles & Fabrics','Wigs & Hair','Cosmetics & Skincare','Perfumes & Fragrances','Nigerian Caps e.g. Zana',
        'Supermarkets/Groceries and Provisions','Soft Drinks & Water','Kitchen Utensils & Plastics','Tea & Spices','Fruits & Vegetables','Grains',
        'Suya, Kebabs & Balango','Raw Meat Sellers','Poultry (Chicken, Eggs, Turkey)','Livestock (Goat, Ram, Cow)','Fish & Seafood',
        'Restaurants','Catering & Small Chops','Hotels & Apartments','Event Rentals (Canopies, Chairs)',
        'Furniture','Home Appliances','Interior Decor & Curtains','Cleaning Services','Flowers & Gardens',
        'Building Materials','Aluminium & Roofing','Cement, Blocks & Interlock','Gravel, Sharp Sand & Quarry','Electrical Supplies','Plumbing Materials','Tiles & Paints','Metal & Iron Works','Carpenters & Artisans',
        'Pharmacy & Patent Stores','Hospital & Medical Equipment','Herbal Medicine','Maternity & Clinics','Fitness & Supplements',
        'Printing Press','Stationery & Office Supplies','Internet & Data Services','Freelancers & Digital Services',
        'Car Dealers / New, Tokunbo $ Used Cars ','Car Spare Parts','Auto Mechanics','Tyres, Batteries & Accessories','Car Wash & Detailing',
        'Laundry Services','Dry Cleaning','House Cleaning',
        'Animal Feed & Supplements','Fish Farming',
        'Pets (Dogs, Cats, Birds)','Pet Food & Accessories','Veterinary Clinics','Pet Grooming',
        'Real Estate Agents','Rentals & Sales','Facility Management','Movers & Packers',
        'Legal Services','Accounting & Tax','Private Tutors','Event Planners','Photography & Videography','Tech Repairs'
      ];
      handler = (req, res) => {
        res.set('x-category-source', 'static-fallback-no-model');
        res.json({ success: true, categories: fallbackCategories });
      };
    }
  }
  // Bind before router to ensure these take precedence
  app.get('/api/categories/public', handler);
  app.get('/api/categories', handler); // legacy/mirror
  // Catch-all for category reads, but DO NOT intercept specialized endpoints like /active-counts
  app.get('/api/categories/*', (req, res, next) => {
    if (req.path && req.path.includes('/active-counts')) return next();
    return handler(req, res);
  });
  console.log('✅ Bound /api/categories(public) routes');
})();

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
app.use('/api/devices', deviceRoutes);

// ✅ Explicit public category endpoints (inline handler with DB and static fallback)
(() => {
  let handler;
  try {
    const CategoryModel = require('./models/Category');
    handler = async (req, res) => {
      try {
        const { type } = req.query; // 'vendor' | 'agent' | 'both' | undefined
        const filter = { isActive: true };
        if (type === 'vendor') {
          filter.$or = [{ type: 'vendor' }, { type: 'both' }];
        } else if (type === 'agent') {
          filter.$or = [{ type: 'agent' }, { type: 'both' }];
        }
        const categories = await CategoryModel.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
        res.set('x-category-source', 'db-model');
        return res.json({ success: true, categories });
      } catch (err) {
        console.error('Category public handler (db) error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load categories' });
      }
    };
    console.log('✅ Category model found; DB-backed public category route will be used');
  } catch (e) {
    console.warn('⚠️ Category model not found, attempting inline schema:', e.message);
    try {
      const mongoose = require('mongoose');
      const inlineSchema = new mongoose.Schema({
        name: { type: String, required: true },
        imageUrl: { type: String, default: '' },
        groupName: { type: String, default: 'Uncategorized' },
        type: { type: String, default: 'both' },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 }
      }, { collection: 'categories', timestamps: false });
      const CategoryInline = mongoose.models.Category || mongoose.model('Category', inlineSchema);
      handler = async (req, res) => {
        try {
          const { type } = req.query;
          const filter = { isActive: true };
          if (type === 'vendor') {
            filter.$or = [{ type: 'vendor' }, { type: 'both' }];
          } else if (type === 'agent') {
            filter.$or = [{ type: 'agent' }, { type: 'both' }];
          }
          const categories = await CategoryInline.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
          res.set('x-category-source', 'db-inline');
          return res.json({ success: true, categories });
        } catch (err) {
          console.error('Category public handler (inline schema) error:', err.message);
          // Final fallback to static list if DB query fails
          const fallbackNames = [
            'Phones & Accessories / Laptops & Computers','Game Consoles & Accessories','Solar & Inverters','CCTV & Security Devices',
            'Boutiques','Thrift / Okrika / Gonjo','Tokunbo / Belgium Products','Shoes and Bags','Jewelry & Accessories','Tailoring & Fashion Design','Textiles & Fabrics','Wigs & Hair','Cosmetics & Skincare','Perfumes, Incense & Fragrances','Nigerian Caps e.g. Zana',
            'Supermarkets/Groceries and Provisions','Soft Drinks & Water','Kitchen Utensils & Plastics','Tea & Spices','Fruits & Vegetables','Grains',
            'Suya, Kebabs & Balango','Raw Meat Sellers','Poultry (Chicken, Eggs, Turkey)','Livestock (Goat, Ram, Cow)','Fish & Seafood',
            'Restaurants','Catering & Small Chops','Hotels & Apartments','Event Rentals (Canopies, Chairs)',
            'Furniture','Home Appliances','Interior Decor & Curtains','Cleaning Services','Flowers & Gardens',
            'Building Materials','Aluminium & Roofing','Cement, Blocks & Interlock','Gravel, Sharp Sand & Quarry','Electrical Supplies','Plumbing Materials','Tiles & Paints','Metal & Iron Works','Carpenters & Artisans',
            'Pharmacy & Patent Stores','Hospital & Medical Equipment','Herbal Medicine','Maternity & Clinics','Fitness & Supplements',
            'Printing Press','Stationery & Office Supplies','Internet & Data Services','Freelancers & Digital Services',
            'Car Dealers / New, Tokunbo $ Used Cars ','Car Spare Parts','Auto Mechanics','Tyres, Batteries & Accessories','Car Wash & Detailing',
            'Laundry Services','Dry Cleaning','House Cleaning',
            'Animal Feed & Supplements','Fish Farming',
            'Pets (Dogs, Cats, Birds)','Pet Food & Accessories','Veterinary Clinics','Pet Grooming',
            'Real Estate Agents','Rentals & Sales','Facility Management','Movers & Packers',
            'Legal Services','Accounting & Tax','Private Tutors','Event Planners','Photography & Videography','Tech Repairs'
          ];
          const fallbackCategories = fallbackNames.map(n => ({ name: n, type: 'both', imageUrl: '', groupName: '' }));
          res.set('x-category-source', 'static-fallback-inline-error');
          return res.json({ success: true, categories: fallbackCategories });
        }
      };
      console.log('✅ Using inline Category schema for public category route');
    } catch (schemaErr) {
      console.warn('⚠️ Inline schema failed; falling back to static category list:', schemaErr.message);
      const fallbackNames = [
        'Phones & Accessories / Laptops & Computers','Game Consoles & Accessories','Solar & Inverters','CCTV & Security Devices',
        'Boutiques','Thrift / Okrika / Gonjo','Tokunbo / Belgium Products','Shoes and Bags','Jewelry & Accessories','Tailoring & Fashion Design','Textiles & Fabrics','Wigs & Hair','Cosmetics & Skincare','Perfumes, Incense & Fragrances','Nigerian Caps e.g. Zana',
        'Supermarkets/Groceries and Provisions','Soft Drinks & Water','Kitchen Utensils & Plastics','Tea & Spices','Fruits & Vegetables','Grains',
        'Suya, Kebabs & Balango','Raw Meat Sellers','Poultry (Chicken, Eggs, Turkey)','Livestock (Goat, Ram, Cow)','Fish & Seafood',
        'Restaurants','Catering & Small Chops','Hotels & Apartments','Event Rentals (Canopies, Chairs)',
        'Furniture','Home Appliances','Interior Decor & Curtains','Cleaning Services','Flowers & Gardens',
        'Building Materials','Aluminium & Roofing','Cement, Blocks & Interlock','Gravel, Sharp Sand & Quarry','Electrical Supplies','Plumbing Materials','Tiles & Paints','Metal & Iron Works','Carpenters & Artisans',
        'Pharmacy & Patent Stores','Hospital & Medical Equipment','Herbal Medicine','Maternity & Clinics','Fitness & Supplements',
        'Printing Press','Stationery & Office Supplies','Internet & Data Services','Freelancers & Digital Services',
        'Car Dealers / New, Tokunbo $ Used Cars ','Car Spare Parts','Auto Mechanics','Tyres, Batteries & Accessories','Car Wash & Detailing',
        'Laundry Services','Dry Cleaning','House Cleaning',
        'Animal Feed & Supplements','Fish Farming',
        'Pets (Dogs, Cats, Birds)','Pet Food & Accessories','Veterinary Clinics','Pet Grooming',
        'Real Estate Agents','Rentals & Sales','Facility Management','Movers & Packers',
        'Legal Services','Accounting & Tax','Private Tutors','Event Planners','Photography & Videography','Tech Repairs'
      ];
      const fallbackCategories = fallbackNames.map(n => ({ name: n, type: 'both', imageUrl: '', groupName: '' }));
      handler = (req, res) => {
        res.set('x-category-source', 'static-fallback-no-model');
        res.json({ success: true, categories: fallbackCategories });
      };
    }
  }
  app.get('/api/categories/public', handler);
  app.get('/api/categories', handler); // legacy/mirror
  // Catch-all for any GET under /api/categories/**, excluding specialized endpoints (e.g., /active-counts)
  app.get('/api/categories/*', (req, res, next) => {
    if (req.path && req.path.includes('/active-counts')) return next();
    return handler(req, res);
  });
  console.log('✅ Bound /api/categories(public) routes');
})();

// ✅ Admin routes
app.get('/admin/wallet-management', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/paystack-wallet-management.html'));
});

// ✅ Serve well-known files with correct content type
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, '../frontend/.well-known/assetlinks.json'));
});
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, '../frontend/.well-known/apple-app-site-association'));
});
// ✅ Test route
app.get('/', (req, res) => res.send('Backend is running 🚀'));
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ✅ List-Unsubscribe landing and One‑Click endpoint
app.get('/unsubscribe', (req, res) => {
  res.type('html').status(200).send(`<!doctype html>
  <html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Unsubscribe | Vendplug</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0f1115;color:#e5e7eb;margin:0;padding:40px}
        .card{max-width:640px;margin:0 auto;background:#12151b;border:1px solid #1f2937;border-radius:12px;padding:24px}
        h1{margin:0 0 8px 0;color:#00cc99;font-size:22px}
        p{line-height:1.6;color:#cbd5e1}
        a{color:#00cc99;text-decoration:none}
        .muted{color:#94a3b8;font-size:12px;margin-top:10px}
        .btn{display:inline-block;margin-top:14px;background:#00cc99;color:#0b0f14;padding:10px 16px;border-radius:8px;font-weight:600;text-decoration:none}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>You're unsubscribed</h1>
        <p>You've been unsubscribed from non-essential email updates. Transactional messages (such as receipts, security alerts, or required account notices) may still be sent when strictly necessary.</p>
        <p>If this was a mistake or you want to manage your communication preferences, please contact support.</p>
        <a class="btn" href="/support.html">Go to Support</a>
        <div class="muted">Request ID: ${Date.now().toString(16)}</div>
      </div>
    </body>
  </html>`);
});
// One‑Click List‑Unsubscribe (RFC 8058): accept POST and return 200
app.post('/unsubscribe', (req, res) => {
  try {
    // Optionally, record a marker here if you later add per-user preferences.
    res.status(200).json({ success: true });
  } catch (_e) {
    res.status(200).json({ success: true });
  }
});

// ✅ HTTP Server + Socket.IO
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Export io for modules that need to emit without req/res
try { module.exports.io = io; } catch (_) {}

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
  try {
    const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
    const payload = {
      message: err.message || 'Internal Server Error',
      requestId: req.requestId
    };
    // Include stack only in non-production for easier debugging
    if (String(process.env.NODE_ENV).toLowerCase() !== 'production') {
      payload.error = err.message;
      payload.stack = err.stack;
    }
    console.error('🔥 Uncaught Error:', err.stack || err.message || err);
    res.status(status).json(payload);
  } catch (_) {
    res.status(500).json({ message: 'Internal Server Error', requestId: req.requestId });
  }
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
    const mod = require('./controllers/payoutController');
    const processPayoutQueue = mod && typeof mod.processPayoutQueue === 'function' ? mod.processPayoutQueue : null;
    if (processPayoutQueue) {
      setInterval(async () => {
        try { await processPayoutQueue(); } catch (e) { console.warn('Queue error:', e.message); }
      }, 60 * 1000);
      console.log('⏱️  Payout queue processor started (every 60s)');
    } else {
      console.log('ℹ️  Skipping payout queue (no processPayoutQueue export)');
    }
  } catch (e) {
    console.error('⚠️ Failed to start payout queue processor:', e.message);
  }

  // Reconcile pending wallet topups periodically (every 2 minutes)
  try {
    const { reconcilePendingTopups } = require('./controllers/paystackController');
    setInterval(async () => {
      try {
        const res = await reconcilePendingTopups(25);
        if (res && res.scanned) {
          console.log(`🔁 Reconciled topups: scanned=${res.scanned}, credited=${res.credited || 0}`);
        }
      } catch (e) {
        console.warn('Reconcile topups error:', e.message);
      }
    }, 2 * 60 * 1000);
    console.log('⏱️  Topup reconciliation scheduler started (every 2m)');
  } catch (e) {
    console.error('⚠️ Failed to start topup reconciliation:', e.message);
  }
});
