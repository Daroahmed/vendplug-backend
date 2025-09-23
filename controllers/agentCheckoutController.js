// backend/controllers/agentCheckoutController.js
const mongoose = require("mongoose");
const Cart = require("../models/AgentCart");
const Wallet = require("../models/walletModel");
const Order = require("../models/AgentOrder");
const Transaction = require("../models/Transaction");
const AgentProduct = require("../models/AgentProduct");

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
        populate: { path: "agent", select: "_id name" }
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
      agent: i.product?.agent?.name
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
    // 6. Group items by agent
    // ===============================
    const ordersByAgent = {};
    cart.items.forEach((item) => {
      const agentId = item.product.agent._id.toString();
      if (!ordersByAgent[agentId]) ordersByAgent[agentId] = [];
      ordersByAgent[agentId].push(item);
    });

    // ===============================
    // 7. Reserve stock atomically per item and create orders per agent
    // ===============================
    const createdOrders = [];
    for (let agentId in ordersByAgent) {
      const agentItems = ordersByAgent[agentId];

      const orderTotal = agentItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
      );

      // Reserve stock for each item (ensure available >= qty)
      for (const item of agentItems) {
        const inc = Number(item.quantity || 0);
        const reservedResult = await AgentProduct.findOneAndUpdate(
          {
            _id: item.product._id,
            $expr: { $gte: [ { $subtract: ["$stock", "$reserved"] }, inc ] }
          },
          { $inc: { reserved: inc } },
          { new: true, session }
        );
        if (!reservedResult) {
          throw new Error(`Insufficient stock for ${item.product?.name || 'product'}`);
        }
      }

      const order = await Order.create(
        [
          {
            buyer: req.buyer._id,
            agent: new mongoose.Types.ObjectId(agentId),
            items: agentItems.map((item) => ({
              product: item.product._id,
              quantity: item.quantity,
              price: item.price
            })),
            totalAmount: orderTotal,
            status: "pending", // waiting for agent acceptance
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

    // ===============================
    // 9. Send notifications
    // ===============================
    try {
      const io = req.app.get('io');
      const { sendNotification } = require('../utils/notificationHelper');
      
      // Notify buyer about order creation
      await sendNotification(io, {
        recipientId: req.buyer._id,
        recipientType: 'Buyer',
        notificationType: 'ORDER_CREATED',
        args: [createdOrders[0]._id, totalCost],
        orderId: createdOrders[0]._id
      });

      // Notify each agent about new orders
      for (const order of createdOrders) {
        await sendNotification(io, {
          recipientId: order.agent,
          recipientType: 'Agent',
          notificationType: 'ORDER_CREATED',
          args: [order._id, order.totalAmount],
          orderId: order._id
        });
      }

      console.log('✅ Agent order creation notifications sent');
    } catch (notificationError) {
      console.error('❌ Notification error:', notificationError);
      // Don't fail the checkout if notifications fail
    }

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
