import AppError from "../utils/AppError.js";

// Accept multiple roles
export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission", 403, "FORBIDDEN"));
    }
    next();
  };
