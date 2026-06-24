const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// ─── Global 10-Second Request Timeout Middleware ──────────────────────────────
// If any route takes more than 10s, send 504 to prevent resource exhaustion
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        status: 'error',
        message: 'Gateway Timeout: Request took longer than 10 seconds.'
      });
    }
  }, 10000);
  // Clear the timer when response finishes
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  next();
});

// ─── OTP Rate Limiter: Anti-Spam Shield ───────────────────────────────────────
// Strictly limits OTP send requests to 5 per IP per minute
const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // max 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many OTP requests from this IP. Please wait 1 minute before trying again.'
  }
});

// Standard Apple-minimal server middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root simple health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Perfect Bandhan Premium API Server is fully operational.'
  });
});

// Privacy Policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/privacy.html'));
});

// Endpoint prefixes mapping
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);

// Catch JSON parsing/limit errors gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ status: 'error', message: 'Invalid JSON payload format.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'Payload size limit exceeded. Please upload smaller images.' });
  }
  return res.status(500).json({ status: 'error', message: err.message || 'Internal server error.' });
});

// Catch-all route not found handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'API route not found.'
  });
});

module.exports = app;
