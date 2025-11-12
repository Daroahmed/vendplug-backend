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

// ------------------------
// Email rendering helpers
// ------------------------
function getPublicBaseUrl() {
  // Try multiple env names; first non-empty wins
  let base =
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    process.env.WEB_URL ||
    process.env.SERVER_URL ||
    process.env.BACKEND_URL ||
    '';

  if (base) {
    // Remove trailing /api if present
    base = base.replace(/\/api\/?$/, '');
    // Ensure protocol
    if (!/^https?:\/\//i.test(base)) {
      const preferHttps = process.env.NODE_ENV === 'production';
      base = `${preferHttps ? 'https' : 'http'}://${base}`;
    }
    // Remove trailing slash for consistent join
    base = base.replace(/\/+$/, '');
  }
  return base;
}

function getLogoUrl() {
  // Priority: explicit EMAIL_LOGO_URL
  if (process.env.EMAIL_LOGO_URL) return process.env.EMAIL_LOGO_URL;

  const base = getPublicBaseUrl();
  if (base) return `${base}/logo1.png`;

  // Final fallback to a generic placeholder (HTTPS to avoid mixed content)
  return 'https://via.placeholder.com/120x40.png?text=Vendplug';
}

function buildEmailHtml({ title, preheader, heading, introHtml, actionText, actionUrl, footerHtml, uniqueLine }) {
  const safePreheader = (preheader || '').replace(/\s+/g, ' ').trim();
  const safeUnique = (uniqueLine || '').replace(/\s+/g, ' ').trim();
  const btn = actionText && actionUrl ? `
      <div style="text-align:center;margin:18px 0 4px 0;">
        <a href="${actionUrl}" style="background-color:#00cc99;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:600">
          ${actionText}
        </a>
      </div>
  ` : '';

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <title>${title || 'Vendplug'}</title>
      <style>
        @media (prefers-color-scheme: dark) {
          body{background:#0b0f14 !important;color:#e5e7eb !important}
          .card{background:#0f1720 !important}
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,'Noto Sans',sans-serif;color:#111827">
      <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${safePreheader}</span>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding:32px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px">
              <tr>
                <td style="text-align:center;padding-bottom:16px">
                  <img src="${getLogoUrl()}" alt="Vendplug" height="40" style="display:inline-block;border:0"/>
                </td>
              </tr>
              <tr>
                <td class="card" style="background:#ffffff;border-radius:12px;padding:28px 24px;box-shadow:0 2px 10px rgba(0,0,0,0.06)">
                  <div style="color:#6b7280;font-size:12px;margin-bottom:8px">${safeUnique}</div>
                  <h1 style="margin:0;font-size:22px;line-height:28px;color:#111827">${heading || ''}</h1>
                  <div style="margin-top:12px;font-size:14px;line-height:22px;color:#111827">
                    ${introHtml || ''}
                  </div>
                  ${btn}
                  ${footerHtml ? `<div style="margin-top:20px;font-size:12px;color:#6b7280">${footerHtml}</div>` : ''}
                </td>
              </tr>
              <tr>
                <td style="text-align:center;color:#9ca3af;font-size:11px;padding-top:16px">
                  © ${new Date().getFullYear()} Vendplug • This is an automated message
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function buildEmailText({ heading, introText, actionText, actionUrl, footerText, uniqueLine }) {
  const parts = [];
  if (uniqueLine) parts.push(`${uniqueLine}`);
  if (heading) parts.push(heading);
  if (introText) parts.push('', introText);
  if (actionText && actionUrl) {
    parts.push('', `${actionText}: ${actionUrl}`);
  } else if (actionUrl) {
    parts.push('', `${actionUrl}`);
  }
  if (footerText) parts.push('', footerText);
  parts.push('', '— Vendplug');
  return parts.join('\n');
}

// Lightweight HTTP sender using Resend API (preferred in production)
async function sendViaResend(to, subject, payload) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!from) {
    throw new Error('RESEND_FROM/EMAIL_FROM not configured');
  }

  const body = typeof payload === 'string'
    ? { from, to: [to], subject, html: payload }
    : { from, to: [to], subject, html: payload.html, text: payload.text };

  console.log(`📤 Attempting to send email via Resend to: ${to}`);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const errorMsg = `Resend ${res.status}: ${text}`;
    console.error(`❌ Resend API error: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  const result = await res.json().catch(() => ({}));
  console.log(`✅ Resend API accepted email (ID: ${result.id || 'unknown'})`);
  return result;
}

// Helper: prepares payload, tries to enqueue; fallback to direct send if needed
async function tryEnqueueEmail(job) {
  try {
    const queued = await enqueueEmail(job);
    // enqueueEmail returns true if queued, false if disabled/unavailable (triggers fallback)
    return queued;
  } catch (err) {
    console.warn('⚠️ Email queue error, sending synchronously:', err.message);
    return false; // Fallback to synchronous
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
    const nowIso = new Date().toISOString();
    const tokenStr = (token || '').toString();
    const masked = tokenStr ? `•••${tokenStr.slice(-6)}` : '';
    const uniqueLine = masked ? `Ref: ${masked} • ${nowIso}` : `Ref: ${nowIso}`;

    // Prefer Resend if configured (no SMTP egress required)
    if (process.env.RESEND_API_KEY) {
      let baseUrl = getPublicBaseUrl() || 'http://localhost:5000';
      if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
        const devIp = process.env.DEV_IP;
        if (devIp) {
          baseUrl = `http://${devIp}:5000`;
        }
      }
      const verificationLink = `${baseUrl}/verify-email.html?token=${token}`;

      const html = buildEmailHtml({
        title: 'Verify Your Vendplug Account',
        preheader: 'Confirm your email to activate your Vendplug account.',
        heading: 'Verify your email',
        introHtml: `Thank you for registering. Click the button below to verify your email address and activate your account.`,
        actionText: 'Verify Email',
        actionUrl: verificationLink,
        footerHtml: `If you didn’t create an account with Vendplug, you can safely ignore this message.<br/>This link will expire in 24 hours.`,
        uniqueLine
      });

      const text = buildEmailText({
        heading: 'Verify your email',
        introText: 'Thank you for registering. Open the link below to verify your email and activate your account.',
        actionText: 'Verify Email',
        actionUrl: verificationLink,
        footerText: 'If you did not create an account, ignore this message. Link expires in 24 hours.',
        uniqueLine
      });

      console.log('✉️ Using Resend with base URL:', baseUrl);
      await sendViaResend(email, 'Verify Your Vendplug Account', { html, text });
      console.log('✉️ Verification email sent successfully via Resend to:', email);
      return true;
    }

    // SMTP fallback
    console.log('📧 Attempting to send verification email via SMTP...');
    if (!process.env.EMAIL_USER || (!process.env.EMAIL_PASSWORD && !process.env.EMAIL_PASS)) {
      throw new Error('SMTP credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env');
    }
    
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Email service not available - SMTP connection failed');
    }

    // Use normalized public base URL
    let baseUrl = getPublicBaseUrl() || 'http://localhost:5000';
     
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
    console.log('  - baseUrl (SMTP):', baseUrl);
    console.log('  - token:', token);
    console.log('  - full verification link:', verificationLink);
    
    const html = buildEmailHtml({
      title: 'Verify Your Vendplug Account',
      preheader: 'Confirm your email to activate your Vendplug account.',
      heading: 'Verify your email',
      introHtml: `Thank you for registering. Click the button below to verify your email address and activate your account.`,
      actionText: 'Verify Email',
      actionUrl: verificationLink,
      footerHtml: `If you didn’t create an account with Vendplug, you can safely ignore this message.<br/>This link will expire in 24 hours.`,
      uniqueLine
    });

    const text = buildEmailText({
      heading: 'Verify your email',
      introText: 'Thank you for registering. Open the link below to verify your email and activate your account.',
      actionText: 'Verify Email',
      actionUrl: verificationLink,
      footerText: 'If you did not create an account, ignore this message. Link expires in 24 hours.',
      uniqueLine
    });

    const mailOptions = {
      from: `"Vendplug" <${process.env.EMAIL_USER}>`, // Use authenticated email
      to: email,
      subject: 'Verify Your Vendplug Account',
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✉️ Verification email sent successfully via SMTP to:', email);
    console.log('   Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error.message);
    console.error('   Full error:', error);
    return false;
  }
};

// Wrap password reset
async function sendPasswordResetEmail(email, token) {
  const job = { type: 'reset', email, token };
  if (await tryEnqueueEmail(job)) return true;
  // fallback: existing code
  try {
    const nowIso = new Date().toISOString();
    const tokenStr = (token || '').toString();
    const masked = tokenStr ? `•••${tokenStr.slice(-6)}` : '';
    const uniqueLine = masked ? `Ref: ${masked} • ${nowIso}` : `Ref: ${nowIso}`;

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      let baseUrl = getPublicBaseUrl() || 'http://localhost:5000';
      if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
        const devIp = process.env.DEV_IP;
        if (devIp) {
          baseUrl = `http://${devIp}:5000`;
        }
      }
      const resetLink = `${baseUrl}/reset-password.html?token=${token}`;

      const html = buildEmailHtml({
        title: 'Reset Your Vendplug Password',
        preheader: 'Use the secure link to reset your Vendplug password.',
        heading: 'Password reset request',
        introHtml: `You requested to reset your password. Click the button below to set a new password.`,
        actionText: 'Reset Password',
        actionUrl: resetLink,
        footerHtml: `If you didn’t request this, please ignore this email.<br/>This link will expire in 1 hour.`,
        uniqueLine
      });

      const text = buildEmailText({
        heading: 'Password reset request',
        introText: 'You requested to reset your password. Open the link below to set a new password.',
        actionText: 'Reset Password',
        actionUrl: resetLink,
        footerText: 'If you did not request this, ignore this message. Link expires in 1 hour.',
        uniqueLine
      });

      console.log('✉️ Using Resend with base URL:', baseUrl);
      await sendViaResend(email, 'Reset Your Vendplug Password', { html, text });
      console.log('✉️ Password reset email sent successfully via Resend to:', email);
      return true;
    }

    // SMTP fallback
    console.log('📧 Attempting to send password reset email via SMTP...');
    if (!process.env.EMAIL_USER || (!process.env.EMAIL_PASSWORD && !process.env.EMAIL_PASS)) {
      throw new Error('SMTP credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env');
    }
    
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Email service not available - SMTP connection failed');
    }

    // Use normalized public base URL
    let baseUrl = getPublicBaseUrl() || 'http://localhost:5000';
     
     // For development, use your computer's IP address so phone can access it
     if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
       // You can set this in your .env file: DEV_IP=192.168.1.100
       const devIp = process.env.DEV_IP;
       if (devIp) {
         baseUrl = `http://${devIp}:5000`;
       }
    }
    
    const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
    
    const html = buildEmailHtml({
      title: 'Reset Your Vendplug Password',
      preheader: 'Use the secure link to reset your Vendplug password.',
      heading: 'Password reset request',
      introHtml: `You requested to reset your password. Click the button below to set a new password.`,
      actionText: 'Reset Password',
      actionUrl: resetLink,
      footerHtml: `If you didn’t request this, please ignore this email.<br/>This link will expire in 1 hour.`,
      uniqueLine
    });

    const text = buildEmailText({
      heading: 'Password reset request',
      introText: 'You requested to reset your password. Open the link below to set a new password.',
      actionText: 'Reset Password',
      actionUrl: resetLink,
      footerText: 'If you did not request this, ignore this message. Link expires in 1 hour.',
      uniqueLine
    });

    const mailOptions = {
      from: `"Vendplug" <${process.env.EMAIL_USER}>`, // Use authenticated email
      to: email,
      subject: 'Reset Your Vendplug Password',
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✉️ Password reset email sent successfully via SMTP to:', email);
    console.log('   Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    console.error('   Full error:', error);
    return false;
  }
};

// Wrap PIN reset
async function sendPinResetEmail(email, resetCode, userType) {
  const job = { type: 'pin', email, resetCode, userType };
  if (await tryEnqueueEmail(job)) return true;
  // fallback: existing code
  try {
    const nowIso = new Date().toISOString();
    const uniqueLine = `Ref: ${String(resetCode).slice(0, 4)} • ${nowIso}`;

    // Prefer Resend if configured
    if (process.env.RESEND_API_KEY) {
      const html = buildEmailHtml({
        title: `PIN Reset Code - ${userType} Account`,
        preheader: 'Use the verification code to complete your PIN reset.',
        heading: 'PIN reset code',
        introHtml: `You requested to reset your payout PIN for your ${userType.toLowerCase()} account. Use the code below to complete the reset process:` +
          `<div style="background:#f8f9fa;border:2px dashed #00cc99;border-radius:8px;padding:18px 20px;text-align:center;margin:16px 0">
             <div style="font-size:28px;font-weight:700;color:#00cc99;letter-spacing:4px;font-family:monospace">${resetCode}</div>
             <div style="color:#6b7280;margin-top:8px;font-size:12px">Enter this code in the PIN reset form</div>
           </div>`,
        footerHtml: `This code will expire in 15 minutes for security reasons.<br/>If you didn’t request this, please ignore this email.`,
        uniqueLine
      });

      const text = buildEmailText({
        heading: 'PIN reset code',
        introText: `Use this code to complete your ${userType.toLowerCase()} payout PIN reset:`,
        actionText: 'PIN Code',
        actionUrl: String(resetCode),
        footerText: 'Code expires in 15 minutes. If you did not request this, ignore this message.',
        uniqueLine
      });

      await sendViaResend(email, `PIN Reset Code - ${userType} Account`, { html, text });
      console.log('✉️ PIN reset email sent successfully via Resend to:', email);
      return true;
    }

    // SMTP fallback
    console.log('📧 Attempting to send PIN reset email via SMTP...');
    if (!process.env.EMAIL_USER || (!process.env.EMAIL_PASSWORD && !process.env.EMAIL_PASS)) {
      throw new Error('SMTP credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env');
    }
    
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Email service not available - SMTP connection failed');
    }

    const html = buildEmailHtml({
      title: `PIN Reset Code - ${userType} Account`,
      preheader: 'Use the verification code to complete your PIN reset.',
      heading: 'PIN reset code',
      introHtml: `You requested to reset your payout PIN for your ${userType.toLowerCase()} account. Use the code below to complete the reset process:` +
        `<div style="background:#f8f9fa;border:2px dashed #00cc99;border-radius:8px;padding:18px 20px;text-align:center;margin:16px 0">
           <div style="font-size:28px;font-weight:700;color:#00cc99;letter-spacing:4px;font-family:monospace">${resetCode}</div>
           <div style="color:#6b7280;margin-top:8px;font-size:12px">Enter this code in the PIN reset form</div>
         </div>`,
      footerHtml: `This code will expire in 15 minutes for security reasons.<br/>If you didn’t request this, please ignore this email.`,
      uniqueLine
    });

    const text = buildEmailText({
      heading: 'PIN reset code',
      introText: `Use this code to complete your ${userType.toLowerCase()} payout PIN reset:`,
      actionText: 'PIN Code',
      actionUrl: String(resetCode),
      footerText: 'Code expires in 15 minutes. If you did not request this, ignore this message.',
      uniqueLine
    });

    const mailOptions = {
      from: `"Vendplug" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `PIN Reset Code - ${userType} Account`,
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✉️ PIN reset email sent successfully via SMTP to:', email);
    console.log('   Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending PIN reset email:', error.message);
    console.error('   Full error:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPinResetEmail,
  testConnection
};