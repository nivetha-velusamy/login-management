const mongoose = require('mongoose');
const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenId: { type: String, required: true, unique: true },
  ip: String,
  userAgent: String,
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.model('Session', sessionSchema);
