const mongoose = require('mongoose');

const vendorProductSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor', // ✅ Matches vendor model name
    required: true
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  
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
  
      // Fallback
      "Other"
    ]
  },

  description: { type: String },
  stock: { type: Number },
  reserved: { type: Number, default: 0 },
  outOfStockNotifiedAt: { type: Date },
  image: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VendorProduct', vendorProductSchema);
