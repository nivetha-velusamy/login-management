const router = require('express').Router();
const auth = require('../middleware/auth');
const NetworkLog = require('../models/NetworkLog');
router.get('/logs', auth, async (req, res, next) => {
  try { const logs = await NetworkLog.find().sort({ createdAt: -1 }).limit(60).lean(); res.json({ logs }); }
  catch (e) { next(e); }
});
module.exports = router;
