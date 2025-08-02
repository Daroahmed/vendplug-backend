const express = require("express");
const router = express.Router();
const {
  getVendorProducts,
  addVendorProduct,
  updateVendorProduct,
  deleteVendorProduct
} = require("../controllers/vendorProductController");
const { protectVendor } = require("../middleware/authMiddleware");

// All routes are protected by vendor token
router.get("/", protectVendor, getVendorProducts);             // GET /api/vendor/products
router.post("/", protectVendor, addVendorProduct);             // POST /api/vendor/products
router.put("/:id", protectVendor, updateVendorProduct);        // PUT /api/vendor/products/:id
router.delete("/:id", protectVendor, deleteVendorProduct);     // DELETE /api/vendor/products/:id

module.exports = router;
