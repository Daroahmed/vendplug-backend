console.log("✅ messageNotifications.js loaded");

class MessageNotificationManager {
  constructor() {
    this.socket = io(window.BACKEND_URL || "");
    this.unreadCount = 0;
    this.setupSocketListeners();
    this.setupUIElements();
    this.loadUnreadCount();
  }

  setupSocketListeners() {
    // Connect to socket
    this.socket.on('connect', () => {
      console.log('✅ Connected to message notification system');
      
      // Register for notifications based on user type and ID
      const userData = this.getCurrentUserData();
      if (userData) {
        this.socket.emit('register', userData.id);
      }
    });

    // Listen for new messages
    this.socket.on('new_message', (data) => {
      console.log('📨 New message received:', data);
      
      // Only process messages for the current user
      const currentUser = this.getCurrentUserData();
      if (currentUser && data.recipientId === currentUser.id) {
        this.unreadCount++;
        this.updateMessageBadge();
        this.showMessageToast(data.message);
      }
    });

    // Handle connection errors
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });
  }

  setupUIElements() {
    // Find message badge elements
    this.messageBadge = document.getElementById('messageBadge') || document.getElementById('messageCount');
    this.messageIcon = document.getElementById('messageIcon') || document.querySelector('.message-icon');
    
    console.log('🔍 Message badge element:', this.messageBadge);
    console.log('🔍 Message icon element:', this.messageIcon);
    
    if (this.messageBadge) {
      this.updateMessageBadge();
    } else {
      console.log('❌ Message badge not found in DOM');
    }
  }

  getCurrentUserData() {
    // Determine user type based on current page context first
    const currentPage = window.location.pathname;
    let expectedRole = null;
    
    if (currentPage.includes('buyer')) {
      expectedRole = { key: 'vendplugBuyer', tokenKey: 'vendplug-buyer-token', role: 'buyer' };
    } else if (currentPage.includes('vendor')) {
      expectedRole = { key: 'vendplugVendor', tokenKey: 'vendplug-vendor-token', role: 'vendor' };
    } else if (currentPage.includes('agent')) {
      expectedRole = { key: 'vendplugAgent', tokenKey: 'vendplug-agent-token', role: 'agent' };
    }
    
    console.log('🔍 Message system - Current page context:', currentPage, 'Expected role:', expectedRole?.role);
    
    // If we can determine the expected role from the page, prioritize that user
    if (expectedRole) {
      const userData = getCurrentUser();
      const token = getAuthToken();
      
      console.log(`🔍 Message system checking expected ${expectedRole.role}:`, {
        userData: !!userData,
        token: !!token,
        tokenValue: token ? `${token.substring(0, 10)}...` : 'null'
      });
      
      if (userData && token) {
        console.log(`✅ Found expected ${expectedRole.role} user with token:`, userData._id);
        return { ...userData, role: expectedRole.role };
      }
    }
    
    // Fallback: Check all roles (for backward compatibility)
    const roles = [
      { key: 'vendplugBuyer', tokenKey: 'vendplug-buyer-token', role: 'buyer' },
      { key: 'vendplugVendor', tokenKey: 'vendplug-vendor-token', role: 'vendor' },
      { key: 'vendplugAgent', tokenKey: 'vendplug-agent-token', role: 'agent' }
    ];
    
    for (const { key, tokenKey, role } of roles) {
      const userData = getCurrentUser();
      const token = getAuthToken();
      
      console.log(`🔍 Message system checking ${role}:`, {
        userData: !!userData,
        token: !!token,
        tokenValue: token ? `${token.substring(0, 10)}...` : 'null'
      });
      
      if (userData && token) {
        console.log(`✅ Found ${role} user with token:`, userData._id);
        return { ...userData, role };
      }
    }
    
    // Fallback: return first available user data (for backward compatibility)
    const buyerData = JSON.parse(localStorage.getItem('vendplugBuyer') || 'null');
    const vendorData = JSON.parse(localStorage.getItem('vendplugVendor') || 'null');
    const agentData = JSON.parse(localStorage.getItem('vendplugAgent') || 'null');
    
    const userData = buyerData || vendorData || agentData;
    if (userData) {
      console.log(`⚠️ Found user without token (fallback):`, userData._id);
    } else {
      console.log('❌ No user data found in localStorage');
    }
    
    return userData;
  }

  async loadUnreadCount() {
    try {
      const userData = this.getCurrentUserData();
      if (!userData) return;

      const token = this.getUserToken(userData);
      if (!token) return;

      const response = await fetch(`${window.BACKEND_URL || ""}/api/chats/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.unreadCount = data.unreadCount || 0;
        this.updateMessageBadge();
      }
    } catch (error) {
      console.error('❌ Error loading unread count:', error);
    }
  }

  getUserToken(userData) {
    // Use smart auth utility
    const token = getAuthToken();
    if (token) {
      console.log('🔑 Using smart auth token for', userData.role);
      return token;
    }
    
    console.log('❌ No token found for role:', userData.role);
    return null;
  }

  updateMessageBadge() {
    if (this.messageBadge) {
      this.messageBadge.textContent = this.unreadCount;
      this.messageBadge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
      console.log('📊 Updated message badge:', this.unreadCount, 'display:', this.messageBadge.style.display);
    } else {
      console.log('❌ Message badge element not found');
    }
    
    // Also update the notification icon if it exists
    this.updateNotificationIcon();
  }

  updateNotificationIcon() {
    // Update the notification icon to include message count
    const notificationBadge = document.getElementById('notification-badge');
    if (notificationBadge && window.notificationManager) {
      const totalUnread = (window.notificationManager.unreadCount || 0) + this.unreadCount;
      notificationBadge.textContent = totalUnread;
      notificationBadge.style.display = totalUnread > 0 ? 'flex' : 'none';
      console.log('📊 Updated notification badge with total count:', totalUnread);
    }
  }

  showMessageToast(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'message-toast';
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-comments"></i>
        <div class="toast-text">
          <strong>New Message</strong>
          <p>${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}</p>
        </div>
      </div>
    `;
    
    // Add toast styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--bg-card, #1e1e1e);
      color: var(--text-light, #fff);
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .message-toast .toast-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .message-toast .toast-text strong {
        display: block;
        color: var(--primary, #00cc99);
        margin-bottom: 5px;
      }
      .message-toast .toast-text p {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  // Method to mark messages as read (call this when user opens chat)
  markAsRead() {
    this.unreadCount = 0;
    this.updateMessageBadge();
  }
}

// Initialize message notification manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM Content Loaded - Initializing message notification manager');
  const messageNotificationManager = new MessageNotificationManager();
  
  // Export for use in other scripts
  window.messageNotificationManager = messageNotificationManager;
});
