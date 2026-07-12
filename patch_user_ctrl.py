import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/controllers/user.controller.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add require for generatePbId at the top
if "const generateUniquePbId" not in content:
    content = content.replace("const User = require('../models/user.model');", "const User = require('../models/user.model');\nconst generateUniquePbId = require('../utils/generatePbId');")

old_code = """      user = new User(profileData);
      await user.save();
    }

    console.log(`[MongoDB Write] Successfully stored/updated user profile for +91 ${profileData.phone} in MongoDB Atlas.`);"""

new_code = """      profileData.pbId = await generateUniquePbId();
      user = new User(profileData);
      await user.save();
    }

    console.log(`[MongoDB Write] Successfully stored/updated user profile for +91 ${profileData.phone} in MongoDB Atlas.`);"""

content = content.replace(old_code, new_code)

with open(file_path, 'w') as f:
    f.write(content)
print("user.controller.js patched successfully for auto pbId generation.")
