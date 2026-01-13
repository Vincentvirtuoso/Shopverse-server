import mongoose from "mongoose";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import jwt from "jsonwebtoken";

export const checkSuperAdminExists = catchAsync(async (req, res) => {
  const superAdminCount = await User.countDocuments({ role: "super_admin" });

  res.status(200).json({
    success: true,
    data: {
      superAdminExists: superAdminCount > 0,
      count: superAdminCount,
    },
  });
});

export const setupSuperAdmin = catchAsync(async (req, res, next) => {
  const existingSuperAdmin = await User.findOne({ role: "super_admin" });

  if (existingSuperAdmin) {
    return next(
      new AppError(
        "Super admin account already exists. Setup can only be done once.",
        400,
        "SETUP_COMPLETE"
      )
    );
  }

  // 2. Validate required fields
  const {
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    storeName,
    businessType,
  } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return next(
      new AppError(
        "Please provide all required fields: firstName, lastName, email, password",
        400,
        "VALIDATION_ERROR"
      )
    );
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(
      new AppError("Email is already registered", 409, "EMAIL_EXISTS")
    );
  }

  // 4. Validate password strength
  if (password.length < 8) {
    return next(
      new AppError(
        "Password must be at least 8 characters long",
        400,
        "WEAK_PASSWORD"
      )
    );
  }

  // 5. Create super admin user
  const superAdminData = {
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    phoneNumber: phoneNumber || undefined,
    role: "super_admin",
    isEmailVerified: true,
    isActive: true,
    preferences: {
      currency: "NGN",
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
    },
    sellerProfile: {
      storeName: storeName || "Shopverse Main Store",
      businessType: businessType || "E-commerce",
      businessAddress: {
        street: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
      },
      description: "Primary administrator account",
      rating: 0,
      totalReviews: 0,
      isVerifiedSeller: true,
    },
    stats: {
      totalOrders: 0,
      totalSpent: 0,
      lastLogin: new Date(),
      loginCount: 0,
    },
  };

  const superAdmin = await User.create(superAdminData);

  // 6. Generate JWT token
  const token = jwt.sign(
    {
      id: superAdmin._id,
      email: superAdmin.email,
      role: superAdmin.role,
      isSeller: superAdmin.isSeller,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  const refreshToken = jwt.sign(
    { id: superAdmin._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );

  // 7. Set cookies
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
  };

  if (secure && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  res.cookie("token", token, cookieOptions);
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  // 8. Prepare response data
  const userData = {
    id: superAdmin._id,
    email: superAdmin.email,
    firstName: superAdmin.firstName,
    lastName: superAdmin.lastName,
    fullName: superAdmin.fullName,
    phoneNumber: superAdmin.phoneNumber,
    profileImage: superAdmin.profileImage,
    role: superAdmin.role,
    isEmailVerified: superAdmin.isEmailVerified,
    isPhoneVerified: superAdmin.isPhoneVerified,
    isActive: superAdmin.isActive,
    isSeller: superAdmin.isSeller,
    preferences: superAdmin.preferences,
    stats: superAdmin.stats,
    sellerProfile: superAdmin.sellerProfile,
    createdAt: superAdmin.createdAt,
  };

  // 9. Send success response
  res.status(201).json({
    success: true,
    message: "Super admin account created successfully",
    data: {
      user: userData,
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      setupComplete: true,
    },
  });
});

export const resetSetup = catchAsync(async (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return next(
      new AppError(
        "This endpoint is not available in production",
        403,
        "FORBIDDEN"
      )
    );
  }

  const { secret } = req.body;
  if (secret !== process.env.SETUP_RESET_SECRET) {
    return next(new AppError("Invalid reset secret", 401, "UNAUTHORIZED"));
  }

  await User.deleteMany({ role: "super_admin" });

  res.status(200).json({
    success: true,
    message: "Super admin setup has been reset",
    data: {
      reset: true,
      timestamp: new Date(),
    },
  });
});
