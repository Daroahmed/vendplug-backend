const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ✅ Vendor Review Schema
const vendorReviewSchema = new mongoose.Schema(
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

// ✅ Vendor Schema
const vendorSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    shopName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    businessName: { type: String },
    businessAddress: { type: String },
    cacNumber: { type: String },
    state: { type: String },
    role: { type: String, default: 'vendor' },

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
        "Thrift / Okrika / Gonjo",
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
    
    
    shopDescription: { type: String },

    totalTransactions: { type: Number, default: 0 },
    brandImage: { type: String },

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    reviews: [vendorReviewSchema],

    averageRating: { type: Number, default: 0 },

    password: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Password Hash Middleware (MUST run before other save hooks)
vendorSchema.pre('save', async function (next) {
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
vendorSchema.pre('save', function (next) {
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
vendorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);
