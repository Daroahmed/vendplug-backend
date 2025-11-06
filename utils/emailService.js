const nodemailer = require('nodemailer');
const { enqueueEmail } = require('./queue');

// SMTP transporter (fallback when RESEND_API_KEY is not set)
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

// Lightweight HTTP sender using Resend API (preferred in production)
async function sendViaResend(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!from) {
    throw new Error('RESEND_FROM/EMAIL_FROM not configured');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

// Helper: prepares payload, tries to enqueue; fallback to direct send if needed
async function tryEnqueueEmail(job) {
  try {
    await enqueueEmail(job);
    return true;
  } catch (err) {
    console.warn('⚠️ Email queue fallback: sending synchronously:', err.message);
    return false;
  }
}

// Test email connection
const testConnection = async () => {
  try {
    // If using Resend, consider connectivity OK (HTTPS client-side; no persistent conn)
    if (process.env.RESEND_API_KEY) {
      return true;
    }

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

// Wrap verification - identical format to before, but use tryEnqueueEmail
async function sendVerificationEmail(email, token) {
  const job = { type: 'verify', email, token };
  if (await tryEnqueueEmail(job)) return true;
  // fallback: run old logic
  try {
    // Prefer Resend if configured (no SMTP egress required)
    if (process.env.RESEND_API_KEY) {
      let baseUrl = process.env.FRONTEND_URL;
      if (!baseUrl) {
        const serverUrl = process.env.SERVER_URL || process.env.BACKEND_URL || 'http://localhost:5000';
        baseUrl = serverUrl.replace('/api', '');
      }
      if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
        const devIp = process.env.DEV_IP;
        if (devIp) {
          baseUrl = `http://${devIp}:5000`;
        }
      }
      const verificationLink = `${baseUrl}/verify-email.html?token=${token}`;
      const html = `
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
      `;
      await sendViaResend(email, 'Verify Your Vendplug Account', html);
      console.log('✉️ Verification email sent to (Resend):', email);
      return true;
    }

    // SMTP fallback
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

// Wrap password reset
async function sendPasswordResetEmail(email, token) {
  const job = { type: 'reset', email, token };
  if (await tryEnqueueEmail(job)) return true;
  // fallback: existing code
  try {
    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      let baseUrl = process.env.FRONTEND_URL;
      if (!baseUrl) {
        const serverUrl = process.env.SERVER_URL || process.env.BACKEND_URL || 'http://localhost:5000';
        baseUrl = serverUrl.replace('/api', '');
      }
      if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
        const devIp = process.env.DEV_IP;
        if (devIp) {
          baseUrl = `http://${devIp}:5000`;
        }
      }
      const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
      const html = `
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
      `;
      await sendViaResend(email, 'Reset Your Vendplug Password', html);
      console.log('✉️ Password reset email sent to (Resend):', email);
      return true;
    }

    // SMTP fallback
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

// Wrap PIN reset
async function sendPinResetEmail(email, resetCode, userType) {
  const job = { type: 'pin', email, resetCode, userType };
  if (await tryEnqueueEmail(job)) return true;
  // fallback: existing code
  try {
    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #00cc99, #00a67e); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🔐 PIN Reset Request</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Your ${userType} payout PIN reset code</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">You requested to reset your payout PIN for your ${userType.toLowerCase()} account. Use the code below to complete the reset process:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #00cc99; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; color: #00cc99; letter-spacing: 4px; font-family: monospace;">${resetCode}</div>
              <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Enter this code in the PIN reset form</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⏰ Important:</strong> This code will expire in 15 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">If you didn't request this PIN reset, please ignore this email. Your account remains secure.</p>
            
            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">This is an automated message from Vendplug Escrow System</p>
            </div>
          </div>
        </div>
      `;
      
      await sendViaResend(email, `PIN Reset Code - ${userType} Account`, html);
      console.log('✉️ PIN reset email sent to (Resend):', email);
      return true;
    }

    // SMTP fallback
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Email service not available');
    }

    const mailOptions = {
      from: `"Vendplug" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `PIN Reset Code - ${userType} Account`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #00cc99, #00a67e); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🔐 PIN Reset Request</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Your ${userType} payout PIN reset code</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">You requested to reset your payout PIN for your ${userType.toLowerCase()} account. Use the code below to complete the reset process:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #00cc99; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; color: #00cc99; letter-spacing: 4px; font-family: monospace;">${resetCode}</div>
              <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Enter this code in the PIN reset form</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⏰ Important:</strong> This code will expire in 15 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">If you didn't request this PIN reset, please ignore this email. Your account remains secure.</p>
            
            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">This is an automated message from Vendplug Escrow System</p>
            </div>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✉️ PIN reset email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ Error sending PIN reset email:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPinResetEmail,
  testConnection
};