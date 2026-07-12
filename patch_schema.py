import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/models/user.model.js'
with open(file_path, 'r') as f:
    content = f.read()

new_field = """  pbId: {
    type: String,
    unique: true,
    index: true,
    default: ''
  },
  password: {"""

content = content.replace("  password: {", new_field)

with open(file_path, 'w') as f:
    f.write(content)
print("user.model.js patched successfully for pbId.")
