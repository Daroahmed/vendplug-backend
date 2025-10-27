// Admin Dashboard JavaScript

// Token validation utility
function validateToken() {
    const token = localStorage.getItem('vendplug-admin-token');
    if (!token) {
        console.error('❌ No admin token found');
        return false;
    }
    
    try {
        // Basic JWT structure validation
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error('❌ Invalid JWT structure');
            localStorage.removeItem('vendplug-admin-token');
            return false;
        }
        
        // Check if token is expired (basic check)
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            console.error('❌ Token expired');
            localStorage.removeItem('vendplug-admin-token');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Token validation error:', error);
        localStorage.removeItem('vendplug-admin-token');
        return false;
    }
}

// Ad Type and Position Validation
function validateAdTypePosition(adType, adPosition) {
    const validCombinations = {
        'banner': ['hero', 'top', 'middle', 'bottom', 'sidebar'],
        'carousel': ['hero', 'top', 'middle', 'bottom'],
        'inline': ['middle', 'bottom'],
        'popup': ['popup']
    };
    
    const validPositions = validCombinations[adType];
    
    if (!validPositions) {
        alert(`Invalid ad type: ${adType}`);
        return false;
    }
    
    if (!validPositions.includes(adPosition)) {
        const validPositionsText = validPositions.join(', ');
        alert(`Invalid position "${adPosition}" for ad type "${adType}".\n\nValid positions for ${adType} ads are: ${validPositionsText}`);
        return false;
    }
    
    return true;
}

class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.adminToken = localStorage.getItem('vendplug-admin-token');
        this.currentPage = {
            users: 1,
            orders: 1,
            payouts: 1,
            disputes: 1,
            supportTickets: 1
        };
        this.currentLimit = 20;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing admin dashboard...');
        this.setupEventListeners();
        this.checkAuth();
        
        // Show dashboard section by default
        this.showSection('dashboard');
        
        // Load dashboard data
        this.loadDashboardData();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (section && section !== 'logout') {
                    this.showSection(section);
                }
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Search and filter events
        document.getElementById('userSearch')?.addEventListener('input', this.debounce(() => this.searchUsers(), 500));
        document.getElementById('orderSearch')?.addEventListener('input', this.debounce(() => this.searchOrders(), 500));
        
        // Ad type and position synchronization
        document.getElementById('adType')?.addEventListener('change', this.updatePositionOptions.bind(this));
    }

    updatePositionOptions() {
        const adTypeSelect = document.getElementById('adType');
        const adPositionSelect = document.getElementById('adPosition');
        
        if (!adTypeSelect || !adPositionSelect) return;
        
        const selectedType = adTypeSelect.value;
        const validCombinations = {
            'banner': ['hero', 'top', 'middle', 'bottom', 'sidebar'],
            'carousel': ['hero', 'top', 'middle', 'bottom'],
            'inline': ['middle', 'bottom'],
            'popup': ['popup']
        };
        
        // Clear existing options
        adPositionSelect.innerHTML = '<option value="">Select Position</option>';
        
        // Add valid positions for selected type
        if (selectedType && validCombinations[selectedType]) {
            const validPositions = validCombinations[selectedType];
            validPositions.forEach(position => {
                const option = document.createElement('option');
                option.value = position;
                option.textContent = this.getPositionDisplayName(position);
                adPositionSelect.appendChild(option);
            });
        } else {
            // If no type selected, show all positions
            const allPositions = ['hero', 'top', 'middle', 'bottom', 'sidebar', 'popup'];
            allPositions.forEach(position => {
                const option = document.createElement('option');
                option.value = position;
                option.textContent = this.getPositionDisplayName(position);
                adPositionSelect.appendChild(option);
            });
        }
    }

    getPositionDisplayName(position) {
        const displayNames = {
            'hero': 'Hero Section',
            'top': 'Top',
            'middle': 'Middle',
            'bottom': 'Bottom',
            'sidebar': 'Sidebar',
            'popup': 'Popup'
        };
        return displayNames[position] || position;
    }

    checkAuth() {
        console.log('🔐 Checking authentication...');
        
        if (!isAuthenticated()) {
            console.log('❌ User not authenticated - redirecting to login');
            redirectToLogin();
            return;
        }

        // Check if user is admin
        const userType = getCurrentUserType();
        console.log('👤 User type:', userType);
        
        if (userType !== 'admin') {
            console.error('❌ Access denied: User is not admin, userType:', userType);
            alert('Access denied. This page is only for administrators.');
            // Redirect to appropriate dashboard based on user type
            if (userType === 'buyer') {
                window.location.href = 'buyer-home.html';
            } else if (userType === 'vendor') {
                window.location.href = 'vendor-dashboard.html';
            } else if (userType === 'agent') {
                window.location.href = 'agent-dashboard.html';
            } else if (userType === 'staff') {
                window.location.href = 'staff-dispute-dashboard.html';
            } else {
                redirectToLogin();
            }
            return;
        }

        console.log('✅ Admin authentication successful');

        // Clean up conflicting tokens after successful admin authentication
        if (typeof cleanupAfterLogin === 'function') {
            cleanupAfterLogin('admin');
        }
    }

    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            console.log('🔑 Admin token:', this.adminToken ? 'Present' : 'Missing');
            
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);

            if (!response.ok) {
                if (response.status === 401) {
                    console.log('❌ Unauthorized - redirecting to login');
                    this.logout();
                    return;
                }
                throw new Error(`Failed to load dashboard data: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 Dashboard data received:', data);
            console.log('📊 Counts data:', data.data?.counts);
            console.log('📊 Financial data:', data.data?.financial);
            
            if (data.data) {
                this.updateDashboardCards(data.data.counts);
                this.updateFinancialSummary(data.data.financial);
                this.updateRecentOrders(data.data.recentOrders);
                this.updateRecentTransactions(data.data.recentTransactions);
                console.log('✅ Dashboard data updated successfully');
            } else {
                console.warn('⚠️ No data in response');
            }

        } catch (error) {
            console.error('❌ Dashboard data error:', error);
            this.showError('Failed to load dashboard data: ' + error.message);
        }
    }

    async applyGlobalFilter() {
        try {
            const dateFrom = document.getElementById('dashboardDateFrom').value;
            const dateTo = document.getElementById('dashboardDateTo').value;

            const params = new URLSearchParams();
            if (dateFrom) params.append('startDate', dateFrom);
            if (dateTo) params.append('endDate', dateTo);

            const response = await fetch(`/api/admin/dashboard?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                throw new Error('Failed to load filtered dashboard data');
            }

            const data = await response.json();
            this.updateDashboardCards(data.data.counts);
            this.updateFinancialSummary(data.data.financial);
            this.updateRecentOrders(data.data.recentOrders);
            this.updateRecentTransactions(data.data.recentTransactions);

            // Show filter status
            const filterStatus = document.createElement('div');
            filterStatus.className = 'alert alert-info';
            filterStatus.style.marginTop = '10px';
            filterStatus.innerHTML = `
                <strong>Filter Applied:</strong> 
                ${dateFrom ? `From ${dateFrom}` : 'All time'} 
                ${dateTo ? `to ${dateTo}` : ''}
                <button type="button" class="btn-close" onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px;">&times;</button>
            `;
            
            // Remove existing filter status
            const existingStatus = document.querySelector('.alert-info');
            if (existingStatus) existingStatus.remove();
            
            // Add new filter status
            const filterContainer = document.querySelector('.filters');
            filterContainer.appendChild(filterStatus);

        } catch (error) {
            console.error('❌ Global filter error:', error);
            this.showError('Failed to apply filter');
        }
    }

    clearGlobalFilter() {
        document.getElementById('dashboardDateFrom').value = '';
        document.getElementById('dashboardDateTo').value = '';
        
        // Remove filter status
        const existingStatus = document.querySelector('.alert-info');
        if (existingStatus) existingStatus.remove();
        
        // Reload dashboard with no filters
        this.loadDashboardData();
    }

    updateFinancialSummary(financial) {
        console.log('💰 Updating financial summary with data:', financial);
        if (!financial) return;
        
        // Format currency with Nigerian Naira symbol
        const formatCurrency = (amount) => {
            return new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        };
        
        // Update financial summary elements
        const totalTransactionElement = document.getElementById('totalTransactionAmount');
        if (totalTransactionElement) {
            totalTransactionElement.textContent = formatCurrency(financial.totalTransactionAmount);
        }
        
        const totalOrderElement = document.getElementById('totalOrderAmount');
        if (totalOrderElement) {
            totalOrderElement.textContent = formatCurrency(financial.totalOrderAmount);
        }
        
        const totalPayoutElement = document.getElementById('totalPayoutAmount');
        if (totalPayoutElement) {
            totalPayoutElement.textContent = formatCurrency(financial.totalPayoutAmount);
        }
        
        const netRevenueElement = document.getElementById('netRevenue');
        if (netRevenueElement) {
            netRevenueElement.textContent = formatCurrency(financial.netRevenue);
            
            // Color code based on positive/negative revenue
            if (financial.netRevenue >= 0) {
                netRevenueElement.style.color = '#4ade80'; // Green for positive
            } else {
                netRevenueElement.style.color = '#f87171'; // Red for negative
            }
        }
    }

    updateDashboardCards(counts) {
        console.log('🔢 Updating dashboard cards with counts:', counts);
        document.getElementById('totalUsers').textContent = counts.totalBuyers + counts.totalVendors + counts.totalAgents;
        document.getElementById('totalOrders').textContent = counts.totalOrders;
        document.getElementById('pendingPayouts').textContent = counts.pendingPayouts;
        document.getElementById('processingPayouts').textContent = counts.processingPayouts;
        document.getElementById('openDisputes').textContent = counts.openDisputes || 0;
        document.getElementById('underReviewDisputes').textContent = counts.underReviewDisputes || 0;
        
        // Update assigned disputes if the element exists
        const assignedDisputesElement = document.getElementById('assignedDisputes');
        if (assignedDisputesElement) {
            assignedDisputesElement.textContent = counts.assignedDisputes || 0;
        }
        
        // Update escalated disputes
        const escalatedDisputesElement = document.getElementById('escalatedDisputes');
        if (escalatedDisputesElement) {
            escalatedDisputesElement.textContent = counts.escalatedDisputes || 0;
        }
        
        // Update resolved disputes
        const resolvedDisputesElement = document.getElementById('resolvedDisputes');
        if (resolvedDisputesElement) {
            resolvedDisputesElement.textContent = counts.resolvedDisputes || 0;
        }
        
        // Update total disputes
        const totalDisputesElement = document.getElementById('totalDisputes');
        if (totalDisputesElement) {
            totalDisputesElement.textContent = counts.totalDisputes || 0;
        }
        
        // Update support tickets
        const totalSupportTicketsElement = document.getElementById('totalSupportTickets');
        if (totalSupportTicketsElement) {
            totalSupportTicketsElement.textContent = counts.totalSupportTickets || 0;
        }
    }

    updateRecentOrders(orders) {
        console.log('📋 Updating recent orders:', orders);
        const container = document.getElementById('recentOrders');
        
        if (!container) {
            console.error('❌ Recent orders container not found');
            return;
        }
        
        if (!orders || orders.length === 0) {
            console.log('📋 No recent orders to display');
            container.innerHTML = '<p>No recent orders</p>';
            return;
        }

        console.log('📋 Rendering recent orders:', orders.length);
        
        try {
            const ordersHTML = orders.map(order => `
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: 600;">${DataFormatter.formatOrderId(order.orderId)}</div>
                    <div style="font-size: 0.9rem; color: #666;">
                        ${DataFormatter.formatUserName(order.buyer)} → ${DataFormatter.formatUserName(order.vendor, 'Unknown Vendor')}
                    </div>
                    <div style="font-size: 0.8rem; color: #999;">
                        ${DataFormatter.formatDate(order.createdAt)} - ${DataFormatter.formatStatus(order.status)}
                    </div>
                </div>
            `).join('');

            container.innerHTML = ordersHTML;
            console.log('✅ Recent orders updated successfully');
        } catch (error) {
            console.error('❌ Error rendering recent orders:', error);
            container.innerHTML = '<p>Error loading recent orders</p>';
        }
    }

    updateRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<p>No recent transactions</p>';
            return;
        }

        const transactionsHTML = transactions.map(transaction => `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <div style="font-weight: 600;">₦${transaction.amount?.toLocaleString()}</div>
                <div style="font-size: 0.9rem; color: #666;">
                    ${transaction.initiatedBy?.fullName || transaction.initiatedBy?.shopName || 'Unknown'} - ${transaction.type}
                </div>
                <div style="font-size: 0.8rem; color: #999;">
                    ${new Date(transaction.createdAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');

        container.innerHTML = transactionsHTML;
    }

    showSection(section) {
        console.log('🔄 Showing section:', section);
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(s => {
            console.log('🔍 Hiding section:', s.id, 'current display:', s.style.display);
            s.style.display = 'none';
        });
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        // Show selected section
        const sectionElement = document.getElementById(`${section}-section`);
        const navLink = document.querySelector(`[data-section="${section}"]`);
        
        console.log('🔍 Looking for section element:', `${section}-section`);
        console.log('🔍 Found section element:', sectionElement);
        
        if (sectionElement) {
            sectionElement.style.display = 'block';
            console.log('✅ Section element found and shown:', section);
            console.log('🔍 Section element display after setting:', sectionElement.style.display);
            console.log('🔍 Section element computed style:', window.getComputedStyle(sectionElement).display);
        } else {
            console.error('❌ Section element not found:', `${section}-section`);
        }
        
        if (navLink) {
            navLink.classList.add('active');
            console.log('✅ Nav link found and activated:', section);
        } else {
            console.error('❌ Nav link not found:', `[data-section="${section}"]`);
        }

        this.currentSection = section;

        // Load section-specific data
        switch (section) {
            case 'users':
                this.loadUsers();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'payouts':
                this.loadPayouts();
                break;
            case 'disputes':
                this.loadDisputes();
                break;
            case 'support-tickets':
                this.loadSupportTickets();
                break;
            case 'escalated-disputes':
                this.loadEscalatedDisputes();
                break;
            case 'staff-activity':
                this.loadStaffActivity();
                break;
            case 'ad-management':
                this.loadAds();
                break;
            case 'notification-campaigns':
                this.loadCampaigns();
                break;
            case 'wallet-management':
                this.loadWalletManagement();
                break;
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(`/api/admin/users?page=${this.currentPage.users}&limit=${this.currentLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load users');

            const data = await response.json();
            this.displayUsers(data.data);

        } catch (error) {
            console.error('❌ Load users error:', error);
            this.showError('Failed to load users');
        }
    }

    async searchUsers() {
        const search = document.getElementById('userSearch').value;
        const role = document.getElementById('userRole').value;
        const status = document.getElementById('userStatus').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (search) params.append('search', search);
            if (role) params.append('role', role);
            if (status) params.append('status', status);

            const response = await fetch(`/api/admin/users?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search users');

            const data = await response.json();
            this.displayUsers(data.data);

        } catch (error) {
            console.error('❌ Search users error:', error);
            this.showError('Failed to search users');
        }
    }

    displayUsers(data) {
        const container = document.getElementById('usersTable');
        
        if (!data.users || data.users.length === 0) {
            container.innerHTML = '<p>No users found</p>';
            return;
        }

        const usersHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.users.map(user => `
                            <tr>
                                <td>${user.fullName}</td>
                                <td>${user.email}</td>
                                <td>${this.getUserRole(user)}</td>
                                <td>
                                    <span class="status-badge ${user.isActive ? 'status-completed' : 'status-failed'}">
                                        ${user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${user.isActive ? 
                                        `<button class="btn btn-warning" onclick="adminDashboard.suspendUser('${user._id}', '${this.getUserRole(user)}')">Suspend</button>` :
                                        `<button class="btn btn-success" onclick="adminDashboard.activateUser('${user._id}', '${this.getUserRole(user)}')">Activate</button>`
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'users')}
        `;

        container.innerHTML = usersHTML;
    }

    getUserRole(user) {
        // Use userType if available, otherwise fallback to field detection
        if (user.userType) {
            return user.userType.charAt(0).toUpperCase() + user.userType.slice(1);
        }
        if (user.shopName) return 'Vendor';
        if (user.agentCode) return 'Agent';
        return 'Buyer';
    }

    async suspendUser(userId, userType) {
        if (!confirm('Are you sure you want to suspend this user?')) return;

        try {
            const response = await fetch('/api/admin/users/status', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    userType,
                    action: 'suspend'
                })
            });

            if (!response.ok) throw new Error('Failed to suspend user');

            this.showSuccess('User suspended successfully');
            this.loadUsers();

        } catch (error) {
            console.error('❌ Suspend user error:', error);
            this.showError('Failed to suspend user');
        }
    }

    async activateUser(userId, userType) {
        if (!confirm('Are you sure you want to activate this user?')) return;

        try {
            const response = await fetch('/api/admin/users/status', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    userType,
                    action: 'activate'
                })
            });

            if (!response.ok) throw new Error('Failed to activate user');

            this.showSuccess('User activated successfully');
            this.loadUsers();

        } catch (error) {
            console.error('❌ Activate user error:', error);
            this.showError('Failed to activate user');
        }
    }

    async loadOrders() {
        try {
            const response = await fetch(`/api/admin/orders?page=${this.currentPage.orders}&limit=${this.currentLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load orders');

            const data = await response.json();
            this.displayOrders(data.data);

        } catch (error) {
            console.error('❌ Load orders error:', error);
            this.showError('Failed to load orders');
        }
    }

    async searchOrders() {
        const search = document.getElementById('orderSearch').value;
        const status = document.getElementById('orderStatus').value;
        const orderType = document.getElementById('orderType').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (search) params.append('search', search);
            if (status) params.append('status', status);
            if (orderType) params.append('orderType', orderType);

            const response = await fetch(`/api/admin/orders?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search orders');

            const data = await response.json();
            this.displayOrders(data.data);

        } catch (error) {
            console.error('❌ Search orders error:', error);
            this.showError('Failed to search orders');
        }
    }

    displayOrders(data) {
        const container = document.getElementById('ordersTable');
        
        if (!data.orders || data.orders.length === 0) {
            container.innerHTML = '<p>No orders found</p>';
            return;
        }

        const ordersHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Buyer</th>
                            <th>Vendor</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.orders.map(order => `
                            <tr>
                                <td>${DataFormatter.formatOrderId(order._id)}</td>
                                <td>${DataFormatter.formatUserName(order.buyer)}</td>
                                <td>${DataFormatter.formatUserName(order.vendor, 'Unknown Vendor')}</td>
                                <td>${DataFormatter.formatCurrency(order.totalAmount)}</td>
                                <td>
                                    <span class="status-badge ${DataFormatter.getStatusBadgeClass(order.status)}">
                                        ${DataFormatter.formatStatus(order.status)}
                                    </span>
                                </td>
                                <td>${order.agent ? 'Agent' : 'Vendor'}</td>
                                <td>${DataFormatter.formatDate(order.createdAt)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'orders')}
        `;

        container.innerHTML = ordersHTML;
    }

    async loadPayouts() {
        try {
            const response = await window.tokenManager.authenticatedFetch(`/api/admin/payouts?page=${this.currentPage.payouts}&limit=${this.currentLimit}`);

            if (!response.ok) throw new Error('Failed to load payouts');

            const data = await response.json();
            this.displayPayouts(data.data);

        } catch (error) {
            console.error('❌ Load payouts error:', error);
            this.showError('Failed to load payouts');
        }
    }

    async fixStuckProcessingPayouts() {
        if (!confirm('This will fix all stuck processing payouts. Continue?')) {
            return;
        }

        try {
            const response = await window.tokenManager.authenticatedFetch('/api/admin/payouts/fix-stuck-processing', {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to fix stuck processing payouts');

            const result = await response.json();
            this.showSuccess(result.message);
            this.loadPayouts(); // Refresh the payouts list

        } catch (error) {
            console.error('❌ Fix stuck processing payouts error:', error);
            this.showError('Failed to fix stuck processing payouts');
        }
    }

    async checkPayoutStatuses() {
        try {
            const response = await window.tokenManager.authenticatedFetch('/api/admin/payouts/check-statuses', {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to check payout statuses');

            const result = await response.json();
            this.showSuccess(result.message);
            this.loadPayouts(); // Refresh the payouts list

        } catch (error) {
            console.error('❌ Check payout statuses error:', error);
            this.showError('Failed to check payout statuses');
        }
    }

    async searchPayouts() {
        const status = document.getElementById('payoutStatus').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (status) params.append('status', status);

            const response = await fetch(`/api/admin/payouts?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search payouts');

            const data = await response.json();
            this.displayPayouts(data.data);

        } catch (error) {
            console.error('❌ Search payouts error:', error);
            this.showError('Failed to search payouts');
        }
    }

    displayPayouts(data) {
        const container = document.getElementById('payoutsTable');
        
        if (!data.payouts || data.payouts.length === 0) {
            container.innerHTML = '<p>No payouts found</p>';
            return;
        }

        const payoutsHTML = `
            <div style="margin-bottom: 20px; display: flex; gap: 10px;">
                <button class="btn btn-danger" onclick="adminDashboard.fixStuckProcessingPayouts()" style="background: #dc3545; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
                    🔧 Fix Stuck Processing Payouts
                </button>
                <button class="btn btn-info" onclick="adminDashboard.checkPayoutStatuses()" style="background: #17a2b8; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Check Payout Statuses
                </button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Bank Details</th>
                            <th>Amount</th>
                            <th>Net Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.payouts.map(payout => `
                            <tr>
                                <td>
                                    <div>${payout.userId?.fullName || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${payout.userId?.email || 'N/A'}</div>
                                </td>
                                <td>
                                    <div>${payout.bankAccountId?.bankName || 'N/A'}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${payout.bankAccountId?.accountNumber || 'N/A'}</div>
                                </td>
                                <td>₦${payout.amount?.toLocaleString()}</td>
                                <td>₦${payout.netAmount?.toLocaleString()}</td>
                                <td>
                                    <span class="status-badge status-${payout.status}">
                                        ${payout.status}
                                    </span>
                                </td>
                                <td>${new Date(payout.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${payout.status === 'pending' ? `
                                        <button class="btn btn-success" onclick="adminDashboard.approvePayout('${payout._id}')">Approve</button>
                                        <button class="btn btn-danger" onclick="adminDashboard.rejectPayout('${payout._id}')">Reject</button>
                                    ` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'payouts')}
        `;

        container.innerHTML = payoutsHTML;
    }

    async approvePayout(payoutId) {
        if (!confirm('Are you sure you want to approve this payout?')) return;

        try {
            const response = await fetch('/api/admin/payouts/status', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    payoutId,
                    action: 'approve'
                })
            });

            if (!response.ok) throw new Error('Failed to approve payout');

            this.showSuccess('Payout approved successfully');
            this.loadPayouts();

        } catch (error) {
            console.error('❌ Approve payout error:', error);
            this.showError('Failed to approve payout');
        }
    }

    async rejectPayout(payoutId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            const response = await fetch('/api/admin/payouts/status', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    payoutId,
                    action: 'reject',
                    reason
                })
            });

            if (!response.ok) throw new Error('Failed to reject payout');

            this.showSuccess('Payout rejected successfully');
            this.loadPayouts();

        } catch (error) {
            console.error('❌ Reject payout error:', error);
            this.showError('Failed to reject payout');
        }
    }

    createPagination(pagination, section) {
        if (!pagination || pagination.pages <= 1) return '';

        const pages = [];
        for (let i = 1; i <= pagination.pages; i++) {
            pages.push(`
                <button 
                    class="pagination ${i === pagination.page ? 'active' : ''}"
                    onclick="adminDashboard.goToPage('${section}', ${i})"
                >
                    ${i}
                </button>
            `);
        }

        return `
            <div class="pagination">
                ${pagination.page > 1 ? `<button onclick="adminDashboard.goToPage('${section}', ${pagination.page - 1})">Previous</button>` : ''}
                ${pages.join('')}
                ${pagination.page < pagination.pages ? `<button onclick="adminDashboard.goToPage('${section}', ${pagination.page + 1})">Next</button>` : ''}
            </div>
        `;
    }

    goToPage(section, page) {
        this.currentPage[section] = page;
        
        switch (section) {
            case 'users':
                this.loadUsers();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'payouts':
                this.loadPayouts();
                break;
            case 'supportTickets':
                this.loadSupportTickets();
                break;
        }
    }

    logout() {
        localStorage.removeItem('vendplug-admin-token');
        window.location.href = 'admin-login.html';
    }

    showSuccess(message) {
        // Simple success notification
        alert(`✅ ${message}`);
    }

    showError(message) {
        // Simple error notification
        alert(`❌ ${message}`);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Dispute Management
    async loadDisputes() {
        try {
            const response = await fetch(`/api/admin/disputes?page=${this.currentPage.disputes}&limit=${this.currentLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load disputes');

            const data = await response.json();
            this.displayDisputes(data.data);

        } catch (error) {
            console.error('❌ Load disputes error:', error);
            this.showError('Failed to load disputes');
        }
    }

    async searchDisputes() {
        const status = document.getElementById('disputeStatus').value;
        const priority = document.getElementById('disputePriority').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (status) params.append('status', status);
            if (priority) params.append('priority', priority);

            const response = await fetch(`/api/admin/disputes?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search disputes');

            const data = await response.json();
            this.displayDisputes(data.data);

        } catch (error) {
            console.error('❌ Search disputes error:', error);
            this.showError('Failed to search disputes');
        }
    }

    displayDisputes(data) {
        const container = document.getElementById('disputesTable');
        
        // Debug: Log the first dispute to see the data structure
        if (data.disputes && data.disputes.length > 0) {
            console.log('🔍 First dispute in frontend:', data.disputes[0]);
        }
        
        if (!data.disputes || data.disputes.length === 0) {
            container.innerHTML = '<p>No disputes found</p>';
            return;
        }

        const disputesHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Dispute ID</th>
                            <th>Complainant</th>
                            <th>Respondent</th>
                            <th>Order</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.disputes.map(dispute => `
                            <tr>
                                <td>${dispute.disputeId}</td>
                                <td>
                                    <div>${DataFormatter.formatUserName(dispute.raisedBy || dispute.complainant?.userId)}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${DataFormatter.formatUserType(dispute.raisedByType || dispute.complainant?.userType)}</div>
                                </td>
                                <td>
                                    <div>${DataFormatter.formatUserName(dispute.respondent?.userId, 'Unknown Respondent')}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${DataFormatter.formatUserType(dispute.respondent?.userType)}</div>
                                </td>
                                <td>
                                    <div>${DataFormatter.formatOrderId(dispute.orderId?._id || dispute.orderId)}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${DataFormatter.formatCurrency(dispute.orderId?.totalAmount)}</div>
                                </td>
                                <td>${DataFormatter.formatCategory(dispute.category)}</td>
                                <td>
                                    <span class="status-badge status-${dispute.status}">
                                        ${dispute.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td>
                                    <span class="status-badge status-${dispute.priority}">
                                        ${dispute.priority}
                                    </span>
                                </td>
                                <td>${new Date(dispute.createdAt).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="adminDashboard.viewDispute('${dispute.disputeId}')">View</button>
                                    ${dispute.status === 'open' ? `
                                        <button class="btn btn-success" onclick="adminDashboard.assignDispute('${dispute.disputeId}')">Assign</button>
                                    ` : ''}
                                    ${dispute.status === 'under_review' ? `
                                        <button class="btn btn-warning" onclick="adminDashboard.resolveDispute('${dispute.disputeId}')">Resolve</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'disputes')}
        `;

        container.innerHTML = disputesHTML;
    }

    // Support Tickets Management
    async loadSupportTickets() {
        try {
            const response = await fetch(`/api/support/admin/tickets?page=${this.currentPage.supportTickets}&limit=${this.currentLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load support tickets');

            const data = await response.json();
            this.displaySupportTickets(data.data);

        } catch (error) {
            console.error('❌ Load support tickets error:', error);
            this.showError('Failed to load support tickets');
        }
    }

    async searchSupportTickets() {
        const status = document.getElementById('supportStatus').value;
        const priority = document.getElementById('supportPriority').value;
        const category = document.getElementById('supportCategory').value;
        const assignedTo = document.getElementById('supportAssignedTo').value;
        const search = document.getElementById('supportSearch').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (status) params.append('status', status);
            if (priority) params.append('priority', priority);
            if (category) params.append('category', category);
            if (assignedTo) params.append('assignedTo', assignedTo);
            if (search) params.append('search', search);

            const response = await fetch(`/api/support/staff/tickets?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search support tickets');

            const data = await response.json();
            this.displaySupportTickets(data.data);

        } catch (error) {
            console.error('❌ Search support tickets error:', error);
            this.showError('Failed to search support tickets');
        }
    }

    displaySupportTickets(data) {
        const container = document.getElementById('supportTicketsTable');
        
        if (!data.tickets || data.tickets.length === 0) {
            container.innerHTML = '<p>No support tickets found</p>';
            return;
        }

        const ticketsHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Ticket ID</th>
                            <th>Requester</th>
                            <th>Category</th>
                            <th>Subject</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Assigned To</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.tickets.map(ticket => `
                            <tr>
                                <td>#${ticket.ticketNumber || ticket._id.slice(-8)}</td>
                                <td>${ticket.requester?.fullName || 'Unknown'}</td>
                                <td>${this.formatSupportCategory(ticket.category)}</td>
                                <td>${ticket.subject}</td>
                                <td><span class="priority-badge priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span></td>
                                <td><span class="status-badge status-${ticket.status}">${ticket.status.replace('_', ' ').toUpperCase()}</span></td>
                                <td>${ticket.assignedTo?.fullName || 'Unassigned'}</td>
                                <td>${new Date(ticket.createdAt).toLocaleDateString()}</td>
                                <td>
                                    <button onclick="adminDashboard.viewSupportTicket('${ticket._id}')" class="btn btn-sm btn-primary">View</button>
                                    ${!ticket.assignedTo ? `<button onclick="adminDashboard.assignSupportTicket('${ticket._id}')" class="btn btn-sm btn-warning">Assign</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'supportTickets')}
        `;

        container.innerHTML = ticketsHTML;
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
            const response = await fetch(`/api/support/admin/tickets/${ticketId}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load support ticket details');

            const data = await response.json();
            this.showSupportTicketModal(data.data);

        } catch (error) {
            console.error('❌ View support ticket error:', error);
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
                        <div class="modal-actions">
                            ${!ticket.assignedTo ? `<button onclick="adminDashboard.assignSupportTicket('${ticket._id}')" class="btn btn-warning">Assign Ticket</button>` : ''}
                            <button onclick="adminDashboard.updateSupportTicketStatus('${ticket._id}')" class="btn btn-primary">Update Status</button>
                            <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async assignSupportTicket(ticketId) {
        try {
            // Fetch available staff for assignment
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/staff`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load staff');

            const data = await response.json();
            const staff = data.staff || [];

            if (staff.length === 0) {
                this.showError('No staff available for assignment');
                return;
            }

            // Create staff selection modal
            const staffOptions = staff.map(s => `<option value="${s._id}">${s.fullName} (${s.email})</option>`).join('');
            
            const modalHTML = `
                <div class="modal" id="staffSelectionModal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Assign Support Ticket</h3>
                            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Select Staff Member:</label>
                                <select id="selectedStaff" class="form-control">
                                    ${staffOptions}
                                </select>
                            </div>
                            <div class="modal-actions">
                                <button onclick="adminDashboard.confirmAssignSupportTicket('${ticketId}')" class="btn btn-primary">Assign</button>
                                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

        } catch (error) {
            console.error('❌ Assign support ticket error:', error);
            this.showError('Failed to load staff for assignment');
        }
    }

    async confirmAssignSupportTicket(ticketId) {
        const staffId = document.getElementById('selectedStaff').value;
        if (!staffId) {
            this.showError('Please select a staff member');
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/support/admin/tickets/${ticketId}/assign`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ assignedTo: staffId })
            });

            if (!response.ok) throw new Error('Failed to assign support ticket');

            const data = await response.json();
            const staffName = document.getElementById('selectedStaff').selectedOptions[0].text;

            this.showSuccess(`Support ticket assigned successfully to ${staffName}`);
            this.loadSupportTickets();
            
            // Close the modal
            const modal = document.getElementById('staffSelectionModal');
            if (modal) {
                modal.remove();
            }

        } catch (error) {
            console.error('❌ Assign support ticket error:', error);
            this.showError('Failed to assign support ticket');
        }
    }

    async updateSupportTicketStatus(ticketId) {
        const status = prompt('Enter new status (open, in_progress, resolved, closed):');
        if (!status) return;

        try {
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/support/admin/tickets/${ticketId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) throw new Error('Failed to update support ticket status');

            this.showSuccess('Support ticket status updated successfully');
            this.loadSupportTickets();

        } catch (error) {
            console.error('❌ Update support ticket status error:', error);
            this.showError('Failed to update support ticket status');
        }
    }

    clearSupportFilters() {
        document.getElementById('supportStatus').value = '';
        document.getElementById('supportPriority').value = '';
        document.getElementById('supportCategory').value = '';
        document.getElementById('supportAssignedTo').value = '';
        document.getElementById('supportSearch').value = '';
        this.loadSupportTickets();
    }

    formatCategory(category) {
        const categories = {
            'product_not_received': 'Product Not Received',
            'product_damaged': 'Product Damaged',
            'product_not_as_described': 'Product Not As Described',
            'wrong_product': 'Wrong Product',
            'delivery_issues': 'Delivery Issues',
            'payment_issues': 'Payment Issues',
            'communication_issues': 'Communication Issues',
            'other': 'Other'
        };
        return categories[category] || category;
    }

    async viewDispute(disputeId) {
        try {
            console.log('🔍 Fetching dispute with ID:', disputeId);
            console.log('🔍 Admin token:', localStorage.getItem('vendplug-admin-token') ? 'Present' : 'Missing');
            
            const response = await fetch(`/api/disputes/admin/${disputeId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`
                }
            });

            console.log('🔍 Response status:', response.status);
            console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
                throw new Error(`Failed to fetch dispute details: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            console.log('🔍 Admin dispute response:', responseData);
            
            if (responseData.success && responseData.data) {
                console.log('🔍 Dispute data to display:', responseData.data);
                this.showDisputeModal(responseData.data);
            } else {
                console.error('❌ Invalid response format:', responseData);
                throw new Error('Invalid response format - missing success or data');
            }
            
        } catch (error) {
            console.error('❌ View dispute error:', error);
            this.showError(`Failed to load dispute details: ${error.message}`);
        }
    }

    showDisputeModal(dispute) {
        // Debug: Log the dispute object to see what we're working with
        console.log('🔍 Dispute object received:', dispute);
        
        // Extract the actual dispute data (it's wrapped in a 'dispute' property)
        const disputeData = dispute.dispute || dispute;
        
        // Debug: Log the populated data
        console.log('🔍 Dispute data structure:', {
            disputeId: disputeData.disputeId,
            title: disputeData.title,
            status: disputeData.status,
            priority: disputeData.priority,
            category: disputeData.category,
            complainant: disputeData.complainant,
            respondent: disputeData.respondent,
            orderId: disputeData.orderId,
            raisedBy: disputeData.raisedBy,
            raisedByType: disputeData.raisedByType,
            evidence: disputeData.evidence
        });
        
        // Ensure DataFormatter is available, create fallbacks if not
        if (typeof DataFormatter === 'undefined') {
            console.warn('⚠️ DataFormatter is not available, using fallback functions');
            window.DataFormatter = {
                formatOrderId: (id) => id ? (id._id || id).toString().substring(0, 8) : 'Unknown',
                formatUserName: (user, fallback = 'Unknown User') => {
                    if (!user) return fallback;
                    return user.fullName || user.shopName || user.businessName || user.email || fallback;
                },
                formatUserType: (type) => type || 'Unknown',
                formatCurrency: (amount) => amount ? `₦${Number(amount).toLocaleString()}` : '₦0',
                formatStatus: (status) => status ? status.replace('_', ' ').toUpperCase() : 'Unknown',
                formatCategory: (category) => category || 'Unknown'
            };
        }
        
        // Check if sidebar is open and add appropriate class
        const sidebar = document.querySelector('.sidebar');
        const isSidebarOpen = sidebar && sidebar.classList.contains('open');
        const modalClass = isSidebarOpen ? 'modal sidebar-open' : 'modal';
        
        // Create modal HTML
        const modalHTML = `
            <div id="disputeModal" class="${modalClass}" style="display: block;">
                <div class="modal-content" style="max-width: 90%; max-height: 90%; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Dispute Details - ${disputeData.disputeId || disputeData._id || 'Unknown'}</h2>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        ${disputeData.status === 'escalated' ? `
                            <div class="alert alert-warning">
                                <strong>⚠️ This dispute has been escalated and requires admin attention</strong>
                                ${disputeData.escalation ? `
                                    <br><small>Escalation Reason: ${disputeData.escalation.reason || 'Not specified'}</small>
                                    ${disputeData.escalation.notes ? `<br><small>Notes: ${disputeData.escalation.notes}</small>` : ''}
                                ` : ''}
                            </div>
                        ` : ''}
                        <div class="dispute-info">
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Status:</label>
                                    <span class="status-badge status-${disputeData.status || 'unknown'}">${(disputeData.status || 'unknown').replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <div class="info-item">
                                    <label>Priority:</label>
                                    <span class="status-badge status-${disputeData.priority || 'unknown'}">${(disputeData.priority || 'unknown').toUpperCase()}</span>
                                </div>
                                <div class="info-item">
                                    <label>Category:</label>
                                    <span>${this.formatCategory(disputeData.category || 'unknown')}</span>
                                </div>
                                <div class="info-item">
                                    <label>Created:</label>
                                    <span>${disputeData.createdAt ? new Date(disputeData.createdAt).toLocaleString() : 'Unknown'}</span>
                                </div>
                            </div>
                            
                            <div class="dispute-parties">
                                <h3>Parties Involved</h3>
                                <div class="parties-grid">
                                    <div class="party">
                                        <h4>Complainant (${disputeData.raisedByType || disputeData.complainant?.userType || 'Unknown'})</h4>
                                        <p>ID: ${disputeData.raisedBy?._id || disputeData.complainant?.userId?._id || disputeData.complainant?.userId || 'Unknown'}</p>
                                        <p>Name: ${disputeData.raisedBy?.fullName || disputeData.raisedBy?.shopName || disputeData.complainant?.userId?.fullName || disputeData.complainant?.userId?.shopName || 'Unknown'}</p>
                                    </div>
                                    <div class="party">
                                        <h4>Respondent (${disputeData.respondent?.userType || 'Unknown'})</h4>
                                        <p>ID: ${DataFormatter.formatOrderId(disputeData.respondent?.userId?._id || disputeData.respondent?.userId)}</p>
                                        <p>Name: ${DataFormatter.formatUserName(disputeData.respondent?.userId, 'Unknown Respondent')}</p>
                                    </div>
                                </div>
                                ${disputeData.assignment?.assignedTo ? `
                                <div class="party">
                                    <h4>Assigned To</h4>
                                    <p>Name: ${disputeData.assignment.assignedTo.fullName || 'Unknown'}</p>
                                    <p>Role: ${disputeData.assignment.assignedTo.role || 'Unknown'}</p>
                                    <p>Email: ${disputeData.assignment.assignedTo.email || 'Unknown'}</p>
                                </div>
                                ` : ''}
                            </div>

                            <div class="dispute-details">
                                <h3>Dispute Details</h3>
                                <div class="detail-item">
                                    <label>Title:</label>
                                    <p>${disputeData.title || 'No title'}</p>
                                </div>
                                <div class="detail-item">
                                    <label>Description:</label>
                                    <p>${disputeData.description || 'No description'}</p>
                                </div>
                                <div class="detail-item">
                                    <label>Order:</label>
                                    <p>${DataFormatter.formatUserType(disputeData.orderType)} - ${DataFormatter.formatOrderId(disputeData.orderId?._id || disputeData.orderId)}</p>
                                    <p>Amount: ${DataFormatter.formatCurrency(disputeData.orderId?.totalAmount)}</p>
                                    <p>Status: ${DataFormatter.formatStatus(disputeData.orderId?.status)}</p>
                                </div>
                            </div>

                            ${disputeData.evidence && disputeData.evidence.length > 0 ? `
                                <div class="dispute-evidence">
                                    <h3>Evidence</h3>
                                    <div class="evidence-list">
                                        ${disputeData.evidence.map(evidence => `
                                            <div class="evidence-item">
                                                <div class="evidence-info">
                                                    <strong>${evidence.type.toUpperCase()}</strong>
                                                    <p>${evidence.description}</p>
                                                    <small>Uploaded by ${evidence.uploadedByType} on ${new Date(evidence.uploadedAt).toLocaleString()}</small>
                                                </div>
                                                ${evidence.type === 'image' ? `
                                                    <div class="evidence-preview">
                                                        <p><strong>Image File:</strong> ${evidence.description}</p>
                                                        <p><em>Note: File upload functionality needs to be implemented to display images properly.</em></p>
                                                        <p><strong>File URL:</strong> ${evidence.url}</p>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${disputeData.messages && disputeData.messages.length > 0 ? `
                                <div class="dispute-messages">
                                    <h3>Messages</h3>
                                    <div class="messages-list">
                                        ${disputeData.messages.map(message => `
                                            <div class="message-item">
                                                <div class="message-header">
                                                    <strong>${message.sender.userType}</strong>
                                                    <span>${new Date(message.createdAt).toLocaleString()}</span>
                                                </div>
                                                <div class="message-content">
                                                    <p>${message.message}</p>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${disputeData.resolution ? `
                                <div class="dispute-resolution">
                                    <h3>Resolution</h3>
                                    <div class="resolution-details">
                                        <div class="info-item">
                                            <label>Decision:</label>
                                            <span>${disputeData.resolution.decision}</span>
                                        </div>
                                        <div class="info-item">
                                            <label>Reason:</label>
                                            <span>${disputeData.resolution.reason || 'N/A'}</span>
                                        </div>
                                        ${disputeData.resolution.refundAmount ? `
                                            <div class="info-item">
                                                <label>Refund Amount:</label>
                                                <span>₦${disputeData.resolution.refundAmount}</span>
                                            </div>
                                        ` : ''}
                                        <div class="info-item">
                                            <label>Resolved At:</label>
                                            <span>${new Date(disputeData.resolution.resolvedAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        ${disputeData.status === 'open' ? `
                            <button class="btn btn-success" onclick="adminDashboard.assignDispute('${disputeData.disputeId}')">Assign to Staff</button>
                        ` : ''}
                        ${disputeData.status === 'under_review' ? `
                            <button class="btn btn-warning" onclick="adminDashboard.resolveDispute('${disputeData.disputeId}')">Resolve Dispute</button>
                        ` : ''}
                        ${disputeData.status === 'escalated' ? `
                            <div class="d-flex gap-2">
                                <button class="btn btn-primary" onclick="adminDashboard.reassignEscalatedDispute('${disputeData.disputeId}')">
                                    <i class="fas fa-user-plus me-1"></i>Reassign to Staff
                                </button>
                                <button class="btn btn-success" onclick="adminDashboard.showResolveEscalatedModal('${disputeData.disputeId}')">
                                    <i class="fas fa-check me-1"></i>Resolve Escalated
                                </button>
                            </div>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async assignDispute(disputeId) {
        try {
            // Fetch available staff for assignment
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/staff`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch staff list');
            }

            const data = await response.json();
            const staff = data.data.staff || [];

            // Filter staff with dispute resolution permissions
            const availableStaff = staff.filter(s => 
                s.permissions && s.permissions.disputeResolution && s.isActive
            );

            if (availableStaff.length === 0) {
                alert('No available staff members found for dispute assignment');
                return;
            }

            // Create staff selection modal
            this.showStaffSelectionModal(disputeId, availableStaff);

        } catch (error) {
            console.error('Error fetching staff:', error);
            alert('Failed to load staff list. Please try again.');
        }
    }

    showStaffSelectionModal(disputeId, staff) {
        // Create modal HTML
        const modalHtml = `
            <div id="staffSelectionModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 600px; max-height: 90%; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Assign Dispute to Staff</h2>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>Select a staff member to assign this dispute to:</p>
                        <div class="list-group">
                            ${staff.map(s => `
                                <button type="button" class="list-group-item list-group-item-action" 
                                        onclick="adminDashboard.performAssignDispute('${disputeId}', '${s._id}', '${s.fullName}')">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${s.fullName}</h6>
                                        <small>${s.role}</small>
                                    </div>
                                    <p class="mb-1">Current workload: ${s.currentDisputes || 0} disputes</p>
                                    <small>Specialties: ${s.disputeSpecialties ? s.disputeSpecialties.join(', ') : 'General'}</small>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('staffSelectionModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Modal is already visible with style="display: block;"
    }

    async performAssignDispute(disputeId, assignedTo, staffName) {
        try {
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/disputes/${disputeId}/assign`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ assignedTo })
            });

            if (!response.ok) throw new Error('Failed to assign dispute');

            this.showSuccess(`Dispute assigned successfully to ${staffName}`);
            this.loadDisputes();
            
            // Close the modal
            const modal = document.getElementById('staffSelectionModal');
            if (modal) {
                modal.remove();
            }

        } catch (error) {
            console.error('❌ Assign dispute error:', error);
            this.showError('Failed to assign dispute');
        }
    }

    resolveDispute(disputeId) {
        const decision = prompt('Enter decision (Refund Buyer, Fund Vendor/Agent, Partial Refund, No Action, Escalated):');
        if (!decision) return;

        const reason = prompt('Enter reason for decision:');
        if (!reason) return;

        const notes = prompt('Enter additional notes (optional):') || '';

        // Map user-friendly terms to backend values
        let backendDecision;
        switch(decision.toLowerCase()) {
            case 'refund buyer':
                backendDecision = 'favor_complainant';
                break;
            case 'fund vendor/agent':
                backendDecision = 'favor_respondent';
                break;
            case 'partial refund':
                backendDecision = 'partial_refund';
                break;
            case 'no action':
                backendDecision = 'no_action';
                break;
            case 'escalated':
                backendDecision = 'escalated';
                break;
            default:
                alert('Invalid decision. Please use: Refund Buyer, Fund Vendor/Agent, Partial Refund, No Action, or Escalated');
                return;
        }

        this.performResolveDispute(disputeId, backendDecision, reason, 0, notes);
    }

    async performResolveDispute(disputeId, decision, reason, refundAmount, notes) {
        try {
            const token = getAuthToken();
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/disputes/${disputeId}/resolve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    decision,
                    reason,
                    refundAmount,
                    notes
                })
            });

            if (!response.ok) throw new Error('Failed to resolve dispute');

            this.showSuccess('Dispute resolved successfully');
            this.loadDisputes();

        } catch (error) {
            console.error('❌ Resolve dispute error:', error);
            this.showError('Failed to resolve dispute');
        }
    }

    // Escalated Disputes Management
    showEscalatedDisputes() {
        this.showSection('escalated-disputes');
    }

    async loadEscalatedDisputes() {
        try {
            const response = await fetch(`/api/admin/disputes/escalated?page=${this.currentPage.disputes}&limit=${this.currentLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load escalated disputes');

            const data = await response.json();
            this.displayEscalatedDisputes(data.data);

        } catch (error) {
            console.error('❌ Load escalated disputes error:', error);
            this.showError('Failed to load escalated disputes');
        }
    }

    async searchEscalatedDisputes() {
        const priority = document.getElementById('escalatedPriority').value;
        const reason = document.getElementById('escalationReason').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (priority) params.append('priority', priority);
            if (reason) params.append('escalationReason', reason);

            const response = await fetch(`/api/admin/disputes/escalated?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search escalated disputes');

            const data = await response.json();
            this.displayEscalatedDisputes(data.data);

        } catch (error) {
            console.error('❌ Search escalated disputes error:', error);
            this.showError('Failed to search escalated disputes');
        }
    }

    displayEscalatedDisputes(data) {
        const container = document.getElementById('escalatedDisputesTable');
        
        if (!data.disputes || data.disputes.length === 0) {
            container.innerHTML = '<p>No escalated disputes found</p>';
            return;
        }

        const disputesHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Dispute ID</th>
                            <th>Complainant</th>
                            <th>Respondent</th>
                            <th>Order</th>
                            <th>Category</th>
                            <th>Priority</th>
                            <th>Escalated By</th>
                            <th>Escalation Reason</th>
                            <th>Escalated At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.disputes.map(dispute => `
                            <tr>
                                <td>${dispute.disputeId}</td>
                                <td>
                                    <div>${DataFormatter.formatUserName(dispute.raisedBy || dispute.complainant?.userId)}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${DataFormatter.formatUserType(dispute.raisedByType || dispute.complainant?.userType)}</div>
                                </td>
                                <td>
                                    <div>${DataFormatter.formatUserName(dispute.respondent?.userId, 'Unknown Respondent')}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${DataFormatter.formatUserType(dispute.respondent?.userType)}</div>
                                </td>
                                <td>
                                    <div>${DataFormatter.formatOrderId(dispute.orderId?._id || dispute.orderId)}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${DataFormatter.formatCurrency(dispute.orderId?.totalAmount)}</div>
                                </td>
                                <td>${DataFormatter.formatCategory(dispute.category)}</td>
                                <td>
                                    <span class="status-badge status-${dispute.priority}">
                                        ${dispute.priority}
                                    </span>
                                </td>
                                <td>
                                    <div>${dispute.escalation?.escalatedBy?.fullName || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${dispute.escalation?.escalatedBy?.role || 'N/A'}</div>
                                </td>
                                <td>
                                    <span class="badge bg-warning">${dispute.escalation?.reason || 'Unknown'}</span>
                                </td>
                                <td>${dispute.escalation?.escalatedAt ? new Date(dispute.escalation.escalatedAt).toLocaleDateString() : 'N/A'}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="adminDashboard.viewEscalatedDispute('${dispute.disputeId}')">View</button>
                                    <button class="btn btn-success" onclick="adminDashboard.reassignEscalatedDispute('${dispute.disputeId}')">Reassign</button>
                                    <button class="btn btn-warning" onclick="adminDashboard.resolveEscalatedDispute('${dispute.disputeId}')">Resolve</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'disputes')}
        `;

        container.innerHTML = disputesHTML;
    }

    async viewEscalatedDispute(disputeId) {
        try {
            const response = await fetch(`/api/disputes/admin/${disputeId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch escalated dispute details');

            const responseData = await response.json();
            console.log('🔍 Admin escalated dispute response:', responseData);
            
            if (responseData.success && responseData.data) {
                this.showEscalatedDisputeModal(responseData.data);
            } else {
                throw new Error('Invalid response format');
            }
            
        } catch (error) {
            console.error('❌ View escalated dispute error:', error);
            this.showError('Failed to load escalated dispute details');
        }
    }

    showEscalatedDisputeModal(dispute) {
        const disputeData = dispute.dispute || dispute;
        
        // Check if sidebar is open and add appropriate class
        const sidebar = document.querySelector('.sidebar');
        const isSidebarOpen = sidebar && sidebar.classList.contains('open');
        const modalClass = isSidebarOpen ? 'modal sidebar-open' : 'modal';
        
        const modalHTML = `
            <div id="escalatedDisputeModal" class="${modalClass}" style="display: block;">
                <div class="modal-content" style="max-width: 90%; max-height: 90%; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Escalated Dispute - ${disputeData.disputeId}</h2>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <strong>⚠️ This dispute has been escalated and requires admin attention</strong>
                        </div>
                        
                        <div class="dispute-info">
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Status:</label>
                                    <span class="status-badge status-${disputeData.status || 'unknown'}">${(disputeData.status || 'unknown').replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <div class="info-item">
                                    <label>Priority:</label>
                                    <span class="status-badge status-${disputeData.priority || 'unknown'}">${(disputeData.priority || 'unknown').toUpperCase()}</span>
                                </div>
                                <div class="info-item">
                                    <label>Category:</label>
                                    <span>${this.formatCategory(disputeData.category || 'unknown')}</span>
                                </div>
                                <div class="info-item">
                                    <label>Created:</label>
                                    <span>${disputeData.createdAt ? new Date(disputeData.createdAt).toLocaleString() : 'Unknown'}</span>
                                </div>
                            </div>
                            
                            <div class="escalation-details" style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h4>Escalation Details</h4>
                                <div class="info-item">
                                    <label>Escalated By:</label>
                                    <span>${disputeData.escalation?.escalatedBy?.fullName || 'Unknown'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Escalation Reason:</label>
                                    <span class="badge bg-warning">${disputeData.escalation?.reason || 'Unknown'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Escalated At:</label>
                                    <span>${disputeData.escalation?.escalatedAt ? new Date(disputeData.escalation.escalatedAt).toLocaleString() : 'Unknown'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Escalation Notes:</label>
                                    <p>${disputeData.escalation?.notes || 'No additional notes provided'}</p>
                                </div>
                            </div>
                            
                            <div class="dispute-parties">
                                <h3>Parties Involved</h3>
                                <div class="parties-grid">
                                    <div class="party">
                                        <h4>Complainant (${disputeData.raisedByType || disputeData.complainant?.userType || 'Unknown'})</h4>
                                        <p>ID: ${disputeData.raisedBy?._id || disputeData.complainant?.userId?._id || disputeData.complainant?.userId || 'Unknown'}</p>
                                        <p>Name: ${disputeData.raisedBy?.fullName || disputeData.raisedBy?.shopName || disputeData.complainant?.userId?.fullName || disputeData.complainant?.userId?.shopName || 'Unknown'}</p>
                                    </div>
                                    <div class="party">
                                        <h4>Respondent (${disputeData.respondent?.userType || 'Unknown'})</h4>
                                        <p>ID: ${DataFormatter.formatOrderId(disputeData.respondent?.userId?._id || disputeData.respondent?.userId)}</p>
                                        <p>Name: ${DataFormatter.formatUserName(disputeData.respondent?.userId, 'Unknown Respondent')}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="dispute-details">
                                <h3>Dispute Details</h3>
                                <div class="detail-item">
                                    <label>Title:</label>
                                    <p>${disputeData.title || 'No title'}</p>
                                </div>
                                <div class="detail-item">
                                    <label>Description:</label>
                                    <p>${disputeData.description || 'No description'}</p>
                                </div>
                                <div class="detail-item">
                                    <label>Order:</label>
                                    <p>${DataFormatter.formatUserType(disputeData.orderType)} - ${DataFormatter.formatOrderId(disputeData.orderId?._id || disputeData.orderId)}</p>
                                    <p>Amount: ${DataFormatter.formatCurrency(disputeData.orderId?.totalAmount)}</p>
                                    <p>Status: ${DataFormatter.formatStatus(disputeData.orderId?.status)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-success" onclick="adminDashboard.reassignEscalatedDispute('${disputeData.disputeId}')">Reassign to Staff</button>
                        <button class="btn btn-warning" onclick="adminDashboard.resolveEscalatedDispute('${disputeData.disputeId}')">Resolve as Admin</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }


    // Staff Activity Log Management
    async loadStaffActivity() {
        try {
            // Load staff list for filter
            await this.loadStaffListForFilter();
            
            const response = await fetch(`/api/admin/staff-activity?page=${this.currentPage.disputes}&limit=${this.currentLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load staff activity');

            const data = await response.json();
            this.displayStaffActivity(data.data);

        } catch (error) {
            console.error('❌ Load staff activity error:', error);
            this.showError('Failed to load staff activity');
        }
    }

    async loadStaffListForFilter() {
        try {
            const response = await fetch('/api/admin/staff', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const staffSelect = document.getElementById('staffFilter');
                
                // Clear existing options except "All Staff"
                staffSelect.innerHTML = '<option value="">All Staff</option>';
                
                // Add staff options
                data.data.staff.forEach(staff => {
                    const option = document.createElement('option');
                    option.value = staff._id;
                    option.textContent = `${staff.fullName} (${staff.role})`;
                    staffSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('❌ Load staff list for filter error:', error);
        }
    }

    async searchStaffActivity() {
        const staffId = document.getElementById('staffFilter').value;
        const action = document.getElementById('actionFilter').value;
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;

        try {
            const params = new URLSearchParams({
                page: 1,
                limit: this.currentLimit
            });
            if (staffId) params.append('staffId', staffId);
            if (action) params.append('action', action);
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const response = await fetch(`/api/admin/staff-activity?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to search staff activity');

            const data = await response.json();
            this.displayStaffActivity(data.data);

        } catch (error) {
            console.error('❌ Search staff activity error:', error);
            this.showError('Failed to search staff activity');
        }
    }

    displayStaffActivity(data) {
        const container = document.getElementById('staffActivityTable');
        
        if (!data.activities || data.activities.length === 0) {
            container.innerHTML = '<p>No staff activity found</p>';
            return;
        }

        const activitiesHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Staff Member</th>
                            <th>Action</th>
                            <th>Dispute ID</th>
                            <th>Details</th>
                            <th>IP Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.activities.map(activity => `
                            <tr>
                                <td>${new Date(activity.timestamp).toLocaleString()}</td>
                                <td>
                                    <div>${activity.staff?.fullName || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${activity.staff?.role || 'N/A'}</div>
                                </td>
                                <td>
                                    <span class="badge bg-${this.getActionColor(activity.action)}">
                                        ${this.formatAction(activity.action)}
                                    </span>
                                </td>
                                <td>${activity.disputeId || 'N/A'}</td>
                                <td>
                                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                                        ${activity.details || 'No details'}
                                    </div>
                                </td>
                                <td>${activity.ipAddress || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${this.createPagination(data.pagination, 'disputes')}
        `;

        container.innerHTML = activitiesHTML;
    }

    getActionColor(action) {
        const colors = {
            'dispute_assigned': 'primary',
            'review_started': 'warning',
            'dispute_resolved': 'success',
            'dispute_escalated': 'danger',
            'priority_updated': 'info',
            'message_sent': 'secondary',
            'info_requested': 'dark'
        };
        return colors[action] || 'secondary';
    }

    formatAction(action) {
        const actions = {
            'dispute_assigned': 'Dispute Assigned',
            'review_started': 'Review Started',
            'dispute_resolved': 'Dispute Resolved',
            'dispute_escalated': 'Dispute Escalated',
            'priority_updated': 'Priority Updated',
            'message_sent': 'Message Sent',
            'info_requested': 'Info Requested'
        };
        return actions[action] || action.replace('_', ' ').toUpperCase();
    }

    // Escalated Dispute Management Functions
    showResolveEscalatedModal(disputeId) {
        // Create resolution modal
        const modalHtml = `
            <div id="resolveEscalatedModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 600px; max-height: 90%; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Resolve Escalated Dispute</h2>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="resolveEscalatedForm">
                            <div class="form-group mb-3">
                                <label for="resolutionDecision">Resolution Decision *</label>
                                <select class="form-control" id="resolutionDecision" required>
                                    <option value="">Select decision</option>
                                    <option value="favor_complainant">Refund Buyer</option>
                                    <option value="favor_respondent">Fund Vendor/Agent</option>
                                    <option value="partial_refund">Partial Refund</option>
                                </select>
                            </div>
                            <div class="form-group mb-3">
                                <label for="resolutionReason">Resolution Reason *</label>
                                <input type="text" class="form-control" id="resolutionReason" required 
                                       placeholder="Brief reason for the decision">
                            </div>
                            <div class="form-group mb-3">
                                <label for="resolutionNotes">Resolution Notes</label>
                                <textarea class="form-control" id="resolutionNotes" rows="3" 
                                          placeholder="Detailed notes about the resolution"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="button" class="btn btn-success" onclick="adminDashboard.performResolveEscalatedDispute('${disputeId}')">
                            <i class="fas fa-check-circle"></i> Resolve Dispute
                        </button>
                    </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('resolveEscalatedModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Modal is already visible with style="display: block;"
    }

    async performResolveEscalatedDispute(disputeId) {
        const resolution = document.getElementById('resolutionDecision').value;
        const reason = document.getElementById('resolutionReason').value;
        const notes = document.getElementById('resolutionNotes').value;

        if (!resolution || !reason) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const token = getAuthToken();
            console.log('🔑 Admin token:', token ? 'Present' : 'Missing');
            console.log('🔑 Token length:', token ? token.length : 0);
            
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/disputes/${disputeId}/resolve-escalated`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    decision: resolution, // Map to backend expected field
                    reason,
                    notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to resolve escalated dispute');
            }

            this.showSuccess('Escalated dispute resolved successfully');
            this.loadEscalatedDisputes();
            
            // Close the modal
            const modal = document.getElementById('resolveEscalatedModal');
            if (modal) {
                modal.remove();
            }

        } catch (error) {
            console.error('❌ Resolve escalated dispute error:', error);
            this.showError('Failed to resolve escalated dispute');
        }
    }

    async reassignEscalatedDispute(disputeId) {
        try {
            // Fetch available staff for assignment
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/staff`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch staff list');
            }

            const data = await response.json();
            const staff = data.data.staff || [];

            // Filter staff with dispute resolution permissions
            const availableStaff = staff.filter(s => 
                s.permissions && s.permissions.disputeResolution && s.isActive
            );

            if (availableStaff.length === 0) {
                alert('No available staff members found for dispute reassignment');
                return;
            }

            // Create staff selection modal for reassignment
            this.showStaffReassignmentModal(disputeId, availableStaff);

        } catch (error) {
            console.error('Error fetching staff:', error);
            alert('Failed to load staff list. Please try again.');
        }
    }

    showStaffReassignmentModal(disputeId, staff) {
        // Create modal HTML
        const modalHtml = `
            <div id="staffReassignmentModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 600px; max-height: 90%; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Reassign Escalated Dispute</h2>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>Select a staff member to reassign this escalated dispute to:</p>
                        <div class="list-group">
                            ${staff.map(s => `
                                <button type="button" class="list-group-item list-group-item-action" 
                                        onclick="adminDashboard.performReassignEscalatedDispute('${disputeId}', '${s._id}', '${s.fullName}')">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${s.fullName}</h6>
                                        <small>${s.role}</small>
                                    </div>
                                    <p class="mb-1">Current workload: ${s.currentDisputes || 0} disputes</p>
                                    <small>Specialties: ${s.disputeSpecialties ? s.disputeSpecialties.join(', ') : 'General'}</small>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('staffReassignmentModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Modal is already visible with style="display: block;"
    }

    async performReassignEscalatedDispute(disputeId, assignedTo, staffName) {
        try {
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin/disputes/${disputeId}/reassign`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ assignedTo })
            });

            if (!response.ok) {
                throw new Error('Failed to reassign escalated dispute');
            }

            this.showSuccess(`Escalated dispute reassigned successfully to ${staffName}`);
            this.loadEscalatedDisputes();
            
            // Close the modal
            const modal = document.getElementById('staffReassignmentModal');
            if (modal) {
                modal.remove();
            }

        } catch (error) {
            console.error('❌ Reassign escalated dispute error:', error);
            this.showError('Failed to reassign escalated dispute');
        }
    }

    // Ad Management Functions
    async loadAds() {
        try {
            console.log('🔄 Loading ads...');
            console.log('🔑 Admin token:', this.adminToken ? 'Present' : 'Missing');
            console.log('🔑 Token length:', this.adminToken ? this.adminToken.length : 0);
            const response = await fetch('/api/admin-ads/ads', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                throw new Error('Failed to load ads');
            }

            const data = await response.json();
            console.log('📊 Ads data received:', data);
            console.log('📊 Number of ads:', data.data && data.data.ads ? data.data.ads.length : 0);
            this.renderAdsTable(data.data && data.data.ads ? data.data.ads : []);
        } catch (error) {
            console.error('❌ Error loading ads:', error);
            document.getElementById('adsTable').innerHTML = '<div class="loading">Error loading ads</div>';
        }
    }

    renderAdsTable(ads) {
        console.log('🎨 Rendering ads table with', ads.length, 'ads');
        const container = document.getElementById('adsTable');
        
        if (ads.length === 0) {
            console.log('📭 No ads to display');
            container.innerHTML = '<div class="loading">No ads found</div>';
            return;
        }

        const table = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ads.map(ad => `
                            <tr>
                                <td>${ad.title}</td>
                                <td><span class="status-badge status-${ad.type}">${ad.type}</span></td>
                                <td><span class="status-badge status-${ad.status}">${ad.status}</span></td>
                                <td><span class="status-badge status-${ad.priority}">${ad.priority}</span></td>
                                <td>${ad.startDate ? new Date(ad.startDate).toLocaleDateString() : 'N/A'}</td>
                                <td>${ad.endDate ? new Date(ad.endDate).toLocaleDateString() : 'N/A'}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="editAd('${ad._id}')">Edit</button>
                                    <button class="btn btn-danger" onclick="deleteAd('${ad._id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = table;
    }

    async loadCampaigns() {
        try {
            const response = await fetch('/api/admin-ads/campaigns', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load campaigns');
            }

            const data = await response.json();
            this.renderCampaignsTable(data.data && data.data.campaigns ? data.data.campaigns : []);
        } catch (error) {
            console.error('Error loading campaigns:', error);
            document.getElementById('campaignsTable').innerHTML = '<div class="loading">Error loading campaigns</div>';
        }
    }

    renderCampaignsTable(campaigns) {
        const container = document.getElementById('campaignsTable');
        
        if (campaigns.length === 0) {
            container.innerHTML = '<div class="loading">No campaigns found</div>';
            return;
        }

        const table = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Target</th>
                            <th>Priority</th>
                            <th>Send Date</th>
                            <th>Expiry Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${campaigns.map(campaign => `
                            <tr>
                                <td>${campaign.title || '-'}</td>
                                <td><span class="status-badge status-${campaign.status}">${campaign.status}</span></td>
                                <td>${Array.isArray(campaign.targetUserTypes) && campaign.targetUserTypes.length ? campaign.targetUserTypes.join(', ') : (campaign.targetUserType || 'all')}</td>
                                <td><span class="status-badge status-${campaign.priority}">${campaign.priority}</span></td>
                                <td>${campaign.scheduledFor ? new Date(campaign.scheduledFor).toLocaleString() : 'N/A'}</td>
                                <td>${campaign.expiresAt ? new Date(campaign.expiresAt).toLocaleString() : 'N/A'}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="editCampaign('${campaign._id}')">Edit</button>
                                    <button class="btn btn-danger" onclick="deleteCampaign('${campaign._id}')">Delete</button>
                                    ${['draft','scheduled'].includes(campaign.status) ? `<button class="btn btn-success" onclick="sendCampaign('${campaign._id}')">Send</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = table;
    }

    filterAds() {
        // Implementation for filtering ads
        console.log('Filtering ads...');
    }

    filterCampaigns() {
        // Implementation for filtering campaigns
        console.log('Filtering campaigns...');
    }

    // Wallet Management Methods
    async loadWalletManagement() {
        try {
            console.log('🏦 Loading wallet management data...');
            
            // Load wallet balance and capacity
            await this.loadWalletBalance();
            
            // Load pending payouts
            await this.loadPendingPayouts();
            
            // Load recent transactions
            await this.loadRecentWalletTransactions();
            
            // Setup wallet management event listeners
            this.setupWalletEventListeners();
            
        } catch (error) {
            console.error('❌ Error loading wallet management:', error);
            this.showError('Failed to load wallet management data');
        }
    }

    async loadWalletBalance() {
        try {
            const response = await fetch('/api/paystack-wallet/balance', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load wallet balance');
            }

            const data = await response.json();
            console.log('💰 Wallet balance data:', data);
            
            this.updateWalletDisplay(data.data);
            
        } catch (error) {
            console.error('❌ Error loading wallet balance:', error);
            this.showWalletError('Failed to load wallet balance');
        }
    }

    async loadPendingPayouts() {
        try {
            const response = await fetch('/api/admin/payouts?status=pending&limit=10', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load pending payouts');
            }

            const data = await response.json();
            const pendingAmount = data.data?.payouts?.reduce((total, payout) => total + (payout.amount || 0), 0) || 0;
            
            document.getElementById('pendingPayouts').textContent = `₦${pendingAmount.toLocaleString()}`;
            
        } catch (error) {
            console.error('❌ Error loading pending payouts:', error);
            document.getElementById('pendingPayouts').textContent = 'Error';
        }
    }

    async loadRecentWalletTransactions() {
        // Remove this functionality since there's no proper endpoint
        const container = document.getElementById('walletRecentTransactions');
        if (container) {
            container.innerHTML = '<p>Recent wallet transactions not available</p>';
        }
    }

    updateWalletDisplay(data) {
        if (!data) {
            console.warn('⚠️ No wallet data received');
            return;
        }

        const balance = data.balance || 0;
        const payoutCapacity = data.payoutCapacity || 0;
        const capacityPercentage = data.capacityPercentage || 0;
        
        // Update balance display
        document.getElementById('walletBalance').textContent = balance.toLocaleString();
        
        // Update payout capacity
        document.getElementById('payoutCapacity').textContent = `₦${payoutCapacity.toLocaleString()}`;
        
        // Update capacity indicator
        const capacityFill = document.getElementById('capacityFill');
        const capacityText = document.getElementById('capacityText');
        
        if (capacityFill && capacityText) {
            capacityFill.style.width = `${capacityPercentage}%`;
            capacityText.textContent = `${capacityPercentage.toFixed(1)}% capacity`;
        }
        
        // Update last updated time
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
        
        // Update recommendations
        this.updateRecommendations(data);
        
        // Update alerts
        this.updateAlerts(data);
    }

    updateRecommendations(data) {
        const recommendationContent = document.getElementById('recommendationContent');
        if (!recommendationContent) return;
        
        const balance = data.balance || 0;
        const payoutCapacity = data.payoutCapacity || 0;
        
        let recommendations = [];
        
        if (balance < 50000) {
            recommendations.push('💡 Consider topping up your wallet - low balance detected');
        }
        
        if (payoutCapacity < 10000) {
            recommendations.push('⚠️ Payout capacity is low - may affect instant payouts');
        }
        
        if (balance > 500000) {
            recommendations.push('✅ Wallet balance is healthy - good for high-volume operations');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ Your wallet is in good condition');
        }
        
        recommendationContent.innerHTML = recommendations.map(rec => `<div style="margin: 0.5rem 0;">${rec}</div>`).join('');
    }

    updateAlerts(data) {
        const alertsContainer = document.getElementById('alerts');
        if (!alertsContainer) return;
        
        const balance = data.balance || 0;
        const payoutCapacity = data.payoutCapacity || 0;
        
        let alerts = [];
        
        if (balance < 10000) {
            alerts.push({
                type: 'danger',
                message: '🚨 Critical: Wallet balance is very low! Top up immediately to avoid payout failures.'
            });
        } else if (balance < 50000) {
            alerts.push({
                type: 'warning',
                message: '⚠️ Warning: Wallet balance is low. Consider topping up soon.'
            });
        }
        
        if (payoutCapacity < 5000) {
            alerts.push({
                type: 'warning',
                message: '⚠️ Payout capacity is very low. This may cause delays in vendor payouts.'
            });
        }
        
        if (alerts.length === 0) {
            alertsContainer.innerHTML = '';
            return;
        }
        
        alertsContainer.innerHTML = alerts.map(alert => `
            <div class="alert alert-${alert.type}" style="padding: 1rem; margin: 0.5rem 0; border-radius: 5px; background: ${alert.type === 'danger' ? '#f8d7da' : '#fff3cd'}; color: ${alert.type === 'danger' ? '#721c24' : '#856404'}; border: 1px solid ${alert.type === 'danger' ? '#f5c6cb' : '#ffeaa7'};">
                ${alert.message}
            </div>
        `).join('');
    }

    renderRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        
        if (transactions.length === 0) {
            container.innerHTML = '<div class="loading">No recent transactions</div>';
            return;
        }
        
        const transactionsHTML = transactions.map(transaction => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee;">
                <div>
                    <div style="font-weight: bold;">${transaction.type || 'Transaction'}</div>
                    <div style="color: #666; font-size: 0.9rem;">
                        ${transaction.initiatedBy?.fullName || transaction.initiatedBy?.shopName || 'System'} • 
                        ${new Date(transaction.createdAt).toLocaleString()}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: ${transaction.type === 'commission' ? '#28a745' : '#007bff'};">
                        ${transaction.type === 'commission' ? '+' : ''}₦${(transaction.amount || 0).toLocaleString()}
                    </div>
                    <div style="color: #666; font-size: 0.9rem;">
                        <span class="status-badge status-${transaction.status}">${transaction.status}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = transactionsHTML;
    }

    setupWalletEventListeners() {
        // Refresh balance button
        const refreshBtn = document.getElementById('refreshBalance');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadWalletBalance();
            });
        }
        
        // Top up button
        const topUpBtn = document.getElementById('topUpBtn');
        if (topUpBtn) {
            topUpBtn.addEventListener('click', () => {
                alert('Top-up functionality will be implemented soon. Please use the Paystack dashboard for now.');
            });
        }
    }

    showWalletError(message) {
        document.getElementById('walletBalance').textContent = 'Error';
        document.getElementById('payoutCapacity').textContent = 'Error';
        document.getElementById('capacityText').textContent = 'Error loading data';
        
        const recommendationContent = document.getElementById('recommendationContent');
        if (recommendationContent) {
            recommendationContent.innerHTML = `<div style="color: #dc3545;">❌ ${message}</div>`;
        }
    }
}

// Global functions for ad management modals
function showCreateAdModal() {
    document.getElementById('createAdModal').style.display = 'block';
}

function closeCreateAdModal() {
    document.getElementById('createAdModal').style.display = 'none';
    document.getElementById('createAdForm').reset();
    
    // Reset edit state
    const modalTitle = document.querySelector('#createAdModal h2');
    if (modalTitle) {
        modalTitle.textContent = 'Create New Ad';
    }
    const createBtn = document.getElementById('createAdBtn');
    if (createBtn) {
        createBtn.textContent = 'Create Ad';
        createBtn.removeAttribute('data-edit-id');
    }
    
    // Clear image preview
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.style.display = 'none';
        imagePreview.src = '';
    }
}

function showCreateCampaignModal() {
    document.getElementById('createCampaignModal').style.display = 'block';
}

function closeCreateCampaignModal() {
    document.getElementById('createCampaignModal').style.display = 'none';
    document.getElementById('createCampaignForm').reset();
}

// Image upload functions
async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        showImageUploadStatus('File size must be less than 5MB', 'error');
        return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showImageUploadStatus('Please select a valid image file (JPEG, PNG, GIF, WebP)', 'error');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('imageUploadPlaceholder').style.display = 'none';
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('previewImg').src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    showImageUploadStatus('Uploading image...', 'progress');
    
    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/admin-ads/upload-image', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('adImageUrl').value = result.image.url;
            showImageUploadStatus('✅ Image uploaded successfully!', 'success');
        } else {
            throw new Error(result.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Image upload error:', error);
        showImageUploadStatus('❌ Failed to upload image: ' + error.message, 'error');
        // Reset file input
        input.value = '';
        document.getElementById('imageUploadPlaceholder').style.display = 'block';
        document.getElementById('imagePreview').style.display = 'none';
    }
}

function removeImage() {
    document.getElementById('adImageFile').value = '';
    document.getElementById('adImageUrl').value = '';
    document.getElementById('imageUploadPlaceholder').style.display = 'block';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadStatus').innerHTML = '';
}

function showImageUploadStatus(message, type) {
    const statusDiv = document.getElementById('imageUploadStatus');
    statusDiv.innerHTML = message;
    statusDiv.className = `upload-${type}`;
}

// Add drag and drop functionality
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.querySelector('.image-upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                document.getElementById('adImageFile').files = files;
                handleImageUpload(document.getElementById('adImageFile'));
            }
        });
    }
});

async function createAd() {
    // Check if this is an edit operation (moved outside try block)
    const createBtn = document.getElementById('createAdBtn');
    const editId = createBtn ? createBtn.getAttribute('data-edit-id') : null;
    const isEdit = editId && editId !== 'null';
    
    try {
        // Check if image is uploaded
        const imageUrl = document.getElementById('adImageUrl').value;
        if (!imageUrl) {
            alert('Please upload an image for the ad');
            return;
        }

        // Get target pages from checkboxes
        const targetPages = Array.from(document.querySelectorAll('input[name="adTargetPages"]:checked')).map(cb => cb.value);
        if (targetPages.length === 0) {
            alert('Please select at least one target page');
            return;
        }

        // Get target user types from checkboxes
        const targetUserTypes = Array.from(document.querySelectorAll('input[name="adTargetUserTypes"]:checked')).map(cb => cb.value);
        if (targetUserTypes.length === 0) {
            alert('Please select at least one target user type');
            return;
        }

        // Validate ad type and position synchronization
        const adType = document.getElementById('adType').value;
        const adPosition = document.getElementById('adPosition').value;
        
        if (!validateAdTypePosition(adType, adPosition)) {
            return; // Validation failed, error message already shown
        }

        const formData = {
            title: document.getElementById('adTitle').value,
            type: document.getElementById('adType').value,
            status: document.getElementById('adStatus').value,
            priority: parseInt(document.getElementById('adPriority').value) || 1,
            description: document.getElementById('adDescription').value,
            image: imageUrl,
            link: document.getElementById('adClickUrl').value,
            position: document.getElementById('adPosition').value,
            startDate: document.getElementById('adStartDate').value ? new Date(document.getElementById('adStartDate').value) : null,
            endDate: document.getElementById('adEndDate').value ? new Date(document.getElementById('adEndDate').value) : null,
            targetPages: targetPages,
            targetUserTypes: targetUserTypes
        };

        const url = isEdit 
            ? `${window.BACKEND_URL || window.location.origin}/api/admin-ads/ads/${editId}`
            : `${window.BACKEND_URL || window.location.origin}/api/admin-ads/ads`;
        
        const method = isEdit ? 'PUT' : 'POST';

        // Validate token before making API call
        if (!validateToken()) {
            alert('Your session has expired. Please login again.');
            window.location.href = '/admin-login.html';
            return;
        }
        
        const token = localStorage.getItem('vendplug-admin-token');
        console.log('🔑 Create ad token validated successfully');
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData
            });
            
            if (response.status === 401) {
                console.error('❌ Authentication failed - token expired');
                alert('Your session has expired. Please login again.');
                // Clear the expired token
                localStorage.removeItem('vendplug-admin-token');
                window.location.href = '/admin-login.html';
                return;
            }
            
            const errorMessage = errorData.message || errorData.error || `Failed to ${isEdit ? 'update' : 'create'} ad (${response.status})`;
            throw new Error(errorMessage);
        }

        alert(`Ad ${isEdit ? 'updated' : 'created'} successfully!`);
        try {
            closeCreateAdModal();
        } catch (closeError) {
            console.warn('Warning: Error closing modal:', closeError);
        }
        adminDashboard.loadAds();
        
        // Refresh ads on public pages if adManager exists
        if (window.adManager && typeof window.adManager.refreshAds === 'function') {
            window.adManager.refreshAds();
        }
    } catch (error) {
        console.error(`Error ${isEdit ? 'updating' : 'creating'} ad:`, error);
        alert(`Failed to ${isEdit ? 'update' : 'create'} ad`);
    }
}

async function createCampaign() {
    try {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const title = getVal('campaignTitle');
        const message = getVal('campaignMessage');
        if (!title || !message) {
            alert('Please enter title and message');
            return;
        }

        // Map priority to model enum
        const rawPriority = (getVal('campaignPriority') || 'normal').toLowerCase();
        const priorityMap = { low: 'low', normal: 'normal', medium: 'normal', high: 'high', urgent: 'urgent' };
        const priority = priorityMap[rawPriority] || 'normal';

        // Targets (comma or single). Model expects array of ['buyer','agent','vendor','staff','admin','all']
        const rawTarget = getVal('campaignTarget') || 'all';
        const targetUserTypes = rawTarget
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        // Type and delivery method with safe defaults matching enums
        const type = (getVal('campaignType') || 'announcement').toLowerCase();
        const deliveryMethod = (getVal('campaignDelivery') || 'in_app').toLowerCase();

        // Scheduling
        const sendDateStr = getVal('campaignSendDate');
        const expiryDateStr = getVal('campaignExpiryDate');
        const scheduledFor = sendDateStr ? new Date(sendDateStr) : new Date();
        const expiresAt = expiryDateStr ? new Date(expiryDateStr) : new Date(scheduledFor.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Optional link/image/linkText
        const image = getVal('campaignImageUrl') || '';
        const link = getVal('campaignLinkUrl') || '';
        const linkText = getVal('campaignLinkText') || 'Learn More';

        // Optional settings JSON
        let settings = undefined;
        const dataStr = getVal('campaignData');
        if (dataStr) {
            try {
                const parsed = JSON.parse(dataStr);
                // Put user JSON under settings to align with schema
                settings = parsed;
            } catch (_) {
                alert('Additional data must be valid JSON');
                return;
            }
        }

        const payload = {
            title,
            message,
            type,
            deliveryMethod,
            priority,
            scheduledFor,
            expiresAt,
            targetUserTypes: targetUserTypes.length ? targetUserTypes : ['all'],
            image,
            link,
            linkText,
            status: 'scheduled'
        };
        if (settings) payload.settings = settings;

        // Determine create vs update
        const form = document.getElementById('createCampaignForm');
        const editId = form ? form.getAttribute('data-edit-id') : null;
        const isEdit = !!editId;

        const url = isEdit ? `/api/admin-ads/campaigns/${editId}` : '/api/admin-ads/campaigns';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to create campaign');
        }

        alert(isEdit ? 'Campaign updated successfully!' : 'Campaign created successfully!');
        // Reset edit state
        if (form) form.removeAttribute('data-edit-id');
        const btn = document.getElementById('createCampaignBtn');
        if (btn) btn.textContent = 'Create Campaign';
        closeCreateCampaignModal && closeCreateCampaignModal();
        adminDashboard && adminDashboard.loadCampaigns && adminDashboard.loadCampaigns();
    } catch (error) {
        console.error('Error saving campaign:', error);
        alert(error.message || 'Failed to save campaign');
    }
}

// UI helpers for quick scheduling presets
function setCampaignSendNow(checked) {
    const sendEl = document.getElementById('campaignSendDate');
    if (!sendEl) return;
    if (checked) {
        const now = new Date();
        sendEl.value = formatLocalDatetime(now);
    }
}

function setCampaignExpiry(days) {
    const sendEl = document.getElementById('campaignSendDate');
    const expiryEl = document.getElementById('campaignExpiryDate');
    if (!expiryEl) return;
    const base = sendEl && sendEl.value ? new Date(sendEl.value) : new Date();
    const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    expiryEl.value = formatLocalDatetime(expires);
}

function formatLocalDatetime(d) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function setCampaignDataTemplate(kind) {
    const el = document.getElementById('campaignData');
    if (!el) return;
    let tpl = {};
    if (kind === 'popup') {
        tpl = { popup: { showDelay: 2000, autoClose: 0, closeable: true, showOncePerUser: true } };
    } else if (kind === 'email') {
        tpl = { email: { subject: 'Announcement', template: 'basic', includeUnsubscribe: true } };
    } else if (kind === 'sms') {
        tpl = { sms: { provider: 'twilio' } };
    }
    el.value = JSON.stringify(tpl, null, 2);
}

function filterAds() {
    adminDashboard.loadAds();
}

function filterCampaigns() {
    adminDashboard.loadCampaigns();
}

async function editAd(adId) {
    try {
        // Validate token before making API call
        if (!validateToken()) {
            alert('Your session has expired. Please login again.');
            window.location.href = '/admin-login.html';
            return;
        }
        
        // Fetch the ad details
        const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin-ads/ads/${adId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                console.error('❌ Authentication failed - token expired');
                alert('Your session has expired. Please login again.');
                localStorage.removeItem('vendplug-admin-token');
                window.location.href = '/admin-login.html';
                return;
            }
            throw new Error(errorData.message || 'Failed to fetch ad details');
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error('Invalid response format');
        }
        const ad = result.data;

        // Populate the form with existing data
        document.getElementById('adTitle').value = ad.title;
        document.getElementById('adDescription').value = ad.description || '';
        document.getElementById('adType').value = ad.type;
        
        // Update position options based on ad type
        adminDashboard.updatePositionOptions();
        
        document.getElementById('adImageUrl').value = ad.image;
        document.getElementById('adClickUrl').value = ad.link || '';
        document.getElementById('adPosition').value = ad.position;
        document.getElementById('adPriority').value = ad.priority;
        document.getElementById('adStatus').value = ad.status;
        document.getElementById('adStartDate').value = new Date(ad.startDate).toISOString().slice(0, 16);
        document.getElementById('adEndDate').value = new Date(ad.endDate).toISOString().slice(0, 16);

        // Set target pages
        const targetPagesCheckboxes = document.querySelectorAll('input[name="adTargetPages"]');
        targetPagesCheckboxes.forEach(checkbox => {
            checkbox.checked = ad.targetPages.includes(checkbox.value) || ad.targetPages.includes('all');
        });

        // Set target user types
        const targetUserTypesCheckboxes = document.querySelectorAll('input[name="adTargetUserTypes"]');
        targetUserTypesCheckboxes.forEach(checkbox => {
            checkbox.checked = ad.targetUserTypes.includes(checkbox.value) || ad.targetUserTypes.includes('all');
        });

        // Show the modal
        showCreateAdModal();
        
        // Change the form title and button
        const modalTitle = document.querySelector('#createAdModal h2');
        if (modalTitle) {
            modalTitle.textContent = 'Edit Ad';
        }
        const createBtn = document.getElementById('createAdBtn');
        if (createBtn) {
            createBtn.textContent = 'Update Ad';
            createBtn.setAttribute('data-edit-id', adId);
        }

    } catch (error) {
        console.error('❌ Error fetching ad details:', error);
        alert('Failed to load ad details for editing');
    }
}

async function deleteAd(adId) {
    if (confirm('Are you sure you want to delete this ad?')) {
        try {
            // Validate token before making API call
            if (!validateToken()) {
                alert('Your session has expired. Please login again.');
                window.location.href = '/admin-login.html';
                return;
            }
            
            const response = await fetch(`${window.BACKEND_URL || window.location.origin}/api/admin-ads/ads/${adId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    console.error('❌ Authentication failed - token expired');
                    alert('Your session has expired. Please login again.');
                    localStorage.removeItem('vendplug-admin-token');
                    window.location.href = '/admin-login.html';
                    return;
                }
                throw new Error(errorData.message || 'Failed to delete ad');
            }

            const result = await response.json();
            
            if (result.success) {
                alert('Ad deleted successfully');
                // Reload the ads list
                adminDashboard.loadAds();
                
                // Refresh ads on public pages if adManager exists
                if (window.adManager && typeof window.adManager.refreshAds === 'function') {
                    window.adManager.refreshAds();
                }
            } else {
                throw new Error(result.message || 'Failed to delete ad');
            }

        } catch (error) {
            console.error('❌ Error deleting ad:', error);
            alert('Failed to delete ad: ' + error.message);
        }
    }
}

function editCampaign(campaignId) {
    fetch(`/api/admin-ads/campaigns/${campaignId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(result => {
        if (!result.success) throw new Error(result.message || 'Failed to load campaign');
        const c = result.data;
        // Open modal and populate fields
        showCreateCampaignModal();
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        setVal('campaignTitle', c.title);
        setVal('campaignMessage', c.message);
        setVal('campaignType', c.type || 'announcement');
        setVal('campaignDelivery', c.deliveryMethod || 'in_app');
        setVal('campaignPriority', c.priority || 'normal');
        setVal('campaignImageUrl', c.image || '');
        setVal('campaignLinkUrl', c.link || '');
        setVal('campaignLinkText', c.linkText || 'Learn More');
        const sendEl = document.getElementById('campaignSendDate');
        if (sendEl && c.scheduledFor) sendEl.value = formatLocalDatetime(new Date(c.scheduledFor));
        const expEl = document.getElementById('campaignExpiryDate');
        if (expEl && c.expiresAt) expEl.value = formatLocalDatetime(new Date(c.expiresAt));
        const dataEl = document.getElementById('campaignData');
        if (dataEl && c.settings) dataEl.value = JSON.stringify(c.settings, null, 2);

        // Store edit id for update
        const form = document.getElementById('createCampaignForm');
        if (form) form.setAttribute('data-edit-id', c._id);
        const createBtn = document.getElementById('createCampaignBtn');
        if (createBtn) createBtn.textContent = 'Update Campaign';
    })
    .catch(err => {
        console.error('Error loading campaign:', err);
        alert(err.message || 'Failed to load campaign');
    });
}

function deleteCampaign(campaignId) {
    if (confirm('Are you sure you want to delete this campaign?')) {
        fetch(`/api/admin-ads/campaigns/${campaignId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
                'Content-Type': 'application/json'
            }
        })
        .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete campaign');
            alert(data.message || 'Campaign deleted');
            adminDashboard && adminDashboard.loadCampaigns && adminDashboard.loadCampaigns();
        })
        .catch(err => {
            console.error('Error deleting campaign:', err);
            alert(err.message || 'Failed to delete campaign');
        });
    }
}

function sendCampaign(campaignId) {
    if (!confirm('Are you sure you want to send this campaign?')) return;
    fetch(`/api/admin-ads/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('vendplug-admin-token')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to send campaign');
        alert(data.message || 'Campaign sent');
        adminDashboard && adminDashboard.loadCampaigns && adminDashboard.loadCampaigns();
    })
    .catch(err => {
        console.error('Error sending campaign:', err);
        alert(err.message || 'Failed to send campaign');
    });
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});

