import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError(
        "You are not logged in. Please log in to access this resource.",
        401,
        "UNAUTHORIZED"
      )
    );
  }

  // Verify token with proper error handling
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(
        new AppError(
          "Invalid token. Please log in again.",
          401,
          "INVALID_TOKEN"
        )
      );
    }
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError(
          "Your token has expired. Please log in again.",
          401,
          "TOKEN_EXPIRED"
        )
      );
    }
    return next(
      new AppError(
        "Authentication failed. Please log in again.",
        401,
        "AUTH_FAILED"
      )
    );
  }

  // Check if user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(
      new AppError(
        "The user belonging to this token no longer exists.",
        401,
        "USER_NOT_FOUND"
      )
    );
  }

  if (!user.isActive) {
    return next(
      new AppError(
        "Your account has been deactivated. Contact support.",
        403,
        "ACCOUNT_DEACTIVATED"
      )
    );
  }

  if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "Password recently changed. Please log in again.",
        401,
        "PASSWORD_CHANGED"
      )
    );
  }

  req.user = user;
  next();
});
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
