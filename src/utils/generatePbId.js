const User = require('../models/user.model');
const crypto = require('crypto');

async function generateUniquePbId() {
  let isUnique = false;
  let pbId = '';
  
  while (!isUnique) {
    // Generate 6 random alphanumeric chars (uppercase)
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    pbId = `PB-${randomStr}`;
    
    // Check collision
    const existing = await User.findOne({ pbId });
    if (!existing) {
      isUnique = true;
    }
  }
  return pbId;
}

module.exports = generateUniquePbId;
