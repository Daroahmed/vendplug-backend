const Order = require('../models/Order');
const Product = require('../models/Product');
const { createNotification } = require('./notificationController');
const Notification = require('../models/Notification');
const PayoutQueue = require("../models/payoutQueueModel");

const getAgentOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      agent: req.user._id,
      status: { $nin: ['completed', 'cancelled'] }
    })
      .populate('buyer', 'fullName email')
      .populate('agent', 'fullName');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

const getAgentOrderHistory = async (req, res) => {
  try {
    const orders = await Order.find({
      agent: req.user._id,
      status: { $in: ['completed', 'cancelled'] }
    })
      .populate('buyer', 'fullName')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order history', error: error.message });
  }
};

const getBuyerOrders = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const orders = await Order.find({ buyer: buyerId })
      .populate('agent', 'fullName')
      .populate('vendor', 'shopName')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your orders', error: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const { cartItems, pickupLocation, deliveryOption, note } = req.body;
    const buyerId = req.user.id;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const ordersGroupedByAgent = {};

    for (const item of cartItems) {
      const product = await Product.findById(item.id).populate('agent vendor');
      if (!product || (!product.agent && !product.vendor)) continue;

      const partyId = product.agent?._id?.toString() || product.vendor?._id?.toString();
      const partyType = product.agent ? 'agent' : 'vendor';

      if (!ordersGroupedByAgent[partyId]) {
        ordersGroupedByAgent[partyId] = {
          items: [],
          totalAmount: 0,
          partyType,
        };
      }

      const subtotal = product.price * item.qty;
      ordersGroupedByAgent[partyId].items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        qty: item.qty
      });
      ordersGroupedByAgent[partyId].totalAmount += subtotal;
    }

    const savedOrders = [];
    const io = req.app.get('io');

    for (const partyId in ordersGroupedByAgent) {
      const { items, totalAmount, partyType } = ordersGroupedByAgent[partyId];

      const orderData = {
        buyer: buyerId,
        items,
        pickupLocation,
        totalAmount,
        deliveryOption,
        note
      };

      if (partyType === 'agent') orderData.agent = partyId;
      if (partyType === 'vendor') orderData.vendor = partyId;

      const order = new Order(orderData);
      const saved = await order.save();
      savedOrders.push(saved);

      // Socket + notification
      io.to(`${partyType}_${partyId}`).emit('new-order', {
        partyId,
        orderId: saved._id,
        totalAmount,
        itemCount: items.length,
        time: saved.createdAt
      });

      await createNotification(
        partyId,
        `🛒 You have a new order to fulfill.`,
        saved._id
      );
    }

    res.status(201).json({ message: 'Order(s) placed successfully', orders: savedOrders });

  } catch (error) {
    console.error('❌ Error placing order:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;
    const role = req.user.role;

    const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed', 'in-progress', 'fulfilled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const isAgent = role === 'agent' && order.agent?.toString() === userId.toString();
    const isVendor = role === 'vendor' && order.vendor?.toString() === userId.toString();

    if (!isAgent && !isVendor) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.status = status;
    await order.save();

    // 💸 If fulfilled, queue payout
    if (status === 'fulfilled' && isVendor) {
      try {
        const amount = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
        await PayoutQueue.create({
          vendor: order.vendor,
          order: order._id,
          amount,
          status: "pending",
        });
        console.log(`💸 Order ${order._id} queued for payout: ₦${amount}`);
      } catch (err) {
        console.error("❌ Failed to queue payout:", err.message);
      }
    }

    const io = req.app.get('io');
    const buyerId = order.buyer.toString();

    io.to(`buyer_${buyerId}`).emit('order-status-update', {
      orderId: order._id,
      newStatus: status
    });

    await createNotification(
      userId,
      `📦 Order #${order._id} status updated to "${status}"`,
      order._id
    );

    await Notification.create({
      user: buyerId,
      type: "buyer",
      message: `Your order was marked as ${status}.`,
      order: order._id,
      status: "unread",
    });

    res.json({ message: 'Order status updated', order });

  } catch (err) {
    console.error('❌ Failed to update order status:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAgentOrders,
  getAgentOrderHistory,
  getBuyerOrders,
  createOrder,
  updateOrderStatus
};