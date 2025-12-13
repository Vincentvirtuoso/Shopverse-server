import dotenv from "dotenv";
dotenv.config();

import SibApiV3Sdk from "sib-api-v3-sdk";

// Initialize Brevo API Client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();

const validateConfig = () => {
  const requiredVars = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

export const sendEmail = async ({ to, subject, htmlContent, textContent }) => {
  validateConfig();

  if (!to) {
    throw new Error("Recipient email ('to') is required");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  try {
    // Create email data object - properties must be set individually
    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME,
    };
    emailData.to = [{ email: to }];
    emailData.subject = subject;
    emailData.htmlContent = htmlContent;
    emailData.textContent = textContent;

    console.log(`📧 Sending email to: ${to}`);
    console.log(
      `📤 From: ${emailData.sender.name} <${emailData.sender.email}>`
    );

    const response = await brevoClient.sendTransacEmail(emailData);

    console.log(
      `✅ Email sent successfully! Message ID: ${response.messageId}`
    );
    return response;
  } catch (error) {
    console.error("❌ Failed to send email:");
    console.error("Error details:", error.response?.body || error.message);

    // Re-throw with more context
    throw new Error(
      `Email sending failed: ${error.response?.body?.message || error.message}`
    );
  }
};

export const sendVerificationEmail = async (email, token, firstName) => {
  if (!email || !token || !firstName) {
    throw new Error("Email, token, and firstName are required");
  }

  const verificationUrl = `${
    process.env.FRONTEND_URL
  }/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const currentYear = new Date().getFullYear();

  return await sendEmail({
    to: email,
    subject: "Verify Your Email Address",
    htmlContent: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f5;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content h2 {
            color: #1f2937;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .content p {
            color: #4b5563;
            margin-bottom: 16px;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            margin: 24px 0;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .link-box {
            background-color: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            word-break: break-all;
            font-size: 14px;
            color: #4F46E5;
            margin: 20px 0;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning strong {
            color: #92400e;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background-color: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ Email Verification</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}! 👋</h2>
            <p>Thank you for creating an account with us! We're excited to have you on board.</p>
            <p>To complete your registration and access all features, please verify your email address by clicking the button below:</p>
            <center>
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </center>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="link-box">${verificationUrl}</div>
            <div class="warning">
              <strong>⏰ Important:</strong> This verification link will expire in 24 hours.
            </div>
            <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email. No account will be created.</p>
          </div>
          <div class="footer">
            <p><strong>Your Company</strong></p>
            <p>&copy; ${currentYear} All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
Hi ${firstName}!

Thank you for creating an account with us! We're excited to have you on board.

To complete your registration, please verify your email address by visiting:
${verificationUrl}

⏰ IMPORTANT: This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

---
Your Company
© ${currentYear} All rights reserved.
    `,
  });
};

export const sendWelcomeEmail = async (email, firstName) => {
  if (!email || !firstName) {
    throw new Error("Email and firstName are required");
  }

  const currentYear = new Date().getFullYear();
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

  return await sendEmail({
    to: email,
    subject: "🎉 Welcome! Your Email is Verified",
    htmlContent: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f5;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content h2 {
            color: #1f2937;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .content p {
            color: #4b5563;
            margin-bottom: 16px;
            font-size: 16px;
          }
          .success-badge {
            display: inline-block;
            background-color: #d1fae5;
            color: #065f46;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            margin: 24px 0;
            font-weight: 600;
            font-size: 16px;
          }
          .features {
            background-color: #f9fafb;
            padding: 24px;
            border-radius: 8px;
            margin: 24px 0;
          }
          .features h3 {
            color: #1f2937;
            margin-top: 0;
            font-size: 18px;
          }
          .features ul {
            margin: 12px 0;
            padding-left: 20px;
          }
          .features li {
            color: #4b5563;
            margin-bottom: 8px;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background-color: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome Aboard! 🎉</h1>
          </div>
          <div class="content">
            <center>
              <div class="success-badge">✓ Email Verified</div>
            </center>
            <h2>Hi ${firstName}! 👋</h2>
            <p>Congratulations! Your email has been successfully verified, and your account is now fully activated.</p>
            <p>You now have complete access to all features and can start exploring everything we have to offer.</p>
            
            <div class="features">
              <h3>🚀 What's Next?</h3>
              <ul>
                <li>Complete your profile to personalize your experience</li>
                <li>Explore our features and discover what we offer</li>
                <li>Connect with our community</li>
                <li>Check out our getting started guide</li>
              </ul>
            </div>

            <center>
              <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
            </center>

            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Need help getting started? Feel free to reach out to our support team anytime. We're here to help!
            </p>
          </div>
          <div class="footer">
            <p><strong>Your Company</strong></p>
            <p>&copy; ${currentYear} All rights reserved.</p>
            <p style="margin-top: 10px;">
              <a href="${process.env.FRONTEND_URL}" style="color: #4F46E5; text-decoration: none;">Visit Website</a> |
              <a href="${process.env.FRONTEND_URL}/support" style="color: #4F46E5; text-decoration: none;">Get Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
Welcome Aboard! 🎉

Hi ${firstName}!

Congratulations! Your email has been successfully verified, and your account is now fully activated.

You now have complete access to all features and can start exploring everything we have to offer.

WHAT'S NEXT?
• Complete your profile to personalize your experience
• Explore our features and discover what we offer
• Connect with our community
• Check out our getting started guide

Visit your dashboard: ${dashboardUrl}

Need help getting started? Feel free to reach out to our support team anytime. We're here to help!

---
Your Company
© ${currentYear} All rights reserved.
    `,
  });
};

export const sendPasswordResetEmail = async (email, token, firstName) => {
  if (!email || !token || !firstName) {
    throw new Error("Email, token, and firstName are required");
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const currentYear = new Date().getFullYear();

  return await sendEmail({
    to: email,
    subject: "Password Reset Request",
    htmlContent: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f5;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .content {
            padding: 40px 30px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            margin: 24px 0;
            font-weight: 600;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background-color: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>
            <div class="warning">
              <strong>⏰ Important:</strong> This link will expire in 1 hour.
            </div>
            <p style="color: #6b7280; font-size: 14px;">If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>&copy; ${currentYear} Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
Hi ${firstName},

We received a request to reset your password.

Reset your password here: ${resetUrl}

⏰ This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

---
© ${currentYear} Your Company
    `,
  });
};

// Export configuration validator for testing
export { validateConfig };
