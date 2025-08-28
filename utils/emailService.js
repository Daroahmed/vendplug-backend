const nodemailer = require('nodemailer');

// Create transporter (you'll need to set these environment variables)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send verification email
const sendVerificationEmail = async (email, token) => {
  try {
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email.html?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
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

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail
};