import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/controllers/auth.controller.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add require for generatePbId at the top
if "const generateUniquePbId" not in content:
    content = content.replace("const User = require('../models/user.model');", "const User = require('../models/user.model');\nconst generateUniquePbId = require('../utils/generatePbId');")

old_code = """      user = new User({
        phone,
        password: hashedPassword,
        profileFor: 'Self',"""

new_code = """      user = new User({
        phone,
        pbId: await generateUniquePbId(),
        password: hashedPassword,
        profileFor: 'Self',"""

content = content.replace(old_code, new_code)

with open(file_path, 'w') as f:
    f.write(content)
print("auth.controller.js patched successfully for auto pbId generation.")
