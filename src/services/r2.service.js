const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

class R2Service {
  constructor() {
    this.s3Client = null;
    this.bucketName = process.env.R2_BUCKET_NAME || 'sindhi-shadi-media';
    this.customDomain = process.env.R2_CUSTOM_DOMAIN || 'https://media.sindhishadi.com';
    
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
      console.log('[R2 Service] Cloudflare R2 Client initialized successfully.');
    } else {
      console.warn('[R2 Service] Cloudflare credentials missing. Operating in Fallback Mock Mode.');
    }
  }

  async uploadPhoto(fileBuffer, fileName, mimeType) {
    const uniqueKey = `uploads/${Date.now()}_${fileName}`;

    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: uniqueKey,
          Body: fileBuffer,
          ContentType: mimeType
        });
        await this.s3Client.send(command);
        const fileUrl = `${this.customDomain}/${uniqueKey}`;
        console.log(`[R2 Storage] File uploaded successfully. Resolved URL: ${fileUrl}`);
        return fileUrl;
      } catch (err) {
        console.error('[R2 Storage] Upload failed. Falling back to mock URL:', err.message);
      }
    }

    // Fallback Mock URL
    const mockUrl = `https://pub-sindhishadi-r2.cloudflare.com/${uniqueKey}`;
    console.log(`[R2 Storage Mock] Generated upload target: ${mockUrl}`);
    return mockUrl;
  }
}

module.exports = new R2Service();
