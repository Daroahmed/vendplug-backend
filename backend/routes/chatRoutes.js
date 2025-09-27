const express = require('express');
const router = express.Router();
const {
  createOrGetChat,
  getUserChats,
  getChat,
  getChatMessages,
  markChatAsRead,
  getChatParticipants,
  archiveChat,
  unarchiveChat,
  getUnreadCount
} = require('../controllers/chatController');
const {
  sendMessage,
  markMessageAsRead,
  addReaction,
  removeReaction,
  deleteMessage,
  searchMessages,
  upload
} = require('../controllers/messageController');
const { protectAnyUser } = require('../middleware/authMiddleware');

// Chat routes
router.post('/', protectAnyUser, createOrGetChat);
router.get('/', protectAnyUser, getUserChats);
router.get('/unread-count', protectAnyUser, getUnreadCount);
router.get('/:chatId', protectAnyUser, getChat);
router.put('/:chatId/read', protectAnyUser, markChatAsRead);
router.get('/:chatId/participants', protectAnyUser, getChatParticipants);
router.put('/:chatId/archive', protectAnyUser, archiveChat);
router.put('/:chatId/unarchive', protectAnyUser, unarchiveChat);

// Message routes
router.post('/:chatId/messages', protectAnyUser, upload.array('attachments', 5), sendMessage);
router.get('/:chatId/messages', protectAnyUser, getChatMessages);
router.get('/:chatId/messages/search', protectAnyUser, searchMessages);
router.put('/messages/:messageId/read', protectAnyUser, markMessageAsRead);
router.post('/messages/:messageId/reactions', protectAnyUser, addReaction);
router.delete('/messages/:messageId/reactions', protectAnyUser, removeReaction);
router.delete('/messages/:messageId', protectAnyUser, deleteMessage);

module.exports = router;
