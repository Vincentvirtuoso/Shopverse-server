import AppError from "./AppError.js";
import catchAsync from "./catchAsync.js";
import { verifyPaystackPayment } from "./paystack.js";
import Order from "../models/Orders.js";

export const verifyPayment = catchAsync(async (req, res, next) => {
  const { reference } = req.body;

  if (!reference) {
    return next(
      new AppError("Payment reference is required", 400, "MISSING_REFERENCE")
    );
  }

  // Verify with Paystack
  const verificationResult = await verifyPaystackPayment(reference);

  if (!verificationResult.success) {
    return res.status(400).json({
      status: "fail",
      verified: false,
      message: verificationResult.message || "Payment verification failed",
    });
  }

  // Find order by payment reference
  const order = await Order.findOne({
    "payment.transactionId": reference,
  });

  if (!order) {
    return next(
      new AppError(
        "Order not found for this payment reference",
        404,
        "ORDER_NOT_FOUND"
      )
    );
  }

  // Check if payment is already verified
  if (order.payment.status === "paid") {
    return res.status(200).json({
      status: "success",
      verified: true,
      message: "Payment already verified",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.pricing.total,
        currency: order.pricing.currency,
        reference: reference,
        paidAt: order.payment.paidAt,
      },
    });
  }

  // Verify amount matches (critical security check)
  const expectedAmount = order.pricing.total;
  const paidAmount = verificationResult.data.amount;

  // Allow small rounding differences (within 0.01)
  if (Math.abs(expectedAmount - paidAmount) > 0.01) {
    console.error("Amount mismatch:", {
      orderNumber: order.orderNumber,
      expectedAmount,
      paidAmount,
      difference: Math.abs(expectedAmount - paidAmount),
    });

    return next(
      new AppError(
        "Payment amount does not match order total",
        400,
        "AMOUNT_MISMATCH"
      )
    );
  }

  // Update order payment status
  order.payment.status = "paid";
  order.payment.paidAt = new Date(verificationResult.data.paidAt);
  order.payment.channel = verificationResult.data.channel;
  order.status = "pending"; // Move from payment_pending to pending

  // Add to status history
  order.statusHistory.push({
    status: "pending",
    timestamp: new Date(),
    note: "Payment verified and confirmed",
    updatedBy: order.customer.user,
  });

  await order.save();

  res.status(200).json({
    status: "success",
    verified: true,
    message: "Payment verified successfully",
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: paidAmount,
      currency: verificationResult.data.currency,
      reference: reference,
      paidAt: verificationResult.data.paidAt,
    },
  });
});

export const paystackWebhook = catchAsync(async (req, res, next) => {
  const crypto = require("crypto");

  // Verify webhook signature
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    console.error("Invalid webhook signature");
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.body;
  console.log("Webhook event received:", event.event);

  // Handle charge.success event
  if (event.event === "charge.success") {
    const { reference, amount, metadata } = event.data;

    const order = await Order.findOne({
      "payment.transactionId": reference,
    });

    if (!order) {
      console.error("Order not found for webhook:", reference);
      return res.status(200).send("OK"); // Still return 200 to acknowledge
    }

    if (order.payment.status === "paid") {
      console.log("Order already marked as paid:", order.orderNumber);
      return res.status(200).send("OK");
    }

    // Verify amount matches
    const expectedAmount = Math.round(order.pricing.total * 100); // Convert to kobo

    if (amount === expectedAmount) {
      order.payment.status = "paid";
      order.payment.paidAt = new Date();
      order.status = "pending";

      order.statusHistory.push({
        status: "pending",
        timestamp: new Date(),
        note: "Payment confirmed via webhook",
        updatedBy: order.customer.user,
      });

      await order.save();
      console.log(`✅ Order ${order.orderNumber} marked as paid via webhook`);
    } else {
      console.error("Webhook amount mismatch:", {
        reference,
        expectedAmount,
        receivedAmount: amount,
      });
    }
  }

  res.status(200).send("OK");
});
