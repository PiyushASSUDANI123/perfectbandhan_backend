require('dotenv').config();
const app = require('./app');
const dbService = require('./services/db.service');
const whatsappService = require('./services/whatsapp.service');

const PORT = process.env.PORT || 3000;

// Connect to Database Core & Handshake WhatsApp QR singleton client
dbService.connect();
whatsappService.initialize();

app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`  SINDHI SHADI BACKEND RUNNING ON PORT: ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log('==================================================');
});
