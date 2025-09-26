const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ✅ Agent Review Schema
const agentReviewSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

// ✅ Agent Schema
const agentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    businessName: { type: String, required: true }, // Changed from shopName to businessName
    phoneNumber: { type: String, required: true },
    businessAddress: { type: String },
    state: { type: String },
    role: { type: String, default: 'agent' },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },

    virtualAccount: { type: String, unique: true },
    walletBalance: { type: Number, default: 0 },

    category: {
      type: [String],
      required: true,
      enum: [
        // 🛒 Everyday Essentials
        "Supermarkets/Groceries and Provisions",
        "Soft Drinks & Water",
        "Kitchen Utensils & Plastics",
        "Gas Plants",
        "Fruits & Vegetables",
        "Grains", 

        // 🍖 Meat & Animal Products
        "Suya & Balango",
        "Raw Meat Sellers",
        "Poultry (Chicken, Eggs, Turkey)",
        "Livestock (Goat, Ram, Cow)",
        "Fish & Seafood",
    
        // 🍽️ Food & Hospitality
        "Restaurants",
        "Catering & Small Chops",
        "Hotels & Apartments",
        "Event Rentals (Canopies, Chairs)",
    
        // 👚 Fashion & Lifestyle
        "Boutiques",
        "Thrift / Okrika / Gongo",
        "Tokunbo / Belguim Products",
        "Shoes and Bags",
        "Jewelry & Accessories",
        "Tailoring & Fashion Design",
        "Textiles & Fabrics",
        "Wigs & Hair",
        "Cosmetics & Skincare",
        "Perfumes & Fragrances",
        "Nigerian Caps e.g. Zana",
    
        // 🏠 Home & Living
        "Furniture",
        "Home Appliances",
        "Interior Decor & Curtains",
        "Cleaning Services",
        "Flowers & Gardens",
    
        // 🧱 Building & Construction
        "Building Materials",
        "Aluminium & Roofing",
        "Cement, Blocks & Interlock",
        "Gravel, Sharp Sand & Quarry",
        "Electrical Supplies",
        "Plumbing Materials",
        "Tiles & Paints",
        "Metal & Iron Works",
        "Carpenters & Artisans",
    
        // 🏥 Health & Beauty
        "Pharmacy & Patent Stores",
        "Hospital & Medical Equipment",
        "Herbal Medicine",
        "Maternity & Clinics",
        "Fitness & Supplements",
    
        // 💻 Electronics & Gadgets
        "Phones & Accessories / Laptops & Computers",
        "Solar & Inverters",
        "CCTV & Security Devices",
        "Game Consoles & Accessories",
    
        // 🧾 Office & Services
        "Printing Press",
        "Stationery & Office Supplies",
        "Internet & Data Services",
        "Freelancers & Digital Services",
    
        // 🚗 Auto & Transport
        "Car Dealers / Tokunbo Cars",
        "Car Spare Parts",
        "Auto Mechanics",
        "Tyres, Batteries & Accessories",
        "Car Wash & Detailing",
    
        // 🧺 Laundry & Cleaning
        "Laundry Services",
        "Dry Cleaning",
        "House Cleaning",
    
        // 🐄 Agriculture
        "Animal Feed & Supplements",
        "Fish Farming",
    
        // 🐕 Pets
        "Pets (Dogs, Cats, Birds)",
        "Pet Food & Accessories",
        "Veterinary Clinics",
        "Pet Grooming",
    
        // 🏡 Real Estate
        "Real Estate Agents",
        "Rentals & Sales",
        "Facility Management",
        "Movers & Packers",
    
        // 🧠 Professional
        "Legal Services",
        "Accounting & Tax",
        "Private Tutors",
        "Event Planners",
        "Photography & Videography",
        "Tech Repairs",
    
        // 🏪 Market Categories (New for agents)
        "Town Market",
        "Village Market",
    
        // Fallback
        "Other"
      ]
    },
    otherCategory: {
      type: String,
      required: function () {
        return this.category === "Other";
      }
    },
    
    businessDescription: { type: String }, // Changed from shopDescription to businessDescription

    totalTransactions: { type: Number, default: 0 },
    brandImage: { type: String },

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AgentProduct' }], // Changed from Product to AgentProduct

    reviews: [agentReviewSchema],

    averageRating: { type: Number, default: 0 },

    password: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Password Hash Middleware (MUST run before other save hooks)
agentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ Auto-calculate average rating
agentSchema.pre('save', function (next) {
  if (this.reviews && this.reviews.length > 0) {
    this.averageRating =
      this.reviews.reduce((acc, item) => acc + item.rating, 0) /
      this.reviews.length;
  } else {
    this.averageRating = 0;
  }
  next();
});

// ✅ Compare password
agentSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Agent', agentSchema);
