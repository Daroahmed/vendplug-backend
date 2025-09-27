// Data formatting utilities for better display
class DataFormatter {
    // Format user names with better fallbacks
    static formatUserName(user, fallback = 'Unknown User') {
        if (!user) return fallback;
        
        // Try different name fields
        const name = user.fullName || user.name || user.shopName || user.username;
        if (name && name.trim()) return name.trim();
        
        // If we have email, extract name part
        if (user.email) {
            const emailName = user.email.split('@')[0];
            return emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        
        return fallback;
    }

    // Format email with fallback
    static formatEmail(email, fallback = 'No email') {
        if (!email || !email.trim()) return fallback;
        return email.trim();
    }

    // Format username with fallback
    static formatUsername(username, fallback = 'No username') {
        if (!username || !username.trim()) return fallback;
        return username.trim();
    }

    // Format currency with better fallbacks
    static formatCurrency(amount, fallback = '₦0') {
        if (amount === null || amount === undefined || isNaN(amount)) return fallback;
        return `₦${Number(amount).toLocaleString()}`;
    }

    // Format order ID with fallback
    static formatOrderId(orderId, fallback = 'No ID') {
        if (!orderId) return fallback;
        return orderId.toString();
    }

    // Format date with better fallbacks
    static formatDate(date, fallback = 'No date') {
        if (!date) return fallback;
        try {
            return new Date(date).toLocaleDateString();
        } catch (error) {
            return fallback;
        }
    }

    // Format status with better styling
    static formatStatus(status, fallback = 'Unknown') {
        if (!status) return fallback;
        return status.replace('_', ' ').toUpperCase();
    }

    // Format category with better display
    static formatCategory(category, fallback = 'Other') {
        if (!category) return fallback;
        
        const categoryMap = {
            'product_not_received': 'Product Not Received',
            'product_damaged': 'Product Damaged',
            'product_not_as_described': 'Product Not As Described',
            'wrong_product': 'Wrong Product',
            'delivery_issues': 'Delivery Issues',
            'payment_issues': 'Payment Issues',
            'communication_issues': 'Communication Issues',
            'other': 'Other'
        };
        
        return categoryMap[category] || category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Format user type with better display
    static formatUserType(userType, fallback = 'User') {
        if (!userType) return fallback;
        
        const typeMap = {
            'Buyer': 'Buyer',
            'Vendor': 'Vendor',
            'Agent': 'Agent',
            'Admin': 'Admin',
            'dispute_manager': 'Dispute Manager',
            'dispute_specialist': 'Dispute Specialist',
            'dispute_analyst': 'Dispute Analyst'
        };
        
        return typeMap[userType] || userType;
    }

    // Format bank details
    static formatBankDetails(bankAccount, fallback = 'No bank details') {
        if (!bankAccount) return fallback;
        
        const bankName = bankAccount.bankName || 'Unknown Bank';
        const accountNumber = bankAccount.accountNumber || '****';
        const accountName = bankAccount.accountName || 'Unknown Account';
        
        return `${bankName} - ${accountName} (${accountNumber})`;
    }

    // Format dispute priority
    static formatPriority(priority, fallback = 'Medium') {
        if (!priority) return fallback;
        
        const priorityMap = {
            'low': 'Low',
            'medium': 'Medium',
            'high': 'High',
            'urgent': 'Urgent'
        };
        
        return priorityMap[priority] || priority.charAt(0).toUpperCase() + priority.slice(1);
    }

    // Format resolution decision
    static formatResolutionDecision(decision, fallback = 'Pending') {
        if (!decision) return fallback;
        
        const decisionMap = {
            'favor_complainant': 'Favor Complainant',
            'favor_respondent': 'Favor Respondent',
            'partial_refund': 'Partial Refund',
            'full_refund': 'Full Refund',
            'no_action': 'No Action',
            'no_refund': 'No Refund',
            'escalated': 'Escalated'
        };
        
        return decisionMap[decision] || decision.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Format escalation reason
    static formatEscalationReason(reason, fallback = 'Not specified') {
        if (!reason) return fallback;
        
        const reasonMap = {
            'complex_case': 'Complex Case',
            'high_value': 'High Value',
            'repeat_offender': 'Repeat Offender',
            'policy_violation': 'Policy Violation',
            'system_issue': 'System Issue',
            'customer_complaint': 'Customer Complaint',
            'legal_issue': 'Legal Issue',
            'other': 'Other'
        };
        
        return reasonMap[reason] || reason.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Get status badge class
    static getStatusBadgeClass(status) {
        if (!status) return 'status-unknown';
        
        const statusMap = {
            'pending': 'status-pending',
            'processing': 'status-processing',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled',
            'open': 'status-open',
            'assigned': 'status-assigned',
            'under_review': 'status-under-review',
            'resolved': 'status-resolved',
            'closed': 'status-closed',
            'escalated': 'status-escalated',
            'low': 'status-low',
            'medium': 'status-medium',
            'high': 'status-high',
            'urgent': 'status-urgent'
        };
        
        return statusMap[status] || 'status-unknown';
    }

    // Format phone number
    static formatPhone(phone, fallback = 'No phone') {
        if (!phone || !phone.trim()) return fallback;
        return phone.trim();
    }

    // Format address
    static formatAddress(address, fallback = 'No address') {
        if (!address || !address.trim()) return fallback;
        return address.trim();
    }

    // Format description with truncation
    static formatDescription(description, maxLength = 100, fallback = 'No description') {
        if (!description || !description.trim()) return fallback;
        
        const trimmed = description.trim();
        if (trimmed.length <= maxLength) return trimmed;
        
        return trimmed.substring(0, maxLength) + '...';
    }
}

// Make it available globally
window.DataFormatter = DataFormatter;
