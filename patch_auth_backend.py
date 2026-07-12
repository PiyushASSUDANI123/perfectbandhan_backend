import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/controllers/auth.controller.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Import bcryptjs at the top
if 'const bcrypt = require(\'bcryptjs\');' not in content:
    content = content.replace("const jwt = require('jsonwebtoken');", "const jwt = require('jsonwebtoken');\nconst bcrypt = require('bcryptjs');")

# 2. Fix loginWithPassword to remove backdoor and add bcrypt support
login_old = """    const adminPhone = process.env.ADMIN_PHONE || '12347890';
    const adminPassword = process.env.ADMIN_PASSWORD || 'piyushassudani@96';

    const config = await AppConfig.findOne();
    const bypassPassword = config?.developerBypassPassword || '300609';

    if (phone === adminPhone && password === adminPassword) {
      console.log(`[Auth] Admin login successful for +91 ${phone}`);
      const token = jwt.sign({ phone, isAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({
        status: 'success',
        message: 'Admin login successful',
        token,
        isAdmin: true,
        isProfileComplete: true
      });
    }

    if (phone === '9413879444' && password === bypassPassword) {
      const token = jwt.sign({ phone, isAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
        isAdmin: true,
        isProfileComplete: true
      });
    }

    // Support password login for any registered profile with custom password (or dynamic bypass password)
    const userProfile = await userController.getProfile(phone);
    if (userProfile) {
      const dbPassword = userProfile.password || '';
      if (dbPassword && password === dbPassword) {"""

login_new = """    const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminPhone && adminPassword && phone === adminPhone) {
      // Direct comparison if no hash provided in ENV, but recommended to put hash in ENV
      if (password === adminPassword) {
        console.log(`[Auth] Admin login successful for +91 ${phone}`);
        const token = jwt.sign({ phone, isAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
        return res.status(200).json({
          status: 'success',
          message: 'Admin login successful',
          token,
          isAdmin: true,
          isProfileComplete: true
        });
      }
    }

    // Support password login for any registered profile
    const userProfile = await userController.getProfile(phone);
    if (userProfile) {
      const dbPassword = userProfile.password || '';
      if (dbPassword) {
        let isMatch = false;
        // Check if it is a bcrypt hash
        if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(password, dbPassword);
        } else {
          // Legacy plaintext fallback
          isMatch = (password === dbPassword);
          if (isMatch) {
            // Auto-upgrade to secure hash silently
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await User.updateOne({ phone }, { $set: { password: hashedPassword } });
          }
        }

        if (isMatch) {"""

content = content.replace(login_old, login_new)

# 3. Fix setPassword to hash password before saving
setpass_old = """    const User = require('../models/user.model');
    let user = await User.findOne({ phone });
    if (!user) {
      // Create a skeleton user so password is set
      user = new User({
        phone,
        password,
        profileFor: 'Self',"""

setpass_new = """    const User = require('../models/user.model');
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let user = await User.findOne({ phone });
    if (!user) {
      // Create a skeleton user so password is set
      user = new User({
        phone,
        password: hashedPassword,
        profileFor: 'Self',"""

content = content.replace(setpass_old, setpass_new)

setpass_update_old = """    } else {
      await User.updateOne({ phone }, { $set: { password } });
    }"""
setpass_update_new = """    } else {
      await User.updateOne({ phone }, { $set: { password: hashedPassword } });
    }"""
content = content.replace(setpass_update_old, setpass_update_new)


with open(file_path, 'w') as f:
    f.write(content)
print("auth.controller.js patched.")
