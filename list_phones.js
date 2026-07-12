require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model.js');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'phone firstName');
    console.log("Found " + users.length + " users in DB.");
    users.forEach(u => {
      console.log(`Phone: ${u.phone} | Name: ${u.firstName || 'No Name'} | Registered: ${u.firstName ? 'Yes' : 'No'}`);
    });
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
