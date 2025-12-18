import e from "express";
import {
  getUser,
  login,
  logout,
  refreshToken,
  register,
  resendVerificationEmail,
  verifyEmail,
} from "../controller/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validators/user.validation.js";
import { protect } from "../middleware/auth.middleware.js";

const router = e.Router();

router.post("/login", validate(loginSchema), login);
router.post("/register", validate(registerSchema), register);
router.post("/refresh-token", refreshToken);
router.get("/verify-email/", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.post("/logout", protect, logout);
router.get("/me", protect, getUser);

export default router;
