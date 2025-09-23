const VendorProduct = require('../models/vendorProductModel');
const AgentProduct = require('../models/AgentProduct');

async function notifyOutOfStock(io, product, ownerId, ownerType) {
  try {
    const { sendNotification } = require('./notificationHelper');
    await sendNotification(io, {
      recipientId: ownerId,
      recipientType: ownerType,
      notificationType: 'PRODUCT_OUT_OF_STOCK',
      args: [product.name],
      productId: product._id
    });
  } catch (err) {
    console.error('Inventory notify error:', err);
  }
}

async function checkAndNotifyIfOutOfStock(io, modelName, productId, session) {
  const Model = modelName === 'agent' ? AgentProduct : VendorProduct;
  const product = await Model.findById(productId).lean();
  if (!product) return;
  const stock = Number(product.stock || 0);
  const reserved = Number(product.reserved || 0);
  const available = Math.max(0, stock - reserved);
  const alreadyNotified = !!product.outOfStockNotifiedAt;

  if (available <= 0 && !alreadyNotified) {
    const update = { outOfStockNotifiedAt: new Date() };
    await Model.updateOne({ _id: productId }, { $set: update }, { session });
    const ownerId = modelName === 'agent' ? product.agent : product.vendor;
    const ownerType = modelName === 'agent' ? 'Agent' : 'Vendor';
    await notifyOutOfStock(io, product, ownerId, ownerType);
  }

  if (available > 0 && alreadyNotified) {
    await Model.updateOne({ _id: productId }, { $unset: { outOfStockNotifiedAt: 1 } }, { session });
  }
}

module.exports = { checkAndNotifyIfOutOfStock };


