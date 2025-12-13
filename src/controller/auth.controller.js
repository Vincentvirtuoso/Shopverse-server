import User from "../models/User.js";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../utils/emailService.js";
import crypto from "crypto";

// Cookie settings
const secure = process.env.NODE_ENV === "production";

const createCookieOptions = (days) => {
  const options = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
  };

  if (secure && process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

// ===== LOGIN =====
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(
      new AppError("Please provide email and password", 400, "VALIDATION_ERROR")
    );
  }

  // Using the static method from schema
  const user = await User.findByEmail(email).select("+password");

  if (!user) {
    return next(new AppError("Invalid credentials", 401, "AUTH_FAILED"));
  }

  if (!user.isActive) {
    return next(
      new AppError("Account is deactivated. Contact support.", 403, "FORBIDDEN")
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

  // Generate tokens
  const token = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      isSeller: user.isSeller,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );

  // Update stats
  user.stats.lastLogin = new Date();
  user.stats.loginCount += 1;
  await user.save({ validateBeforeSave: false });

  // Set cookies
  res.cookie("token", token, createCookieOptions(7));
  res.cookie("refreshToken", refreshToken, createCookieOptions(30));

  // Build response data
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
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
  };

  if (secure && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  res.clearCookie("token", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
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
      new AppError("Verification token is required", 400, "TOKEN_REQUIRED")
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
        "INVALID_TOKEN"
      )
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
      new AppError("Please provide email address", 400, "VALIDATION_ERROR")
    );
  }

  const user = await User.findByEmail(email);

  if (!user) {
    return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
  }

  if (user.isEmailVerified) {
    return next(
      new AppError("Email is already verified", 400, "ALREADY_VERIFIED")
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
        "EMAIL_SEND_FAILED"
      )
    );
  }
});

export const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError("Refresh token required", 401, "TOKEN_REQUIRED"));
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    if (!user.isActive) {
      return next(new AppError("Account is deactivated", 403, "FORBIDDEN"));
    }

    // Generate new access token
    const newToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        isSeller: user.isSeller,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // CHANGE: Send new token in response body
    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token: newToken,
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  } catch (error) {
    return next(new AppError("Invalid refresh token", 401, "INVALID_TOKEN"));
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
