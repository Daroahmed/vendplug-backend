// backend/services/emailNotificationService.js
const nodemailer = require('nodemailer');
let dkimPlugin = null;
try {
    // Optional DKIM plugin, only used if env keys are present
    dkimPlugin = require('nodemailer-dkim');
} catch (_) {
    dkimPlugin = null;
}

class EmailNotificationService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.init();
    }

    init() {
        // Check if email configuration is available
        if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const port = Number(process.env.EMAIL_PORT || 587);
            const secure = port === 465; // only 465 is implicit TLS
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port,
                secure,
                pool: true,
                maxConnections: Number(process.env.EMAIL_MAX_CONNECTIONS || 5),
                maxMessages: Number(process.env.EMAIL_MAX_MESSAGES || 200),
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    minVersion: 'TLSv1.2',
                    // Allow override via env (e.g. self-signed during testing)
                    rejectUnauthorized: String(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED || 'true') !== 'false'
                },
                greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT || 10000),
                connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT || 10000)
            });

            // Default addressing for alignment and bounces
            const userDomain = (process.env.EMAIL_FROM_DOMAIN)
                || (process.env.EMAIL_USER.includes('@') ? process.env.EMAIL_USER.split('@').pop() : '');
            this.fromAddress = process.env.EMAIL_FROM
                || (userDomain ? `"Vendplug Escrow" <no-reply@${userDomain}>` : `"Vendplug Escrow" <${process.env.EMAIL_USER}>`);
            this.replyTo = process.env.EMAIL_REPLY_TO || this.fromAddress;
            this.returnPath = process.env.EMAIL_RETURN_PATH || ''; // set if you own a bounce mailbox, else leave empty

            // Optional DKIM signing
            if (dkimPlugin && process.env.DKIM_PRIVATE_KEY && (process.env.DKIM_DOMAIN || userDomain) && process.env.DKIM_SELECTOR) {
                try {
                    this.transporter.use('stream', dkimPlugin.signer({
                        domainName: process.env.DKIM_DOMAIN || userDomain,
                        keySelector: process.env.DKIM_SELECTOR,
                        privateKey: process.env.DKIM_PRIVATE_KEY
                    }));
                    console.log('✅ DKIM signer enabled');
                } catch (e) {
                    console.warn('⚠️ Failed to enable DKIM signer:', e.message);
                }
            }

            this.isConfigured = true;
            console.log('✅ Email notification service configured');
        } else {
            console.log('⚠️ Email configuration not found. Email notifications disabled.');
            console.log('   Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables to enable email notifications.');
        }
    }

    /**
     * Build normalized mail options to keep alignment and headers consistent.
     */
    buildMail({ to, subject, html, text, refId }) {
        const mail = {
            from: this.fromAddress || `"Vendplug Escrow" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text,
            replyTo: this.replyTo,
            headers: {
                'Auto-Submitted': 'auto-generated',
                ...(refId ? { 'X-Entity-Ref-ID': String(refId).slice(0, 120) } : {})
            }
        };
        if (this.returnPath) {
            mail.envelope = { from: this.returnPath, to };
        }
        return mail;
    }

    // Send dispute assignment notification
    async sendDisputeAssignmentNotification(staffEmail, staffName, dispute) {
        if (!this.isConfigured) {
            console.log(`📧 [Email disabled] Would send assignment notification to ${staffEmail}`);
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const mailOptions = this.buildMail({
                to: staffEmail,
                subject: `New Dispute Assignment - ${dispute.disputeId}`,
                html: this.generateAssignmentEmailHTML(staffName, dispute),
                text: this.generateAssignmentEmailText(staffName, dispute),
                refId: dispute && dispute.disputeId
            });

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Assignment notification sent to ${staffEmail}`);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('Error sending assignment notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Send dispute resolution notification
    async sendDisputeResolutionNotification(complainantEmail, complainantName, dispute, resolution) {
        if (!this.isConfigured) {
            console.log(`📧 [Email disabled] Would send resolution notification to ${complainantEmail}`);
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const mailOptions = this.buildMail({
                to: complainantEmail,
                subject: `Dispute Resolution - ${dispute.disputeId}`,
                html: this.generateResolutionEmailHTML(complainantName, dispute, resolution),
                text: this.generateResolutionEmailText(complainantName, dispute, resolution),
                refId: dispute && dispute.disputeId
            });

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Resolution notification sent to ${complainantEmail}`);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('Error sending resolution notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Send dispute status update notification
    async sendDisputeStatusUpdateNotification(userEmail, userName, dispute, newStatus) {
        if (!this.isConfigured) {
            console.log(`📧 [Email disabled] Would send status update to ${userEmail}`);
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const mailOptions = this.buildMail({
                to: userEmail,
                subject: `Dispute Status Update - ${dispute.disputeId}`,
                html: this.generateStatusUpdateEmailHTML(userName, dispute, newStatus),
                text: this.generateStatusUpdateEmailText(userName, dispute, newStatus),
                refId: dispute && dispute.disputeId
            });

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Status update notification sent to ${userEmail}`);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('Error sending status update notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Generate HTML email for dispute assignment
    generateAssignmentEmailHTML(staffName, dispute) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>New Dispute Assignment</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2c3e50, #3498db); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
                    .dispute-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3498db; }
                    .priority-urgent { border-left-color: #e74c3c; }
                    .priority-high { border-left-color: #f39c12; }
                    .priority-medium { border-left-color: #f1c40f; }
                    .priority-low { border-left-color: #27ae60; }
                    .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎯 New Dispute Assignment</h1>
                        <p>Hello ${staffName}, you have been assigned a new dispute to resolve.</p>
                    </div>
                    <div class="content">
                        <div class="dispute-info priority-${dispute.priority}">
                            <h3>${dispute.disputeId}</h3>
                            <h4>${dispute.title}</h4>
                            <p><strong>Category:</strong> ${dispute.category.replace(/_/g, ' ')}</p>
                            <p><strong>Priority:</strong> ${dispute.priority.toUpperCase()}</p>
                            <p><strong>Description:</strong> ${dispute.description}</p>
                            <p><strong>Created:</strong> ${new Date(dispute.createdAt).toLocaleDateString()}</p>
                        </div>
                        <p>Please log into the staff dashboard to review and resolve this dispute.</p>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/staff-dispute-dashboard.html" class="btn">View Dispute</a>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Vendplug Escrow System.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Generate text email for dispute assignment
    generateAssignmentEmailText(staffName, dispute) {
        return `
            New Dispute Assignment
            
            Hello ${staffName},
            
            You have been assigned a new dispute to resolve:
            
            Dispute ID: ${dispute.disputeId}
            Title: ${dispute.title}
            Category: ${dispute.category.replace(/_/g, ' ')}
            Priority: ${dispute.priority.toUpperCase()}
            Description: ${dispute.description}
            Created: ${new Date(dispute.createdAt).toLocaleDateString()}
            
            Please log into the staff dashboard to review and resolve this dispute.
            
            Best regards,
            Vendplug Escrow System
        `;
    }

    // Generate HTML email for dispute resolution
    generateResolutionEmailHTML(complainantName, dispute, resolution) {
        const decisionText = {
            'favor_complainant': 'in your favor',
            'favor_respondent': 'in favor of the respondent',
            'partial_refund': 'with a partial refund',
            'full_refund': 'with a full refund',
            'no_action': 'with no action required',
            'escalated': 'escalated for further review'
        };

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Dispute Resolution</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
                    .resolution-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #27ae60; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Dispute Resolved</h1>
                        <p>Your dispute has been resolved ${decisionText[resolution.decision] || 'successfully'}.</p>
                    </div>
                    <div class="content">
                        <div class="resolution-info">
                            <h3>${dispute.disputeId}</h3>
                            <h4>${dispute.title}</h4>
                            <p><strong>Decision:</strong> ${resolution.decision.replace(/_/g, ' ')}</p>
                            <p><strong>Reason:</strong> ${resolution.reason}</p>
                            ${resolution.refundAmount > 0 ? `<p><strong>Refund Amount:</strong> $${resolution.refundAmount}</p>` : ''}
                            ${resolution.notes ? `<p><strong>Additional Notes:</strong> ${resolution.notes}</p>` : ''}
                            <p><strong>Resolved:</strong> ${new Date(resolution.resolvedAt).toLocaleDateString()}</p>
                        </div>
                        <p>Thank you for using Vendplug Escrow. If you have any questions about this resolution, please contact our support team.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Vendplug Escrow System.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Generate text email for dispute resolution
    generateResolutionEmailText(complainantName, dispute, resolution) {
        const decisionText = {
            'favor_complainant': 'in your favor',
            'favor_respondent': 'in favor of the respondent',
            'partial_refund': 'with a partial refund',
            'full_refund': 'with a full refund',
            'no_action': 'with no action required',
            'escalated': 'escalated for further review'
        };

        return `
            Dispute Resolution
            
            Hello ${complainantName},
            
            Your dispute has been resolved ${decisionText[resolution.decision] || 'successfully'}:
            
            Dispute ID: ${dispute.disputeId}
            Title: ${dispute.title}
            Decision: ${resolution.decision.replace(/_/g, ' ')}
            Reason: ${resolution.reason}
            ${resolution.refundAmount > 0 ? `Refund Amount: $${resolution.refundAmount}` : ''}
            ${resolution.notes ? `Additional Notes: ${resolution.notes}` : ''}
            Resolved: ${new Date(resolution.resolvedAt).toLocaleDateString()}
            
            Thank you for using Vendplug Escrow. If you have any questions about this resolution, please contact our support team.
            
            Best regards,
            Vendplug Escrow System
        `;
    }

    // Generate HTML email for status update
    generateStatusUpdateEmailHTML(userName, dispute, newStatus) {
        const statusText = {
            'assigned': 'assigned to a staff member',
            'under_review': 'under review',
            'resolved': 'resolved',
            'closed': 'closed',
            'escalated': 'escalated'
        };

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Dispute Status Update</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #3498db, #5dade2); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
                    .status-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3498db; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 Dispute Status Update</h1>
                        <p>Your dispute status has been updated.</p>
                    </div>
                    <div class="content">
                        <div class="status-info">
                            <h3>${dispute.disputeId}</h3>
                            <h4>${dispute.title}</h4>
                            <p><strong>New Status:</strong> ${statusText[newStatus] || newStatus}</p>
                            <p><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        <p>You can check the current status of your dispute by logging into your account.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Vendplug Escrow System.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Generate text email for status update
    generateStatusUpdateEmailText(userName, dispute, newStatus) {
        const statusText = {
            'assigned': 'assigned to a staff member',
            'under_review': 'under review',
            'resolved': 'resolved',
            'closed': 'closed',
            'escalated': 'escalated'
        };

        return `
            Dispute Status Update
            
            Hello ${userName},
            
            Your dispute status has been updated:
            
            Dispute ID: ${dispute.disputeId}
            Title: ${dispute.title}
            New Status: ${statusText[newStatus] || newStatus}
            Updated: ${new Date().toLocaleDateString()}
            
            You can check the current status of your dispute by logging into your account.
            
            Best regards,
            Vendplug Escrow System
        `;
    }

    // Test email configuration
    async testEmailConfiguration() {
        if (!this.isConfigured) {
            return { success: false, message: 'Email service not configured' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Email configuration is valid' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Create singleton instance
const emailNotificationService = new EmailNotificationService();

module.exports = emailNotificationService;
