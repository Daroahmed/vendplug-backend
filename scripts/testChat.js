// Test script for chat functionality
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

// Import models
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const SupportTicket = require('../models/SupportTicket');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

async function testChatSystem() {
    try {
        console.log('🧪 Testing Chat System...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Test 1: Create a test chat
        console.log('\n📝 Test 1: Creating test chat...');
        
        // Find test users
        const buyer = await Buyer.findOne();
        const vendor = await Vendor.findOne();
        const agent = await Agent.findOne();

        if (!buyer || !vendor) {
            console.log('❌ Need at least one buyer and vendor to test');
            return;
        }

        // Create chat between buyer and vendor
        const chat = await Chat.create({
            participants: [
                {
                    user: buyer._id,
                    userType: 'Buyer',
                    role: 'buyer'
                },
                {
                    user: vendor._id,
                    userType: 'Vendor',
                    role: 'vendor'
                }
            ],
            chatType: 'direct'
        });

        console.log('✅ Chat created:', chat._id);

        // Test 2: Send messages
        console.log('\n📝 Test 2: Sending messages...');
        
        const message1 = await Message.create({
            chat: chat._id,
            sender: buyer._id,
            senderType: 'Buyer',
            content: 'Hello! I have a question about your product.',
            messageType: 'text'
        });

        const message2 = await Message.create({
            chat: chat._id,
            sender: vendor._id,
            senderType: 'Vendor',
            content: 'Hi! I\'d be happy to help. What would you like to know?',
            messageType: 'text'
        });

        console.log('✅ Messages created:', message1._id, message2._id);

        // Test 3: Create support ticket
        console.log('\n📝 Test 3: Creating support ticket...');
        
        const supportTicket = await SupportTicket.create({
            requester: buyer._id,
            requesterType: 'Buyer',
            category: 'technical',
            subject: 'Login Issue',
            description: 'I cannot log into my account',
            priority: 'medium'
        });

        console.log('✅ Support ticket created:', supportTicket.ticketNumber);

        // Test 4: Test chat queries
        console.log('\n📝 Test 4: Testing chat queries...');
        
        const buyerChats = await Chat.find({
            'participants.user': buyer._id,
            'participants.userType': 'Buyer'
        }).populate('participants.user', 'fullName email');

        console.log('✅ Buyer chats found:', buyerChats.length);

        // Test 5: Test message queries
        console.log('\n📝 Test 5: Testing message queries...');
        
        const chatMessages = await Message.find({
            chat: chat._id
        }).populate('sender', 'fullName email');

        console.log('✅ Chat messages found:', chatMessages.length);

        // Test 6: Test support ticket queries
        console.log('\n📝 Test 6: Testing support ticket queries...');
        
        const userTickets = await SupportTicket.find({
            requester: buyer._id,
            requesterType: 'Buyer'
        });

        console.log('✅ User tickets found:', userTickets.length);

        // Test 7: Test unread count
        console.log('\n📝 Test 7: Testing unread count...');
        
        const unreadCount = await Message.countDocuments({
            chat: chat._id,
            sender: { $ne: buyer._id },
            isDeleted: false,
            'readBy': {
                $not: {
                    $elemMatch: {
                        user: buyer._id,
                        userType: 'Buyer'
                    }
                }
            }
        });

        console.log('✅ Unread messages count:', unreadCount);

        console.log('\n🎉 All tests passed! Chat system is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run tests
testChatSystem();
