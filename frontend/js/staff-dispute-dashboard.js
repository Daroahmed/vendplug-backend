// frontend/js/staff-dispute-dashboard.js
class StaffDisputeDashboard {
    constructor() {
        this.currentStaff = null;
        this.currentDispute = null;
        this.apiBaseUrl = '/api/staff';
        this.init();
    }

    async init() {
        // Check authentication
        if (!isAuthenticated()) {
            redirectToLogin();
            return;
        }

        // Check if user is staff
        const userType = getCurrentUserType();
        if (userType !== 'staff') {
            console.error('❌ Access denied: User is not staff, userType:', userType);
            if (window.showOverlay) {
                window.showOverlay({ type:'error', title:'Access Denied', message:'This page is only for staff members.', autoClose: 2500 });
            }
            // Redirect to appropriate dashboard based on user type
            if (userType === 'buyer') {
                window.location.href = 'buyer-home.html';
            } else if (userType === 'vendor') {
                window.location.href = 'vendor-dashboard.html';
            } else if (userType === 'agent') {
                window.location.href = 'agent-dashboard.html';
            } else if (userType === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                redirectToLogin();
            }
            return;
        }

        try {
            // Get staff info
            await this.loadStaffInfo();
            
            // Load dashboard
            await this.loadDashboard();
            
            // Set up real-time updates
            this.setupRealTimeUpdates();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    async loadStaffInfo() {
        try {
            const response = await fetch('/api/staff/profile', {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load staff info');
            }

            const data = await response.json();
            this.currentStaff = data.data;
            
            // Update UI
            document.getElementById('staffName').textContent = this.currentStaff.fullName;
            document.getElementById('staffRole').textContent = this.currentStaff.role || 'Staff';
            
            // Show/hide manager features
            if (this.currentStaff.permissions?.disputeAssignment) {
                document.getElementById('assignDisputesLink').style.display = 'block';
            }

        } catch (error) {
            console.error('Error loading staff info:', error);
            // Show fallback values
            document.getElementById('staffName').textContent = 'Staff Member';
            document.getElementById('staffRole').textContent = 'Staff';
            throw error;
        }
    }

    async loadDashboard() {
        try {
            // Load analytics for dashboard stats
            const analyticsResponse = await fetch(`${this.apiBaseUrl}/disputes/stats?period=30`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (analyticsResponse.ok) {
                const analyticsData = await analyticsResponse.json();
                this.updateDashboardStats(analyticsData.data);
            }

            // Load support ticket stats
            await this.loadSupportTicketStats();

            // Load recent disputes
            await this.loadRecentDisputes();
            
            // Load category breakdown
            await this.loadCategoryBreakdown();

        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateDashboardStats(data) {
        document.getElementById('assignedCount').textContent = data.assignedDisputes || 0;
        document.getElementById('resolvedToday').textContent = data.resolvedToday || 0;
        document.getElementById('pendingCount').textContent = data.pendingReview || 0;
        document.getElementById('overdueCount').textContent = data.overdueDisputes || 0;
    }

    async loadSupportTicketStats() {
        try {
            // Load my support tickets count
            const myTicketsResponse = await fetch(`/api/support/staff/tickets/my?limit=1`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (myTicketsResponse.ok) {
                const myTicketsData = await myTicketsResponse.json();
                document.getElementById('assignedSupportCount').textContent = myTicketsData.data.pagination.totalItems || 0;
            }

            // Load available support tickets count
            const availableTicketsResponse = await fetch(`/api/support/staff/tickets/available?limit=1`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (availableTicketsResponse.ok) {
                const availableTicketsData = await availableTicketsResponse.json();
                document.getElementById('availableSupportCount').textContent = availableTicketsData.data.pagination.totalItems || 0;
            }

            // Load resolved today count
            const today = new Date().toISOString().split('T')[0];
            const resolvedResponse = await fetch(`/api/support/staff/tickets/my?status=resolved&limit=1`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (resolvedResponse.ok) {
                const resolvedData = await resolvedResponse.json();
                // Filter for today's resolved tickets
                const todayResolved = resolvedData.data.tickets.filter(ticket => {
                    const ticketDate = new Date(ticket.updatedAt).toISOString().split('T')[0];
                    return ticketDate === today;
                });
                document.getElementById('resolvedSupportCount').textContent = todayResolved.length;
            }

            // Load in progress count
            const inProgressResponse = await fetch(`/api/support/staff/tickets/my?status=in_progress&limit=1`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (inProgressResponse.ok) {
                const inProgressData = await inProgressResponse.json();
                document.getElementById('pendingSupportCount').textContent = inProgressData.data.pagination.totalItems || 0;
            }

        } catch (error) {
            console.error('Error loading support ticket stats:', error);
            // Set default values on error
            document.getElementById('assignedSupportCount').textContent = '0';
            document.getElementById('availableSupportCount').textContent = '0';
            document.getElementById('resolvedSupportCount').textContent = '0';
            document.getElementById('pendingSupportCount').textContent = '0';
        }
    }

    async loadRecentDisputes() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/my?limit=5`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load recent disputes');
            }

            const data = await response.json();
            this.renderRecentDisputes(data.data.disputes);

        } catch (error) {
            console.error('Error loading recent disputes:', error);
            document.getElementById('recentDisputes').innerHTML = 
                '<div class="text-center text-muted">Failed to load recent disputes</div>';
        }
    }

    renderRecentDisputes(disputes) {
        const container = document.getElementById('recentDisputes');
        
        if (!container) {
            console.error('recentDisputes container not found');
            return;
        }
        
        if (!disputes || disputes.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No recent disputes</div>';
            return;
        }

        const html = disputes.map(dispute => `
            <div class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded">
                <div>
                    <h6 class="mb-1">${dispute.disputeId}</h6>
                    <p class="mb-1 text-muted">${dispute.title}</p>
                    <small class="text-muted">
                        ${dispute.category.replace(/_/g, ' ')} • 
                        ${new Date(dispute.createdAt).toLocaleDateString()}
                    </small>
                </div>
                <div class="text-end">
                    <span class="status-badge status-${dispute.status}">${dispute.status}</span>
                    <br>
                    <button class="btn btn-sm btn-outline-primary mt-1" onclick="viewDispute('${dispute.disputeId}')">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    async loadCategoryBreakdown() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/stats?period=30`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load category breakdown');
            }

            const data = await response.json();
            this.renderCategoryChart(data.data.categoryStats);

        } catch (error) {
            console.error('Error loading category breakdown:', error);
            document.getElementById('categoryChart').innerHTML = 
                '<div class="text-center text-muted">Failed to load category data</div>';
        }
    }

    renderCategoryChart(categoryStats) {
        const container = document.getElementById('categoryChart');
        
        if (!container) {
            console.error('categoryChart container not found');
            return;
        }
        
        if (!categoryStats || categoryStats.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No category data available</div>';
            return;
        }

        const ctx = document.createElement('canvas');
        ctx.id = 'categoryChartCanvas';
        container.innerHTML = '';
        container.appendChild(ctx);

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryStats.map(item => (item.category || item._id).replace(/_/g, ' ')),
                datasets: [{
                    data: categoryStats.map(item => item.count),
                    backgroundColor: [
                        '#3498db', '#e74c3c', '#f39c12', '#27ae60', 
                        '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async loadMyDisputes() {
        try {
            const statusFilter = document.getElementById('statusFilter').value;
            // Build query params safely so we don't end up with .../my&t= when status is empty
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            params.append('t', Date.now());
            const url = `${this.apiBaseUrl}/disputes/my${params.toString() ? `?${params.toString()}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load disputes');
            }

            const data = await response.json();
            const disputes = (data && data.data && Array.isArray(data.data.disputes)) ? data.data.disputes : [];
            this.renderMyDisputes(disputes);
            
            // Update dispute count
            document.getElementById('disputeCount').textContent = disputes.length;

        } catch (error) {
            console.error('Error loading my disputes:', error);
            document.getElementById('myDisputesList').innerHTML = 
                '<div class="text-center text-muted">Failed to load disputes</div>';
        }
    }

    renderMyDisputes(disputes) {
        const container = document.getElementById('myDisputesList');
        
        console.log('🔍 Rendering disputes:', disputes);
        
        if (!disputes || disputes.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No disputes found</div>';
            return;
        }

        const html = disputes.map(dispute => {
            console.log(`🔍 Processing dispute ${dispute.disputeId} with status: ${dispute.status}`);
            return `
            <div class="card dispute-card mb-3 ${dispute.priority}-priority">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="d-flex align-items-center mb-2">
                                <h5 class="mb-0 me-3">${dispute.disputeId}</h5>
                                <span class="status-badge status-${dispute.status}">${dispute.status}</span>
                                <span class="priority-badge priority-${dispute.priority} ms-2">${dispute.priority}</span>
                            </div>
                            <h6 class="mb-1">${dispute.title}</h6>
                            <p class="text-muted mb-2">${dispute.description.substring(0, 100)}...</p>
                            <div class="d-flex align-items-center text-muted">
                                <small>
                                    <i class="fas fa-tag me-1"></i>${dispute.category.replace(/_/g, ' ')}
                                    <i class="fas fa-calendar ms-3 me-1"></i>${new Date(dispute.createdAt).toLocaleDateString()}
                                    <i class="fas fa-user ms-3 me-1"></i>${DataFormatter.formatUserName(dispute.complainant?.userId)}
                                </small>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="btn-group-vertical">
                                <button class="btn btn-outline-primary btn-sm mb-1" onclick="viewDispute('${dispute.disputeId}')">
                                    <i class="fas fa-eye me-1"></i>View Details
                                </button>
                                
                                ${dispute.status === 'assigned' ? `
                                    <button class="btn btn-primary btn-sm" onclick="startReview('${dispute.disputeId}')">
                                        <i class="fas fa-play me-1"></i>Start Review
                                    </button>
                                ` : ''}
                                
                                ${dispute.status === 'under_review' ? `
                                    <div class="btn-group-vertical">
                                        <button class="btn btn-success btn-sm mb-1" onclick="showResolveModal('${dispute.disputeId}')">
                                        <i class="fas fa-check me-1"></i>Resolve
                                    </button>
                                        <button class="btn btn-warning btn-sm mb-1" onclick="showEscalateModal('${dispute.disputeId}')">
                                            <i class="fas fa-arrow-up me-1"></i>Escalate
                                        </button>
                                        <button class="btn btn-info btn-sm mb-1" onclick="showRequestInfoModal('${dispute.disputeId}')">
                                            <i class="fas fa-question me-1"></i>Request Info
                                        </button>
                                        <button class="btn btn-secondary btn-sm" onclick="showPriorityModal('${dispute.disputeId}')">
                                            <i class="fas fa-flag me-1"></i>Priority
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        container.innerHTML = html;
    }

    async loadAvailableDisputes() {
        try {
            const categoryFilter = document.getElementById('categoryFilter').value;
            // Build query params safely
            const params = new URLSearchParams();
            if (categoryFilter) params.append('category', categoryFilter);
            const url = `${this.apiBaseUrl}/disputes/available${params.toString() ? `?${params.toString()}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load available disputes');
            }

            const data = await response.json();
            const disputes = (data && data.data && Array.isArray(data.data.disputes)) ? data.data.disputes : [];
            this.renderAvailableDisputes(disputes);

        } catch (error) {
            console.error('Error loading available disputes:', error);
            document.getElementById('availableDisputesList').innerHTML = 
                '<div class="text-center text-muted">Failed to load available disputes</div>';
        }
    }

    renderAvailableDisputes(disputes) {
        const container = document.getElementById('availableDisputesList');
        
        if (!disputes || disputes.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No available disputes</div>';
            return;
        }

        const html = disputes.map(dispute => `
            <div class="card dispute-card mb-3 ${dispute.priority}-priority">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="d-flex align-items-center mb-2">
                                <h5 class="mb-0 me-3">${dispute.disputeId}</h5>
                                <span class="status-badge status-${dispute.status}">${dispute.status}</span>
                                <span class="priority-badge priority-${dispute.priority} ms-2">${dispute.priority}</span>
                            </div>
                            <h6 class="mb-1">${dispute.title}</h6>
                            <p class="text-muted mb-2">${dispute.description.substring(0, 100)}...</p>
                            <div class="d-flex align-items-center text-muted">
                                <small>
                                    <i class="fas fa-tag me-1"></i>${dispute.category.replace(/_/g, ' ')}
                                    <i class="fas fa-calendar ms-3 me-1"></i>${new Date(dispute.createdAt).toLocaleDateString()}
                                    <i class="fas fa-user ms-3 me-1"></i>${DataFormatter.formatUserName(dispute.complainant?.userId)}
                                </small>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <button class="btn btn-primary" onclick="dashboard.showAssignModal('${dispute.disputeId}')">
                                <i class="fas fa-user-plus me-1"></i>Assign
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Support Tickets Management
    async loadMySupportTickets() {
        try {
            const statusFilter = document.getElementById('supportStatusFilter').value;
            const priorityFilter = document.getElementById('supportPriorityFilter').value;
            
            let url = `/api/support/staff/tickets/my`;
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (priorityFilter) params.append('priority', priorityFilter);
            if (params.toString()) url += `?${params.toString()}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load my support tickets');
            }

            const data = await response.json();
            this.renderMySupportTickets(data.data.tickets);
            document.getElementById('supportTicketCount').textContent = data.data.tickets.length;

        } catch (error) {
            console.error('Error loading my support tickets:', error);
            document.getElementById('mySupportTicketsList').innerHTML = 
                '<div class="text-center text-muted">Failed to load my support tickets</div>';
        }
    }

    async loadAvailableSupportTickets() {
        try {
            const categoryFilter = document.getElementById('supportCategoryFilter').value;
            const priorityFilter = document.getElementById('availableSupportPriorityFilter').value;
            
            let url = `/api/support/staff/tickets/available`;
            const params = new URLSearchParams();
            if (categoryFilter) params.append('category', categoryFilter);
            if (priorityFilter) params.append('priority', priorityFilter);
            if (params.toString()) url += `?${params.toString()}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load available support tickets');
            }

            const data = await response.json();
            this.renderAvailableSupportTickets(data.data.tickets);

        } catch (error) {
            console.error('Error loading available support tickets:', error);
            document.getElementById('availableSupportTicketsList').innerHTML = 
                '<div class="text-center text-muted">Failed to load available support tickets</div>';
        }
    }

    renderMySupportTickets(tickets) {
        const container = document.getElementById('mySupportTicketsList');
        
        if (tickets.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No assigned support tickets</div>';
            return;
        }

        const html = tickets.map(ticket => `
            <div class="card support-ticket-card mb-3 ${ticket.priority}-priority">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="d-flex align-items-center mb-2">
                                <h5 class="mb-0 me-3">#${ticket.ticketNumber || ticket._id.slice(-8)}</h5>
                                <span class="status-badge status-${ticket.status}">${ticket.status.replace('_', ' ')}</span>
                                <span class="priority-badge priority-${ticket.priority} ms-2">${ticket.priority}</span>
                            </div>
                            <h6 class="mb-1">${ticket.subject}</h6>
                            <p class="text-muted mb-2">${ticket.description.substring(0, 100)}...</p>
                            <div class="d-flex align-items-center text-muted">
                                <small>
                                    <i class="fas fa-tag me-1"></i>${this.formatSupportCategory(ticket.category)}
                                    <i class="fas fa-calendar ms-3 me-1"></i>${new Date(ticket.createdAt).toLocaleDateString()}
                                    <i class="fas fa-user ms-3 me-1"></i>${ticket.requester?.fullName || 'Unknown'}
                                </small>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <button class="btn btn-primary me-2" onclick="dashboard.viewSupportTicket('${ticket._id}')">
                                <i class="fas fa-eye me-1"></i>View
                            </button>
                            <button class="btn btn-success" onclick="dashboard.updateSupportTicketStatus('${ticket._id}')">
                                <i class="fas fa-edit me-1"></i>Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderAvailableSupportTickets(tickets) {
        const container = document.getElementById('availableSupportTicketsList');
        
        if (tickets.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No available support tickets</div>';
            return;
        }

        const html = tickets.map(ticket => `
            <div class="card support-ticket-card mb-3 ${ticket.priority}-priority">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="d-flex align-items-center mb-2">
                                <h5 class="mb-0 me-3">#${ticket.ticketNumber || ticket._id.slice(-8)}</h5>
                                <span class="status-badge status-${ticket.status}">${ticket.status.replace('_', ' ')}</span>
                                <span class="priority-badge priority-${ticket.priority} ms-2">${ticket.priority}</span>
                            </div>
                            <h6 class="mb-1">${ticket.subject}</h6>
                            <p class="text-muted mb-2">${ticket.description.substring(0, 100)}...</p>
                            <div class="d-flex align-items-center text-muted">
                                <small>
                                    <i class="fas fa-tag me-1"></i>${this.formatSupportCategory(ticket.category)}
                                    <i class="fas fa-calendar ms-3 me-1"></i>${new Date(ticket.createdAt).toLocaleDateString()}
                                    <i class="fas fa-user ms-3 me-1"></i>${ticket.requester?.fullName || 'Unknown'}
                                </small>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <button class="btn btn-primary me-2" onclick="dashboard.viewSupportTicket('${ticket._id}')">
                                <i class="fas fa-eye me-1"></i>View
                            </button>
                            <button class="btn btn-warning" onclick="dashboard.assignSupportTicket('${ticket._id}')">
                                <i class="fas fa-user-plus me-1"></i>Assign
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    formatSupportCategory(category) {
        const categories = {
            'technical': 'Technical',
            'billing': 'Billing',
            'order': 'Order',
            'account': 'Account',
            'payment': 'Payment',
            'other': 'Other'
        };
        return categories[category] || category;
    }

    async viewSupportTicket(ticketId) {
        try {
            // Use staff ticket details endpoint
            const response = await fetch(`/api/support/staff/tickets/${ticketId}`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load support ticket details');
            }

            const data = await response.json();
            this.showSupportTicketModal(data.data);

        } catch (error) {
            console.error('Error loading support ticket details:', error);
            this.showError('Failed to load support ticket details');
        }
    }

    showSupportTicketModal(ticket) {
        const modalHTML = `
            <div class="modal" id="supportTicketModal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Support Ticket #${ticket.ticketNumber || ticket._id.slice(-8)}</h3>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="ticket-details">
                            <div class="detail-row">
                                <strong>Requester:</strong> ${ticket.requester?.fullName || 'Unknown'}
                            </div>
                            <div class="detail-row">
                                <strong>Category:</strong> ${this.formatSupportCategory(ticket.category)}
                            </div>
                            <div class="detail-row">
                                <strong>Subject:</strong> ${ticket.subject}
                            </div>
                            <div class="detail-row">
                                <strong>Priority:</strong> <span class="priority-badge priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Status:</strong> <span class="status-badge status-${ticket.status}">${ticket.status.replace('_', ' ').toUpperCase()}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Assigned To:</strong> ${ticket.assignedTo?.fullName || 'Unassigned'}
                            </div>
                            <div class="detail-row">
                                <strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}
                            </div>
                            <div class="detail-row">
                                <strong>Description:</strong>
                                <p>${ticket.description}</p>
                            </div>
                        </div>
                        <div class="ticket-chat-section">
                            <h4>Conversation</h4>
                            <div class="chat-container" id="supportTicketChat-${ticket._id}">
                                <div class="chat-messages" id="chatMessages-${ticket._id}">
                                    <!-- Messages will be loaded here -->
                                </div>
                                <div class="chat-input">
                                    <div class="input-group">
                                        <input type="text" class="form-control" id="chatInput-${ticket._id}" placeholder="Type a message..." onkeypress="if(event.key==='Enter') dashboard.sendSupportMessage('${ticket._id}')">
                                        <button class="btn btn-primary" onclick="dashboard.sendSupportMessage('${ticket._id}')">
                                            <i class="fas fa-paper-plane"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button onclick="dashboard.updateSupportTicketStatus('${ticket._id}')" class="btn btn-primary">Update Status</button>
                            <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Load chat messages for this support ticket
        if (ticket.chat) {
            const chatId = ticket.chat._id || ticket.chat;
            this.loadSupportTicketChat(ticket._id, chatId);
        }
    }

    async loadSupportTicketChat(ticketId, chatId) {
        try {
            const response = await fetch(`/api/support/staff/tickets/${ticketId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load chat messages');
            }

            const data = await response.json();
            console.log('📨 Staff chat data received:', data);
            this.renderSupportTicketMessages(ticketId, data.data || []);

        } catch (error) {
            console.error('Error loading support ticket chat:', error);
            const messagesContainer = document.getElementById(`chatMessages-${ticketId}`);
            if (messagesContainer) {
                messagesContainer.innerHTML = '<div class="text-center text-muted">Failed to load messages</div>';
            }
        }
    }

    renderSupportTicketMessages(ticketId, messages) {
        const messagesContainer = document.getElementById(`chatMessages-${ticketId}`);
        if (!messagesContainer) return;

        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-comments"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = messages.map(message => {
            const isStaff = message.senderType === 'Admin' || message.senderType === 'Staff';
            const senderName = this.getSenderDisplayName(message);
            const initials = this.getSenderInitials(senderName);
            const messageTime = new Date(message.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="message-bubble ${isStaff ? 'message-sent' : 'message-received'}">
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <strong>${senderName}</strong>
                            <small>${messageTime}</small>
                        </div>
                        <div class="message-text">${this.escapeHtml(message.content)}</div>
                        ${message.attachments && message.attachments.length > 0 ? 
                            `<div class="message-attachments">
                                ${message.attachments.map(attachment => `
                                    <div class="attachment-item">
                                        <i class="fas fa-paperclip"></i>
                                        <a href="${attachment.url || attachment.secure_url}" target="_blank">${attachment.filename}</a>
                                    </div>
                                `).join('')}
                            </div>` : ''
                        }
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    getSenderDisplayName(message) {
        if (message.senderType === 'Staff' || message.senderType === 'Admin') {
            return message.sender?.fullName || 'Support Staff';
        }
        
        if (message.sender?.fullName) {
            return message.sender.fullName;
        }
        
        return message.senderType || 'User';
    }

    getSenderInitials(name) {
        if (!name) return 'U';
        
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        
        return name.charAt(0).toUpperCase();
    }

    async sendSupportMessage(ticketId) {
        const messageInput = document.getElementById(`chatInput-${ticketId}`);
        const message = messageInput.value.trim();
        
        if (!message) return;

        try {
            // Disable send button and show loading
            const sendBtn = messageInput.nextElementSibling;
            const originalContent = sendBtn.innerHTML;
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // Send message using staff-specific endpoint
            const response = await fetch(`/api/support/staff/tickets/${ticketId}/message`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: message })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send message');
            }

            messageInput.value = '';
            
            // Reload messages
            const ticketResponse = await fetch(`/api/support/staff/tickets/${ticketId}`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (ticketResponse.ok) {
                const ticketData = await ticketResponse.json();
                const chatId = ticketData.data.chat._id || ticketData.data.chat;
                await this.loadSupportTicketChat(ticketId, chatId);
            }

        } catch (error) {
            console.error('Error sending support message:', error);
            this.showError('Failed to send message: ' + error.message);
        } finally {
            // Re-enable send button
            const sendBtn = messageInput.nextElementSibling;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async assignSupportTicket(ticketId) {
        if (!confirm('Are you sure you want to assign this support ticket to yourself?')) return;

        try {
            // Backend expects /api/staff/support/... and payload { staffId }
            const response = await fetch(`/api/support/staff/tickets/${ticketId}/assign`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ staffId: this.currentStaff._id })
            });

            if (!response.ok) {
                throw new Error('Failed to assign support ticket');
            }

            this.showSuccess('Support ticket assigned successfully');
            this.loadAvailableSupportTickets();
            this.loadMySupportTickets();

        } catch (error) {
            console.error('Error assigning support ticket:', error);
            this.showError('Failed to assign support ticket');
        }
    }

    async updateSupportTicketStatus(ticketId) {
        const status = prompt('Enter new status (open, in_progress, resolved, closed):');
        if (!status) return;

        try {
            const response = await fetch(`/api/support/staff/tickets/${ticketId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('Failed to update support ticket status');
            }

            this.showSuccess('Support ticket status updated successfully');
            this.loadMySupportTickets();
            this.loadAvailableSupportTickets();

        } catch (error) {
            console.error('Error updating support ticket status:', error);
            this.showError('Failed to update support ticket status');
        }
    }

    async loadAnalytics() {
        try {
            const period = document.getElementById('analyticsPeriod').value;
            const response = await fetch(`${this.apiBaseUrl}/disputes/stats?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load analytics');
            }

            const data = await response.json();
            this.renderAnalytics(data.data);

        } catch (error) {
            console.error('Error loading analytics:', error);
            document.getElementById('analyticsContent').innerHTML = 
                '<div class="text-center text-muted">Failed to load analytics</div>';
        }
    }

    renderAnalytics(data) {
        const container = document.getElementById('analyticsContent');
        
        const html = `
            <div class="row">
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-chart-line me-2"></i>Performance Overview</h5>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-4">
                                    <h4 class="text-primary">${data.totalDisputes || 0}</h4>
                                    <small class="text-muted">Total Disputes</small>
                                </div>
                                <div class="col-4">
                                    <h4 class="text-success">${data.resolvedDisputes || 0}</h4>
                                    <small class="text-muted">Resolved</small>
                                </div>
                                <div class="col-4">
                                    <h4 class="text-warning">${data.assignedDisputes || 0}</h4>
                                    <small class="text-muted">Assigned</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-clock me-2"></i>Resolution Time</h5>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-4">
                                    <h4 class="text-info">${data.averageResolutionTime ? Math.round(data.averageResolutionTime * 10) / 10 : 0}</h4>
                                    <small class="text-muted">Avg. Hours</small>
                                </div>
                                <div class="col-4">
                                    <h4 class="text-success">${data.resolvedDisputes || 0}</h4>
                                    <small class="text-muted">Resolved</small>
                                </div>
                                <div class="col-4">
                                    <h4 class="text-warning">${data.escalatedDisputes || 0}</h4>
                                    <small class="text-muted">Escalated</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-chart-pie me-2"></i>Category Breakdown</h5>
                        </div>
                        <div class="card-body">
                            <div class="chart-container">
                                <canvas id="analyticsCategoryChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Render category chart
        if (data.categoryStats && data.categoryStats.length > 0) {
            const ctx = document.getElementById('analyticsCategoryChart');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.categoryStats.map(item => (item.category || item._id).replace(/_/g, ' ')),
                    datasets: [{
                        label: 'Disputes',
                        data: data.categoryStats.map(item => item.count),
                        backgroundColor: '#3498db'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    async viewDispute(disputeId) {
        console.log('🔍 viewDispute called with ID:', disputeId);
        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${disputeId}`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load dispute details');
            }

            const data = await response.json();
            console.log('📊 Dispute data received:', data);
            this.currentDispute = data.data;
            this.renderDisputeModal();

        } catch (error) {
            console.error('Error loading dispute details:', error);
            this.showError('Failed to load dispute details');
        }
    }

    renderDisputeModal() {
        const dispute = this.currentDispute.dispute || this.currentDispute;
        console.log('🔍 Rendering dispute modal with data:', dispute);
        console.log('🔍 Dispute category:', dispute.category);
        console.log('🔍 Complainant data:', dispute.complainant);
        console.log('🔍 Respondent data:', dispute.respondent);
        console.log('🔍 Order data:', dispute.order);
        document.getElementById('modalDisputeId').textContent = dispute.disputeId;
        
        const html = `
            <div class="row">
                <div class="col-md-8">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5><i class="fas fa-info-circle me-2"></i>Dispute Information</h5>
                        </div>
                        <div class="card-body">
                            <div class="row mb-3">
                                <div class="col-sm-3"><strong>Title:</strong></div>
                                <div class="col-sm-9">${dispute.title || 'No title provided'}</div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-sm-3"><strong>Description:</strong></div>
                                <div class="col-sm-9">${dispute.description || 'No description provided'}</div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-sm-3"><strong>Category:</strong></div>
                                <div class="col-sm-9">
                                    <span class="badge bg-primary">${dispute.category ? dispute.category.replace(/_/g, ' ') : 'Unknown'}</span>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-sm-3"><strong>Status:</strong></div>
                                <div class="col-sm-9">
                                    <span class="status-badge status-${dispute.status}">${dispute.status}</span>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-sm-3"><strong>Priority:</strong></div>
                                <div class="col-sm-9">
                                    <span class="priority-badge priority-${dispute.priority}">${dispute.priority}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-comments me-2"></i>Messages</h5>
                        </div>
                        <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                            <div id="disputeMessages">
                                ${this.renderMessages(dispute.messages)}
                            </div>
                            <div class="mt-3">
                                <div class="input-group">
                                    <input type="text" class="form-control" id="newMessage" placeholder="Type a message...">
                                    <button class="btn btn-primary" onclick="dashboard.sendMessage()">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h5><i class="fas fa-users me-2"></i>Parties</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <strong>Complainant (${DataFormatter.formatUserType(dispute.complainant?.userType)}):</strong><br>
                                <small class="text-muted">
                                    ID: ${DataFormatter.formatOrderId(dispute.complainant?.userId?._id || dispute.complainant?.userId)}<br>
                                    Name: ${DataFormatter.formatUserName(dispute.complainant?.userId)}
                                </small>
                            </div>
                            <div class="mb-3">
                                <strong>Respondent (${DataFormatter.formatUserType(dispute.respondent?.userType)}):</strong><br>
                                <small class="text-muted">
                                    ID: ${DataFormatter.formatOrderId(dispute.respondent?.userId?._id || dispute.respondent?.userId)}<br>
                                    Name: ${DataFormatter.formatUserName(dispute.respondent?.userId)}
                                </small>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header">
                            <h5><i class="fas fa-shopping-cart me-2"></i>Order Details</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-2">
                                <strong>Order ID:</strong> ${DataFormatter.formatOrderId(dispute.orderId?._id || dispute.orderId)}
                            </div>
                            <div class="mb-2">
                                <strong>Amount:</strong> ${DataFormatter.formatCurrency(dispute.orderId?.totalAmount)}
                            </div>
                            <div class="mb-2">
                                <strong>Status:</strong> ${DataFormatter.formatStatus(dispute.orderId?.status)}
                            </div>
                            <div class="mb-2">
                                <strong>Created:</strong> ${DataFormatter.formatDate(dispute.orderId?.createdAt)}
                            </div>
                        </div>
                    </div>

                    ${dispute.status !== 'resolved' ? `
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-tools me-2"></i>Actions</h5>
                            </div>
                            <div class="card-body">
                                ${dispute.status === 'assigned' ? `
                                    <button class="btn btn-primary w-100 mb-2" onclick="dashboard.startReview('${dispute.disputeId}')">
                                        <i class="fas fa-play me-1"></i>Start Review
                                </button>
                                ` : ''}
                                
                                ${dispute.status === 'under_review' ? `
                                    <div class="row mb-2">
                                        <div class="col-6">
                                            <button class="btn btn-success w-100" onclick="showResolveModal('${dispute.disputeId}')">
                                                <i class="fas fa-check me-1"></i>Resolve
                                </button>
                            </div>
                                        <div class="col-6">
                                            <button class="btn btn-warning w-100" onclick="showEscalateModal('${dispute.disputeId}')">
                                                <i class="fas fa-arrow-up me-1"></i>Escalate
                                            </button>
                        </div>
                                    </div>
                                    
                                    <div class="row mb-2">
                                        <div class="col-6">
                                            <button class="btn btn-info w-100" onclick="showRequestInfoModal('${dispute.disputeId}')">
                                                <i class="fas fa-question me-1"></i>Request Info
                                            </button>
                                        </div>
                                        <div class="col-6">
                                            <button class="btn btn-secondary w-100" onclick="showPriorityModal('${dispute.disputeId}')">
                                                <i class="fas fa-flag me-1"></i>Priority
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <button class="btn btn-outline-primary w-100 mb-2" onclick="dashboard.showInternalNotesModal('${dispute.disputeId}')">
                                        <i class="fas fa-sticky-note me-1"></i>Internal Notes
                                    </button>
                                ` : ''}
                                
                                <button class="btn btn-outline-success w-100" onclick="dashboard.showContactModal('${dispute.disputeId}')">
                                    <i class="fas fa-comment me-1"></i>Contact Parties
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.getElementById('disputeModalContent').innerHTML = html;
        new bootstrap.Modal(document.getElementById('disputeModal')).show();
    }

    renderMessages(messages) {
        if (!messages || messages.length === 0) {
            return '<div class="text-center text-muted">No messages yet</div>';
        }

        return messages.map(message => `
            <div class="message-bubble ${message.sender.userType === 'Admin' ? 'message-sent' : 'message-received'} ${message.isInternal ? 'message-internal' : ''}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${message.sender.userId?.fullName || message.sender.userType}</strong>
                        <div>${message.message}</div>
                    </div>
                    <small class="text-muted">${new Date(message.createdAt).toLocaleString()}</small>
                </div>
            </div>
        `).join('');
    }

    async sendMessage() {
        const messageInput = document.getElementById('newMessage');
        const message = messageInput.value.trim();
        
        if (!message) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDispute.disputeId}/message`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            messageInput.value = '';
            await this.viewDispute(this.currentDispute.disputeId);

        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    showResolveModal(disputeId) {
        console.log('🔍 showResolveModal called with disputeId:', disputeId);
        this.currentDisputeId = disputeId;
        console.log('🔍 currentDisputeId set to:', this.currentDisputeId);
        console.log('🔍 Dashboard object currentDisputeId:', this.currentDisputeId);
        new bootstrap.Modal(document.getElementById('resolveModal')).show();
    }

    async submitResolution() {
        console.log('🔍 submitResolution called');
        console.log('🔍 currentDisputeId:', this.currentDisputeId);
        
        const resolution = document.getElementById('resolutionDecision').value;
        const reason = document.getElementById('resolutionReason').value;
        const notes = document.getElementById('resolutionNotes').value;

        console.log('🔍 Resolution:', resolution);
        console.log('🔍 Reason:', reason);
        console.log('🔍 Notes:', notes);

        if (!resolution) {
            this.showError('Please select a resolution decision');
            return;
        }

        if (!this.currentDisputeId) {
            console.error('❌ No dispute selected - currentDisputeId is:', this.currentDisputeId);
            this.showError('No dispute selected');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/resolve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resolution,
                    reason,
                    notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to resolve dispute');
            }

            bootstrap.Modal.getInstance(document.getElementById('resolveModal')).hide();
            this.showSuccess('Dispute resolved successfully');
            
            // Refresh current view
            if (document.getElementById('myDisputesView').style.display !== 'none') {
                await this.loadMyDisputes();
            }
            await this.loadDashboard();

        } catch (error) {
            console.error('Error resolving dispute:', error);
            this.showError('Failed to resolve dispute');
        }
    }

    showAssignModal(disputeId) {
        this.currentDisputeId = disputeId;
        this.loadStaffForAssignment();
        new bootstrap.Modal(document.getElementById('assignModal')).show();
    }

    async loadStaffForAssignment() {
        try {
            const response = await fetch('/api/admin/staff/available', {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load staff');
            }

            const data = await response.json();
            const select = document.getElementById('assignToStaff');
            
            select.innerHTML = '<option value="">Select Staff Member</option>';
            data.data.forEach(staff => {
                const option = document.createElement('option');
                option.value = staff._id;
                option.textContent = `${staff.fullName} (${staff.role}) - ${staff.activityStats?.currentDisputes?.length || 0}/${staff.maxConcurrentDisputes}`;
                select.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading staff:', error);
            this.showError('Failed to load staff members');
        }
    }

    async submitAssignment() {
        const assignedTo = document.getElementById('assignToStaff').value;
        const notes = document.getElementById('assignNotes').value;

        if (!assignedTo) {
            this.showError('Please select a staff member');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/assign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assignedTo,
                    notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to assign dispute');
            }

            bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
            this.showSuccess('Dispute assigned successfully');
            
            // Refresh available disputes
            await this.loadAvailableDisputes();

        } catch (error) {
            console.error('Error assigning dispute:', error);
            this.showError('Failed to assign dispute');
        }
    }

    async updateStatus(disputeId, status) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${disputeId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('Failed to update status');
            }

            this.showSuccess('Status updated successfully');
            await this.viewDispute(disputeId);

        } catch (error) {
            console.error('Error updating status:', error);
            this.showError('Failed to update status');
        }
    }

    // Start Review Action
    async startReview(disputeId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${disputeId}/start-review`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to start review');
            }

            this.showSuccess('Review started successfully');
            await this.loadMyDisputes();
            await this.viewDispute(disputeId);

        } catch (error) {
            console.error('Error starting review:', error);
            this.showError('Failed to start review');
        }
    }

    // Show Escalate Modal
    showEscalateModal(disputeId) {
        console.log('🔍 showEscalateModal called with disputeId:', disputeId);
        this.currentDisputeId = disputeId;
        console.log('🔍 currentDisputeId set to:', this.currentDisputeId);
        new bootstrap.Modal(document.getElementById('escalateModal')).show();
    }

    async submitEscalation() {
        console.log('🔍 submitEscalation called');
        console.log('🔍 currentDisputeId:', this.currentDisputeId);
        
        const reason = document.getElementById('escalationReason').value;
        const notes = document.getElementById('escalationNotes').value;

        console.log('🔍 Escalation Reason:', reason);
        console.log('🔍 Escalation Notes:', notes);

        if (!reason) {
            this.showError('Please select an escalation reason');
            return;
        }

        if (!this.currentDisputeId) {
            console.error('❌ No dispute selected - currentDisputeId is:', this.currentDisputeId);
            this.showError('No dispute selected');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/escalate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason,
                    priority: 'high', // Escalated disputes are always high priority
                    notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to escalate dispute');
            }

            const result = await response.json();
            console.log('✅ Escalation successful:', result);

            // Close modal
            const modalElement = document.getElementById('escalateModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();

            // Show success message
            this.showSuccess('Dispute escalated successfully');

            // Refresh the dispute list
            await this.loadMyDisputes();

        } catch (error) {
            console.error('❌ Escalation error:', error);
            this.showError('Failed to escalate dispute');
        }
    }


    // Show Request Info Modal
    showRequestInfoModal(disputeId) {
        console.log('🔍 showRequestInfoModal called with disputeId:', disputeId);
        this.currentDisputeId = disputeId;
        console.log('🔍 currentDisputeId set to:', this.currentDisputeId);
        new bootstrap.Modal(document.getElementById('requestInfoModal')).show();
    }

    async submitRequestInfo() {
        console.log('🔍 submitRequestInfo called');
        console.log('🔍 currentDisputeId:', this.currentDisputeId);
        
        const requestType = document.getElementById('requestType').value;
        const message = document.getElementById('requestMessage').value;
        const dueDate = document.getElementById('requestDueDate').value;

        console.log('🔍 Request Type:', requestType);
        console.log('🔍 Message:', message);
        console.log('🔍 Due Date:', dueDate);

        if (!requestType || !message) {
            this.showError('Please select request type and enter message');
            return;
        }

        if (!this.currentDisputeId) {
            console.error('❌ No dispute selected - currentDisputeId is:', this.currentDisputeId);
            this.showError('No dispute selected');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/request-info`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requestType,
                    message,
                    dueDate: dueDate || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send information request');
            }

            const result = await response.json();
            console.log('✅ Request info successful:', result);

            // Close modal
            const modalElement = document.getElementById('requestInfoModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();

            // Show success message
            this.showSuccess('Information request sent successfully');

            // Refresh the dispute list
            await this.loadMyDisputes();

        } catch (error) {
            console.error('❌ Request info error:', error);
            this.showError('Failed to send information request');
        }
    }


    // Show Priority Modal
    showPriorityModal(disputeId) {
        console.log('🔍 showPriorityModal called with disputeId:', disputeId);
        this.currentDisputeId = disputeId;
        console.log('🔍 currentDisputeId set to:', this.currentDisputeId);
        new bootstrap.Modal(document.getElementById('priorityModal')).show();
    }

    // Submit Priority Change
    async submitPriorityChange() {
        console.log('🔍 submitPriorityChange called');
        console.log('🔍 currentDisputeId:', this.currentDisputeId);
        
        const priority = document.getElementById('newPriority').value;
        const reason = document.getElementById('priorityReason').value;

        console.log('🔍 Priority:', priority);
        console.log('🔍 Reason:', reason);

        if (!priority) {
            this.showError('Please select a priority level');
            return;
        }

        if (!this.currentDisputeId) {
            console.error('❌ No dispute selected - currentDisputeId is:', this.currentDisputeId);
            this.showError('No dispute selected');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/priority`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    priority, 
                    reason: reason || '' 
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update priority');
            }

            const result = await response.json();
            console.log('✅ Priority update successful:', result);

            // Close modal
            const modalElement = document.getElementById('priorityModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();

            // Show success message
            this.showSuccess('Priority updated successfully');

            // Refresh the dispute list
            await this.loadMyDisputes();

        } catch (error) {
            console.error('❌ Priority update error:', error);
            this.showError('Failed to update priority');
        }
    }

    // Show Internal Notes Modal
    showInternalNotesModal(disputeId) {
        console.log('🔍 showInternalNotesModal called with disputeId:', disputeId);
        this.currentDisputeId = disputeId;
        console.log('🔍 currentDisputeId set to:', this.currentDisputeId);
        new bootstrap.Modal(document.getElementById('internalNotesModal')).show();
        
        // Load existing notes
        this.loadInternalNotes(disputeId);
    }

    // Load Internal Notes
    async loadInternalNotes(disputeId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${disputeId}/internal-notes`, {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderInternalNotes(data.data.notes || []);
            }
        } catch (error) {
            console.error('Error loading internal notes:', error);
        }
    }

    // Render Internal Notes
    renderInternalNotes(notes) {
        const container = document.getElementById('internalNotesList');
        
        if (notes.length === 0) {
            container.innerHTML = '<div class="text-muted">No internal notes yet</div>';
            return;
        }

        const html = notes.map(note => `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${note.addedBy?.fullName || 'Staff'}</strong>
                            <div>${note.note}</div>
                        </div>
                        <small class="text-muted">${new Date(note.createdAt).toLocaleString()}</small>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Add Internal Note
    async addInternalNote() {
        console.log('🔍 addInternalNote called');
        console.log('🔍 currentDisputeId:', this.currentDisputeId);
        
        const note = document.getElementById('newInternalNote').value.trim();

        console.log('🔍 Note:', note);

        if (!note) {
            this.showError('Please enter a note');
            return;
        }

        if (!this.currentDisputeId) {
            console.error('❌ No dispute selected - currentDisputeId is:', this.currentDisputeId);
            this.showError('No dispute selected');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/internal-notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ note })
            });

            if (!response.ok) {
                throw new Error('Failed to add note');
            }

            const result = await response.json();
            console.log('✅ Note added successfully:', result);

            document.getElementById('newInternalNote').value = '';
            await this.loadInternalNotes(this.currentDisputeId);
            this.showSuccess('Internal note added successfully');

        } catch (error) {
            console.error('❌ Error adding note:', error);
            this.showError('Failed to add note');
        }
    }

    // Show Contact Modal
    showContactModal(disputeId) {
        console.log('🔍 showContactModal called with disputeId:', disputeId);
        this.currentDisputeId = disputeId;
        console.log('🔍 currentDisputeId set to:', this.currentDisputeId);
        new bootstrap.Modal(document.getElementById('contactModal')).show();
    }

    // Send Contact Message
    async sendContactMessage() {
        console.log('🔍 sendContactMessage called');
        console.log('🔍 currentDisputeId:', this.currentDisputeId);
        
        const contactType = document.getElementById('contactRecipient').value;
        const message = document.getElementById('contactMessage').value;
        const isInternal = document.getElementById('internalMessage').checked;

        console.log('🔍 Contact Type:', contactType);
        console.log('🔍 Message:', message);
        console.log('🔍 Is Internal:', isInternal);

        if (!message.trim()) {
            this.showError('Please enter a message');
            return;
        }

        if (!this.currentDisputeId) {
            console.error('❌ No dispute selected - currentDisputeId is:', this.currentDisputeId);
            this.showError('No dispute selected');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/disputes/${this.currentDisputeId}/contact`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contactType, message, isInternal })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const result = await response.json();
            console.log('✅ Message sent successfully:', result);

            // Close modal
            const modalElement = document.getElementById('contactModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();

            // Show success message
            this.showSuccess('Message sent successfully');

            // Refresh the dispute list
            await this.loadMyDisputes();

        } catch (error) {
            console.error('❌ Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    // Navigation functions
    showDashboard() {
        this.hideAllViews();
        document.getElementById('dashboardView').style.display = 'block';
        document.querySelector('.nav-link[href="#"]').classList.remove('active');
        document.querySelector('.nav-link[onclick="showDashboard()"]').classList.add('active');
        this.loadDashboard();
    }

    showMyDisputes() {
        this.hideAllViews();
        document.getElementById('myDisputesView').style.display = 'block';
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        // Add active class to current button
        const currentBtn = document.querySelector('button[onclick="showMyDisputes()"]');
        if (currentBtn) currentBtn.classList.add('active');
        this.loadMyDisputes();
    }

    showAvailableDisputes() {
        this.hideAllViews();
        document.getElementById('availableDisputesView').style.display = 'block';
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        // Add active class to current button
        const currentBtn = document.querySelector('button[onclick="showAvailableDisputes()"]');
        if (currentBtn) currentBtn.classList.add('active');
        this.loadAvailableDisputes();
    }

    showAnalytics() {
        this.hideAllViews();
        document.getElementById('analyticsView').style.display = 'block';
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        // Add active class to current button
        const currentBtn = document.querySelector('button[onclick="showAnalytics()"]');
        if (currentBtn) currentBtn.classList.add('active');
        this.loadAnalytics();
    }

    showMySupportTickets() {
        this.hideAllViews();
        document.getElementById('mySupportTicketsView').style.display = 'block';
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        // Add active class to current button
        const currentBtn = document.querySelector('button[onclick="showMySupportTickets()"]');
        if (currentBtn) currentBtn.classList.add('active');
        this.loadMySupportTickets();
    }

    showAvailableSupportTickets() {
        this.hideAllViews();
        document.getElementById('availableSupportTicketsView').style.display = 'block';
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        // Add active class to current button
        const currentBtn = document.querySelector('button[onclick="showAvailableSupportTickets()"]');
        if (currentBtn) currentBtn.classList.add('active');
        this.loadAvailableSupportTickets();
    }

    showSettings() {
        this.showError('Settings feature coming soon!');
    }

    hideAllViews() {
        document.getElementById('dashboardView').style.display = 'none';
        document.getElementById('myDisputesView').style.display = 'none';
        document.getElementById('availableDisputesView').style.display = 'none';
        document.getElementById('mySupportTicketsView').style.display = 'none';
        document.getElementById('availableSupportTicketsView').style.display = 'none';
        document.getElementById('analyticsView').style.display = 'none';
    }

    setupRealTimeUpdates() {
        // Initialize Socket.IO connection
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            // Listen for support ticket notifications
            this.socket.on('new-notification', (notification) => {
                this.handleNotification(notification);
            });
            
            // Listen for support ticket updates
            this.socket.on('support-ticket-updated', (data) => {
                this.handleSupportTicketUpdate(data);
            });
            
            // Listen for new support tickets
            this.socket.on('new-support-ticket', (data) => {
                this.handleNewSupportTicket(data);
            });
            
            // Listen for support ticket messages
            this.socket.on('support-ticket-message', (data) => {
                this.handleSupportTicketMessage(data);
            });
            
            // Listen for support ticket status updates
            this.socket.on('support-ticket-status-updated', (data) => {
                this.handleSupportTicketStatusUpdate(data);
            });
            
            console.log('✅ Real-time updates initialized');
        } else {
            console.warn('⚠️ Socket.IO not available');
        }
    }

    handleNotification(notification) {
        // Show notification toast
        this.showNotificationToast(notification.title, notification.message);
        
        // Update relevant sections if needed
        if (notification.notificationType === 'NEW_SUPPORT_TICKET') {
            this.loadAvailableSupportTickets();
        } else if (notification.notificationType === 'TICKET_ASSIGNED') {
            this.loadMySupportTickets();
            this.loadAvailableSupportTickets();
        }
    }

    handleSupportTicketUpdate(data) {
        // Refresh support ticket lists
        this.loadMySupportTickets();
        this.loadAvailableSupportTickets();
        
        // Show update notification
        this.showNotificationToast('Support Ticket Updated', `Ticket ${data.ticketNumber} has been updated`);
    }

    handleNewSupportTicket(data) {
        // Refresh available support tickets
        this.loadAvailableSupportTickets();
        
        // Show new ticket notification
        this.showNotificationToast('New Support Ticket', `New ${data.category} ticket: ${data.ticketNumber}`);
    }

    handleSupportTicketMessage(data) {
        // If we're currently viewing this ticket, add the message to the chat
        const currentTicketId = this.currentSupportTicketId;
        if (currentTicketId && currentTicketId === data.ticketId) {
            // Add the new message to the chat
            this.addMessageToChat(data.message);
        }
        
        // Show notification for new messages
        if (data.senderType !== 'Staff') {
            this.showNotificationToast('New Support Message', `New message in ticket ${data.ticketNumber}`);
        }
    }

    handleSupportTicketStatusUpdate(data) {
        // Refresh support ticket lists
        this.loadMySupportTickets();
        this.loadAvailableSupportTickets();
        
        // Show status update notification
        this.showNotificationToast('Ticket Status Updated', `Ticket ${data.ticketNumber} status updated to ${data.status}`);
    }

    addMessageToChat(message) {
        const messagesContainer = document.getElementById(`chatMessages-${this.currentSupportTicketId}`);
        if (!messagesContainer) return;

        // Remove "no messages" if it exists
        const noMessages = messagesContainer.querySelector('.no-messages');
        if (noMessages) {
            noMessages.remove();
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.innerHTML = this.renderSupportTicketMessage(this.currentSupportTicketId, [message]);
        
        // Append to messages container
        messagesContainer.appendChild(messageElement.firstElementChild);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    // Utility functions
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    redirectToLogin() {
        window.location.href = '/staff-login.html';
    }

    setupRealTimeUpdates() {
        // Set up periodic refresh for dashboard
        setInterval(() => {
            if (document.getElementById('dashboardView').style.display !== 'none') {
                this.loadDashboard();
            }
        }, 30000); // Refresh every 30 seconds
    }

    async refreshDashboard() {
        await this.loadDashboard();
        this.showSuccess('Dashboard refreshed');
    }

    filterDisputes() {
        this.loadMyDisputes();
    }

    filterAvailableDisputes() {
        this.loadAvailableDisputes();
    }
}

// Global functions for onclick handlers
function showDashboard() { 
    if (dashboard) dashboard.showDashboard(); 
    else console.error('Dashboard not initialized yet');
}
function showMyDisputes() { 
    if (dashboard) dashboard.showMyDisputes(); 
    else console.error('Dashboard not initialized yet');
}
function showAvailableDisputes() { 
    if (dashboard) dashboard.showAvailableDisputes(); 
    else console.error('Dashboard not initialized yet');
}
function showMySupportTickets() { 
    if (dashboard) dashboard.showMySupportTickets(); 
    else console.error('Dashboard not initialized yet');
}
function showAvailableSupportTickets() { 
    if (dashboard) dashboard.showAvailableSupportTickets(); 
    else console.error('Dashboard not initialized yet');
}
function showAnalytics() { 
    if (dashboard) dashboard.showAnalytics(); 
    else console.error('Dashboard not initialized yet');
}
function showSettings() { 
    if (dashboard) dashboard.showSettings(); 
    else console.error('Dashboard not initialized yet');
}
function refreshDashboard() { 
    if (dashboard) dashboard.refreshDashboard(); 
    else console.error('Dashboard not initialized yet');
}
function filterDisputes() { 
    if (dashboard) dashboard.filterDisputes(); 
    else console.error('Dashboard not initialized yet');
}
function filterAvailableDisputes() { 
    if (dashboard) dashboard.filterAvailableDisputes(); 
    else console.error('Dashboard not initialized yet');
}
function loadMyDisputes() { 
    if (dashboard) dashboard.loadMyDisputes(); 
    else console.error('Dashboard not initialized yet');
}
function loadAvailableDisputes() { 
    if (dashboard) dashboard.loadAvailableDisputes(); 
    else console.error('Dashboard not initialized yet');
}
function loadMySupportTickets() { 
    if (dashboard) dashboard.loadMySupportTickets(); 
    else console.error('Dashboard not initialized yet');
}
function loadAvailableSupportTickets() { 
    if (dashboard) dashboard.loadAvailableSupportTickets(); 
    else console.error('Dashboard not initialized yet');
}
function loadAnalytics() { 
    if (dashboard) dashboard.loadAnalytics(); 
    else console.error('Dashboard not initialized yet');
}
function submitResolution() { 
    if (dashboard) dashboard.submitResolution(); 
    else console.error('Dashboard not initialized yet');
}
function submitAssignment() { 
    if (dashboard) dashboard.submitAssignment(); 
    else console.error('Dashboard not initialized yet');
}

function logout() {
    localStorage.removeItem('staff-token');
    window.location.href = '/staff-login.html';
}

// Global functions for onclick handlers
function viewDispute(disputeId) {
    if (dashboard) {
        dashboard.viewDispute(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function startReview(disputeId) {
    if (dashboard) {
        dashboard.startReview(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function showResolveModal(disputeId) {
    console.log('🔍 Global showResolveModal called with disputeId:', disputeId);
    console.log('🔍 Dashboard object exists:', !!dashboard);
    if (dashboard) {
        console.log('🔍 Calling dashboard.showResolveModal');
        dashboard.showResolveModal(disputeId);
    } else {
        console.error('❌ Dashboard not initialized');
    }
}

function showEscalateModal(disputeId) {
    if (dashboard) {
        dashboard.showEscalateModal(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function showRequestInfoModal(disputeId) {
    if (dashboard) {
        dashboard.showRequestInfoModal(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function showPriorityModal(disputeId) {
    if (dashboard) {
        dashboard.showPriorityModal(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function showInternalNotesModal(disputeId) {
    if (dashboard) {
        dashboard.showInternalNotesModal(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function showContactModal(disputeId) {
    if (dashboard) {
        dashboard.showContactModal(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

// Additional global functions for modal actions
function submitResolution() {
    console.log('🔍 Global submitResolution called');
    console.log('🔍 Dashboard object exists:', !!dashboard);
    if (dashboard) {
        console.log('🔍 Dashboard currentDisputeId:', dashboard.currentDisputeId);
        dashboard.submitResolution();
    } else {
        console.error('Dashboard not initialized');
    }
}

function submitEscalation() {
    if (dashboard) {
        dashboard.submitEscalation();
    } else {
        console.error('Dashboard not initialized');
    }
}

function submitRequestInfo() {
    if (dashboard) {
        dashboard.submitRequestInfo();
    } else {
        console.error('Dashboard not initialized');
    }
}

function submitPriorityChange() {
    if (dashboard) {
        dashboard.submitPriorityChange();
    } else {
        console.error('Dashboard not initialized');
    }
}

function addInternalNote() {
    if (dashboard) {
        dashboard.addInternalNote();
    } else {
        console.error('Dashboard not initialized');
    }
}

function showEscalateModal(disputeId) {
    if (dashboard) {
        dashboard.showEscalateModal(disputeId);
    } else {
        console.error('Dashboard not initialized');
    }
}

function submitResolution() {
    if (dashboard) {
        dashboard.submitResolution();
    } else {
        console.error('Dashboard not initialized');
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new StaffDisputeDashboard();
});
