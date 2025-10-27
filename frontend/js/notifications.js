console.log("✅ notifications.js loaded");

const BACKEND = window.BACKEND_URL || "";

class NotificationManager {
  constructor() {
    this.socket = io(window.SOCKET_URL || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    this.notifications = [];
    this.unreadCount = 0;
    this.setupSocketListeners();
    this.setupUIElements();
  }

  setupSocketListeners() {
    // Connect to socket
    this.socket.on('connect', () => {
      console.log('✅ Connected to notification system');
      
      // Register for notifications based on user type and ID
      const userData = this.getCurrentUserData();
      if (userData) {
        this.socket.emit('register', userData.id);
      }
    });

    // Listen for new notifications
    this.socket.on('new-notification', (notification) => {
      // Only process notifications for the current user
      const currentUser = this.getCurrentUserData();
      if (currentUser && notification.userId === currentUser.id) {
        this.notifications.unshift(notification);
        this.unreadCount++;
        this.updateUI();
        this.showToast(notification);
      }
    });

    // Handle connection errors
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });
  }

  setupUIElements() {
    // Try to find header actions container (different for different pages)
    const headerActions = document.querySelector('.header-actions') || document.querySelector('.user-menu');
    console.log('🔍 Looking for header container:', headerActions);
    console.log('🔍 Notification icon already exists:', document.getElementById('notification-icon'));
    
    if (headerActions && !document.getElementById('notification-icon')) {
      // Create notification icon
      const notificationIcon = document.createElement('a');
      notificationIcon.href = '#';
      notificationIcon.className = 'notification-icon';
      notificationIcon.id = 'notification-icon';
      notificationIcon.innerHTML = `
        <i class="fas fa-bell"></i>
        <span class="notification-badge" id="notification-badge">0</span>
      `;
      
      // Insert before the closing div of header-actions
      headerActions.appendChild(notificationIcon);
      
      console.log('✅ Notification icon injected successfully');
      console.log('🔍 Header actions now contains:', headerActions.innerHTML);
    } else {
      console.log('❌ Cannot inject notification icon - headerActions:', !!headerActions, 'icon exists:', !!document.getElementById('notification-icon'));
    }

    // Create notification dropdown if it doesn't exist
    if (!document.getElementById('notification-dropdown')) {
      const dropdown = document.createElement('div');
      dropdown.id = 'notification-dropdown';
      dropdown.className = 'notification-dropdown';
      dropdown.innerHTML = `
        <div class="notification-header">
          <h3>Notifications</h3>
          <button id="mark-all-read">Mark all as read</button>
        </div>
        <div class="notification-list" id="notification-list"></div>
      `;
      document.body.appendChild(dropdown);

      // Add styles for notification dropdown only
      const styles = document.createElement('style');
      styles.textContent = `
        .notification-dropdown {
          position: fixed;
          top: 60px;
          right: 20px;
          width: 350px;
          max-height: 400px;
          background: var(--bg-card, #1e1e1e);
          border: 1px solid var(--bg-secondary, #2c2c2c);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 1000;
          display: none;
          overflow: hidden;
        }

        .notification-header {
          padding: 1rem;
          border-bottom: 1px solid var(--bg-secondary, #2c2c2c);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .notification-header h3 {
          margin: 0;
          color: var(--text-light, #fff);
          font-size: 1.1rem;
        }

        #mark-all-read {
          background: var(--primary, #00cc99);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        #mark-all-read:hover {
          opacity: 0.9;
        }

        .notification-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .notification-item {
          padding: 1rem;
          border-bottom: 1px solid var(--bg-secondary, #2c2c2c);
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .notification-item:hover {
          background-color: var(--bg-secondary, #2c2c2c);
        }

        .notification-item.unread {
          background-color: rgba(0, 204, 153, 0.1);
        }

        .notification-title {
          font-weight: bold;
          color: var(--text-light, #fff);
          margin-bottom: 0.25rem;
        }

        .notification-message {
          color: var(--muted, #aaa);
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }

        .notification-time {
          color: var(--muted, #aaa);
          font-size: 0.8rem;
        }

        .notification-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: var(--primary, #00cc99);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 1001;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `;
      document.head.appendChild(styles);
    }

    // Add event listeners (outside the if block to avoid scope issues)
    const icon = document.getElementById('notification-icon');
    const dropdown = document.getElementById('notification-dropdown');
    const markAllRead = document.getElementById('mark-all-read');

    if (icon && dropdown && markAllRead) {
      icon.addEventListener('click', () => {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });

      markAllRead.addEventListener('click', () => {
        this.markAllAsRead();
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !icon.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }
  }

  getCurrentUserData() {
    // Use smart auth utility to get current user
    const userData = getCurrentUser();
    const userType = getCurrentUserType();
    
    if (userData && userType) {
      // Handle different ID field names for different user types
      const userId = userData._id || userData.id;
      console.log(`✅ Found ${userType} user:`, userId);
      return {
        id: userId,
        role: userType
      };
    }
    
    console.log('❌ No user data found');
    return null;
  }

  async loadNotifications() {
    try {
      const userData = this.getCurrentUserData();
      if (!userData) return;

      // Get the correct token using smart auth utility
      const token = getAuthToken();
      
      if (!token) {
        console.log('❌ No token found for role:', userData.role);
        return;
      }
      
      console.log(`🔑 Using smart auth token for ${userData.role}`);

      const res = await fetch(`${BACKEND}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to load notifications');

      const data = await res.json();
      this.notifications = data;
      this.unreadCount = data.filter(n => !n.read).length;
      this.updateUI();
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    }
  }

  async markAsRead(notificationId) {
    try {
      const userData = this.getCurrentUserData();
      if (!userData) return;

      const token = getAuthToken();
      
      if (!token) {
        console.log('❌ No token found for role:', userData.role);
        return;
      }

      const res = await fetch(`${BACKEND}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to mark notification as read');

      // Update local state
      const notification = this.notifications.find(n => n._id === notificationId);
      if (notification && !notification.read) {
        notification.read = true;
        this.unreadCount--;
        this.updateUI();
      }
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      const userData = this.getCurrentUserData();
      if (!userData) return;

      const token = getAuthToken();
      
      if (!token) {
        console.log('❌ No token found for role:', userData.role);
        return;
      }

      const res = await fetch(`${BACKEND}/api/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to mark all notifications as read');

      // Update local state
      this.notifications.forEach(n => n.read = true);
      this.unreadCount = 0;
      this.updateUI();
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    }
  }

  updateUI() {
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');

    // Update badge if it exists
    if (badge) {
      if (this.unreadCount > 0) {
        badge.style.display = 'block';
        badge.textContent = this.unreadCount;
      } else {
        badge.style.display = 'none';
      }
    }

    // Update list if it exists
    if (list) {
      list.innerHTML = this.notifications.length ? 
        this.notifications.map(n => this.renderNotification(n)).join('') :
        '<div class="notification-item">No notifications</div>';
    }
  }

  renderNotification(notification) {
    const time = new Date(notification.createdAt).toLocaleString();
    return `
      <div class="notification-item ${notification.read ? '' : 'unread'}" 
           onclick="notificationManager.markAsRead('${notification._id}')">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">${time}</div>
      </div>
    `;
  }

  showToast(notification) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.textContent = notification.title;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize notification manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM Content Loaded - Initializing notification manager');
  const notificationManager = new NotificationManager();
  
  // Load existing notifications
  notificationManager.loadNotifications();
  
  // Export for global use
  window.notificationManager = notificationManager;
  
  // Fallback: try again after a short delay if icon wasn't injected
  setTimeout(() => {
    if (!document.getElementById('notification-icon')) {
      console.log('🔄 Retrying notification icon injection...');
      notificationManager.setupUIElements();
    }
  }, 1000);
});
