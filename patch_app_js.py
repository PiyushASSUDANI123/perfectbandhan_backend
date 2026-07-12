import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/app.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add public share route
if "app.get('/p/:pbId'" not in content:
    old_code = """// Endpoint prefixes mapping
app.use('/api/v1/auth', authRoutes);"""

    new_code = """// Public Profile Web Share Route
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
app.use('/api/v1/auth', authRoutes);"""
    
    content = content.replace(old_code, new_code)
    
    with open(file_path, 'w') as f:
        f.write(content)
    print("app.js patched successfully with /p/:pbId SSR route.")
