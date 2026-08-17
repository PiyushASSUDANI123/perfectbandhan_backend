const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });
const User = require('../src/models/user.model');

async function generateUniquePbId() {
  let isUnique = false;
  let pbId = '';
  while (!isUnique) {
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    pbId = `PB-${randomStr}`;
    const existing = await User.findOne({ pbId });
    if (!existing) isUnique = true;
  }
  return pbId;
}

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB. Migrating pbIds...');
    
    const users = await User.find({ $or: [{ pbId: { $exists: false } }, { pbId: '' }] });
    console.log(`Found ${users.length} users missing pbId.`);
    
    let count = 0;
    for (const user of users) {
      user.pbId = await generateUniquePbId();
      await user.save();
      count++;
      if (count % 10 === 0) console.log(`Migrated ${count} users...`);
    }
    
    console.log(`Migration complete! Successfully assigned pbId to ${count} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
