// Get all products for the logged-in vendor
const getVendorProducts = async (req, res) => {
    const products = await Product.find({ vendor: req.vendor._id });
    res.json(products);
  };
  
  // Add new product
  const addVendorProduct = async (req, res) => {
    const { name, price, category, image } = req.body;
    const newProduct = await Product.create({
      name,
      price,
      category,
      image,
      vendor: req.vendor._id
    });
    res.status(201).json(newProduct);
  };
  
  // Update a product
  const updateVendorProduct = async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
  
    if (!product) return res.status(404).json({ message: "Product not found" });
  
    const { name, price, category, image } = req.body;
    product.name = name || product.name;
    product.price = price ?? product.price;
    product.category = category || product.category;
    product.image = image || product.image;
  
    await product.save();
    res.json({ message: "Product updated", product });
  };
  
  // Delete a product
  const deleteVendorProduct = async (req, res) => {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      vendor: req.vendor._id
    });
  
    if (!product) return res.status(404).json({ message: "Product not found" });
  
    res.json({ message: "Product deleted" });
  };
  
  module.exports = {
    getVendorProducts,
    addVendorProduct,
    updateVendorProduct,
    deleteVendorProduct
  };
  