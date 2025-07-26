const Order = require('../models/Order');
const Product = require('../models/Product');
const { createNotification } = require('./notificationController');

// ✅ AGENT: Get active (non-completed) orders
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

// ✅ AGENT: Get full history
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

// ✅ BUYER: View their orders
const getBuyerOrders = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const orders = await Order.find({ buyer: buyerId })
      .populate('agent', 'fullName')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your orders', error: error.message });
  }
};

// ✅ BUYER: Create Order (Split by Agent)
const createOrder = async (req, res) => {
  try {
    const { cartItems, pickupLocation, deliveryOption, note } = req.body;
    const buyerId = req.user.id;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const ordersGroupedByAgent = {};

    for (const item of cartItems) {
      const product = await Product.findById(item.id).populate('agent');
      if (!product || !product.agent) continue;

      const agentId = product.agent._id.toString();

      if (!ordersGroupedByAgent[agentId]) {
        ordersGroupedByAgent[agentId] = {
          items: [],
          totalAmount: 0
        };
      }

      const subtotal = product.price * item.qty;
      ordersGroupedByAgent[agentId].items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        qty: item.qty
      });
      ordersGroupedByAgent[agentId].totalAmount += subtotal;
    }

    const savedOrders = [];
    const io = req.app.get('io');

    for (const agentId in ordersGroupedByAgent) {
      const { items, totalAmount } = ordersGroupedByAgent[agentId];

      const order = new Order({
        buyer: buyerId,
        agent: agentId,
        items,
        pickupLocation,
        totalAmount,
        deliveryOption,
        note
      });

      const saved = await order.save();
      savedOrders.push(saved);

      // 🔔 Real-time notification to agent
      io.to(`agent_${agentId}`).emit('new-order', {
        agentId,
        orderId: saved._id,
        totalAmount,
        itemCount: items.length,
        time: saved.createdAt
      });

      // 📝 Create saved notification with a readable message
      await createNotification(
        agentId,
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

// ✅ AGENT: Update order status + notify buyer + record notification
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const agentId = req.user._id;

    const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed', 'in-progress'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.agent.toString() !== agentId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.status = status;
    await order.save();

    const io = req.app.get('io');

    // 🔔 Notify buyer via Socket.IO
    io.to(`buyer_${order.buyer}`).emit('order-status-update', {
      orderId: order._id,
      newStatus: status
    });

    // 📝 Save notification for agent
    await createNotification(
      agentId,
      `📦 Order #${order._id} status updated to "${status}"`,
      order._id
    );

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
