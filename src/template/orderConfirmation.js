const orderConfirmationEmailTemplate = ({
  order,
  itemsHtml,
  currentYear,
  firstName,
  orderUrl,
  trackingUrl,
}) => {
  const brandColor = "#DC2626"; // red-600
  const brandGradient = "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Order Confirmation - ShopVerse</title>
      <style>
        /* Reset & Base Styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.5;
          background-color: #f3f4f6;
          color: #111827;
          margin: 0;
          padding: 32px 16px;
        }
        
        /* Container */
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.08);
        }
        
        /* Header */
        .header {
          background: ${brandGradient};
          padding: 40px 32px;
          text-align: center;
          position: relative;
        }
        
        .header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
        }
        
        .brand-name {
          font-size: 28px;
          font-weight: 800;
          color: white;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        
        .order-badge {
          display: inline-block;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
          padding: 8px 20px;
          border-radius: 100px;
          font-size: 16px;
          font-weight: 600;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        /* Content */
        .content {
          padding: 32px;
        }
        
        /* Greeting */
        .greeting {
          margin-bottom: 32px;
        }
        
        .greeting h2 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }
        
        .greeting p {
          color: #6B7280;
          font-size: 16px;
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        
        .stat-card {
          background: #F9FAFB;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid #F3F4F6;
        }
        
        .stat-label {
          font-size: 13px;
          color: #6B7280;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }
        
        .stat-highlight {
          color: ${brandColor};
        }
        
        /* Status Timeline */
        .timeline {
          margin: 32px 0;
          padding: 24px;
          background: #F9FAFB;
          border-radius: 20px;
        }
        
        .timeline-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .timeline-steps {
          display: flex;
          justify-content: space-between;
          position: relative;
        }
        
        .timeline-steps::before {
          content: '';
          position: absolute;
          top: 14px;
          left: 0;
          right: 0;
          height: 2px;
          background: #E5E7EB;
          z-index: 1;
        }
        
        .timeline-step {
          position: relative;
          z-index: 2;
          flex: 1;
          text-align: center;
        }
        
        .step-dot {
          width: 28px;
          height: 28px;
          background: white;
          border: 2px solid #E5E7EB;
          border-radius: 50%;
          margin: 0 auto 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        
        .step-dot.completed {
          background: ${brandColor};
          border-color: ${brandColor};
          color: white;
        }
        
        .step-dot.active {
          border-color: ${brandColor};
          border-width: 2px;
          position: relative;
        }
        
        .step-dot.active::after {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          background: ${brandColor};
          border-radius: 50%;
        }
        
        .step-label {
          font-size: 13px;
          font-weight: 500;
          color: #6B7280;
        }
        
        .step-label.completed,
        .step-label.active {
          color: #111827;
          font-weight: 600;
        }
        
        /* Items Table */
        .items-section {
          margin: 32px 0;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 20px;
        }
        
        .section-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        
        .item-count {
          color: ${brandColor};
          font-weight: 600;
          font-size: 14px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .items-table th {
          text-align: left;
          padding: 12px 0;
          color: #6B7280;
          font-weight: 500;
          font-size: 13px;
          border-bottom: 2px solid #F3F4F6;
        }
        
        .items-table td {
          padding: 16px 0;
          border-bottom: 1px solid #F3F4F6;
        }
        
        .product-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .product-image {
          width: 48px;
          height: 48px;
          background: #F3F4F6;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        
        .product-details {
          font-weight: 500;
          color: #111827;
        }
        
        .product-variant {
          font-size: 13px;
          color: #6B7280;
          display: block;
        }
        
        /* Price Summary */
        .price-summary {
          background: #F9FAFB;
          border-radius: 20px;
          padding: 24px;
          margin: 32px 0;
        }
        
        .price-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
        }
        
        .price-row:not(:last-child) {
          border-bottom: 1px solid #F3F4F6;
        }
        
        .price-label {
          color: #6B7280;
          font-size: 15px;
        }
        
        .price-value {
          font-weight: 600;
          color: #111827;
        }
        
        .discount .price-value {
          color: #10B981;
        }
        
        .total-row {
          padding-top: 16px;
          font-size: 20px;
          font-weight: 700;
        }
        
        .total-row .price-label,
        .total-row .price-value {
          color: #111827;
        }
        
        .total-row .price-value {
          color: ${brandColor};
          font-size: 24px;
        }
        
        /* Shipping Card */
        .shipping-card {
          background: white;
          border: 1px solid #F3F4F6;
          border-radius: 20px;
          padding: 24px;
          margin: 32px 0;
        }
        
        .shipping-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .shipping-header h4 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        
        .address {
          color: #374151;
          line-height: 1.6;
        }
        
        .phone {
          color: #6B7280;
          margin-top: 12px;
          font-size: 14px;
        }
        
        /* Action Buttons */
        .actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin: 40px 0 32px;
        }
        
        .btn {
          display: inline-block;
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          text-align: center;
          transition: all 0.2s ease;
        }
        
        .btn-primary {
          background: ${brandGradient};
          color: white !important;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(220, 38, 38, 0.35);
        }
        
        .btn-secondary {
          background: white;
          color: ${brandColor} !important;
          border: 2px solid ${brandColor};
        }
        
        .btn-secondary:hover {
          background: ${brandColor};
          color: white !important;
        }
        
        /* Help Card */
        .help-card {
          background: #FEF2F2;
          border-radius: 20px;
          padding: 24px;
          margin: 32px 0;
          border: 1px solid #FEE2E2;
        }
        
        .help-card h4 {
          color: ${brandColor};
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        
        .help-links {
          display: flex;
          gap: 24px;
          margin-top: 16px;
        }
        
        .help-link {
          color: ${brandColor};
          text-decoration: none;
          font-weight: 600;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .help-link:hover {
          text-decoration: underline;
        }
        
        /* Footer */
        .footer {
          background: #F9FAFB;
          padding: 32px;
          text-align: center;
          border-top: 1px solid #F3F4F6;
        }
        
        .footer-brand {
          font-size: 20px;
          font-weight: 800;
          color: ${brandColor};
          margin-bottom: 16px;
        }
        
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin: 20px 0;
        }
        
        .footer-link {
          color: #6B7280;
          text-decoration: none;
          font-size: 14px;
        }
        
        .footer-link:hover {
          color: ${brandColor};
        }
        
        .copyright {
          color: #9CA3AF;
          font-size: 12px;
          margin-top: 20px;
        }
        
        /* Responsive */
        @media (max-width: 600px) {
          body {
            padding: 0;
          }
          
          .email-container {
            border-radius: 0;
          }
          
          .content {
            padding: 24px;
          }
          
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .timeline-steps {
            flex-direction: column;
            gap: 16px;
          }
          
          .timeline-steps::before {
            display: none;
          }
          
          .step-dot {
            margin: 0;
          }
          
          .timeline-step {
            display: flex;
            align-items: center;
            gap: 16px;
            text-align: left;
          }
          
          .actions {
            flex-direction: column;
          }
          
          .btn {
            width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="header">
          <div class="brand-name">🛍️ ShopVerse</div>
          <div class="order-badge">
            ✓ ORDER #${order.orderNumber.slice(-8)}
          </div>
        </div>
        
        <!-- Main Content -->
        <div class="content">
          <!-- Greeting -->
          <div class="greeting">
            <h2>Thanks for your order, ${firstName}! 🎉</h2>
            <p>We've received your order and will notify you once it's on its way.</p>
          </div>
          
          <!-- Quick Stats -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Order date</div>
              <div class="stat-value">${new Date(
                order.createdAt,
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total amount</div>
              <div class="stat-value stat-highlight">₦${order.pricing?.total?.toLocaleString() || "0"}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Payment</div>
              <div class="stat-value" style="color: ${order.payment?.status === "paid" ? "#10B981" : "#F59E0B"}">
                ${order.payment?.status === "paid" ? "✅ Paid" : "⏳ Pending"}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Status</div>
              <div class="stat-value">${order.status === "processing" ? "Processing" : "Confirmed"}</div>
            </div>
          </div>
          
          <!-- Order Timeline -->
          <div class="timeline">
            <div class="timeline-title">
              <span>📋</span> Order Status
            </div>
            <div class="timeline-steps">
              <div class="timeline-step">
                <div class="step-dot completed">✓</div>
                <div class="step-label completed">Order Placed</div>
              </div>
              <div class="timeline-step">
                <div class="step-dot ${order.status !== "pending" ? "completed" : "active"}">
                  ${order.status !== "pending" ? "✓" : ""}
                </div>
                <div class="step-label ${order.status !== "pending" ? "completed" : "active"}">Confirmed</div>
              </div>
              <div class="timeline-step">
                <div class="step-dot"></div>
                <div class="step-label">Shipped</div>
              </div>
              <div class="timeline-step">
                <div class="step-dot"></div>
                <div class="step-label">Delivered</div>
              </div>
            </div>
          </div>
          
          <!-- Order Items -->
          <div class="items-section">
            <div class="section-header">
              <h3>🛒 Order Items</h3>
              <span class="item-count">${order.items.length} item${order.items.length !== 1 ? "s" : ""}</span>
            </div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <!-- Price Summary -->
          <div class="price-summary">
            <div style="margin-bottom: 16px; font-weight: 700; color: #111827;">Payment Summary</div>
            
            <div class="price-row">
              <span class="price-label">Subtotal</span>
              <span class="price-value">₦${order.pricing?.subtotal?.toLocaleString() || "0"}</span>
            </div>
            
            ${
              order.pricing?.discount?.amount > 0
                ? `
            <div class="price-row discount">
              <span class="price-label">
                Discount ${order.pricing?.discount?.code ? `· ${order.pricing.discount.code}` : ""}
              </span>
              <span class="price-value">-₦${order.pricing?.discount?.amount?.toLocaleString()}</span>
            </div>
            `
                : ""
            }
            
            <div class="price-row">
              <span class="price-label">Shipping</span>
              <span class="price-value">
                ${order.pricing?.shipping === 0 ? "FREE" : `₦${order.pricing?.shipping?.toLocaleString() || "0"}`}
              </span>
            </div>
            
            <div class="price-row">
              <span class="price-label">Tax (${order.pricing?.tax?.breakdown?.taxRate || "7.5"}% VAT)</span>
              <span class="price-value">₦${order.pricing?.tax?.total?.toLocaleString() || "0"}</span>
            </div>
            
            <div class="price-row total-row">
              <span class="price-label">Total</span>
              <span class="price-value">₦${order.pricing?.total?.toLocaleString() || "0"}</span>
            </div>
          </div>
          
          <!-- Shipping Information -->
          <div class="shipping-card">
            <div class="shipping-header">
              <span style="font-size: 24px;">📦</span>
              <h4>Delivery Address</h4>
            </div>
            <div class="address">
              <strong>${order.shipping?.address?.addressLine1 || ""}</strong>
              ${order.shipping?.address?.addressLine2 ? `<br>${order.shipping.address.addressLine2}` : ""}
              <br>${order.shipping?.address?.city || ""}, ${order.shipping?.address?.state || ""} ${order.shipping?.address?.postalCode || ""}
              <br>${order.shipping?.address?.country || "Nigeria"}
            </div>
            ${
              order.shipping?.address?.phone
                ? `
            <div class="phone">
              📞 Phone: ${order.shipping.address.phone}
            </div>
            `
                : ""
            }
          </div>
          
          <!-- Action Buttons -->
          <div class="actions">
            <a href="${orderUrl}" class="btn btn-primary">View Order Details →</a>
            ${
              order.trackingNumber
                ? `
            <a href="${trackingUrl}" class="btn btn-secondary">Track Package</a>
            `
                : ""
            }
          </div>
          
          <!-- Help Card -->
          <div class="help-card">
            <h4>💬 Need help with your order?</h4>
            <p style="color: #7F1D1D; margin-bottom: 16px;">
              Our customer service team is here for you 24/7.
            </p>
            <div class="help-links">
              <a href="${process.env.FRONTEND_URL}/contact" class="help-link">
                📧 Email Support
              </a>
              <a href="${process.env.FRONTEND_URL}/faq" class="help-link">
                📖 FAQs
              </a>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-brand">ShopVerse</div>
          <p style="color: #6B7280; margin-bottom: 16px;">
            Your one-stop shop for everything amazing.
          </p>
          <div class="footer-links">
            <a href="${process.env.FRONTEND_URL}" class="footer-link">Home</a>
            <a href="${process.env.FRONTEND_URL}/orders" class="footer-link">My Orders</a>
            <a href="${process.env.FRONTEND_URL}/contact" class="footer-link">Support</a>
            <a href="${process.env.FRONTEND_URL}/terms" class="footer-link">Terms</a>
          </div>
          <div class="copyright">
            © ${currentYear} ShopVerse. All rights reserved.
            <br>
            This email was sent to confirm your order #${order.orderNumber.slice(-8)}.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const orderConfirmationTextContent = ({
  order,
  firstName,
  currentYear,
}) => {
  return `
✅ ORDER CONFIRMED - SHOPVERSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi ${firstName},

Thanks for shopping with ShopVerse! We've received your order and will start preparing it right away.

📋 ORDER SUMMARY
━━━━━━━━━━━━━━━━━━━━━━
Order #: ${order.orderNumber}
Date: ${new Date(order.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}
Total: ₦${order.pricing?.total?.toLocaleString() || "0"}
Payment: ${order.payment?.status === "paid" ? "Paid ✓" : "Pending"}
Status: ${order.status === "processing" ? "Processing" : "Confirmed"}

🛍️ ORDER ITEMS
━━━━━━━━━━━━━━━━━━━━━━
${order.items
  .map(
    (
      item,
    ) => `${item.quantity}x ${item.product?.name || "Product"}${item.variantName ? ` (${item.variantName})` : ""}
   ₦${(item.price?.final * item.quantity).toLocaleString()}`,
  )
  .join("\n\n")}

💰 PAYMENT BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━
Subtotal: ₦${order.pricing?.subtotal?.toLocaleString() || "0"}
${order.pricing?.discount?.amount > 0 ? `Discount: -₦${order.pricing.discount.amount.toLocaleString()}\n` : ""}Shipping: ${order.pricing?.shipping === 0 ? "FREE" : `₦${order.pricing?.shipping?.toLocaleString() || "0"}`}
Tax: ₦${order.pricing?.tax?.total?.toLocaleString() || "0"}
────────────────────────
TOTAL: ₦${order.pricing?.total?.toLocaleString() || "0"}

📦 DELIVERY ADDRESS
━━━━━━━━━━━━━━━━━━━━━━
${order.shipping?.address?.addressLine1 || ""}
${order.shipping?.address?.addressLine2 ? `${order.shipping.address.addressLine2}\n` : ""}${order.shipping?.address?.city || ""}, ${order.shipping?.address?.state || ""} ${order.shipping?.address?.postalCode || ""}
${order.shipping?.address?.country || "Nigeria"}
${order.shipping?.address?.phone ? `📞 ${order.shipping.address.phone}` : ""}

🔗 QUICK LINKS
━━━━━━━━━━━━━━━━━━━━━━
View your order:
${process.env.FRONTEND_URL}/orders/${order._id}

${
  order.trackingNumber
    ? `Track your package:
${process.env.FRONTEND_URL}/track/${order.trackingNumber}

`
    : ""
}💬 Need help?
━━━━━━━━━━━━━━━━━━━━━━
Contact us anytime:
• Email: support@shopverse.com
• FAQ: ${process.env.FRONTEND_URL}/faq

Thank you for choosing ShopVerse! We hope you love your items.

━━━━━━━━━━━━━━━━━━━━━━
🛍️ ShopVerse
Your one-stop shop for everything amazing.
© ${currentYear} All rights reserved.

This is an automated message, please do not reply directly.
  `;
};

export default orderConfirmationEmailTemplate;
