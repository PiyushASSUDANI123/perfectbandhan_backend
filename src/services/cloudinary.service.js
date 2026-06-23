const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment configurations
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
  constructor() {
    this.isReady = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
    if (this.isReady) {
      console.log('[Cloudinary Service] Cloudinary SDK configured successfully.');
    } else {
      console.warn('[Cloudinary Service] Cloudinary credentials missing from environment.');
    }
  }

  async uploadImage(base64Str) {
    if (!this.isReady) {
      console.warn('[Cloudinary Service] Service not configured. Returning simulated mock photo URL.');
      return `https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg`;
    }

    try {
      // Cloudinary uploader supports direct base64 data URI string uploads
      const uploadResponse = await cloudinary.uploader.upload(base64Str, {
        folder: 'sindhi_shadi/profiles',
        resource_type: 'image'
      });
      return uploadResponse.secure_url;
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err.message);
      throw new Error('Failed to upload image to Cloudinary: ' + err.message);
    }
  }
}

module.exports = new CloudinaryService();
