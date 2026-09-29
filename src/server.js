require('dotenv').config();
const app = require('./app');
const http = require('http');
const dbService = require('./services/db.service');
const whatsappService = require('./services/whatsapp.service');
const socketService = require('./services/socket.service');

// ─── Global Fail-safes ────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('====== FATAL: Uncaught Exception ======');
  console.error(err);
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('====== WARNING: Unhandled Promise Rejection ======');
  console.error('Promise:', promise, '\nReason:', reason);
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to Database
    await dbService.connect();
    
    // Initialize WhatsApp
    whatsappService.initialize();
    
    // Start cron jobs
    const cronService = require('./services/cron.service');
    cronService.start();
    
    // Create HTTP server
    const httpServer = http.createServer(app);
    
    // Initialize Socket.io with Redis adapter
    await socketService.init(httpServer);
    
    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] ${signal} received, shutting down gracefully...`);
      
      // Stop accepting new connections
      httpServer.close(async () => {
        console.log('[Server] HTTP server closed');
        
        // Close DB connection
        await require('mongoose').connection.close();
        console.log('[Server] MongoDB connection closed');
        
        // Close Redis
        await redisService.close();
        console.log('[Server] Redis connection closed');
        
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Health check endpoint
    app.get('/health', async (req, res) => {
      const dbReady = dbService.ready;
      const redisReady = await redisService.healthCheck();
      
      res.status(dbReady && redisReady ? 200 : 503).json({
        status: dbReady && redisReady ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: dbReady ? 'connected' : 'disconnected',
          redis: redisReady ? 'connected' : 'disconnected',
          circuitBreaker: dbService._circuitBreaker?.state || 'unknown'
        },
        pool: dbService.getPoolStats()
      });
    });
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('==================================================');
      console.log(`  PERFECT BANDHAN BACKEND RUNNING ON PORT: ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Host Bind: http://0.0.0.0:${PORT}`);
      console.log('==================================================');
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

startServer();
