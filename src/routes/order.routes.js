import express from "express";
import {
  createOrder,
  getOrder,
  getMyOrders,
  cancelOrder,
  requestReturn,
  getInvoice,
  getSalesStats,
  confirmCashOnDelivery,
} from "../controller/order.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  bulkUpdateFulfillment,
  exportOrders,
  getAllOrders,
  getFulfillmentQueue,
  getOrderAnalytics,
  getReturnsDashboard,
  updateOrderStatus,
} from "../controller/admin.order.controllers.js";

const router = express.Router();

// router.route("/webhook/paystack").post(processPaystackWebhook);

// Protected routes (require authentication)
router.use(protect);

router.route("/").post(createOrder);
router.route("/my-orders").get(getMyOrders);
router.route("/:id").get(getOrder);
router.route("/:id/cancel").patch(cancelOrder);
router.route("/:id/returns").post(requestReturn);
router.route("/:id/invoice").get(getInvoice);
router.route("/:id/confirm-cod").post(confirmCashOnDelivery);

// Admin/Seller routes
router.route("/stats/sales").get(restrictTo("admin"), getSalesStats);
router.use(restrictTo("admin", "super_admin", "seller"));
router.route("/admin").get(getAllOrders);
router.route("/:id/status").patch(updateOrderStatus);
router.get("/analytics", getOrderAnalytics);
router.get("/fufilment/queue", getFulfillmentQueue);
router.patch("/bulk-update", bulkUpdateFulfillment);
router.get("/get-returns", getReturnsDashboard);
router.get("/export", exportOrders);

export default router;
