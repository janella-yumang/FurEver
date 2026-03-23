const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const os = require('os');
const net = require('net');

// Load env BEFORE route imports so SMTP_* vars are available during transporter init
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize MongoDB database connection
const { connectDB } = require('./database');
let dbConnected = false;

// Connect to MongoDB (async - runs on startup)
connectDB()
  .then(() => {
    dbConnected = true;
    console.log('✓ MongoDB database connected');
  })
  .catch((error) => {
    console.error('✗ MongoDB connection failed:', error.message);
    // Don't exit, allow graceful handling
  });

const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const categoriesRoutes = require('./routes/categories');
const ordersRoutes = require('./routes/orders');
const notificationsRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const vouchersRoutes = require('./routes/vouchers');
let migrationRoutes = null;
try {
  migrationRoutes = require('./routes/migration');
} catch (error) {
  console.warn('⚠ Migration routes are unavailable in this deployment:', error?.message || error);
}

const app = express();

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  return [...new Set(ips)];
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ status: 'ok', db: 'mongodb', connected: dbConnected });
});

app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/vouchers', vouchersRoutes);
if (migrationRoutes) {
  app.use('/api/v1/migration', migrationRoutes);
}

function startServer(preferredPort) {
  const server = net.createServer();

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(preferredPort) + 1;
      console.warn(`Port ${preferredPort} is in use. Retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw err;
  });

  server.once('listening', () => {
    server.close(() => {
      app.listen(preferredPort, '0.0.0.0', () => {
        const lanIps = getLanIpv4Addresses();
        console.log(`✓ API running on http://0.0.0.0:${preferredPort}`);

        if (lanIps.length > 0) {
          lanIps.forEach((ip) => {
            console.log(`✓ Access from mobile: http://${ip}:${preferredPort}`);
          });
        } else {
          console.log('✓ Access from mobile: LAN IP not detected');
        }
      });
    });
  });

  server.listen(preferredPort, '0.0.0.0');
}

const port = Number(process.env.PORT) || 4000;
startServer(port);
