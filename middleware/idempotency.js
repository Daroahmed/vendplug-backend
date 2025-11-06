const IdempotencyKey = require('../models/IdempotencyKey');

// Middleware to enforce idempotency on critical POST endpoints
// Requires clients to send 'Idempotency-Key' header
module.exports = async function idempotency(req, res, next) {
  try {
    const key = req.header('Idempotency-Key');
    if (!key) return res.status(400).json({ message: 'Idempotency-Key header is required' });

    const existing = await IdempotencyKey.findOne({ key });
    if (existing) {
      // Replay previous response
      return res.status(existing.statusCode || 200).json(existing.responseBody || {});
    }

    // Wrap res.json to capture output
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        await IdempotencyKey.create({
          key,
          userId: (req.user && (req.user._id || req.user.id)) || null,
          route: req.originalUrl.split('?')[0],
          method: req.method,
          statusCode: res.statusCode,
          responseBody: body,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour TTL
        });
      } catch (_) {}
      return originalJson(body);
    };

    next();
  } catch (err) {
    return res.status(500).json({ message: 'Idempotency middleware error', error: err.message });
  }
};


