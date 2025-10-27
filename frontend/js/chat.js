// Chat functionality
class ChatManager {
    constructor() {
        this.socket = null;
        this.currentChatId = null;
        this.currentUser = null;
        this.chats = [];
        this.participants = [];
        this.typingTimeout = null;
        this.isAutoStarting = false;
        
        this.init();
    }

    async init() {
        // Debug localStorage contents
        console.log('🔍 Debugging localStorage:');
        console.log('vendplugUser:', localStorage.getItem('vendplugUser'));
        console.log('vendplugBuyer:', localStorage.getItem('vendplugBuyer'));
        console.log('vendplugVendor:', localStorage.getItem('vendplugVendor'));
        console.log('vendplugAgent:', localStorage.getItem('vendplugAgent'));
        console.log('vendplug-buyer-token:', localStorage.getItem('vendplug-buyer-token'));
        console.log('vendplug-vendor-token:', localStorage.getItem('vendplug-vendor-token'));
        console.log('vendplug-agent-token:', localStorage.getItem('vendplug-agent-token'));
        
        // Get current user using smart auth utility
        const currentUser = getCurrentUser();
        const userRole = getCurrentUserType();
        const userToken = getAuthToken();
        
        this.currentUser = currentUser;
        
        // Add token to currentUser
        if (this.currentUser) {
            this.currentUser.token = userToken;
        }
        
        console.log('Current user identified as:', this.currentUser);
        console.log('User ID:', this.currentUser._id || this.currentUser.id);
        console.log('User role:', this.currentUser.role);
        
        if (!this.currentUser) {
            console.log('No user found in localStorage, redirecting to login');
            window.location.href = 'buyer-auth.html';
            return;
        }

        // Initialize socket connection
        this.initSocket();
        
        // Load user chats
        await this.loadChats();
        
        // Mark messages as read when chat is opened
        this.markMessagesAsRead();
        
        // Setup event listeners
        this.setupEventListeners();

        // Check for URL parameters to auto-start a chat
        this.handleUrlParameters();
    }

    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        const vendorId = urlParams.get('vendor');
        const agentId = urlParams.get('agent');
        const name = urlParams.get('name');

        // If we have direct chat parameters, auto-start the chat
        if (type === 'direct' && (vendorId || agentId) && name) {
            console.log('Auto-starting direct chat with:', { type, vendorId, agentId, name });
            this.isAutoStarting = true;
            
            // Determine recipient type and ID
            const recipientType = vendorId ? 'Vendor' : 'Agent';
            const recipientId = vendorId || agentId;
            
            // Auto-start the chat
            this.startDirectChat(recipientType, recipientId, decodeURIComponent(name));
        }
    }

    async markMessagesAsRead() {
        try {
            // Mark all messages as read when chat is opened
            if (window.messageNotificationManager) {
                window.messageNotificationManager.markAsRead();
            }
        } catch (error) {
            console.error('❌ Error marking messages as read:', error);
        }
    }

    async startDirectChat(recipientType, recipientId, recipientName) {
        try {
            console.log('Starting direct chat:', { recipientType, recipientId, recipientName });
            
            // Show loading state
            this.showLoading('Starting chat...');
            
            // Get token using smart auth utility
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            console.log('Making API call to create chat with token:', token ? 'present' : 'missing');
            console.log('Request body:', {
                participantId: recipientId,
                participantType: recipientType
            });

            // Create or get existing chat
            const response = await fetch('/api/chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    participantId: recipientId,
                    participantType: recipientType
                })
            });

            console.log('API response status:', response.status);
            console.log('API response ok:', response.ok);
            console.log('API response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error:', errorData);
                throw new Error(`Failed to create/get chat: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const chat = data.data;
            
            console.log('Chat created/retrieved:', chat);
            
            // Add the new chat to our local chats array
            this.chats.unshift(chat);
            this.renderChatList();
            
            // Hide loading state
            this.hideLoading();
            
            // Open the chat
            await this.selectChat(chat._id);
            
            // Hide the start new chat modal if it's open
            const modal = document.getElementById('newChatModal');
            if (modal) {
                modal.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error starting direct chat:', error);
            this.hideLoading();
            this.showError('Failed to start chat. Please try again.');
        }
    }

    initSocket() {
        this.socket = io(window.SOCKET_URL || window.location.origin, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            withCredentials: true
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to chat server');
            this.socket.emit('join_user', { userId: this.currentUser._id || this.currentUser.id });
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from chat server');
        });

        this.socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });

        this.socket.on('message_reaction', (data) => {
            this.handleMessageReaction(data);
        });

        this.socket.on('message_reaction_removed', (data) => {
            this.handleMessageReactionRemoved(data);
        });

        this.socket.on('message_deleted', (data) => {
            this.handleMessageDeleted(data);
        });

        this.socket.on('user_typing', (data) => {
            this.handleTypingIndicator(data);
        });

        this.socket.on('message_read_status', (data) => {
            this.handleMessageReadStatus(data);
        });
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('chatSearch').addEventListener('input', (e) => {
            this.filterChats(e.target.value);
        });

        // Message input
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', (e) => {
            this.handleTyping(e.target.value);
            this.autoResizeTextarea(e.target);
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
    }

    async loadChats() {
        try {
            console.log('Loading chats for user:', this.currentUser);
            console.log('Using token:', this.currentUser.token);
            
            const response = await fetch('/api/chats', {
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                }
            });

            console.log('Chat API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Chat API error response:', errorText);
                throw new Error('Failed to load chats');
            }

            const data = await response.json();
            console.log('Chat API response data:', data);
            this.chats = data.data || [];
            console.log('Processed chats:', this.chats);
            this.renderChatList();
        } catch (error) {
            console.error('Error loading chats:', error);
            this.showError('Failed to load chats');
        }
    }

    renderChatList() {
        const chatList = document.getElementById('chatList');
        
        if (this.chats.length === 0) {
            chatList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>No conversations yet</h3>
                    <p>Start a new chat to begin messaging</p>
                </div>
            `;
            return;
        }

        chatList.innerHTML = this.chats.map(chat => {
            const currentUserId = this.currentUser._id || this.currentUser.id;
            const otherParticipant = chat.participants.find(p => {
                const participantId = p.user._id || p.user.id;
                return participantId.toString() !== currentUserId.toString();
            });
            
            console.log('Chat participants:', chat.participants);
            console.log('Current user ID:', currentUserId);
            console.log('Other participant found:', otherParticipant);
            console.log('Participant user data:', otherParticipant?.user);
            
            const lastMessage = chat.lastMessage;
            const preview = lastMessage ? 
                (lastMessage.content.length > 50 ? 
                    lastMessage.content.substring(0, 50) + '...' : 
                    lastMessage.content) : 
                'No messages yet';

            return `
                <div class="chat-item" onclick="event.preventDefault(); chatManager.selectChat('${chat._id}')" data-chat-id="${chat._id}">
                    <div class="chat-item-header">
                        <div class="chat-participant">${otherParticipant?.user?.fullName || 'Unknown'}</div>
                        <div class="chat-time">${this.formatTime(chat.lastMessageAt)}</div>
                    </div>
                    <div class="chat-preview">${preview}</div>
                    <div class="chat-meta">
                        <div class="chat-status">${this.getChatStatus(chat)}</div>
                        ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async selectChat(chatId) {
        this.currentChatId = chatId;
        
        // Update UI
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-chat-id="${chatId}"]`).classList.add('active');

        // Show messages area
        document.getElementById('chatWelcome').style.display = 'none';
        document.getElementById('chatMessages').style.display = 'block';
        document.getElementById('messageInputContainer').style.display = 'block';

        // Join chat room
        this.socket.emit('join_chat', { chatId, userId: this.currentUser._id || this.currentUser.id });

        // Load messages
        await this.loadMessages(chatId);

        // Mark as read
        await this.markChatAsRead(chatId);
    }

    async loadMessages(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load messages');
            }

            const data = await response.json();
            this.renderMessages(data.data || []);
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showError('Failed to load messages');
        }
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        
        console.log('Rendering messages:', messages);
        console.log('Current user ID:', this.currentUser._id || this.currentUser.id);
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation!</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = messages.map(message => {
            const isSent = message.sender._id === (this.currentUser._id || this.currentUser.id);
            const senderName = message.sender.fullName || 'Unknown';
            const initials = senderName.split(' ').map(n => n[0]).join('').toUpperCase();
            
            console.log('Message sender:', message.sender);
            console.log('Is sent by current user:', isSent);
            
            return `
                <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message._id}">
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <p class="message-text">${this.escapeHtml(message.content)}</p>
                        <div class="message-time">${this.formatTime(message.createdAt)}</div>
                        ${message.reactions && message.reactions.length > 0 ? `
                            <div class="message-reactions">
                                ${message.reactions.map(reaction => `
                                    <span class="reaction" onclick="chatManager.toggleReaction('${message._id}', '${reaction.emoji}')">
                                        ${reaction.emoji} ${reaction.count || 1}
                                    </span>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${message.attachments && message.attachments.length > 0 ? `
                            <div class="message-attachments">
                                ${message.attachments.map(attachment => {
                                    console.log('🔍 Full attachment data:', JSON.stringify(attachment, null, 2));
                                    const isImage = attachment.mimeType && attachment.mimeType.startsWith('image/');
                                    const fileIcon = this.getFileIcon(attachment.mimeType);
                                    
                                    if (isImage) {
                                        let imageUrl = attachment.url || attachment.secure_url || attachment.cloudinaryId;
                                        
                                        // Fallback: construct URL from cloudinaryId if no URL is available
                                        if (!imageUrl && attachment.cloudinaryId) {
                                            imageUrl = `https://res.cloudinary.com/demo/image/upload/v1/${attachment.cloudinaryId}`;
                                            console.log('🔧 Constructed fallback URL from cloudinaryId:', imageUrl);
                                        }
                                        
                                        // Another fallback: construct URL from filename if it looks like a cloudinary ID
                                        if (!imageUrl && attachment.filename) {
                                            imageUrl = `https://res.cloudinary.com/demo/image/upload/v1/${attachment.filename}`;
                                            console.log('🔧 Constructed fallback URL from filename:', imageUrl);
                                        }
                                        
                                        console.log('🖼️ Image URL:', imageUrl);
                                        
                                        if (!imageUrl) {
                                            console.error('❌ No image URL found for attachment:', attachment);
                                            return `
                                                <div class="attachment-image">
                                                    <div class="attachment-error">
                                                        <i class="fas fa-exclamation-triangle"></i>
                                                        <span>Image not available</span>
                                                    </div>
                                                    <div class="attachment-info">
                                                        <span class="attachment-name">${attachment.originalName}</span>
                                                    </div>
                                                </div>
                                            `;
                                        }
                                        
                                        return `
                                            <div class="attachment-image">
                                                <img src="${imageUrl}" alt="${attachment.originalName}" 
                                                     onclick="chatManager.openImageModal('${imageUrl}', '${attachment.originalName}')"
                                                     class="attachment-preview">
                                                <div class="attachment-info">
                                                    <span class="attachment-name">${attachment.originalName}</span>
                                                    <a href="${imageUrl}" target="_blank" class="attachment-download">
                                                        <i class="fas fa-download"></i>
                                                    </a>
                                                </div>
                                            </div>
                                        `;
                                    } else {
                                        const fileUrl = attachment.url || attachment.secure_url || attachment.cloudinaryId;
                                        return `
                                            <a href="${fileUrl || '#'}" target="_blank" class="attachment">
                                                <i class="${fileIcon}"></i>
                                                <span class="attachment-name">${attachment.originalName}</span>
                                                <span class="attachment-size">${this.formatFileSize(attachment.size)}</span>
                                            </a>
                                        `;
                                    }
                                }).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentChatId) return;

        console.log('=== FRONTEND SEND MESSAGE DEBUG ===');
        console.log('Current user:', this.currentUser);
        console.log('User ID:', this.currentUser._id || this.currentUser.id);
        console.log('User role:', this.currentUser.role);
        console.log('Message content:', content);
        console.log('Chat ID:', this.currentChatId);
        console.log('Token being used:', this.currentUser.token);

        try {
            const response = await fetch(`/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentUser.token}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            // Clear input
            messageInput.value = '';
            this.autoResizeTextarea(messageInput);

            // Reload messages to show the new one
            await this.loadMessages(this.currentChatId);
            await this.loadChats(); // Update chat list

        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    handleNewMessage(data) {
        if (data.chatId === this.currentChatId) {
            // Reload messages if it's the current chat
            this.loadMessages(this.currentChatId);
        }
        
        // Update chat list
        this.loadChats();
    }

    handleMessageReaction(data) {
        // Update message reactions in real-time
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            // Reload messages to show updated reactions
            this.loadMessages(this.currentChatId);
        }
    }

    handleMessageReactionRemoved(data) {
        // Update message reactions in real-time
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            // Reload messages to show updated reactions
            this.loadMessages(this.currentChatId);
        }
    }

    handleMessageDeleted(data) {
        if (data.chatId === this.currentChatId) {
            // Reload messages if it's the current chat
            this.loadMessages(this.currentChatId);
        }
    }

    handleTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        const typingText = document.getElementById('typingText');
        
        if (data.isTyping) {
            typingText.textContent = `${data.userName} is typing...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }

    handleMessageReadStatus(data) {
        // Update read status in real-time
        console.log('Message read status updated:', data);
    }

    handleTyping(content) {
        if (!this.currentChatId) return;

        // Send typing start
        this.socket.emit('typing_start', {
            chatId: this.currentChatId,
            userId: this.currentUser._id || this.currentUser.id,
            userName: this.currentUser.fullName
        });

        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Set timeout to stop typing
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('typing_stop', {
                chatId: this.currentChatId,
                userId: this.currentUser._id || this.currentUser.id,
                userName: this.currentUser.fullName
            });
        }, 1000);
    }

    async markChatAsRead(chatId) {
        try {
            await fetch(`/api/chats/${chatId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                }
            });
        } catch (error) {
            console.error('Error marking chat as read:', error);
        }
    }

    async toggleReaction(messageId, emoji) {
        try {
            const response = await fetch(`/api/messages/${messageId}/reactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentUser.token}`
                },
                body: JSON.stringify({ emoji })
            });

            if (!response.ok) {
                throw new Error('Failed to add reaction');
            }

            // Reload messages to show updated reactions
            await this.loadMessages(this.currentChatId);

        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('attachments', file);
        });
        
        // Add required fields for file upload
        formData.append('content', `📎 ${files.length} file(s) uploaded`);
        formData.append('messageType', 'file');

        console.log('📤 Uploading files:', {
            chatId: this.currentChatId,
            fileCount: files.length,
            fileNames: Array.from(files).map(f => f.name),
            token: this.currentUser.token ? 'Present' : 'Missing'
        });

        try {
            const response = await fetch(`/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Upload error response:', errorData);
                throw new Error(`Failed to upload files: ${errorData.message || 'Unknown error'}`);
            }

            // Reload messages
            await this.loadMessages(this.currentChatId);
            await this.loadChats();

        } catch (error) {
            console.error('Error uploading files:', error);
            this.showError('Failed to upload files');
        }
    }

    triggerFileInput() {
        console.log('📎 ChatManager.triggerFileInput called');
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            console.log('✅ File input found, clicking...');
            fileInput.click();
        } else {
            console.log('❌ File input not found');
        }
    }

    getFileIcon(mimeType) {
        if (!mimeType) return 'fas fa-file';
        
        if (mimeType.startsWith('image/')) return 'fas fa-image';
        if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
        if (mimeType.includes('text')) return 'fas fa-file-alt';
        if (mimeType.includes('video')) return 'fas fa-file-video';
        if (mimeType.includes('audio')) return 'fas fa-file-audio';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fas fa-file-archive';
        
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (!bytes) return '';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    openImageModal(imageUrl, imageName) {
        // Create modal for full-size image viewing
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="image-modal-content">
                <div class="image-modal-header">
                    <h3>${imageName}</h3>
                    <button class="image-modal-close" onclick="this.closest('.image-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="image-modal-body">
                    <img src="${imageUrl}" alt="${imageName}" class="image-modal-image">
                </div>
                <div class="image-modal-footer">
                    <a href="${imageUrl}" target="_blank" class="btn btn-primary">
                        <i class="fas fa-external-link-alt"></i> Open in New Tab
                    </a>
                    <a href="${imageUrl}" download="${imageName}" class="btn btn-secondary">
                        <i class="fas fa-download"></i> Download
                    </a>
                </div>
            </div>
        `;
        
        // Add modal styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        // Add CSS for modal content
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .image-modal-content {
                background: white;
                border-radius: 8px;
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                animation: slideIn 0.3s ease;
            }
            @keyframes slideIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .image-modal-header {
                padding: 15px 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .image-modal-header h3 {
                margin: 0;
                font-size: 16px;
                color: #333;
            }
            .image-modal-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #666;
            }
            .image-modal-body {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                overflow: hidden;
            }
            .image-modal-image {
                max-width: 100%;
                max-height: 70vh;
                object-fit: contain;
                border-radius: 4px;
            }
            .image-modal-footer {
                padding: 15px 20px;
                border-top: 1px solid #eee;
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 14px;
            }
            .btn-primary {
                background: #007bff;
                color: white;
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }

    filterChats(query) {
        const chatItems = document.querySelectorAll('.chat-item');
        const searchTerm = query.toLowerCase();

        chatItems.forEach(item => {
            const participantName = item.querySelector('.chat-participant').textContent.toLowerCase();
            const preview = item.querySelector('.chat-preview').textContent.toLowerCase();
            
            if (participantName.includes(searchTerm) || preview.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    getChatStatus(chat) {
        if (chat.unreadCount > 0) {
            return 'Unread';
        }
        return 'Read';
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            return Math.floor(diff / 60000) + 'm ago';
        } else if (diff < 86400000) { // Less than 1 day
            return Math.floor(diff / 3600000) + 'h ago';
        } else {
            return date.toLocaleDateString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        // Simple error display - you can enhance this
        alert(message);
    }

    showLoading(message = 'Loading...') {
        // Create or show loading indicator
        let loadingEl = document.getElementById('loadingIndicator');
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'loadingIndicator';
            loadingEl.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 9999;
                text-align: center;
            `;
            document.body.appendChild(loadingEl);
        }
        loadingEl.innerHTML = `
            <div style="margin-bottom: 10px;">⏳</div>
            <div>${message}</div>
        `;
        loadingEl.style.display = 'block';
    }

    hideLoading() {
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
}

// Make functions globally accessible
window.triggerFileInput = function() {
    console.log('🔗 triggerFileInput called');
    if (window.chatManager) {
        console.log('✅ ChatManager found, calling triggerFileInput');
        window.chatManager.triggerFileInput();
    } else {
        console.log('❌ ChatManager not found');
    }
};

window.sendMessage = function() {
    if (window.chatManager) {
        window.chatManager.sendMessage();
    }
};

// New Chat Modal Functions - REMOVED (no longer needed with auto-direct chat)

// Modal functions removed - using auto-direct chat instead

// createNewChat function removed - using auto-direct chat instead

// Support Ticket Functions
function showSupportModal() {
    document.getElementById('supportModal').classList.add('show');
}

function closeSupportModal() {
    document.getElementById('supportModal').classList.remove('show');
    document.getElementById('supportForm').reset();
}

async function createSupportTicket() {
    const form = document.getElementById('supportForm');
    const formData = new FormData(form);
    
    const ticketData = {
        category: formData.get('supportCategory'),
        subject: formData.get('supportSubject'),
        description: formData.get('supportDescription'),
        priority: formData.get('supportPriority')
    };

    if (!ticketData.category || !ticketData.subject || !ticketData.description) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const response = await fetch('/api/support/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${chatManager.currentUser.token}`
            },
            body: JSON.stringify(ticketData)
        });

        if (!response.ok) {
            throw new Error('Failed to create support ticket');
        }

        const data = await response.json();
        
        // Close modal
        closeSupportModal();
        
        // Show success message
        alert('Support ticket created successfully!');
        
        // Optionally redirect to support tickets or show the ticket
        console.log('Support ticket created:', data.data);

    } catch (error) {
        console.error('Error creating support ticket:', error);
        alert('Failed to create support ticket');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('vendplugUser');
    window.location.href = 'index.html';
}

// Initialize chat manager when page loads
let chatManager;
document.addEventListener('DOMContentLoaded', () => {
    chatManager = new ChatManager();
    window.chatManager = chatManager; // Make it globally accessible
    
    // Test if functions are accessible
    console.log('🧪 Testing global functions:');
    console.log('triggerFileInput exists:', typeof window.triggerFileInput);
    console.log('sendMessage exists:', typeof window.sendMessage);
    console.log('chatManager exists:', typeof window.chatManager);
});