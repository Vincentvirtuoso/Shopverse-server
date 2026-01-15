import express from "express";
import {
  createOrder,
  getOrder,
  getMyOrders,
  updateOrderStatus,
  cancelOrder,
  requestReturn,
  getInvoice,
  getAllOrders,
  getSalesStats,
  processPaystackWebhook,
  confirmCashOnDelivery,
} from "../controller/order.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.route("/webhook/paystack").post(processPaystackWebhook);

// Protected routes (require authentication)
router.use(protect);

router.route("/").post(createOrder);
router.route("/my-orders").get(getMyOrders);
router.route("/:id").get(getOrder);
router.route("/:id/cancel").patch(cancelOrder);
router.route("/:id/returns").post(requestReturn);
router.route("/:id/invoice").get(getInvoice);

// Admin/Seller routes
router.route("/").get(authorize("admin", "seller"), getAllOrders);
router.route("/stats/sales").get(authorize("admin"), getSalesStats);
router
  .route("/:id/status")
  .patch(authorize("admin", "seller"), updateOrderStatus);
router
  .route("/:id/confirm-cod")
  .post(authorize("admin", "seller"), confirmCashOnDelivery);

export default router;
