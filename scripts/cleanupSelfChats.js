const mongoose = require('mongoose');
const Chat = require('../models/Chat');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function cleanupSelfChats() {
  try {
    console.log('Starting cleanup of self-chats...');
    
    // Find chats where both participants have the same user ID
    const selfChats = await Chat.find({
      $expr: {
        $eq: [
          { $arrayElemAt: ['$participants.user', 0] },
          { $arrayElemAt: ['$participants.user', 1] }
        ]
      }
    });
    
    console.log(`Found ${selfChats.length} self-chats to delete`);
    
    if (selfChats.length > 0) {
      // Delete self-chats
      const result = await Chat.deleteMany({
        _id: { $in: selfChats.map(chat => chat._id) }
      });
      
      console.log(`Deleted ${result.deletedCount} self-chats`);
    }
    
    // Also find and delete chats with duplicate participants
    const duplicateChats = await Chat.aggregate([
      {
        $match: {
          chatType: 'direct',
          'participants.1': { $exists: true }
        }
      },
      {
        $addFields: {
          participantIds: '$participants.user'
        }
      },
      {
        $match: {
          $expr: {
            $eq: [
              { $arrayElemAt: ['$participantIds', 0] },
              { $arrayElemAt: ['$participantIds', 1] }
            ]
          }
        }
      }
    ]);
    
    console.log(`Found ${duplicateChats.length} duplicate participant chats to delete`);
    
    if (duplicateChats.length > 0) {
      const duplicateIds = duplicateChats.map(chat => chat._id);
      const deleteResult = await Chat.deleteMany({
        _id: { $in: duplicateIds }
      });
      
      console.log(`Deleted ${deleteResult.deletedCount} duplicate participant chats`);
    }
    
    console.log('Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    mongoose.connection.close();
  }
}

cleanupSelfChats();
