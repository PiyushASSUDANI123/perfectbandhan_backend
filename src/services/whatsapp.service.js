const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { execSync } = require('child_process');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this._initRetryTimer = null;
    this._retryDelay = 15000;    // start at 15s
    this._maxRetryDelay = 300000; // cap at 5 mins
  }

  initialize() {
    // Clear any pending retry timer
    if (this._initRetryTimer) {
      clearTimeout(this._initRetryTimer);
      this._initRetryTimer = null;
    }

    console.log('[WhatsApp Service] Initializing WhatsApp Client...');
    try {
      // Aggressive Zombie Chrome Cleanup
      try {
        console.log('[WhatsApp Service] Cleaning up zombie chromium processes...');
        execSync('pkill -f "chromium|puppeteer"', { stdio: 'ignore' });
      } catch (e) {
        // Ignore if no processes found
      }

      // Destroy previous client if exists
      if (this.client) {
        try { this.client.destroy(); } catch (_) {}
        this.client = null;
        this.isReady = false;
      }

      this.client = new Client({
        authTimeoutMs: 60000,
        authStrategy: new LocalAuth({
          clientId: 'perfect-bandhan-core',
          dataPath: path.join(__dirname, '../../.wwebjs_auth')
        }),
        puppeteer: {
          protocolTimeout: 120000,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',     // prevents shared memory crashes on Linux
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',            // helps in low-memory server environments
            '--disable-gpu'
          ]
        },
        webVersionCache: {
          type: 'none'
        }
      });

      this.client.on('qr', (qr) => {
        console.log('[WhatsApp Service] Scan this QR code to authenticate:');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        console.log('[WhatsApp Service] ✅ Client is authenticated and ready!');
        this.isReady = true;
        this._retryDelay = 15000; // reset backoff on success
      });

      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp Service] ❌ Authentication failure:', msg);
        this.isReady = false;
        this._scheduleReinit();
      });

      this.client.on('disconnected', (reason) => {
        console.warn('[WhatsApp Service] ⚠️  Client disconnected:', reason, '— will reinitialize...');
        this.isReady = false;
        this._scheduleReinit();
      });

      this.client.initialize().catch((err) => {
        console.error('[WhatsApp Service] ❌ Failed to initialize client. Running in Fallback Mode.', err.message);
        this.isReady = false;
        this._scheduleReinit();
      });

    } catch (error) {
      console.error('[WhatsApp Service] ❌ Puppeteer launch error. Running in Fallback Mode.', error.message);
      this._scheduleReinit();
    }
  }

  _scheduleReinit() {
    if (this._initRetryTimer) return; // already scheduled

    console.log(`[WhatsApp Service] 🕐 Retrying WhatsApp init in ${this._retryDelay / 1000}s...`);
    this._initRetryTimer = setTimeout(() => {
      this._initRetryTimer = null;
      this.initialize();
    }, this._retryDelay);

    // Exponential backoff
    this._retryDelay = Math.min(this._retryDelay * 2, this._maxRetryDelay);
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
        console.log(`[WhatsApp Client] ✅ OTP sent successfully to +91 ${phone}`);
        return true;
      } catch (err) {
        console.error(`[WhatsApp Client] ❌ Failed to send to +91 ${phone}:`, err.message);
        // Any crash → mark not ready and reinitialize
        this.isReady = false;
        this._scheduleReinit();
      }
    }

    // Fallback Mock Logger (OTP is in RAM/DB — user must contact admin or retry later)
    console.warn(`[WhatsApp Service Fallback] ⚠️  WhatsApp unavailable. OTP for +91 ${phone}: "${otp}"`);
    return false; // Return false so caller knows it wasn't actually sent
  }

  async sendCustomMessage(phone, message) {
    let targetPhone = phone.trim();
    if (targetPhone.length === 10) {
      targetPhone = `91${targetPhone}`;
    }
    const formattedPhone = `${targetPhone}@c.us`;

    if (this.client && this.isReady) {
      try {
        await this.client.sendMessage(formattedPhone, message);
        console.log(`[WhatsApp Client] ✅ Custom message sent to +91 ${phone}`);
        return true;
      } catch (err) {
        console.error(`[WhatsApp Client] ❌ Failed to send custom message to +91 ${phone}:`, err.message);
        this.isReady = false;
        this._scheduleReinit();
      }
    }

    console.warn(`[WhatsApp Service Fallback] ⚠️  Custom Message to +91 ${phone}: "${message}"`);
    return false;
  }

  /** Quick status check */
  get status() {
    return this.isReady ? 'ready' : 'fallback';
  }
}

module.exports = new WhatsAppService();
