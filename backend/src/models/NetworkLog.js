const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  method: String, path: String, status: Number, durationMs: Number,
  ip: String, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
module.exports = mongoose.model('NetworkLog', schema);
