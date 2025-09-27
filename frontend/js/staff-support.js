// Staff Support Dashboard
class SupportManager {
    constructor() {
        this.currentUser = null;
        this.tickets = [];
        this.currentTicket = null;
        this.socket = null;
        
        this.init();
    }

    async init() {
        // Get current user
        this.currentUser = JSON.parse(localStorage.getItem('vendplugStaff'));
        if (!this.currentUser) {
            window.location.href = 'staff-login.html';
            return;
        }

        // Initialize socket connection
        this.initSocket();
        
        // Load tickets
        await this.loadTickets();
        await this.loadStats();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to support server');
            this.socket.emit('join_staff', { staffId: this.currentUser.id });
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from support server');
        });

        this.socket.on('new_support_ticket', (data) => {
            this.handleNewTicket(data);
        });

        this.socket.on('ticket_updated', (data) => {
            this.handleTicketUpdate(data);
        });
    }

    setupEventListeners() {
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadTickets();
        }, 30000);
    }

    async loadTickets() {
        try {
            const response = await fetch('/api/staff/support/tickets', {
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load tickets');
            }

            const data = await response.json();
            this.tickets = data.data || [];
            this.renderTickets();
            this.updateTicketsCount();

        } catch (error) {
            console.error('Error loading tickets:', error);
            this.showError('Failed to load tickets');
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/support/stats', {
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load stats');
            }

            const data = await response.json();
            this.updateStats(data.data);

        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    renderTickets() {
        const ticketsList = document.getElementById('ticketsList');
        
        if (this.tickets.length === 0) {
            ticketsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <h3>No tickets assigned</h3>
                    <p>You don't have any support tickets assigned to you</p>
                </div>
            `;
            return;
        }

        ticketsList.innerHTML = this.tickets.map(ticket => {
            const priorityClass = ticket.priority === 'urgent' ? 'urgent' : 
                                 ticket.priority === 'high' ? 'high' : '';
            
            return `
                <div class="support-ticket" onclick="supportManager.viewTicket('${ticket._id}')">
                    <div class="ticket-header">
                        <div class="ticket-number">${ticket.ticketNumber}</div>
                        <div class="ticket-status ${ticket.status}">${ticket.status.replace('_', ' ').toUpperCase()}</div>
                    </div>
                    <div class="ticket-subject">${ticket.subject}</div>
                    <div class="ticket-meta">
                        <div class="ticket-priority ${priorityClass}">${ticket.priority.toUpperCase()}</div>
                        <div class="ticket-category">${ticket.category.toUpperCase()}</div>
                        <div class="ticket-requester">${ticket.requester?.fullName || 'Unknown'}</div>
                        <div class="ticket-time">${this.formatTime(ticket.createdAt)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async viewTicket(ticketId) {
        this.currentTicket = this.tickets.find(t => t._id === ticketId);
        if (!this.currentTicket) return;

        // Populate modal
        document.getElementById('ticketNumber').textContent = this.currentTicket.ticketNumber;
        document.getElementById('ticketStatus').textContent = this.currentTicket.status.replace('_', ' ').toUpperCase();
        document.getElementById('ticketStatus').className = `ticket-status ${this.currentTicket.status}`;
        document.getElementById('ticketPriority').textContent = this.currentTicket.priority.toUpperCase();
        document.getElementById('ticketPriority').className = `ticket-priority ${this.currentTicket.priority}`;
        document.getElementById('ticketCategory').textContent = this.currentTicket.category.toUpperCase();
        document.getElementById('ticketRequester').textContent = this.currentTicket.requester?.fullName || 'Unknown';
        document.getElementById('ticketCreated').textContent = this.formatTime(this.currentTicket.createdAt);
        document.getElementById('ticketDescription').textContent = this.currentTicket.description;

        // Load chat messages if chat exists
        if (this.currentTicket.chat) {
            await this.loadTicketChat(this.currentTicket.chat);
        }

        // Show modal
        document.getElementById('ticketModal').classList.add('show');
    }

    async loadTicketChat(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load chat messages');
            }

            const data = await response.json();
            this.renderTicketChat(data.data || []);

        } catch (error) {
            console.error('Error loading ticket chat:', error);
        }
    }

    renderTicketChat(messages) {
        const chatContainer = document.getElementById('ticketChat');
        
        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation with the user</p>
                </div>
            `;
            return;
        }

        chatContainer.innerHTML = messages.map(message => {
            const isStaff = message.senderType === 'Staff';
            const senderName = message.sender.fullName || 'Unknown';
            const initials = senderName.split(' ').map(n => n[0]).join('').toUpperCase();
            
            return `
                <div class="message ${isStaff ? 'sent' : 'received'}">
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <p class="message-text">${this.escapeHtml(message.content)}</p>
                        <div class="message-time">${this.formatTime(message.createdAt)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async updateTicketStatus() {
        const newStatus = document.getElementById('statusUpdate').value;
        if (!newStatus || !this.currentTicket) return;

        try {
            const response = await fetch(`/api/staff/support/tickets/${this.currentTicket._id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentUser.token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error('Failed to update ticket status');
            }

            // Update local ticket
            this.currentTicket.status = newStatus;
            
            // Update UI
            document.getElementById('ticketStatus').textContent = newStatus.replace('_', ' ').toUpperCase();
            document.getElementById('ticketStatus').className = `ticket-status ${newStatus}`;
            
            // Reload tickets list
            await this.loadTickets();
            
            // Clear status select
            document.getElementById('statusUpdate').value = '';

        } catch (error) {
            console.error('Error updating ticket status:', error);
            this.showError('Failed to update ticket status');
        }
    }

    async addInternalNote() {
        const note = document.getElementById('internalNote').value.trim();
        if (!note || !this.currentTicket) return;

        try {
            const response = await fetch(`/api/staff/support/tickets/${this.currentTicket._id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentUser.token}`
                },
                body: JSON.stringify({ 
                    status: this.currentTicket.status,
                    internalNote: note
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add internal note');
            }

            // Clear note input
            document.getElementById('internalNote').value = '';
            
            // Show success message
            this.showSuccess('Internal note added successfully');

        } catch (error) {
            console.error('Error adding internal note:', error);
            this.showError('Failed to add internal note');
        }
    }

    filterTickets() {
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;

        let filteredTickets = this.tickets;

        if (statusFilter) {
            filteredTickets = filteredTickets.filter(t => t.status === statusFilter);
        }

        if (priorityFilter) {
            filteredTickets = filteredTickets.filter(t => t.priority === priorityFilter);
        }

        if (categoryFilter) {
            filteredTickets = filteredTickets.filter(t => t.category === categoryFilter);
        }

        // Update display
        const ticketsList = document.getElementById('ticketsList');
        const allTickets = ticketsList.querySelectorAll('.support-ticket');
        
        allTickets.forEach(ticketElement => {
            const ticketId = ticketElement.onclick.toString().match(/'([^']+)'/)[1];
            const ticket = filteredTickets.find(t => t._id === ticketId);
            
            if (ticket) {
                ticketElement.style.display = 'block';
            } else {
                ticketElement.style.display = 'none';
            }
        });

        // Update count
        document.getElementById('ticketsCount').textContent = `${filteredTickets.length} tickets`;
    }

    updateTicketsCount() {
        document.getElementById('ticketsCount').textContent = `${this.tickets.length} tickets`;
    }

    updateStats(stats) {
        // Update stat cards
        const totalTickets = stats.stats?.reduce((sum, stat) => sum + stat.count, 0) || 0;
        const openTickets = stats.stats?.find(s => s._id === 'open')?.count || 0;
        const resolvedTickets = stats.stats?.find(s => s._id === 'resolved')?.count || 0;
        const overdueTickets = stats.overdueTickets || 0;

        document.getElementById('totalTickets').textContent = totalTickets;
        document.getElementById('openTickets').textContent = openTickets;
        document.getElementById('resolvedTickets').textContent = resolvedTickets;
        document.getElementById('overdueTickets').textContent = overdueTickets;
    }

    handleNewTicket(data) {
        console.log('New support ticket:', data);
        // Reload tickets to show new one
        this.loadTickets();
    }

    handleTicketUpdate(data) {
        console.log('Ticket updated:', data);
        // Reload tickets to show updates
        this.loadTickets();
    }

    async refreshTickets() {
        await this.loadTickets();
        await this.loadStats();
        this.showSuccess('Tickets refreshed');
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
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success display - you can enhance this
        alert('Success: ' + message);
    }
}

// Modal functions
function closeTicketModal() {
    document.getElementById('ticketModal').classList.remove('show');
    document.getElementById('statusUpdate').value = '';
    document.getElementById('internalNote').value = '';
}

// Global functions
function filterTickets() {
    supportManager.filterTickets();
}

function refreshTickets() {
    supportManager.refreshTickets();
}

function updateTicketStatus() {
    supportManager.updateTicketStatus();
}

function addInternalNote() {
    supportManager.addInternalNote();
}

// Logout function
function logout() {
    localStorage.removeItem('vendplugStaff');
    window.location.href = 'staff-login.html';
}

// Initialize support manager when page loads
let supportManager;
document.addEventListener('DOMContentLoaded', () => {
    supportManager = new SupportManager();
});
