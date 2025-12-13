export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Development error
  if (!process.env.NODE_ENV === "production") {
    res.status(err.statusCode).json({
      success: false,
      error: err,
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
  } else {
    // console.log(err);

    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    } else {
      console.error("ERROR 💥", err);
      res.status(500).json({
        success: false,
        message: "Something went wrong",
        code: "INTERNAL_ERROR",
      });
    }
  }
};
