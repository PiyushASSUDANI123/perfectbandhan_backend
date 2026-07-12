import re

file_path = '/Users/piyush/Documents/perfectbandhan/shadi_backend/src/services/socket.service.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix sendMessage payload to include localId
old_send = """        // Acknowledge back to sender
        socket.emit('messageSent', newMessage);"""

new_send = """        // Acknowledge back to sender
        socket.emit('messageSent', { ...newMessage.toJSON(), localId: payload.id });"""

content = content.replace(old_send, new_send)

with open(file_path, 'w') as f:
    f.write(content)
print("socket.service.js patched.")
