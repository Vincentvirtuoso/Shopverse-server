const orderConfirmationEmailTemplate = ({
  order,
  itemsHtml,
  currentYear,
  firstName,
  orderUrl,
  trackingUrl,
}) => {
  return `
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
              max-width: 680px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              color: white;
              padding: 40px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 700;
            }
            .order-number {
              display: inline-block;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px 16px;
              border-radius: 20px;
              margin-top: 12px;
              font-size: 18px;
              font-weight: 600;
            }
            .content {
              padding: 40px;
            }
            .section {
              margin-bottom: 32px;
            }
            .section-title {
              font-size: 20px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-top: 20px;
            }
            .info-card {
              background: #f9fafb;
              padding: 20px;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
            }
            .info-label {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 18px;
              font-weight: 600;
              color: #1f2937;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .items-table th {
              text-align: left;
              padding: 12px;
              background: #f9fafb;
              color: #6b7280;
              font-weight: 600;
              border-bottom: 2px solid #e5e7eb;
            }
            .summary {
              background: #f9fafb;
              padding: 24px;
              border-radius: 12px;
              margin-top: 24px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .summary-row.total {
              border-bottom: none;
              font-size: 20px;
              font-weight: 700;
              color: #1f2937;
            }
            .button {
              display: inline-block;
              padding: 16px 32px;
              background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 10px;
              font-weight: 600;
              font-size: 16px;
              transition: transform 0.2s, box-shadow 0.2s;
              margin: 8px;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(79, 70, 229, 0.3);
            }
            .button-outline {
              display: inline-block;
              padding: 16px 32px;
              background: white;
              color: #4F46E5 !important;
              text-decoration: none;
              border-radius: 10px;
              font-weight: 600;
              font-size: 16px;
              border: 2px solid #4F46E5;
              transition: all 0.2s;
              margin: 8px;
            }
            .button-outline:hover {
              background: #4F46E5;
              color: white !important;
            }
            .timeline {
              position: relative;
              padding-left: 30px;
              margin: 20px 0;
            }
            .timeline::before {
              content: '';
              position: absolute;
              left: 0;
              top: 0;
              bottom: 0;
              width: 2px;
              background: #4F46E5;
            }
            .timeline-item {
              position: relative;
              margin-bottom: 24px;
            }
            .timeline-item::before {
              content: '';
              position: absolute;
              left: -34px;
              top: 0;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #4F46E5;
              border: 3px solid white;
              box-shadow: 0 0 0 3px #4F46E5;
            }
            .timeline-item.completed::before {
              background: #10B981;
              box-shadow: 0 0 0 3px #10B981;
            }
            .timeline-date {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .timeline-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 4px;
            }
            .timeline-desc {
              font-size: 14px;
              color: #6b7280;
            }
            .footer {
              text-align: center;
              padding: 40px 20px;
              background: #f9fafb;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .footer-links {
              margin-top: 16px;
            }
            .footer-links a {
              color: #4F46E5;
              text-decoration: none;
              margin: 0 12px;
            }
            .footer-links a:hover {
              text-decoration: underline;
            }
            .summary-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            /* Summary Item */
            .summary-item {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding: 12px 0;
            }

            .summary-item:not(:last-child) {
              border-bottom: 1px solid #f3f4f6;
            }

            .summary-item.total {
              border-bottom: none;
              padding-top: 16px;
              margin-top: 8px;
            }

            /* Summary Label */
            .summary-label {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .summary-label-desc {
              font-size: 12px;
              color: #6b7280;
              font-weight: 400;
            }

            /* Summary Value */
            .summary-value {
              font-size: 16px;
              font-weight: 600;
              color: #374151;
              text-align: right;
            }

            .summary-item.total .summary-value {
              font-size: 24px;
            }

            /* Divider */
            .summary-divider {
              height: 1px;
              background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
              margin: 16px 0;
            }

            /* Tax Note */
            .tax-note {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-top: 16px;
              padding: 12px;
              background: #f9fafb;
              border-radius: 8px;
              font-size: 13px;
              color: #6b7280;
            }

            .tax-note svg {
              color: #9ca3af;
              flex-shrink: 0;
            }

            /* Discount Styling */
            .summary-item.discount .summary-value {
              color: #10b981;
              font-weight: 600;
            }

            /* Responsive Design */
            @media (max-width: 640px) {
              .summary-card {
                padding: 20px;
              }
              
              .summary-item {
                padding: 10px 0;
              }
              
              .summary-value {
                font-size: 15px;
              }
              
              .summary-item.total .summary-value {
                font-size: 20px;
              }
            }

            /* Hover Effects */
            .summary-item:hover {
              background: #f9fafb;
              margin: 0 -12px;
              padding: 12px;
              border-radius: 6px;
              transition: all 0.2s ease;
            }

            .summary-item.total:hover {
              background: transparent;
              margin: 0;
              padding-top: 16px;
            }
            @media (max-width: 640px) {
              .container {
                margin: 0;
                border-radius: 0;
              }
              .content {
                padding: 20px;
              }
              .info-grid {
                grid-template-columns: 1fr;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Order Confirmed!</h1>
              <div class="order-number">${order.orderNumber}</div>
              <p style="margin-top: 16px; opacity: 0.9;">Thank you for your purchase, ${firstName}!</p>
            </div>
            
            <div class="content">
              <!-- Order Summary -->
              <div class="section">
                <h2 class="section-title">Order Summary</h2>
                <div class="info-grid">
                  <div class="info-card">
                    <div class="info-label">Order Date</div>
                    <div class="info-value">${new Date(
                      order.createdAt
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Payment Method</div>
                    <div class="info-value">${
                      order.payment?.method === "cash_on_delivery"
                        ? "Cash on Delivery"
                        : "Paystack"
                    }</div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Payment Status</div>
                    <div class="info-value" style="color: ${
                      order.payment?.status === "paid" ? "#10B981" : "#F59E0B"
                    }">
                      ${order.payment?.status === "paid" ? "Paid" : "Pending"}
                    </div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Order Status</div>
                    <div class="info-value" style="color: ${
                      order.status === "processing" ? "#F59E0B" : "#10B981"
                    }">
                      ${
                        order.status === "processing"
                          ? "Processing"
                          : "Confirmed"
                      }
                    </div>
                  </div>
                </div>
              </div>
  
              <!-- Order Timeline -->
              <div class="section">
                <h2 class="section-title">Order Status</h2>
                <div class="timeline">
                  <div class="timeline-item completed">
                    <div class="timeline-date">${new Date(
                      order.createdAt
                    ).toLocaleDateString()}</div>
                    <div class="timeline-title">Order Placed</div>
                    <div class="timeline-desc">Your order has been received</div>
                  </div>
                  <div class="timeline-item ${
                    order.status !== "pending" ? "completed" : ""
                  }">
                    <div class="timeline-date">${
                      order.status !== "pending"
                        ? new Date().toLocaleDateString()
                        : "Upcoming"
                    }</div>
                    <div class="timeline-title">Order Confirmation</div>
                    <div class="timeline-desc">Order confirmed and being prepared</div>
                  </div>
                  <div class="timeline-item">
                    <div class="timeline-date">Upcoming</div>
                    <div class="timeline-title">Shipped</div>
                    <div class="timeline-desc">Your order is on its way</div>
                  </div>
                  <div class="timeline-item">
                    <div class="timeline-date">Upcoming</div>
                    <div class="timeline-title">Delivered</div>
                    <div class="timeline-desc">Order delivered to your address</div>
                  </div>
                </div>
              </div>
  
              <!-- Order Items -->
              <div class="section">
                <h2 class="section-title">Order Items (${
                  order.items.length
                })</h2>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th style="width: 60%;">Product</th>
                      <th style="width: 20%; text-align: center;">Quantity</th>
                      <th style="width: 20%; text-align: right;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>
  
              <!-- Order Total -->
              <div class="section">
                <h2 class="section-title mb-6">Order Summary</h2>
                <div class="summary-card">
                  <!-- Subtotal -->
                  <div class="summary-item">
                    <div class="summary-label">
                      <span>Subtotal</span>
                      <span class="summary-label-desc">${
                        order.items?.length || 0
                      } items</span>
                    </div>
                    <div class="summary-value">
                      ₦${order.pricing?.subtotal?.toLocaleString() || "0"}
                    </div>
                  </div>

                  <!-- Discount (if any) -->
                  ${
                    order.pricing?.discount?.amount > 0
                      ? `
                    <div class="summary-item discount">
                      <div class="summary-label">
                        <span>Discount</span>
                        ${
                          order.pricing?.discount?.code
                            ? `<span class="summary-label-desc">${order.pricing.discount.code}</span>`
                            : ""
                        }
                      </div>
                      <div class="summary-value text-green-600">
                        -₦${
                          order.pricing?.discount?.amount?.toLocaleString() ||
                          "0"
                        }
                      </div>
                    </div>
                    `
                      : ""
                  }

                  <!-- Shipping -->
                  <div class="summary-item">
                    <div class="summary-label">
                      <span>Shipping</span>
                      <span class="summary-label-desc">
                        ${
                          shippingAddress?.city
                            ? `${shippingAddress.city}, `
                            : ""
                        }
                        ${shippingAddress?.state || ""}
                      </span>
                    </div>
                    <div class="summary-value">
                      ${
                        order.pricing?.shipping === 0
                          ? '<span class="text-green-600 font-semibold">FREE</span>'
                          : `₦${
                              order.pricing?.shipping?.toLocaleString() || "0"
                            }`
                      }
                    </div>
                  </div>

                  <!-- Tax -->
                  <div class="summary-item">
                    <div class="summary-label">
                      <span>Tax</span>
                      <span class="summary-label-desc">
                        ${order.pricing?.tax?.breakdown?.taxRate || "7.5"}%
                        ${order.pricing?.tax?.breakdown?.taxType || "VAT"}
                      </span>
                    </div>
                    <div class="summary-value">
                      ₦${order.pricing?.tax?.total?.toLocaleString() || "0"}
                    </div>
                  </div>

                  <!-- Divider -->
                  <div class="summary-divider"></div>

                  <!-- Total -->
                  <div class="summary-item total">
                    <div class="summary-label">
                      <span class="text-lg font-bold">Total</span>
                      <span class="summary-label-desc">
                        ${order.pricing?.currency || "NGN"}
                      </span>
                    </div>
                    <div class="summary-value">
                      <span class="text-2xl font-bold text-red-600">
                        ₦${order.pricing?.total?.toLocaleString() || "0"}
                      </span>
                    </div>
                  </div>

                  <!-- Tax Note -->
                  ${
                    order.pricing?.tax?.total > 0
                      ? `
                    <div class="tax-note">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>
                        Tax included as per ${
                          order.pricing?.tax?.breakdown?.location || "NG"
                        } regulations
                      </span>
                    </div>
                    `
                      : ""
                  }
                </div>
              </div>
  
              <!-- Shipping Information -->
              <div class="section">
                <h2 class="section-title">Shipping Information</h2>
                <div class="info-card">
                  <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">
                    ${order.shipping?.address?.addressLine1 || ""}
                    ${
                      order.shipping?.address?.addressLine2
                        ? `<br/>${order.shipping.address.addressLine2}`
                        : ""
                    }
                  </div>
                  <div style="color: #6b7280;">
                    ${order.shipping?.address?.city || ""}, 
                    ${order.shipping?.address?.state || ""} 
                    ${order.shipping?.address?.postalCode || ""}
                    <br/>
                    ${order.shipping?.address?.country || "Nigeria"}
                  </div>
                  ${
                    order.shipping?.address?.phone
                      ? `
                    <div style="margin-top: 8px; color: #6b7280;">
                      Phone: ${order.shipping.address.phone}
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>
  
              <!-- Action Buttons -->
              <div class="section" style="text-align: center; margin-top: 40px;">
                <a href="${orderUrl}" class="button">View Order Details</a>
                ${
                  order.trackingNumber
                    ? `
                  <a href="${trackingUrl}" class="button-outline">Track Order</a>
                `
                    : ""
                }
              </div>
  
              <!-- Help Section -->
              <div class="section" style="background: #f0f9ff; padding: 24px; border-radius: 12px; border: 1px solid #bae6fd;">
                <h3 style="margin-top: 0; color: #0369a1;">Need Help?</h3>
                <p style="color: #0c4a6e; margin-bottom: 16px;">
                  If you have any questions about your order, please don't hesitate to contact our customer support team.
                </p>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                  <a href="${process.env.FRONTEND_URL}/contact" 
                     style="color: #0369a1; text-decoration: none; font-weight: 600;">
                    📞 Contact Support
                  </a>
                  <a href="${process.env.FRONTEND_URL}/faq" 
                     style="color: #0369a1; text-decoration: none; font-weight: 600;">
                    ❓ View FAQ
                  </a>
                </div>
              </div>
            </div>
  
            <div class="footer">
              <p><strong>${process.env.APP_NAME || "Your Company"}</strong></p>
              <p>Thank you for shopping with us!</p>
              <div class="footer-links">
                <a href="${process.env.FRONTEND_URL}">Visit Website</a>
                <a href="${process.env.FRONTEND_URL}/orders">My Orders</a>
                <a href="${process.env.FRONTEND_URL}/contact">Contact Us</a>
              </div>
              <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                &copy; ${currentYear} ${
    process.env.APP_NAME || "Your Company"
  }. All rights reserved.
                <br/>
                This is an automated email, please do not reply directly.
              </p>
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
ORDER CONFIRMED - ${order.orderNumber}

Hi ${firstName},

Thank you for your order! We're excited to let you know that we've received your order and it is now being processed.

ORDER DETAILS
-------------
Order Number: ${order.orderNumber}
Order Date: ${new Date(order.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}
Payment Method: ${
    order.payment?.method === "cash_on_delivery"
      ? "Cash on Delivery"
      : "Paystack"
  }
Payment Status: ${order.payment?.status === "paid" ? "Paid" : "Pending"}
Order Status: ${order.status === "processing" ? "Processing" : "Confirmed"}

ORDER ITEMS
-----------
${order.items
  .map(
    (item) =>
      `• ${item.quantity}x ${item.product?.name || "Product"} ${
        item.variantName ? `(${item.variantName})` : ""
      } - ₦${(item.price?.final * item.quantity).toLocaleString()}`
  )
  .join("\n")}

ORDER SUMMARY
-------------
Subtotal: ₦${order.pricing?.subtotal?.toLocaleString() || "0"}
${
  order.pricing?.discount?.amount > 0
    ? `Discount: -₦${
        order.pricing?.discount?.amount?.toLocaleString() || "0"
      }\n`
    : ""
}Shipping: ${
    order.pricing?.shipping === 0
      ? "FREE"
      : `₦${order.pricing?.shipping?.toLocaleString() || "0"}`
  }
Tax: ₦${order.pricing?.tax?.total?.toLocaleString() || "0"}
Total: ₦${order.pricing?.total?.toLocaleString() || "0"}

SHIPPING ADDRESS
----------------
${order.shipping?.address?.addressLine1 || ""}
${order.shipping?.address?.addressLine2 || ""}
${order.shipping?.address?.city || ""}, ${
    order.shipping?.address?.state || ""
  } ${order.shipping?.address?.postalCode || ""}
${order.shipping?.address?.country || "Nigeria"}
${
  order.shipping?.address?.phone ? `Phone: ${order.shipping.address.phone}` : ""
}

NEXT STEPS
----------
1. Order Processing: We're preparing your items for shipment
2. Shipping: You'll receive tracking information once shipped
3. Delivery: Estimated delivery in 3-5 business days

VIEW YOUR ORDER
---------------
${process.env.FRONTEND_URL}/orders/${order._id}

${
  order.trackingNumber
    ? `TRACK YOUR ORDER\n${process.env.FRONTEND_URL}/track/${order.trackingNumber}\n\n`
    : ""
}
NEED HELP?
----------
If you have any questions about your order, please contact our support team:
• Visit: ${process.env.FRONTEND_URL}/contact
• FAQ: ${process.env.FRONTEND_URL}/faq

Thank you for shopping with ${process.env.APP_NAME || "us"}!

---
${process.env.APP_NAME || "Your Company"}
© ${currentYear} All rights reserved.
This is an automated email, please do not reply directly.
    `;
};

export default orderConfirmationEmailTemplate;
