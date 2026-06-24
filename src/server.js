require('dotenv').config();
const app = require('./app');
const dbService = require('./services/db.service');
const whatsappService = require('./services/whatsapp.service');

// ─── Global Fail-safes ────────────────────────────────────────────────────────
// Catch any un-handled synchronous exception that would otherwise silently kill Node
process.on('uncaughtException', (err) => {
  console.error('====== FATAL: Uncaught Exception ======');
  console.error(err);
  // Give the logger a moment to flush, then exit so PM2 can restart
  setTimeout(() => process.exit(1), 500);
});

// Catch any un-handled async rejection (missing try/catch in async routes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('====== WARNING: Unhandled Promise Rejection ======');
  console.error('Promise:', promise, '\nReason:', reason);
  // Do NOT exit here — non-fatal, but must be logged
});

const PORT = process.env.PORT || 3000;

// Connect to Database Core & Handshake WhatsApp QR singleton client
dbService.connect();
whatsappService.initialize();

app.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(`  PERFECT BANDHAN BACKEND RUNNING ON PORT: ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Host Bind: http://0.0.0.0:${PORT}`);
  console.log('==================================================');
});
