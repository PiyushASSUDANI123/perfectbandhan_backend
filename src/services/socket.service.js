const { Server } = require('socket.io');
const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');

// In-memory Map to track online users: userId -> socket.id
const onlineUsers = new Map();

let io;

exports.init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Adjust for production if necessary
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Phase 2: Socket.io Setup & State Management
    const userId = socket.handshake.query.userId;
    
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.join(`user_${userId}`);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      console.warn(`Connection attempt without userId: ${socket.id}`);
    }

    // Phase 3: Real-Time Messaging Logic
    socket.on('sendMessage', async (payload) => {
      try {
        const { senderId, receiverId, text } = payload;
        
        if (!senderId || !receiverId || !text) {
          throw new Error('Invalid payload');
        }

        // 1. Check or create conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
          conversation = new Conversation({
            participants: [senderId, receiverId],
            lastMessage: text
          });
          await conversation.save();
        } else {
          conversation.lastMessage = text;
          await conversation.save();
        }

        // 2. Create the message
        const newMessage = new Message({
          conversationId: conversation._id,
          senderId,
          receiverId,
          text,
          status: 'sent', // Will change to delivered if receiver is online
          isRead: false
        });

        await newMessage.save();

        // 3. Emit message to receiver if they are online
        const receiverSocketId = onlineUsers.get(receiverId);
        
        if (receiverSocketId) {
          // Direct emission to receiver
          io.to(receiverSocketId).emit('receiveMessage', newMessage);
          
          // Optionally, update status to delivered since it was sent to an active socket
          newMessage.status = 'delivered';
          await newMessage.save();
        }
        
        // Acknowledge back to sender
        socket.emit('messageSent', newMessage);

      } catch (error) {
        console.error('Socket sendMessage Error:', error);
        socket.emit('messageError', { error: 'Failed to send message.' });
      }
    });

    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        console.log(`User disconnected: ${userId}`);
      }
    });
  });
};

exports.getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
