import dotenv from "dotenv";
dotenv.config();

import SibApiV3Sdk from "sib-api-v3-sdk";
import orderConfirmationEmailTemplate, {
  orderConfirmationTextContent,
} from "../template/orderConfirmation.js";

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
            <p><strong>Shopverse</strong></p>
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
Shopverse
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
            <p><strong>Shopverse</strong></p>
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
Shopverse
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
            <p>&copy; ${currentYear} Shopverse. All rights reserved.</p>
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
© ${currentYear} Shopverse
    `,
  });
};

// Add these functions to your existing email service file

/**
 * Send order confirmation email
 * @param {string} email - Recipient email
 * @param {object} order - Order object
 * @param {string} firstName - Customer's first name
 * @param {string} [attachment] - Optional invoice attachment
 */
export const sendOrderConfirmationEmail = async (
  email,
  order,
  firstName,
  attachment = null
) => {
  if (!email || !order || !firstName) {
    throw new Error("Email, order, and firstName are required");
  }

  const currentYear = new Date().getFullYear();
  const orderUrl = `${process.env.FRONTEND_URL}/orders/${order._id}`;
  const trackingUrl = order.trackingNumber
    ? `${process.env.FRONTEND_URL}/track/${order.trackingNumber}`
    : `${process.env.FRONTEND_URL}/orders`;

  // Format order items for the email
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${
            item.product?.image
              ? `
            <img 
              src="${item.product.image}" 
              alt="${item.product.name || "Product"}" 
              style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"
            />
          `
              : ""
          }
          <div>
            <div style="font-weight: 600; color: #1f2937;">${
              item.product?.name || "Product"
            }</div>
            ${
              item.variantName
                ? `<div style="font-size: 14px; color: #6b7280;">${item.variantName}</div>`
                : ""
            }
          </div>
        </div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #1f2937;">
        ₦${(item.price?.final * item.quantity).toLocaleString()}
      </td>
    </tr>
  `
    )
    .join("");

  // Build email configuration
  const emailConfig = {
    to: email,
    subject: `🎉 Order Confirmed - ${order.orderNumber}`,
    htmlContent: orderConfirmationEmailTemplate({
      order,
      itemsHtml,
      currentYear,
      firstName,
      orderUrl,
      shippingAddress,
      trackingUrl,
    }),
    textContent: orderConfirmationTextContent({
      order,
      currentYear,
      firstName,
    }),
  };

  // Add attachment if provided
  if (attachment) {
    emailConfig.attachment = attachment;
  }

  return await sendEmail(emailConfig);
};

export const sendOrderStatusUpdateEmail = async (
  email,
  order,
  status,
  note = ""
) => {
  if (!email || !order || !status) {
    throw new Error("Email, order, and status are required");
  }

  const currentYear = new Date().getFullYear();
  const orderUrl = `${process.env.FRONTEND_URL}/orders/${order._id}`;

  const statusMessages = {
    processing: {
      subject: `🔄 Order Processing - ${order.orderNumber}`,
      title: "Your Order is Being Processed",
      message: "We're preparing your items for shipment.",
      color: "#F59E0B",
    },
    ready_to_ship: {
      subject: `📦 Ready to Ship - ${order.orderNumber}`,
      title: "Your Order is Ready to Ship",
      message: "Your order has been packed and is ready for shipping.",
      color: "#3B82F6",
    },
    shipped: {
      subject: `🚚 Order Shipped - ${order.orderNumber}`,
      title: "Your Order Has Shipped!",
      message: "Your order is on its way to you.",
      color: "#8B5CF6",
    },
    out_for_delivery: {
      subject: `🚛 Out for Delivery - ${order.orderNumber}`,
      title: "Your Order is Out for Delivery",
      message: "Your order will be delivered today.",
      color: "#EC4899",
    },
    delivered: {
      subject: `✅ Order Delivered - ${order.orderNumber}`,
      title: "Your Order Has Been Delivered",
      message: "Your order has been delivered successfully.",
      color: "#10B981",
    },
    cancelled: {
      subject: `❌ Order Cancelled - ${order.orderNumber}`,
      title: "Your Order Has Been Cancelled",
      message: "Your order has been cancelled as requested.",
      color: "#EF4444",
    },
  };

  const statusInfo = statusMessages[status] || {
    subject: `Order Update - ${order.orderNumber}`,
    title: `Order Status Updated: ${status}`,
    message: note || "Your order status has been updated.",
    color: "#6B7280",
  };

  return await sendEmail({
    to: email,
    subject: statusInfo.subject,
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
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: ${statusInfo.color};
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .status-card {
            background: ${statusInfo.color}15;
            border: 1px solid ${statusInfo.color}30;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            text-align: center;
          }
          .status-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .button {
            display: inline-block;
            padding: 16px 32px;
            background: ${statusInfo.color};
            color: white !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusInfo.title}</h1>
            <p style="margin-top: 8px; opacity: 0.9;">Order: ${
              order.orderNumber
            }</p>
          </div>
          
          <div class="content">
            <div class="status-card">
              <div class="status-icon">
                ${
                  status === "processing"
                    ? "🔄"
                    : status === "shipped"
                    ? "🚚"
                    : status === "delivered"
                    ? "✅"
                    : status === "cancelled"
                    ? "❌"
                    : "📦"
                }
              </div>
              <h2 style="margin: 0; color: ${statusInfo.color};">${
      statusInfo.title
    }</h2>
              <p style="color: #6b7280; margin: 12px 0;">${
                statusInfo.message
              }</p>
              ${
                note
                  ? `<p style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid ${statusInfo.color};">${note}</p>`
                  : ""
              }
            </div>
            
            <div style="text-align: center;">
              <a href="${orderUrl}" class="button">View Order Details</a>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 12px;">
              <h3 style="margin-top: 0;">Order Summary</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Order Total:</span>
                <span style="font-weight: 600;">₦${
                  order.pricing?.total?.toLocaleString() || "0"
                }</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Items:</span>
                <span>${order.items.length} item${
      order.items.length !== 1 ? "s" : ""
    }</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>${process.env.APP_NAME || "Your Company"}</strong></p>
            <p>If you have any questions, please contact our support team.</p>
            <p style="margin-top: 20px; font-size: 12px;">
              &copy; ${currentYear} ${
      process.env.APP_NAME || "Your Company"
    }. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
${statusInfo.subject}

${statusInfo.title}

Order: ${order.orderNumber}

${statusInfo.message}

${note ? `Note: ${note}\n` : ""}

Order Summary:
- Order Total: ₦${order.pricing?.total?.toLocaleString() || "0"}
- Items: ${order.items.length} item${order.items.length !== 1 ? "s" : ""}

View your order: ${orderUrl}

Need help? Contact our support team.

---
${process.env.APP_NAME || "Your Company"}
© ${currentYear} All rights reserved.
    `,
  });
};

export const sendPaymentConfirmationEmail = async (email, order, firstName) => {
  if (!email || !order || !firstName) {
    throw new Error("Email, order, and firstName are required");
  }

  const currentYear = new Date().getFullYear();
  const orderUrl = `${process.env.FRONTEND_URL}/orders/${order._id}`;

  return await sendEmail({
    to: email,
    subject: `✅ Payment Received - ${order.orderNumber}`,
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
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
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
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .success-icon {
            text-align: center;
            font-size: 64px;
            margin: 20px 0;
          }
          .amount {
            text-align: center;
            font-size: 48px;
            font-weight: 700;
            color: #10B981;
            margin: 20px 0;
          }
          .info-card {
            background: #f9fafb;
            padding: 24px;
            border-radius: 12px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Confirmed!</h1>
            <p style="margin-top: 8px; opacity: 0.9;">Thank you for your payment</p>
          </div>
          
          <div class="content">
            <div class="success-icon">✅</div>
            
            <div class="amount">
              ₦${order.pricing?.total?.toLocaleString() || "0"}
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <p>Hi ${firstName}, your payment has been successfully processed.</p>
              <p>Your order is now being prepared for shipment.</p>
            </div>
            
            <div class="info-card">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Order Number:</span>
                <span style="font-weight: 600;">${order.orderNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Payment Method:</span>
                <span>${
                  order.payment?.method === "cash_on_delivery"
                    ? "Cash on Delivery"
                    : "Paystack"
                }</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Transaction Date:</span>
                <span>${new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}</span>
              </div>
              ${
                order.payment?.transactionId
                  ? `
                <div style="display: flex; justify-content: space-between;">
                  <span>Transaction ID:</span>
                  <span style="font-family: monospace;">${order.payment.transactionId}</span>
                </div>
              `
                  : ""
              }
            </div>
            
            <div style="text-align: center;">
              <a href="${orderUrl}" class="button">View Order Details</a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>${process.env.APP_NAME || "Your Company"}</strong></p>
            <p>You'll receive another email when your order ships.</p>
            <p style="margin-top: 20px; font-size: 12px;">
              &copy; ${currentYear} ${
      process.env.APP_NAME || "Your Company"
    }. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
PAYMENT CONFIRMED - ${order.orderNumber}

Hi ${firstName},

Your payment has been successfully processed!

Amount: ₦${order.pricing?.total?.toLocaleString() || "0"}

Payment Details:
- Order Number: ${order.orderNumber}
- Payment Method: ${
      order.payment?.method === "cash_on_delivery"
        ? "Cash on Delivery"
        : "Paystack"
    }
- Transaction Date: ${new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}
${
  order.payment?.transactionId
    ? `- Transaction ID: ${order.payment.transactionId}\n`
    : ""
}

Your order is now being prepared for shipment. You'll receive another email with tracking information once it ships.

View your order: ${orderUrl}

Thank you for shopping with ${process.env.APP_NAME || "us"}!

---
${process.env.APP_NAME || "Your Company"}
© ${currentYear} All rights reserved.
    `,
  });
};

export const sendShippingConfirmationEmail = async (
  email,
  order,
  trackingNumber,
  courier,
  estimatedDelivery
) => {
  if (!email || !order || !trackingNumber) {
    throw new Error("Email, order, and trackingNumber are required");
  }

  const currentYear = new Date().getFullYear();
  const orderUrl = `${process.env.FRONTEND_URL}/orders/${order._id}`;
  const trackingUrl = `https://track.courier.com/${trackingNumber}`; // Replace with actual courier tracking URL

  return await sendEmail({
    to: email,
    subject: `🚚 Your Order Has Shipped - ${order.orderNumber}`,
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
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .tracking-card {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
          }
          .tracking-number {
            font-family: monospace;
            font-size: 24px;
            font-weight: 700;
            color: #0369a1;
            margin: 12px 0;
          }
          .button {
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            margin: 12px;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Order is on the Way! 🚚</h1>
            <p style="margin-top: 8px; opacity: 0.9;">Tracking information for ${
              order.orderNumber
            }</p>
          </div>
          
          <div class="content">
            <div class="tracking-card">
              <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <h2 style="margin: 0; color: #0369a1;">Track Your Package</h2>
                <div class="tracking-number">${trackingNumber}</div>
                <div style="margin: 16px 0;">
                  <div>Courier: <strong>${
                    courier || "Standard Shipping"
                  }</strong></div>
                  <div>Estimated Delivery: <strong>${
                    estimatedDelivery || "3-5 business days"
                  }</strong></div>
                </div>
                <a href="${trackingUrl}" class="button">Track Package</a>
                <a href="${orderUrl}" class="button" style="background: #6B7280;">View Order</a>
              </div>
            </div>
            
            <div style="margin-top: 30px;">
              <h3>Shipping Updates</h3>
              <p>You'll receive automatic updates about your shipment's progress. Here's what to expect:</p>
              <ul style="color: #6b7280;">
                <li>Package picked up by courier</li>
                <li>In transit to your city</li>
                <li>Out for delivery</li>
                <li>Delivered to your address</li>
              </ul>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 12px;">
              <h3 style="margin-top: 0;">Delivery Address</h3>
              <p style="margin: 0;">
                ${order.shipping?.address?.addressLine1 || ""}<br/>
                ${order.shipping?.address?.addressLine2 || ""}<br/>
                ${order.shipping?.address?.city || ""}, ${
      order.shipping?.address?.state || ""
    }<br/>
                ${order.shipping?.address?.country || "Nigeria"}
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>${process.env.APP_NAME || "Your Company"}</strong></p>
            <p>Questions about your shipment? Contact our support team.</p>
            <p style="margin-top: 20px; font-size: 12px;">
              &copy; ${currentYear} ${
      process.env.APP_NAME || "Your Company"
    }. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
YOUR ORDER HAS SHIPPED - ${order.orderNumber}

Great news! Your order has been shipped and is on its way to you.

TRACKING INFORMATION
--------------------
Tracking Number: ${trackingNumber}
Courier: ${courier || "Standard Shipping"}
Estimated Delivery: ${estimatedDelivery || "3-5 business days"}

Track your package: ${trackingUrl}

DELIVERY ADDRESS
----------------
${order.shipping?.address?.addressLine1 || ""}
${order.shipping?.address?.addressLine2 || ""}
${order.shipping?.address?.city || ""}, ${order.shipping?.address?.state || ""}
${order.shipping?.address?.country || "Nigeria"}

WHAT TO EXPECT NEXT:
1. Package picked up by courier
2. In transit to your city
3. Out for delivery
4. Delivered to your address

You'll receive automatic updates about your shipment's progress.

View your order: ${orderUrl}

If you have any questions about your shipment, please contact our support team.

---
${process.env.APP_NAME || "Your Company"}
© ${currentYear} All rights reserved.
    `,
  });
};

export const sendOrderCancellationEmail = async (
  email,
  order,
  firstName,
  reason = "",
  refundAmount = 0
) => {
  if (!email || !order || !firstName) {
    throw new Error("Email, order, and firstName are required");
  }

  const currentYear = new Date().getFullYear();
  const orderUrl = `${process.env.FRONTEND_URL}/orders/${order._id}`;

  return await sendEmail({
    to: email,
    subject: `❌ Order Cancelled - ${order.orderNumber}`,
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
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .refund-card {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            text-align: center;
          }
          .button {
            display: inline-block;
            padding: 16px 32px;
            background: #6B7280;
            color: white !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 30px 20px;
            background: #f9fafb;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Cancelled</h1>
            <p style="margin-top: 8px; opacity: 0.9;">Order: ${
              order.orderNumber
            }</p>
          </div>
          
          <div class="content">
            <div style="text-align: center; margin: 30px 0;">
              <div style="font-size: 64px;">❌</div>
              <h2>Your order has been cancelled</h2>
              <p>Hi ${firstName}, your order has been successfully cancelled.</p>
            </div>
            
            ${
              reason
                ? `
              <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Cancellation Reason</h3>
                <p>${reason}</p>
              </div>
            `
                : ""
            }
            
            ${
              refundAmount > 0
                ? `
              <div class="refund-card">
                <h3 style="margin-top: 0; color: #DC2626;">Refund Initiated</h3>
                <div style="font-size: 36px; font-weight: 700; color: #DC2626; margin: 16px 0;">
                  ₦${refundAmount.toLocaleString()}
                </div>
                <p>Your refund has been initiated and will be processed within 5-10 business days.</p>
                <p style="font-size: 14px; color: #9ca3af;">
                  The refund will be credited back to your original payment method.
                </p>
              </div>
            `
                : ""
            }
            
            <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 12px;">
              <h3 style="margin-top: 0;">Order Details</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Order Number:</span>
                <span style="font-weight: 600;">${order.orderNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Order Date:</span>
                <span>${new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Total Amount:</span>
                <span>₦${order.pricing?.total?.toLocaleString() || "0"}</span>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${orderUrl}" class="button">View Cancelled Order</a>
              <br/>
              <a href="${
                process.env.FRONTEND_URL
              }" style="color: #4F46E5; text-decoration: none; margin-top: 16px; display: inline-block;">
                Continue Shopping
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>${process.env.APP_NAME || "Your Company"}</strong></p>
            <p>If you have any questions, please contact our support team.</p>
            <p style="margin-top: 20px; font-size: 12px;">
              &copy; ${currentYear} ${
      process.env.APP_NAME || "Your Company"
    }. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
ORDER CANCELLED - ${order.orderNumber}

Hi ${firstName},

Your order has been successfully cancelled.

ORDER DETAILS
-------------
Order Number: ${order.orderNumber}
Order Date: ${new Date(order.createdAt).toLocaleDateString()}
Total Amount: ₦${order.pricing?.total?.toLocaleString() || "0"}

${reason ? `Cancellation Reason: ${reason}\n` : ""}
${
  refundAmount > 0
    ? `
REFUND INFORMATION
------------------
Refund Amount: ₦${refundAmount.toLocaleString()}
Refund Status: Initiated
Processing Time: 5-10 business days

The refund will be credited back to your original payment method.
`
    : ""
}

View your cancelled order: ${orderUrl}

Continue shopping: ${process.env.FRONTEND_URL}

If you have any questions, please contact our support team.

---
${process.env.APP_NAME || "Your Company"}
© ${currentYear} All rights reserved.
    `,
  });
};
