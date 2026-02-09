import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, res, next) => {
  const cookies = req.cookies || {};
  const appType = req.headers["x-app-type"];

  if (!appType) {
    return next(new AppError("App type missing", 400));
  }

  let accessToken;
  let secret;

  if (appType === "admin") {
    accessToken = cookies.admin_token;
    secret = process.env.ADMIN_TOKEN_SECRET;
  } else {
    accessToken = cookies.user_token;
    secret = process.env.JWT_SECRET;
  }

  if (!accessToken) {
    return next(new AppError("Authentication required. Please log in.", 401));
  }

  // ✅ VERIFY FIRST (never decode first)
  let decoded;
  try {
    decoded = jwt.verify(accessToken, secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Session expired", 401));
    }
    return next(new AppError("Invalid token", 401));
  }

  // 🔒 HARD ROLE BOUNDARY
  if (appType === "admin" && !["admin", "super_admin"].includes(decoded.role)) {
    return next(new AppError("Admin access only", 403));
  }

  if (appType === "user" && ["admin", "super_admin"].includes(decoded.role)) {
    return next(new AppError("User access only", 403));
  }

  const user = await User.findById(decoded.id).lean();

  if (!user) {
    return next(new AppError("User no longer exists", 401));
  }

  if (!user.isActive) {
    return next(new AppError("Account is deactivated", 403));
  }

  req.user = {
    _id: user._id,
    email: user.email,
    role: user.role,
    isSeller: user.isSeller,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    isActive: user.isActive,
    permissions: user.permissions || [],
    isAdmin: ["admin", "super_admin"].includes(user.role),
    isSuperAdmin: user.role === "super_admin",
  };

  next();
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action.",
          403,
          "FORBIDDEN",
        ),
      );
    }
    next();
  };
};

export const requireAdmin = restrictTo("admin", "super_admin");
export const requireSuperAdmin = restrictTo("super_admin");

export const requireSeller = (req, res, next) => {
  if (!req.user.isSeller) {
    return next(
      new AppError(
        "Seller account required to access this resource.",
        403,
        "SELLER_REQUIRED",
      ),
    );
  }
  next();
};

export const requireVerifiedSeller = catchAsync(async (req, res, next) => {
  if (!req.user.isSeller) {
    return next(
      new AppError("Seller account required.", 403, "SELLER_REQUIRED"),
    );
  }

  const user = await User.findById(req.user.id)
    .select("sellerProfile")
    .populate("sellerProfile");

  if (!user?.sellerProfile?.isVerified) {
    return next(
      new AppError(
        "Seller account must be verified.",
        403,
        "SELLER_NOT_VERIFIED",
      ),
    );
  }

  next();
});

export const protectAndRestrict = (...roles) => {
  return [protect, restrictTo(...roles)];
};

export const protectAndRequireSeller = [protect, requireSeller];
export const protectAndRequireVerifiedSeller = [protect, requireVerifiedSeller];
export const protectAndRequireAdmin = [protect, requireAdmin];
export const protectAndRequireSuperAdmin = [protect, requireSuperAdmin];

export const checkActive = (req, res, next) => {
  if (!req.user.isActive) {
    return next(new AppError("Account is deactivated", 403, "FORBIDDEN"));
  }
  next();
};

export const checkEmailVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return next(new AppError("Email not verified", 403, "EMAIL_NOT_VERIFIED"));
  }
  next();
};
