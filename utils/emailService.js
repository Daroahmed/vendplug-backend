const nodemailer = require('nodemailer');

// Create transporter with Zoho Mail configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.zoho.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  requireTLS: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
});

// Validate email configuration
if (!process.env.EMAIL_USER || (!process.env.EMAIL_PASSWORD && !process.env.EMAIL_PASS)) {
  console.warn('⚠️ Email credentials not configured. Check your .env file.');
}

// Test email connection
const testConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email connection successful');
    return true;
  } catch (error) {
    console.error('❌ Email connection failed:', error.message);
    
    // If it's a connection issue, try to reconnect
    if (error.message.includes('Greeting never received') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT')) {
      console.log('🔄 Attempting to reconnect to email service...');
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        await transporter.verify();
        console.log('✅ Email reconnection successful');
        return true;
      } catch (retryError) {
        console.error('❌ Email reconnection failed:', retryError.message);
        return false;
      }
    }
    
    return false;
  }
};

// Send verification email
const sendVerificationEmail = async (email, token) => {
  try {
    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Email service not available');
    }

    // Use environment variable or try to detect the actual server URL
    let baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) {
      // Try to get the actual server IP/domain
             const serverUrl = process.env.SERVER_URL || process.env.BACKEND_URL || 'http://localhost:5000';
       baseUrl = serverUrl.replace('/api', ''); // Remove /api if present
     }
     
     // For development, use your computer's IP address so phone can access it
     if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
       // You can set this in your .env file: DEV_IP=192.168.1.100
       const devIp = process.env.DEV_IP;
       if (devIp) {
         baseUrl = `http://${devIp}:5000`;
       }
    }
    
    const verificationLink = `${baseUrl}/verify-email.html?token=${token}`;
    
    console.log('🔍 Email verification debug:');
    console.log('  - baseUrl:', baseUrl);
    console.log('  - token:', token);
    console.log('  - full verification link:', verificationLink);
    
    const mailOptions = {
      from: `"Vendplug" <${process.env.EMAIL_USER}>`, // Use authenticated email
      to: email,
      subject: 'Verify Your Vendplug Account',
      html: `
        <h2>Welcome to Vendplug!</h2>
        <p>Thank you for registering. Please click the link below to verify your email address:</p>
        <a href="${verificationLink}" style="
          background-color: #00cc99;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          display: inline-block;
          margin: 10px 0;
        ">Verify Email</a>
        <p>If you didn't create an account with Vendplug, please ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✉️ Verification email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error.message);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, token) => {
  try {
    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Email service not available');
    }

    // Use environment variable or try to detect the actual server URL
    let baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) {
      // Try to get the actual server IP/domain
             const serverUrl = process.env.SERVER_URL || process.env.BACKEND_URL || 'http://localhost:5000';
       baseUrl = serverUrl.replace('/api', ''); // Remove /api if present
     }
     
     // For development, use your computer's IP address so phone can access it
     if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
       // You can set this in your .env file: DEV_IP=192.168.1.100
       const devIp = process.env.DEV_IP;
       if (devIp) {
         baseUrl = `http://${devIp}:5000`;
       }
    }
    
    const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
    
    const mailOptions = {
      from: `"Vendplug" <${process.env.EMAIL_USER}>`, // Use authenticated email
      to: email,
      subject: 'Reset Your Vendplug Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Please click the link below to set a new password:</p>
        <a href="${resetLink}" style="
          background-color: #ff6b6b;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          display: inline-block;
          margin: 10px 0;
        ">Reset Password</a>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✉️ Password reset email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  testConnection
};