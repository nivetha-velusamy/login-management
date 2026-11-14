const mongoose = require('mongoose');
async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Configure backend/.env');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`[DB] Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
module.exports = connectDB;
