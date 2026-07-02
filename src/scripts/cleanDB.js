require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const User = require('../models/user.model'); 

async function cleanDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // Find 2 female profiles and 2 male profiles (dummy ones)
    const dummyFemales = await User.find({ gender: 'Female', phone: { $ne: '9413879444' } }).limit(2);
    const dummyMales = await User.find({ gender: 'Male', phone: { $ne: '9413879444' } }).limit(2);
    
    let idsToKeep = [];
    dummyFemales.forEach(u => idsToKeep.push(u._id));
    dummyMales.forEach(u => idsToKeep.push(u._id));

    console.log(`Found ${dummyFemales.length} female and ${dummyMales.length} male dummy accounts to keep.`);

    // Handle developer account
    const devPhone = '9413879444';
    let devAccount = await User.findOne({ phone: devPhone });
    
    if (devAccount) {
      console.log('Developer account found. Wiping its data completely and keeping a blank shell.');
      idsToKeep.push(devAccount._id);
      
      const db = mongoose.connection.db;
      await db.collection('users').updateOne(
        { _id: devAccount._id },
        { 
          $unset: {
            firstName: "", lastName: "", bio: "", gender: "", dob: "", maritalStatus: "", caste: "", nukh: "",
            city: "", state: "", district: "", location: "", height: "", weight: "", complexion: "", physicalDisability: "",
            education: "", occupation: "", income: "", familyType: "", fathersName: "", mothersName: "",
            fathersOccupation: "", mothersOccupation: "", siblings: "", housePhoto: "", uploadedPhotos: "",
            fcmToken: "", password: "", profileViews: ""
          },
          $set: { isAdmin: true, isProfileComplete: false }
        }
      );
      console.log('Developer account reset successfully via native driver.');
    } else {
      console.log('Developer account not found, skipping creation as it requires validation.');
    }

    console.log(`Deleting all other users... (${idsToKeep.length} users protected)`);
    const result = await User.deleteMany({ _id: { $nin: idsToKeep } });
    console.log(`Deleted ${result.deletedCount} users.`);

    try {
      const db = mongoose.connection.db;
      await db.collection('interests').deleteMany({
        $or: [
          { sender: { $nin: idsToKeep } },
          { receiver: { $nin: idsToKeep } }
        ]
      });
      console.log('Cleaned up orphaned interests.');
      
      await db.collection('messages').deleteMany({
        $or: [
          { sender: { $nin: idsToKeep } },
          { receiver: { $nin: idsToKeep } }
        ]
      });
      console.log('Cleaned up orphaned messages.');
      
      await db.collection('notifications').deleteMany({
        user: { $nin: idsToKeep }
      });
      console.log('Cleaned up orphaned notifications.');
    } catch (e) {
      console.log('Could not clean up some orphaned collections.', e.message);
    }

    console.log('Database cleanup completed successfully.');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    mongoose.connection.close();
  }
}

cleanDatabase();
