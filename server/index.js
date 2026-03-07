const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load env BEFORE route imports so SMTP_* vars are available during transporter init
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Initialize SQLite database (creates tables if they don't exist)
require('./database');
console.log('✓ SQLite database initialized');

const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const categoriesRoutes = require('./routes/categories');
const ordersRoutes = require('./routes/orders');
const notificationsRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ status: 'ok', db: 'sqlite' });
});

app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✓ API running on http://0.0.0.0:${port}`);
  console.log(`✓ Access from mobile: http://192.168.1.2:${port}`);
});
