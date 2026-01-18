import axios from "axios";
import AppError from "./AppError.js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

const isTestMode = PAYSTACK_SECRET_KEY?.startsWith("sk_test_");
if (isTestMode) {
  console.log("⚠️  Running in Paystack TEST MODE");
}

const generatePaystackPayment = async (order) => {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Paystack secret key not configured");
    }

    const callbackUrl = `${process.env.FRONTEND_URL}/payment/callback`;

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: order.customer.email,
        amount: Math.round(order.pricing.total * 100),
        currency: "NGN",
        reference: order.payment.transactionId,
        callback_url: callbackUrl,
        metadata: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          customerId: order.customer.user.toString(),
          customerName: `${order.customer.firstName} ${order.customer.lastName}`,
          custom_fields: [
            {
              display_name: "Order Number",
              variable_name: "order_number",
              value: order.orderNumber,
            },
            {
              display_name: "Customer Name",
              variable_name: "customer_name",
              value: `${order.customer.firstName} ${order.customer.lastName}`,
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.status) {
      throw new Error(
        response.data.message || "Paystack initialization failed"
      );
    }

    order.payment.transactionId = response.data.data.reference;
    await order.save();

    // Return the payment data
    return {
      authorization_url: response.data.data.authorization_url,
      access_code: response.data.data.access_code,
      reference: response.data.data.reference,
    };
  } catch (error) {
    console.error(
      "Paystack payment generation failed:",
      error.response?.data || error.message
    );

    if (error.response) {
      console.error("Paystack API Error:", {
        status: error.response.status,
        data: error.response.data,
      });
    }

    throw new AppError(
      error.response?.data?.message ||
        "Payment gateway error. Please try again.",
      500,
      "PAYMENT_GATEWAY_ERROR"
    );
  }
};

const verifyPaystackPayment = async (reference) => {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Paystack secret key not configured");
    }

    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!response.data.status) {
      return {
        success: false,
        message: response.data.message || "Payment verification failed",
      };
    }

    const data = response.data.data;

    // Check if payment was successful
    if (data.status !== "success") {
      return {
        success: false,
        message: `Payment status: ${data.status}`,
        status: data.status,
      };
    }

    return {
      success: true,
      data: {
        reference: data.reference,
        amount: data.amount / 100, // Convert from kobo to naira
        currency: data.currency,
        status: data.status,
        paidAt: data.paid_at,
        channel: data.channel,
        metadata: data.metadata,
        customer: {
          email: data.customer.email,
        },
      },
    };
  } catch (error) {
    console.error(
      "Payment verification error:",
      error.response?.data || error.message
    );

    throw new AppError(
      error.response?.data?.message || "Payment verification failed",
      500,
      "PAYMENT_VERIFICATION_ERROR"
    );
  }
};

export { generatePaystackPayment, verifyPaystackPayment };
