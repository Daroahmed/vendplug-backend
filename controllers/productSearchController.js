const VendorProduct = require('../models/vendorProductModel');
const AgentProduct = require('../models/AgentProduct');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

// Global product search across all vendors and agents
const searchProducts = async (req, res) => {
  try {
    const { q, category, limit = 20, page = 1, exclude } = req.query;
    
    if (!q && !category) {
      return res.status(400).json({
        success: false,
        message: 'Search query or category is required'
      });
    }

    const searchLimit = parseInt(limit);
    const searchPage = parseInt(page);
    const skip = (searchPage - 1) * searchLimit;

    // Build search conditions
    let searchConditions = {};
    
    if (q) {
      searchConditions.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (category) {
      searchConditions.category = { $in: [category] };
    }

    // Exclude specific product if provided
    if (exclude) {
      searchConditions._id = { $ne: exclude };
    }

    // Search vendor products
    const vendorProducts = await VendorProduct.find(searchConditions)
      .populate('vendor', 'shopName fullName location phoneNumber rating totalOrders responseTime')
      .skip(skip)
      .limit(searchLimit)
      .sort({ createdAt: -1 })
      .lean();

    // Search agent products
    const agentProducts = await AgentProduct.find(searchConditions)
      .populate('agent', 'businessName fullName location phoneNumber rating totalOrders responseTime state businessAddress')
      .skip(skip)
      .limit(searchLimit)
      .sort({ createdAt: -1 })
      .lean();

    // Combine and format results
    const allProducts = [
      ...vendorProducts.map(product => ({
        ...product,
        vendor: product.vendor,
        userType: 'vendor',
        _id: product._id
      })),
      ...agentProducts.map(product => ({
        ...product,
        agent: product.agent,
        userType: 'agent',
        _id: product._id
      }))
    ];

    // Sort by relevance (exact name matches first, then partial matches)
    allProducts.sort((a, b) => {
      if (q) {
        const aNameMatch = a.name.toLowerCase().includes(q.toLowerCase());
        const bNameMatch = b.name.toLowerCase().includes(q.toLowerCase());
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
      }
      
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Get total count for pagination
    const vendorCount = await VendorProduct.countDocuments(searchConditions);
    const agentCount = await AgentProduct.countDocuments(searchConditions);
    const totalCount = vendorCount + agentCount;

    res.json({
      success: true,
      products: allProducts,
      pagination: {
        currentPage: searchPage,
        totalPages: Math.ceil(totalCount / searchLimit),
        totalCount,
        hasNext: skip + searchLimit < totalCount,
        hasPrev: searchPage > 1
      }
    });

  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
};

// Get single product details
const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Try to find in vendor products first
    let product = await VendorProduct.findById(id)
      .populate('vendor', 'shopName fullName location phoneNumber rating totalOrders responseTime userType')
      .lean();

    if (product) {
      product.vendor = product.vendor;
      product.userType = 'vendor';
    } else {
      // Try agent products
      product = await AgentProduct.findById(id)
        .populate('agent', 'shopName fullName location phoneNumber rating totalOrders responseTime userType')
        .lean();
      
      if (product) {
        product.agent = product.agent;
        product.userType = 'agent';
      }
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product details',
      error: error.message
    });
  }
};

// Get product categories
const getProductCategories = async (req, res) => {
  try {
    // Get unique categories from both vendor and agent products
    const vendorCategories = await VendorProduct.distinct('category');
    const agentCategories = await AgentProduct.distinct('category');
    
    // Combine and deduplicate
    const allCategories = [...new Set([...vendorCategories, ...agentCategories])];
    
    // Sort categories alphabetically
    allCategories.sort();

    res.json({
      success: true,
      categories: allCategories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20, page = 1 } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    const searchLimit = parseInt(limit);
    const searchPage = parseInt(page);
    const skip = (searchPage - 1) * searchLimit;

    const searchConditions = {
      category: { $in: [category] }
    };

    // Search vendor products
    const vendorProducts = await VendorProduct.find(searchConditions)
      .populate('vendor', 'shopName fullName location phoneNumber rating totalOrders responseTime')
      .skip(skip)
      .limit(searchLimit)
      .sort({ createdAt: -1 })
      .lean();

    // Search agent products
    const agentProducts = await AgentProduct.find(searchConditions)
      .populate('agent', 'businessName fullName location phoneNumber rating totalOrders responseTime state businessAddress')
      .skip(skip)
      .limit(searchLimit)
      .sort({ createdAt: -1 })
      .lean();

    // Combine results
    const allProducts = [
      ...vendorProducts.map(product => ({
        ...product,
        vendor: product.vendor,
        userType: 'vendor',
        _id: product._id
      })),
      ...agentProducts.map(product => ({
        ...product,
        agent: product.agent,
        userType: 'agent',
        _id: product._id
      }))
    ];

    // Get total count
    const vendorCount = await VendorProduct.countDocuments(searchConditions);
    const agentCount = await AgentProduct.countDocuments(searchConditions);
    const totalCount = vendorCount + agentCount;

    res.json({
      success: true,
      products: allProducts,
      pagination: {
        currentPage: searchPage,
        totalPages: Math.ceil(totalCount / searchLimit),
        totalCount,
        hasNext: skip + searchLimit < totalCount,
        hasPrev: searchPage > 1
      }
    });

  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products by category',
      error: error.message
    });
  }
};

// Get trending/popular products
const getTrendingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const searchLimit = parseInt(limit);

    // Get recent products from both vendors and agents
    const vendorProducts = await VendorProduct.find({})
      .populate('vendor', 'shopName fullName location phoneNumber rating totalOrders responseTime')
      .sort({ createdAt: -1 })
      .limit(searchLimit)
      .lean();

    const agentProducts = await AgentProduct.find({})
      .populate('agent', 'businessName fullName location phoneNumber rating totalOrders responseTime state businessAddress')
      .sort({ createdAt: -1 })
      .limit(searchLimit)
      .lean();

    // Combine results
    const allProducts = [
      ...vendorProducts.map(product => ({
        ...product,
        vendor: product.vendor,
        userType: 'vendor',
        _id: product._id
      })),
      ...agentProducts.map(product => ({
        ...product,
        agent: product.agent,
        userType: 'agent',
        _id: product._id
      }))
    ];

    // Shuffle and limit
    const shuffled = allProducts.sort(() => 0.5 - Math.random());
    const trendingProducts = shuffled.slice(0, searchLimit);

    res.json({
      success: true,
      products: trendingProducts
    });

  } catch (error) {
    console.error('Get trending products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trending products',
      error: error.message
    });
  }
};

module.exports = {
  searchProducts,
  getProductDetails,
  getProductCategories,
  getProductsByCategory,
  getTrendingProducts
};
