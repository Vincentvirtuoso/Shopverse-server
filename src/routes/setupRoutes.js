import express from "express";
import {
  checkSuperAdminExists,
  resetSetup,
  setupSuperAdmin,
} from "../controller/setupController.js";

const router = express.Router();

router.get("/check", checkSuperAdminExists);
router.post("/super-admin", setupSuperAdmin);

router.post("/reset", resetSetup);

export default router;
