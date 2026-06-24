const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  initialize() {
    console.log('[WhatsApp Service] Initializing WhatsApp Client...');
    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.join(__dirname, '../../.wwebjs_auth')
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
      });

      this.client.on('qr', (qr) => {
        console.log('[WhatsApp Service] Scan this QR code to authenticate:');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        console.log('[WhatsApp Service] Client is authenticated and ready!');
        this.isReady = true;
      });

      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp Service] Authentication failure:', msg);
      });

      this.client.on('disconnected', (reason) => {
        console.warn('[WhatsApp Service] Client was logged out:', reason);
        this.isReady = false;
      });

      this.client.initialize().catch((err) => {
        console.error('[WhatsApp Service] Failed to initialize client. Running in Fallback Mode.', err.message);
      });
    } catch (error) {
      console.error('[WhatsApp Service] Puppeteer launch error. Running in Fallback Mode.', error.message);
    }
  }

  async sendOtp(phone, otp) {
    let targetPhone = phone.trim();
    if (targetPhone.length === 10) {
      targetPhone = `91${targetPhone}`;
    }
    const formattedPhone = `${targetPhone}@c.us`;
    const message = `Jai Jhulelal! Your verification OTP code for Perfect Bandhan is: ${otp}. Valid for 5 minutes.`;

    if (this.client && this.isReady) {
      try {
        await this.client.sendMessage(formattedPhone, message);
        console.log(`[WhatsApp Client] Message sent successfully to +91 ${phone}`);
        return true;
      } catch (err) {
        console.error(`[WhatsApp Client] Failed to send to +91 ${phone}:`, err.message);
      }
    }
    
    // Fallback Mock Logger
    console.log(`[WhatsApp Service Fallback] Message to +91 ${phone}: "${message}"`);
    return true;
  }
}

module.exports = new WhatsAppService();
