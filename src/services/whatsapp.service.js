class WhatsAppService {
  constructor() {
    this.isReady = false;
  }

  initialize() {
    console.log('[WhatsApp Service] ⚠️  WhatsApp disabled — running in LOG-ONLY mode.');
  }

  async sendOtp(phone, otp) {
    // WhatsApp disabled — print OTP to terminal for manual sharing
    console.log('=======================================================');
    console.log(`[OTP LOG] +91 ${phone}  →  OTP: ${otp}`);
    console.log('=======================================================');
    return true; // Return true so auth flow completes normally
  }

  async sendCustomMessage(phone, message) {
    console.log(`[MSG LOG] +91 ${phone}: "${message}"`);
    return true;
  }

  get status() {
    return 'log-only';
  }
}

module.exports = new WhatsAppService();
