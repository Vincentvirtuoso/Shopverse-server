import express from "express";
import {
  getAllCustomers,
  getCustomerStats,
  getCustomerById,
  updateCustomerStatus,
  updateCustomerRole,
  exportCustomers,
  deleteCustomer,
  bulkUpdateCustomerStatus,
} from "../controller/customers.controller.js";
import { protect, requireSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(requireSuperAdmin);

router.route("/").get(getAllCustomers);

router.get("/stats", getCustomerStats);
router.get("/export", exportCustomers);

router.route("/bulk/status").patch(bulkUpdateCustomerStatus);

router.route("/:id").get(getCustomerById).delete(deleteCustomer);

router.patch("/:id/status", updateCustomerStatus);
router.patch("/:id/role", updateCustomerRole);

export default router;
