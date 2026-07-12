const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
app.set('trust proxy', 1); // Fixes express-rate-limit error behind Nginx/Proxy

// ─── Global 10-Second Request Timeout Middleware ──────────────────────────────
// If any route takes more than 10s, send 504 to prevent resource exhaustion
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        status: 'error',
        message: 'Gateway Timeout: Request took longer than 30 seconds.'
      });
    }
  }, 30000);
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
  validate: { xForwardedForHeader: false, trustProxy: false, default: false },
  message: {
    status: 'error',
    message: 'Too many OTP requests from this IP. Please wait 1 minute before trying again.'
  }
});

// ─── Global Rate Limiter ───────────────────────────────────────────────────────
// Limits all generic requests to 500 per IP per 10 minutes to prevent DDoS
const globalRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500,                 // 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false, default: false },
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again after 10 minutes.'
  }
});

// Standard Apple-minimal server middleware
app.use(helmet()); // Secure HTTP headers
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', globalRateLimiter); // Apply global limit to API routes

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

// Public Profile Web Share Route
app.get('/p/:pbId', async (req, res) => {
  try {
    const User = require('./models/user.model');
    const { pbId } = req.params;
    const user = await User.findOne({ pbId });

    if (!user) {
      return res.status(404).send('<h1>Profile Not Found</h1><p>The profile you are looking for does not exist or the link is invalid.</p>');
    }

    // Server-Side Rendering (SSR) HTML for WhatsApp/Social Media OpenGraph previews
    const photoUrl = (user.uploadedPhotos && user.uploadedPhotos.length > 0) ? user.uploadedPhotos[0] : 'https://perfectbandhan.com/default_avatar.png';
    const fullName = `${user.firstName} ${user.lastName}`;
    const location = `${user.city}, ${user.state}`;
    const details = `${user.age || 25} yrs • ${user.height} • ${user.profession} • ${location}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fullName} - Perfect Bandhan Profile</title>
  
  <!-- OpenGraph Meta Tags for WhatsApp/Instagram Previews -->
  <meta property="og:title" content="${fullName} on Perfect Bandhan" />
  <meta property="og:description" content="${details}. Tap to view full profile!" />
  <meta property="og:image" content="${photoUrl}" />
  <meta property="og:url" content="https://humsafar.piyushassudani.in/p/${pbId}" />
  <meta property="og:type" content="profile" />
  
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .card { background: white; max-width: 400px; width: 100%; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); padding-bottom: 20px; }
    .photo { width: 100%; height: 400px; object-fit: cover; }
    .info { padding: 20px; text-align: center; }
    h1 { margin: 0 0 10px 0; font-size: 24px; color: #333; }
    p { margin: 5px 0; color: #666; font-size: 16px; }
    .pb-id { display: inline-block; background: #FFD700; color: #000; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin-top: 10px; font-size: 14px; }
    .cta { display: block; background: #C89933; color: white; text-align: center; padding: 15px; margin: 20px; border-radius: 12px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${photoUrl}" class="photo" alt="${fullName}">
    <div class="info">
      <h1>${fullName}</h1>
      <p>${details}</p>
      <div class="pb-id">ID: ${pbId}</div>
    </div>
    <a href="https://play.google.com/store/apps/details?id=com.perfectbandhan.app" class="cta">Download App to Connect</a>
  </div>
</body>
</html>
    `;
    res.send(html);
  } catch (error) {
    console.error('[Web Share Route Error]:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint prefixes mapping
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);

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
