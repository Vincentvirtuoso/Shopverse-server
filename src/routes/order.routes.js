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

router.use(protect);

router.post("/", createOrder);
router.get("/my-orders", getMyOrders);

router.patch("/:id/cancel", cancelOrder);
router.post("/:id/returns", requestReturn);
router.get("/:id/invoice", getInvoice);
router.post("/:id/confirm-cod", confirmCashOnDelivery);

router.use("/admin", restrictTo("admin", "super_admin", "seller"));

router.get("/admin", getAllOrders);
router.patch("/admin/:id/status", updateOrderStatus);
// router.patch("/admin/:id/ship", );
router.get("/admin/analytics", getOrderAnalytics);
router.get("/admin/fulfillment/queue", getFulfillmentQueue);
router.patch("/admin/bulk-update", bulkUpdateFulfillment);
router.get("/admin/returns", getReturnsDashboard);
router.get("/admin/export", exportOrders);
router.get("/admin/stats", getSalesStats);

router.get("/:id", getOrder);

export default router;
