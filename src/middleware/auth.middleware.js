import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError("You are not logged in", 401, "UNAUTHORIZED"));
  }

  // Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Check user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError("User no longer exists", 401, "UNAUTHORIZED"));
  }

  // Optional: check if password changed after token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "Password recently changed. Please login again.",
        401,
        "UNAUTHORIZED"
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
