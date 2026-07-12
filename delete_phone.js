require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model.js');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await User.deleteOne({ phone: '9509143877' });
    console.log("Deleted count: " + result.deletedCount);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
