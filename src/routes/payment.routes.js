import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { paystackWebhook, verifyPayment } from "../utils/payment.controller.js";

const router = express.Router();

router.post("/verify", protect, verifyPayment);

router.post("/webhook/paystack", paystackWebhook);

export default router;
