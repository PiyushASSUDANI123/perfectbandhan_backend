const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// Standard Apple-minimal server middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root simple health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Humsafar Premium API Server is fully operational.'
  });
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
