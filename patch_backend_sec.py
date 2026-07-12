import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/controllers/user.controller.js'
with open(file_path, 'r') as f:
    content = f.read()

old_code = """      if (missingFields.length > 0) {
        console.warn(`[User Controller] Validation warnings (ignored to allow user in). Missing fields: ${missingFields.join(', ')}`);
      }

      if (!Array.isArray(profileData.uploadedPhotos) || profileData.uploadedPhotos.length === 0 || !profileData.uploadedPhotos[0]) {
        console.warn('[User Controller] No photos uploaded. Allowing user in anyway.');
      }"""

new_code = """      if (missingFields.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Validation failed. Missing required fields: ${missingFields.join(', ')}`
        });
      }

      if (!Array.isArray(profileData.uploadedPhotos) || profileData.uploadedPhotos.length === 0 || !profileData.uploadedPhotos[0]) {
        return res.status(400).json({ status: 'error', message: 'At least one photo is required.' });
      }"""

content = content.replace(old_code, new_code)

with open(file_path, 'w') as f:
    f.write(content)
print("user.controller.js patched successfully for strict validation.")
