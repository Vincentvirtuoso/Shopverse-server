import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AUTH_CONFIG } from "../config/auth.config.js";
export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const signAccessToken = (user, roleConfig) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      isSeller: user.isSeller,
      permissions:
        user.role === "admin" || user.role === "super_admin"
          ? user.permissions || []
          : undefined,
    },
    roleConfig.tokenSecret,
    { expiresIn: AUTH_CONFIG.access.expiresIn }
  );

export const signRefreshToken = (user, roleConfig) =>
  jwt.sign(
    {
      id: user._id,
      type: "refresh",
      role: user.role,
    },
    roleConfig.refreshSecret,
    { expiresIn: `${AUTH_CONFIG.refresh.expiresInDays}d` }
  );
