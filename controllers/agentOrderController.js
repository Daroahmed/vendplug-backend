// controllers/agentOrderController.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const {
  applyOrderStatus,
  queuePayout,
  handleError
} = require('../utils/orderHelpers');
const {
  sendNotification,
  sendOrderStatusNotification,
  sendPayoutNotification
} = require('../utils/notificationHelper');
const { incrementVendorTransactions, incrementAgentTransactions } = require('../utils/transactionHelper');

// This helper is no longer needed as we're using the new notification system

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
    handleError(res, error, "Error fetching orders");
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
    handleError(res, error, "Error fetching order history");
  }
};

const createOrder = async (req, res) => {
  try {
    const { cartItems, pickupLocation, deliveryOption, note } = req.body;
    const buyerId = req.user.id;

    if (!Array.isArray(cartItems) || !cartItems.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Group items by party (agent/vendor)
    const ordersByParty = {};
    for (const item of cartItems) {
      const product = await Product.findById(item.id).populate('agent vendor');
      if (!product) continue;

      const partyId = product.agent?._id?.toString() || product.vendor?._id?.toString();
      const partyType = product.agent ? 'Agent' : 'Vendor';

      if (!ordersByParty[partyId]) {
        ordersByParty[partyId] = { items: [], totalAmount: 0, partyType };
      }

      const subtotal = product.price * item.qty;
      ordersByParty[partyId].items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        qty: item.qty
      });
      ordersByParty[partyId].totalAmount += subtotal;
    }

    const savedOrders = [];

    for (const partyId in ordersByParty) {
      const { items, totalAmount, partyType } = ordersByParty[partyId];

      const orderData = {
        buyer: buyerId,
        items,
        pickupLocation,
        totalAmount,
        deliveryOption,
        note
      };
      if (partyType === 'Agent') orderData.agent = partyId;
      if (partyType === 'Vendor') orderData.vendor = partyId;

      const order = new Order(orderData);
      const saved = await order.save();
      savedOrders.push(saved);

      // Note: io will be available from req.app.get('io') when this is called
      // await sendNotification(io, {
      //   recipientId: partyId,
      //   recipientType: partyType,
      //   notificationType: 'ORDER_CREATED',
      //   args: [saved._id, totalAmount],
      //   orderId: saved._id,
      //   meta: { itemCount: items.length }
      // });
    }

    res.status(201).json({ message: 'Order(s) placed successfully', orders: savedOrders });

  } catch (error) {
    handleError(res, error, "Error placing order");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { _id: userId, role } = req.user;

    const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed', 'in-progress', 'fulfilled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const isAgent = role === 'agent' && order.agent?.toString() === userId.toString();
    const isVendor = role === 'vendor' && order.vendor?.toString() === userId.toString();
    if (!isAgent && !isVendor) return res.status(403).json({ message: 'Not authorized to update this order' });

    applyOrderStatus(order, status, role);
    await order.save();

    if (status === 'fulfilled' && isVendor) {
      await queuePayout(order);
      
      // ✅ Increment vendor's total transactions count
      await incrementVendorTransactions(order.vendor);
    }

    // ✅ Increment agent's transaction count when order is fulfilled
    if (status === 'fulfilled' && isAgent) {
      await incrementAgentTransactions(order.agent);
    }

    // Send status update notification
    const io = req.app.get('io');
    await sendOrderStatusNotification(io, order, status);

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    handleError(res, error, "Failed to update order status");
  }
};

module.exports = {
  getAgentOrders,
  getAgentOrderHistory,
  createOrder,
  updateOrderStatus
};
