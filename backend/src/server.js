require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const networkLogger = require('./middleware/networkLogger');
const app = express();
app.set('trust proxy', 1);
const clientOrigin = process.env.CLIENT_ORIGIN;
app.use(cors({
  origin: !clientOrigin || clientOrigin === '*' ? true : clientOrigin,
  credentials: true
}));
app.use(express.json({ limit: '20kb' }));
app.use(networkLogger);
app.get('/api/health', (req, res) => res.json({ status: 'healthy', service: 'Login & Session State API', database: { status: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected', host: require('mongoose').connection.host, databaseName: require('mongoose').connection.name, type: process.env.MONGODB_URI?.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'MongoDB Local Server' } }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/network', require('./routes/network'));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: 'Unexpected server error.' }); });
const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`API listening on ${port}`);
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });