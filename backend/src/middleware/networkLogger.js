const NetworkLog = require('../models/NetworkLog');
module.exports = function networkLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    NetworkLog.create({ method: req.method, path: req.originalUrl, status: res.statusCode,
      durationMs: Date.now() - start, ip: req.ip, userId: req.userId || null }).catch(() => {});
  });
  next();
};
