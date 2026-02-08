import User from "../models/User.js";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../utils/emailService.js";
import crypto from "crypto";
import AuditLog from "../models/AuditLog.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
} from "../utils/auth.token.js";
import { AUTH_CONFIG } from "../config/auth.config.js";
import { cookieOptions } from "../utils/auth.cookies.js";

const secure = process.env.NODE_ENV === "production";

const createCookieOptions = (days) => {
  const options = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
  };

  return options;
};

// ===== LOGIN =====
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(
      new AppError(
        "Please provide email and password",
        400,
        "VALIDATION_ERROR",
      ),
    );
  }

  // Using the static method from schema
  const user = await User.findByEmail(email).select("+password");

  if (!user) {
    return next(new AppError("Invalid credentials", 401, "AUTH_FAILED"));
  }

  if (!user.isActive) {
    return next(
      new AppError(
        "Account is deactivated. Contact support.",
        403,
        "FORBIDDEN",
      ),
    );
  }

  // Using the instance method from schema
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new AppError("Invalid credentials", 401, "AUTH_FAILED"));
  }

  if (!user.isEmailVerified) {
    return next(new AppError("Email not verified", 403, "EMAIL_NOT_VERIFIED"));
  }

  const roleKey =
    user.role === "admin" || user.role === "super_admin" ? user.role : "user";

  const roleConfig = AUTH_CONFIG.roles[roleKey];

  console.log("user", user);
  console.log("role config", roleConfig);

  const accessToken = signAccessToken(user, roleConfig);
  const refreshToken = signRefreshToken(user, roleConfig);

  const refreshTokenHash = hashToken(refreshToken);
  user.refreshTokens = user.refreshTokens || [];

  user.refreshTokens.push({
    tokenHash: refreshTokenHash,
    createdAt: new Date(),
    expiresAt: new Date(
      Date.now() + AUTH_CONFIG.refresh.expiresInDays * 86400000,
    ),
  });

  await user.save({ validateBeforeSave: false });

  res.cookie(roleConfig.tokenName, accessToken, cookieOptions(7));
  res.cookie(
    roleConfig.refreshTokenName,
    refreshToken,
    cookieOptions(AUTH_CONFIG.refresh.expiresInDays),
  );

  // Update stats
  await User.updateOne(
    { _id: user._id },
    {
      $set: { "stats.lastLogin": new Date() },
      $inc: { "stats.loginCount": 1 },
    },
  );

  const userData = {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    profileImage: user.profileImage,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    isActive: user.isActive,
    isSeller: user.isSeller,
    preferences: user.preferences,
    stats: user.stats,
    addresses: user.addresses,
    sellerProfile: user.role === "seller" ? user.sellerProfile : undefined,
  };

  // Send response
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: userData,
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  const cookies = req.cookies || {};
  const refreshToken =
    cookies.admin_refresh_token || cookies.user_refresh_token;

  if (refreshToken) {
    const decoded = jwt.decode(refreshToken);
    if (decoded?.id) {
      await User.updateOne(
        { _id: decoded.id },
        { $set: { refreshTokens: [] } },
      );
    }
  }

  Object.values(AUTH_CONFIG.roles).forEach((r) => {
    res.clearCookie(r.tokenName);
    res.clearCookie(r.refreshTokenName);
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const forceLogoutUser = catchAsync(async (req, res) => {
  const { userId } = req.params;

  // Check if requester has permission
  if (req.user.role !== "super_admin" && req.user.role !== "admin") {
    return next(new AppError("Unauthorized to force logout", 403, "FORBIDDEN"));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
  }

  // Add to invalidated tokens list
  await User.findByIdAndUpdate(userId, {
    $push: {
      "security.invalidatedTokens": {
        timestamp: new Date(),
        reason: "force_logout",
        initiatedBy: req.user.id,
      },
    },
    $set: {
      "security.lastForceLogout": new Date(),
    },
  });

  // Create audit log
  await AuditLog.create({
    userId: req.user.id,
    action: "FORCE_LOGOUT",
    targetUserId: userId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    details: {
      reason: req.body.reason || "Administrative action",
    },
  });

  res.status(200).json({
    success: true,
    message: "User logged out from all sessions",
    data: {
      userId,
      timestamp: new Date().toISOString(),
      initiatedBy: req.user.id,
    },
  });
});

// Logout from all devices (user-initiated)
export const logoutAllDevices = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
  }

  // Clear current session cookies first
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };

  const cookiesToClear = [
    process.env.ADMIN_TOKEN_NAME || "admin_token",
    process.env.ADMIN_REFRESH_TOKEN_NAME || "admin_refresh_token",
    process.env.USER_TOKEN_NAME || "user_token",
    process.env.USER_REFRESH_TOKEN_NAME || "user_refresh_token",
    "token",
    "refreshToken",
  ];

  cookiesToClear.forEach((cookieName) => {
    res.clearCookie(cookieName, cookieOptions);
  });

  // Invalidate all tokens for this user
  await User.findByIdAndUpdate(req.user.id, {
    $push: {
      "security.invalidatedTokens": {
        timestamp: new Date(),
        reason: "logout_all_devices",
        allDevices: true,
      },
    },
    $set: {
      "security.tokenVersion": (req.user.security?.tokenVersion || 0) + 1,
      "security.lastLogoutAll": new Date(),
    },
  });

  // Create audit log
  await AuditLog.create({
    userId: req.user.id,
    action: "LOGOUT_ALL_DEVICES",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json({
    success: true,
    message: "Logged out from all devices successfully",
    data: {
      timestamp: new Date().toISOString(),
    },
  });
});

export const register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, phoneNumber, role } = req.body;

  // 1. Validate required fields
  if (!firstName || !lastName || !email || !password) {
    return next(new AppError("Please provide all required fields", 400));
  }

  // 2. Check if user already exists using static method
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return next(new AppError("Email is already registered", 409));
  }

  // 3. Validate role if provided
  const validRoles = ["customer", "seller", "admin", "super_admin"];
  const userRole = role && validRoles.includes(role) ? role : "customer";

  // 4. Create user data object
  const userData = {
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    phoneNumber: phoneNumber || undefined,
    role: userRole,
    ...(userRole === "seller" && {
      sellerProfile: {
        storeName: "",
        businessType: "",
        rating: 0,
        totalReviews: 0,
        isVerifiedSeller: false,
      },
    }),
  };

  // 5. Create new user
  const user = await User.create(userData);

  // 6. Generate email verification token
  const { token, v_tokenExpiresIn } = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendVerificationEmail(user.email, token, user.firstName);
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }

  // 8. Send response
  const responseData = {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isSeller: user.isSeller,
    ...(user.role === "seller" && {
      sellerProfile: user.sellerProfile,
    }),
  };

  res.status(201).json({
    success: true,
    message: "User registered successfully. Please verify your email.",
    data: {
      user: responseData,
      v_tokenExpiresIn,
    },
  });
});

export const verifyEmail = catchAsync(async (req, res, next) => {
  const { token, email } = req.query;

  if (!token) {
    return next(
      new AppError("Verification token is required", 400, "TOKEN_REQUIRED"),
    );
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
    email: email.toLowerCase(),
  });
  const verifiedUser = await User.findOne({
    email,
    isEmailVerified: true,
  });

  if (verifiedUser) {
    return next(new AppError("User is already verified.", 400, "VERIFIED"));
  }

  if (!user) {
    return next(
      new AppError(
        "Invalid or expired verification token. Please request a new one.",
        400,
        "INVALID_TOKEN",
      ),
    );
  }

  // Update user
  user.isEmailVerified = true;
  user.clearEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendWelcomeEmail(user.email, user.firstName);
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  res.status(200).json({
    success: true,
    message: "Email verified successfully! You can now log in.",
    data: {
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

export const resendVerificationEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(
      new AppError("Please provide email address", 400, "VALIDATION_ERROR"),
    );
  }

  const user = await User.findByEmail(email);

  if (!user) {
    return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
  }

  if (user.isEmailVerified) {
    return next(
      new AppError("Email is already verified", 400, "ALREADY_VERIFIED"),
    );
  }

  // Generate new verification token
  const { token, v_tokenExpiresIn } = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  try {
    await sendVerificationEmail(user.email, token, user.firstName);

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully. Please check your inbox.",
      v_tokenExpiresIn,
    });
  } catch (error) {
    user.clearEmailVerificationToken();

    await user.save({ validateBeforeSave: false });
    console.log(error);

    return next(
      new AppError(
        "Failed to send verification email. Please try again later.",
        500,
        "EMAIL_SEND_FAILED",
      ),
    );
  }
});

export const refreshToken = catchAsync(async (req, res, next) => {
  const cookies = req.cookies || {};

  const refreshToken =
    cookies.admin_refresh_token || cookies.user_refresh_token;

  if (!refreshToken) {
    return next(new AppError("Refresh token required", 401));
  }

  let decoded;

  try {
    decoded = jwt.decode(refreshToken);
  } catch {
    return next(new AppError("Invalid refresh token", 401));
  }

  const roleConfig = AUTH_CONFIG.roles[decoded.role || "user"];

  try {
    jwt.verify(refreshToken, roleConfig.refreshSecret);
  } catch {
    return next(new AppError("Refresh token expired", 401));
  }

  const tokenHash = hashToken(refreshToken);

  try {
    const user = await User.findOne({
      _id: decoded.id,
      "refreshTokens.tokenHash": tokenHash,
    });

    if (!user) {
      // token reuse detected → revoke ALL
      await User.updateOne(
        { _id: decoded.id },
        { $set: { refreshTokens: [] } },
      );
      return next(new AppError("Session compromised. Login again.", 401));
    }

    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.tokenHash !== tokenHash,
    );

    const newAccessToken = signAccessToken(user, roleConfig);
    const newRefreshToken = signRefreshToken(user, roleConfig);

    user.refreshTokens.push({
      tokenHash: hashToken(newRefreshToken),
      createdAt: new Date(),
      expiresAt: new Date(
        Date.now() + AUTH_CONFIG.refresh.expiresInDays * 86400000,
      ),
    });

    await user.save({ validateBeforeSave: false });

    res.cookie(roleConfig.tokenName, newAccessToken, cookieOptions(7));
    res.cookie(
      roleConfig.refreshTokenName,
      newRefreshToken,
      cookieOptions(AUTH_CONFIG.refresh.expiresInDays),
    );

    // Build user data
    const userData = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      profileImage: user.profileImage,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
      isSeller: user.isSeller,
      preferences: user.preferences,
      stats: user.stats,
      addresses: user.addresses,
      sellerProfile: user.role === "seller" ? user.sellerProfile : undefined,
      isSuperAdmin: user.role === "super_admin",
      isAdmin: user.role === "admin" || user.role === "super_admin",
    };

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        user: userData,
      },
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid refresh token", 401, "INVALID_TOKEN"));
    }
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError("Refresh token expired", 401, "REFRESH_TOKEN_EXPIRED"),
      );
    }
    return next(new AppError("Token refresh failed", 401, "REFRESH_FAILED"));
  }
});

export const getUser = catchAsync(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
