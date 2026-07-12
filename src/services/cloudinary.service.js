const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');

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

    let uploadString = base64Str;
    try {
      // Compress the image before uploading if it is a valid base64 string
      const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const imageBuffer = Buffer.from(matches[2], 'base64');
        const compressedBuffer = await sharp(imageBuffer)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
          
        uploadString = `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
      }

      // Cloudinary uploader supports direct base64 data URI string uploads
      const uploadResponse = await cloudinary.uploader.upload(uploadString, {
        folder: 'sindhi_shadi/profiles',
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      });
      return uploadResponse.secure_url;
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err);
      // Instead of throwing and failing the profile submission, we return the base64 string
      // so it gets saved to MongoDB directly as a fallback.
      if (typeof uploadString === 'string' && uploadString.startsWith('data:image/')) {
        console.warn('[Cloudinary Service] Falling back to storing Base64 in MongoDB.');
        return uploadString;
      }
      throw new Error('Failed to upload image to Cloudinary: ' + (err.message || JSON.stringify(err) || err));
    }
  }
}

module.exports = new CloudinaryService();
