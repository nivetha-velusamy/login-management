const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const session = await Session.findOne({ tokenId: payload.jti, user: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ message: 'Session expired or revoked.', code: 'SESSION_EXPIRED' });
    session.lastSeenAt = new Date(); await session.save();
    req.userId = payload.sub; req.session = session; next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.', code: 'SESSION_EXPIRED' });
  }
};
