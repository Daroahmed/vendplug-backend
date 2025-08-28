// backend/controllers/checkoutController.js
const mongoose = require("mongoose");
const Cart = require("../models/vendorCartModel");
const Wallet = require("../models/walletModel");
const Order = require("../models/vendorOrderModel");
const Transaction = require("../models/Transaction");

const checkoutCart = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { deliveryLocation } = req.body;

    // ===============================
    // 1. Get cart
    // ===============================
    const cart = await Cart.findOne({ buyer: req.buyer._id })
      .populate({
        path: "items.product",
        populate: { path: "vendor", select: "_id name" }
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // ===============================
    // 2. Calculate total cost
    // ===============================
    const totalCost = cart.items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0
    );

    // ===============================
    // 3. Get buyer wallet
    // ===============================
    const wallet = await Wallet.findOne({ 
      user: req.buyer._id, 
      role: "buyer" 
    });

    if (!wallet || wallet.balance < totalCost) {
      console.log("💰 Wallet issue:", {
        walletFound: !!wallet,
        balance: wallet ? wallet.balance : null,
        totalCost
      });
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // Debug logs
    console.log("🛒 Cart items:", cart.items.map(i => ({
      product: i.product?.name,
      price: i.price,
      qty: i.quantity,
      vendor: i.product?.vendor?.name
    })));
    console.log("💰 Wallet balance:", wallet.balance);
    console.log("🧮 Total cost:", totalCost);

    // ===============================
    // 4. Start transaction
    // ===============================
    session.startTransaction();

    // Deduct from wallet (escrow hold)
    wallet.balance -= totalCost;
    await wallet.save({ session });

    // ===============================
    // 5. Log transaction
    // ===============================
    await Transaction.create(
      [
        {
          ref: new mongoose.Types.ObjectId().toString(),
          type: "fund", // must match enum
          status: "successful",
          amount: totalCost,
          description: "Order payment held in escrow",
          initiatedBy: req.buyer._id,
          initiatorType: "Buyer"
        }
      ],
      { session }
    );

    // ===============================
    // 6. Group items by vendor
    // ===============================
    const ordersByVendor = {};
    cart.items.forEach((item) => {
      const vendorId = item.product.vendor._id.toString();
      if (!ordersByVendor[vendorId]) ordersByVendor[vendorId] = [];
      ordersByVendor[vendorId].push(item);
    });

    // ===============================
    // 7. Create orders per vendor
    // ===============================
    const createdOrders = [];
    for (let vendorId in ordersByVendor) {
      const vendorItems = ordersByVendor[vendorId];

      const orderTotal = vendorItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
      );

      const order = await Order.create(
        [
          {
            buyer: req.buyer._id,
            vendor: vendorId,
            items: vendorItems.map((item) => ({
              product: item.product._id,
              quantity: item.quantity,
              price: item.price
            })),
            totalAmount: orderTotal,
            status: "pending", // waiting for vendor acceptance
            escrow: true,
            deliveryLocation
          }
        ],
        { session }
      );

      createdOrders.push(order[0]);
    }

    // ===============================
    // 8. Clear cart
    // ===============================
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();

    res.json({
      message: "Checkout successful. Orders created and funds held in escrow.",
      orders: createdOrders
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Checkout error:", error);
    res.status(500).json({ message: error.message });

  } finally {
    session.endSession(); // ✅ Always end session
  }
};

module.exports = { checkoutCart };
