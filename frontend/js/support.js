// Support System JavaScript
class SupportManager {
    constructor() {
        this.currentUser = null;
        this.tickets = [];
        this.filteredTickets = [];
        this.currentTicket = null;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Support Manager...');
        
        // Add a small delay to ensure localStorage is fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check authentication using standardized auth-utils
        if (!isAuthenticated()) {
            console.error('❌ No user authenticated, redirecting to login');
            redirectToLogin();
            return;
        }

        // Get current user using standardized function
        this.currentUser = getCurrentUser();
        this.userType = getCurrentUserType();
        this.token = getAuthToken();

        if (!this.currentUser || !this.token) {
            console.error('❌ User data or token missing, redirecting to login');
            redirectToLogin();
            return;
        }

        console.log('✅ Current user:', this.currentUser);
        console.log('✅ User type:', this.userType);

        // Load tickets
        await this.loadTickets();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up real-time updates
        this.setupRealTimeUpdates();
    }


    async loadTickets() {
        try {
            console.log('📋 Loading support tickets...');
            
            const response = await fetch('/api/support/tickets', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Tickets loaded:', data);

            this.tickets = data.data || [];
            this.filteredTickets = [...this.tickets];
            this.renderTickets();
            this.updateTicketsCount();

        } catch (error) {
            console.error('❌ Error loading tickets:', error);
            this.showError('Failed to load support tickets. Please try again.');
        }
    }

    renderTickets() {
        const ticketsList = document.getElementById('ticketsList');
        
        if (this.filteredTickets.length === 0) {
            ticketsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <h3>No Support Tickets</h3>
                    <p>You haven't created any support tickets yet.</p>
                    <button class="btn-create-ticket" onclick="showCreateTicketModal()">
                        <i class="fas fa-plus"></i>
                        Create Your First Ticket
                    </button>
                </div>
            `;
            return;
        }

        const ticketsHTML = this.filteredTickets.map(ticket => this.renderTicket(ticket)).join('');
        ticketsList.innerHTML = ticketsHTML;
    }

    renderTicket(ticket) {
        const statusClass = `status-${ticket.status}`;
        const priorityClass = `priority-${ticket.priority}`;
        const createdDate = new Date(ticket.createdAt).toLocaleDateString();
        const description = ticket.description.length > 100 
            ? ticket.description.substring(0, 100) + '...' 
            : ticket.description;

        return `
            <div class="ticket-item" onclick="supportManager.viewTicket('${ticket._id}')">
                <div class="ticket-info">
                    <div class="ticket-title">${ticket.subject}</div>
                    <div class="ticket-meta">
                        <span><i class="fas fa-tag"></i> ${ticket.category}</span>
                        <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                        ${ticket.ticketNumber ? `<span><i class="fas fa-hashtag"></i> ${ticket.ticketNumber}</span>` : ''}
                    </div>
                    <div class="ticket-description">${description}</div>
                </div>
                <div class="ticket-status">
                    <div class="status-badge ${statusClass}">${ticket.status.replace('_', ' ')}</div>
                    <div class="priority-badge ${priorityClass}">${ticket.priority}</div>
                    <div class="ticket-date">${createdDate}</div>
                </div>
            </div>
        `;
    }

    updateTicketsCount() {
        const countElement = document.getElementById('ticketsCount');
        const totalTickets = this.tickets.length;
        const filteredTickets = this.filteredTickets.length;
        
        if (filteredTickets === totalTickets) {
            countElement.textContent = `${totalTickets} ticket${totalTickets !== 1 ? 's' : ''}`;
        } else {
            countElement.textContent = `${filteredTickets} of ${totalTickets} tickets`;
        }
    }

    filterTickets() {
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;

        this.filteredTickets = this.tickets.filter(ticket => {
            const statusMatch = !statusFilter || ticket.status === statusFilter;
            const priorityMatch = !priorityFilter || ticket.priority === priorityFilter;
            const categoryMatch = !categoryFilter || ticket.category === categoryFilter;
            
            return statusMatch && priorityMatch && categoryMatch;
        });

        this.renderTickets();
        this.updateTicketsCount();
    }

    async viewTicket(ticketId) {
        try {
            console.log('👁️ Viewing ticket:', ticketId);
            
            const response = await fetch(`/api/support/tickets/${ticketId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Ticket details:', data);

            const ticket = data.data;
            this.currentTicket = ticket;
            
            // Show ticket detail modal with chat
            this.showTicketDetailModal(ticket);

        } catch (error) {
            console.error('❌ Error viewing ticket:', error);
            this.showError('Failed to load ticket details. Please try again.');
        }
    }

    showTicketDetailModal(ticket) {
        // Update ticket info panel
        document.getElementById('ticketDetailTitle').textContent = ticket.subject;
        document.getElementById('ticketChatTitle').textContent = ticket.subject;
        document.getElementById('ticketChatMeta').textContent = `Ticket #${ticket.ticketNumber || ticket._id}`;
        
        // Status and priority badges
        const statusBadge = document.getElementById('ticketDetailStatus');
        statusBadge.textContent = ticket.status.replace('_', ' ');
        statusBadge.className = `status-badge status-${ticket.status}`;
        
        const priorityBadge = document.getElementById('ticketDetailPriority');
        priorityBadge.textContent = ticket.priority;
        priorityBadge.className = `priority-badge priority-${ticket.priority}`;
        
        // Other ticket info
        document.getElementById('ticketDetailCategory').textContent = ticket.category;
        document.getElementById('ticketDetailCreated').textContent = new Date(ticket.createdAt).toLocaleString();
        document.getElementById('ticketDetailUpdated').textContent = new Date(ticket.updatedAt).toLocaleString();
        document.getElementById('ticketDetailAssigned').textContent = ticket.assignedTo ? 
            (ticket.assignedTo.fullName || 'Staff Member') : 'Not assigned';
        document.getElementById('ticketDetailDescription').textContent = ticket.description;
        
        // Show modal
        document.getElementById('ticketDetailModal').classList.add('show');
        
        // Load chat messages
        this.loadTicketChat(ticket);
    }

    closeTicketDetailModal() {
        document.getElementById('ticketDetailModal').classList.remove('show');
        this.currentTicket = null;
    }

    setupRealTimeUpdates() {
        // Initialize Socket.IO connection
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            // Listen for support ticket messages
            this.socket.on('support-ticket-message', (data) => {
                this.handleSupportTicketMessage(data);
            });
            
            // Listen for support ticket status updates
            this.socket.on('support-ticket-status-updated', (data) => {
                this.handleSupportTicketStatusUpdate(data);
            });
            
            // Listen for notifications
            this.socket.on('new-notification', (notification) => {
                this.handleNotification(notification);
            });
            
            console.log('✅ Real-time updates initialized for support');
        } else {
            console.warn('⚠️ Socket.IO not available');
        }
    }

    handleSupportTicketMessage(data) {
        // If we're currently viewing this ticket, add the message to the chat
        if (this.currentTicket && this.currentTicket._id === data.ticketId) {
            this.addMessageToChat(data.message);
        }
        
        // Show notification for new messages from staff
        if (data.senderType === 'Staff') {
            this.showNotificationToast('New Support Reply', `Staff replied to ticket ${data.ticketNumber}`);
        }
    }

    handleSupportTicketStatusUpdate(data) {
        // If we're currently viewing this ticket, update the status
        if (this.currentTicket && this.currentTicket._id === data.ticketId) {
            this.updateTicketStatusInUI(data.status);
        }
        
        // Refresh tickets list
        this.loadTickets();
        
        // Show status update notification
        this.showNotificationToast('Ticket Status Updated', `Ticket ${data.ticketNumber} status updated to ${data.status}`);
    }

    handleNotification(notification) {
        // Show notification toast
        this.showNotificationToast(notification.title, notification.message);
    }

    addMessageToChat(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        // Remove "no messages" if it exists
        const noMessages = messagesContainer.querySelector('.no-messages');
        if (noMessages) {
            noMessages.remove();
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.innerHTML = this.renderMessage(message);
        
        // Append to messages container
        messagesContainer.appendChild(messageElement.firstElementChild);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateTicketStatusInUI(status) {
        // Update status in the ticket detail modal
        const statusElement = document.querySelector('#ticketDetailModal .ticket-status');
        if (statusElement) {
            statusElement.textContent = status.toUpperCase();
            statusElement.className = `ticket-status status-${status.toLowerCase().replace('_', '-')}`;
        }
    }

    showNotificationToast(title, message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <div class="toast-header">
                <strong>${title}</strong>
                <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    async loadTicketChat(ticket) {
        try {
            console.log('💬 Loading chat for ticket:', ticket._id);
            
            // Get chat ID from ticket
            const chatId = ticket.chat?._id || ticket.chat;
            if (!chatId) {
                console.log('❌ No chat found for ticket');
                this.renderNoMessages();
                return;
            }

            // Load messages from chat
            const response = await fetch(`/api/support/tickets/${ticket._id}/messages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Chat messages loaded:', data);

            const messages = data.data || [];
            this.renderChatMessages(messages);

        } catch (error) {
            console.error('❌ Error loading chat:', error);
            this.renderNoMessages();
        }
    }

    renderChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            this.renderNoMessages();
            return;
        }

        const messagesHTML = messages.map(message => this.renderMessage(message)).join('');
        chatMessages.innerHTML = messagesHTML;
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    renderMessage(message) {
        // Convert userType to match senderType format (capitalize first letter)
        const currentUserType = this.userType ? 
            this.userType.charAt(0).toUpperCase() + this.userType.slice(1) : 
            null;
        const isSent = message.senderType === currentUserType;
        
        console.log('🔍 Message sender check:', {
            messageSenderType: message.senderType,
            currentUserType: currentUserType,
            originalUserType: this.userType,
            isSent: isSent
        });
        const senderName = this.getSenderName(message);
        const messageTime = new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-avatar">
                    ${senderName.charAt(0).toUpperCase()}
                </div>
                <div class="message-content">
                    <div>${this.escapeHtml(message.content)}</div>
                    <div class="message-time">${messageTime}</div>
                </div>
            </div>
        `;
    }

    getSenderName(message) {
        // Normalize current user type for comparison
        const currentUserType = this.userType
            ? this.userType.charAt(0).toUpperCase() + this.userType.slice(1)
            : null;

        // If it's the current user's message
        if (message.senderType === currentUserType) {
            return this.currentUser.fullName || this.currentUser.email || 'You';
        }

        // Prefer populated sender name when available (backend populates fullName)
        if (message.sender && (message.sender.fullName || message.sender.email)) {
            return message.sender.fullName || message.sender.email;
        }

        // Fallbacks by role
        if (message.senderType === 'Staff') return 'Support Staff';
        if (message.senderType === 'Buyer') return 'Buyer';
        if (message.senderType === 'Vendor') return 'Vendor';
        if (message.senderType === 'Agent') return 'Agent';

        return 'Support';
    }

    renderNoMessages() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="no-messages">
                <i class="fas fa-comments"></i>
                <p>No messages yet. Start the conversation!</p>
            </div>
        `;
    }

    async sendSupportMessage(event) {
        event.preventDefault();
        
        if (!this.currentTicket) {
            this.showError('No ticket selected');
            return;
        }

        const messageInput = document.getElementById('chatMessageInput');
        const message = messageInput.value.trim();
        
        if (!message) {
            return;
        }

        try {
            console.log('📤 Sending support message:', message);
            
            // Disable send button
            const sendBtn = document.getElementById('sendMessageBtn');
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // Send message using the correct endpoint
            const response = await fetch(`/api/support/tickets/${this.currentTicket._id}/message`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: message })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send message');
            }

            // Clear input
            messageInput.value = '';
            
            // Reload messages
            await this.loadTicketChat(this.currentTicket);

        } catch (error) {
            console.error('❌ Error sending message:', error);
            this.showError('Failed to send message: ' + error.message);
        } finally {
            // Re-enable send button
            const sendBtn = document.getElementById('sendMessageBtn');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    showCreateTicketModal() {
        document.getElementById('createTicketModal').classList.add('show');
    }

    closeCreateTicketModal() {
        document.getElementById('createTicketModal').classList.remove('show');
        document.getElementById('createTicketForm').reset();
    }

    async createTicket() {
        const form = document.getElementById('createTicketForm');
        const formData = new FormData(form);
        
        // Debug: Check all form fields
        console.log('🔍 Form elements:', {
            category: document.getElementById('ticketCategory').value,
            subcategory: document.getElementById('ticketSubcategory').value,
            subject: document.getElementById('ticketSubject').value,
            description: document.getElementById('ticketDescription').value,
            priority: document.getElementById('ticketPriority').value
        });
        
        const ticketData = {
            category: formData.get('ticketCategory'),
            subcategory: formData.get('ticketSubcategory') || undefined,
            subject: formData.get('ticketSubject'),
            description: formData.get('ticketDescription'),
            priority: formData.get('ticketPriority')
        };

        console.log('📝 Form data collected:', ticketData);

        // Validate required fields
        const missingFields = [];
        if (!ticketData.category) missingFields.push('Category');
        if (!ticketData.subject) missingFields.push('Subject');
        if (!ticketData.description) missingFields.push('Description');
        
        if (missingFields.length > 0) {
            this.showError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
            return;
        }

        try {
            console.log('📝 Creating support ticket:', ticketData);
            
            const response = await fetch('/api/support/tickets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ticketData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create support ticket');
            }

            const data = await response.json();
            console.log('✅ Ticket created:', data);

            // Close modal
            this.closeCreateTicketModal();
            
            // Show success message
            this.showSuccess('Support ticket created successfully!');
            
            // Reload tickets
            await this.loadTickets();

        } catch (error) {
            console.error('❌ Error creating ticket:', error);
            
            let errorMessage = 'Failed to create support ticket';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.response) {
                errorMessage = `Server error: ${error.response.status}`;
            }
            
            this.showError(errorMessage);
        }
    }

    setupEventListeners() {
        // Filter change events are handled by inline onchange attributes
        console.log('✅ Event listeners set up');
    }

    showError(message) {
        // Simple error display - in a full implementation, you'd use a proper notification system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success display - in a full implementation, you'd use a proper notification system
        alert('Success: ' + message);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for HTML onclick events
function showCreateTicketModal() {
    if (window.supportManager) {
        window.supportManager.showCreateTicketModal();
    }
}

function closeCreateTicketModal() {
    if (window.supportManager) {
        window.supportManager.closeCreateTicketModal();
    }
}

function createTicket() {
    if (window.supportManager) {
        window.supportManager.createTicket();
    }
}

function filterTickets() {
    if (window.supportManager) {
        window.supportManager.filterTickets();
    }
}

function closeTicketDetailModal() {
    if (window.supportManager) {
        window.supportManager.closeTicketDetailModal();
    }
}

function sendSupportMessage(event) {
    if (window.supportManager) {
        window.supportManager.sendSupportMessage(event);
    }
}

function goBack() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('buyer')) {
        window.location.href = 'buyer-home.html';
    } else if (currentPath.includes('vendor')) {
        window.location.href = 'vendor-dashboard.html';
    } else if (currentPath.includes('agent')) {
        window.location.href = 'agent-dashboard.html';
    } else {
        window.history.back();
    }
}

function logout() {
    // Clear all user data
    localStorage.removeItem('vendplugBuyer');
    localStorage.removeItem('vendplugVendor');
    localStorage.removeItem('vendplugAgent');
    localStorage.removeItem('vendplug-buyer-token');
    localStorage.removeItem('vendplug-vendor-token');
    localStorage.removeItem('vendplug-agent-token');
    localStorage.removeItem('vendplug-token');
    
    // Redirect to auth selection
    window.location.href = 'auth-selection.html';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing support system...');
    window.supportManager = new SupportManager();
});
