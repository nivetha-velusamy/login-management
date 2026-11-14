const router = require('express').Router();
const auth = require('../middleware/auth');
const Session = require('../models/Session');
router.use(auth);
router.get('/', async (req, res, next) => {
  try {
    const sessions = await Session.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ sessions: sessions.map(s => ({ id: s._id, ip: s.ip, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt, current: s._id.equals(req.session._id) })) });
  } catch (e) { next(e); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const s = await Session.findOne({ _id: req.params.id, user: req.userId, revokedAt: null });
    if (!s) return res.status(404).json({ message: 'Active session not found.' });
    s.revokedAt = new Date(); await s.save(); res.json({ message: 'Session revoked.' });
  } catch (e) { next(e); }
});
module.exports = router;
