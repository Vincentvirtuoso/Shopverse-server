import mongoose from "mongoose";
import Product from "../models/Product.js";
import User from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import Order from "../models/Orders.js";
import {
  validateDiscountCode,
  calculateShippingCost,
  generateUniqueOrderNumber,
} from "../utils/helpers.js";
import { sendOrderConfirmationEmail } from "../utils/emailService.js";
import { generatePaystackPayment } from "../utils/paystack.js";

export const createOrder = catchAsync(async (req, res, next) => {
  const {
    items,
    shippingAddress,
    discountCode,
    notes,
    billingAddress,
    paymentMethod,
    paymentReference,
    paymentStatus,
    amount,
    saveShippingInfo,
    savedShippingInfo,
  } = req.body;

  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  let isTransactionCommitted = false;

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return next(
        new AppError("Order must have at least one item", 400, "NO_ITEMS"),
      );
    }

    if (
      !shippingAddress ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city
    ) {
      await session.abortTransaction();
      return next(
        new AppError(
          "Complete shipping address is required",
          400,
          "INVALID_ADDRESS",
        ),
      );
    }

    const validPaymentMethods = ["cash_on_delivery", "paystack"];
    if (!validPaymentMethods.includes(paymentMethod)) {
      await session.abortTransaction();
      return next(
        new AppError("Invalid payment method", 400, "INVALID_PAYMENT_METHOD"),
      );
    }

    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).session(
      session,
    );

    if (products.length !== productIds.length) {
      await session.abortTransaction();
      return next(
        new AppError(
          "One or more products not found",
          404,
          "PRODUCT_NOT_FOUND",
        ),
      );
    }

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const orderItems = [];
    let subtotal = 0;
    let totalTax = 0;

    for (const item of items) {
      if (
        !item.quantity ||
        item.quantity < 1 ||
        !Number.isInteger(item.quantity)
      ) {
        await session.abortTransaction();
        return next(
          new AppError("Invalid quantity for product", 400, "INVALID_QUANTITY"),
        );
      }

      const product = productMap.get(item.productId.toString());

      let finalPrice = product.price;
      let stockToCheck = product.stockCount;
      let variantName = null;

      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) {
          await session.abortTransaction();
          return next(
            new AppError(
              `Variant not found for ${product.name}`,
              404,
              "VARIANT_NOT_FOUND",
            ),
          );
        }

        finalPrice = variant.price || product.price;
        stockToCheck = variant.stockCount;
        variantName = variant.name;
      }

      // Apply sale price if applicable
      if (product.isOnSale && product.salePrice) {
        finalPrice = product.salePrice;
      }

      // Check stock availability
      if (stockToCheck < item.quantity) {
        await session.abortTransaction();
        const itemName = variantName
          ? `${product.name} (${variantName})`
          : product.name;
        return next(
          new AppError(
            `Insufficient stock for ${itemName}. Available: ${stockToCheck}`,
            400,
            "INSUFFICIENT_STOCK",
          ),
        );
      }

      const itemSubtotal = finalPrice * item.quantity;
      const itemTax = 0;
      // itemSubtotal * 0.045;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: {
          unit: finalPrice,
          final: finalPrice,
        },
        tax: {
          amount: itemTax,
        },
        variantId: item.variantId || null,
        variantName: variantName || null,
      });

      subtotal += itemSubtotal;
      totalTax += itemTax;
    }

    // Calculate shipping cost
    const shippingCost = calculateShippingCost(shippingAddress, orderItems);

    // Apply discount if provided
    let discountAmount = 0;
    let discountDetails = null;

    if (discountCode) {
      const discountResult = await validateDiscountCode(
        discountCode,
        subtotal,
        userId,
        session,
      );
      if (discountResult.valid) {
        discountAmount = discountResult.amount;
        discountDetails = discountResult.details;
      }
    }

    // Calculate total
    const total = subtotal + shippingCost + totalTax - discountAmount;

    // Ensure total is not negative
    if (total < 0) {
      await session.abortTransaction();
      return next(new AppError("Invalid order total", 400, "INVALID_TOTAL"));
    }

    // Generate unique order number
    const orderNumber = await generateUniqueOrderNumber(async (orderNum) => {
      const existing = await Order.findOne({ orderNumber: orderNum }).session(
        session,
      );
      return !!existing;
    }, 5);

    // Create order object
    const orderData = {
      orderNumber,
      customer: {
        user: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phoneNumber || "",
        isGuest: false,
      },
      items: orderItems,
      shipping: {
        address: {
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 || "",
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country || "Nigeria",
        },
        cost: shippingCost,
      },
      payment: {
        method: paymentMethod,
        status: "pending",
        transactionId:
          paymentMethod === "paystack"
            ? paymentReference || `${orderNumber}-${Date.now()}`
            : null,
      },
      pricing: {
        subtotal,
        shipping: shippingCost,
        tax: {
          total: totalTax,
        },
        discount: {
          amount: discountAmount,
          code: discountCode || null,
          details: discountDetails,
        },
        total,
        currency: "NGN",
      },
      dates: {
        paymentProcessedAt:
          paymentMethod === "cash_on_delivery" ? null : new Date(),
      },
      status:
        paymentMethod === "cash_on_delivery"
          ? "pending"
          : paymentStatus || "payment_pending",
      notes: notes || "",
      ...(billingAddress && {
        billingAddress: {
          addressLine1: billingAddress.addressLine1,
          addressLine2: billingAddress.addressLine2 || "",
          city: billingAddress.city,
          state: billingAddress.state,
          postalCode: billingAddress.postalCode,
          country: billingAddress.country || "Nigeria",
        },
      }),
    };

    // Create and save order
    const order = new Order(orderData);

    // Add initial status to history
    order.statusHistory.push({
      status: "success",
      timestamp: new Date(),
      note: "Order created",
      updatedBy: userId,
    });
    order.statusHistory.push({
      status: "pending",
      timestamp: new Date(),
      note: "Order Status",
      updatedBy: userId,
    });

    await order.save({ session });

    // Update product stock with atomic operations
    for (const item of items) {
      const updateQuery = { _id: item.productId };
      const updateOperation = item.variantId
        ? { $inc: { "variants.$[variant].stockCount": -item.quantity } }
        : { $inc: { stockCount: -item.quantity } };

      const updateOptions = {
        session,
        arrayFilters: item.variantId
          ? [{ "variant._id": item.variantId }]
          : undefined,
      };

      await Product.updateOne(updateQuery, updateOperation, updateOptions);
    }

    await User.updateOne(
      { _id: userId },
      {
        $inc: {
          "stats.totalOrders": 1,
          "stats.totalSpent": total,
        },
      },
      { session },
    );
    if (saveShippingInfo) {
      const user = await User.findById(req.user.id);

      if (!user) {
        return next(new AppError("User not found", 404));
      }

      const newAddress = {
        type: "home",
        isDefault: true,
        street: savedShippingInfo.addressLine1,
        apartment: savedShippingInfo.addressLine2,
        city: savedShippingInfo.city,
        state: savedShippingInfo.state,
        country: savedShippingInfo.country,
        postalCode: savedShippingInfo.postalCode,
        phone: savedShippingInfo.phone,
        instructions: savedShippingInfo.instructions,
      };

      user.addresses = user.addresses.map((addr) => ({
        ...addr.toObject(),
        isDefault: false,
      }));

      const alreadyExists = user.addresses.some(
        (addr) =>
          addr.street === newAddress.street &&
          addr.city === newAddress.city &&
          addr.postalCode === newAddress.postalCode,
      );

      if (!alreadyExists) {
        user.addresses.push(newAddress);
      }

      await user.save();
    }
    // Commit the transaction
    await session.commitTransaction();
    isTransactionCommitted = true;

    const orderResponse = {
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.pricing.total,
      currency: order.pricing.currency,
      items: order.items.map((item) => ({
        productId: item.product,
        quantity: item.quantity,
        variantId: item.variantId,
      })),
      createdAt: order.createdAt,
      estimatedDelivery: calculateEstimatedDelivery(),
      payment: {
        method: order.payment.method,
        status: order.payment.status,
        ...(order.payment.transactionId && {
          transactionId: order.payment.transactionId,
        }),
      },
    };

    // For Paystack, generate payment link
    let paymentData = null;
    if (paymentMethod === "paystack") {
      try {
        paymentData = await generatePaystackPayment(order);
        orderResponse.payment.paystack = {
          authorization_url: paymentData.authorization_url,
          reference: paymentData.reference,
          access_code: paymentData.access_code,
        };
      } catch (paymentError) {
        console.error("Failed to generate Paystack payment:", paymentError);
      }
    }

    sendOrderConfirmationEmail(
      user.email,
      order,
      user.firstName,
      shippingAddress,
    ).catch((err) => {
      console.error("Failed to send order confirmation email:", err);
    });

    // Return success response
    res.status(201).json({
      status: "success",
      message: "Order created successfully",
      data: {
        order: orderResponse,
        ...(paymentData && { payment: paymentData }),
      },
    });
  } catch (error) {
    // Only abort transaction if it hasn't been committed yet
    if (!isTransactionCommitted) {
      await session.abortTransaction();
    }

    console.error("Order creation error:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      return next(new AppError(error.message, 400, "VALIDATION_ERROR"));
    }

    if (error.code === 11000) {
      return next(
        new AppError(
          "Order number conflict, please try again",
          409,
          "DUPLICATE_ORDER_NUMBER",
        ),
      );
    }

    return next(
      new AppError(
        "Failed to create order. Please try again.",
        500,
        "ORDER_CREATION_FAILED",
      ),
    );
  } finally {
    session.endSession();
  }
});

const calculateEstimatedDelivery = () => {
  const today = new Date();
  const deliveryDate = new Date(today);

  // Add 3-7 business days
  let businessDaysAdded = 0;
  while (businessDaysAdded < 3) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    const dayOfWeek = deliveryDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysAdded++;
    }
  }

  return deliveryDate;
};

export const getOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const order = await Order.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
      { orderNumber: id },
    ],
    "customer.user": userId,
    isDeleted: false,
  })
    .populate("items.product", "name image brand price")
    .populate("statusHistory.updatedBy", "firstName lastName");

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

export const getMyOrders = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const {
    page = 1,
    limit = 10,
    status,
    sortBy = "-dates.placedAt",
    search,
  } = req.query;

  const query = {
    "customer.user": userId,
    isDeleted: false,
  };

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Search by order number or product name
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      // You might need to populate products for this search
    ];
  }

  const skip = (page - 1) * limit;

  // Execute query with pagination
  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate("items.product", "name image")
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status: "success",
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
});

export const cancelOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { reason } = req.body;

  const order = await Order.findOne({
    _id: id,
    "customer.user": userId,
    isDeleted: false,
  });

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  // Check if order can be cancelled
  if (!order.canBeCancelled()) {
    return next(
      new AppError(
        `Order cannot be cancelled. Current status: ${order.status}`,
        400,
        "ORDER_NOT_CANCELLABLE",
      ),
    );
  }

  // Restock products
  for (const item of order.items) {
    const product = await Product.findById(item.product);

    if (product) {
      product.stockCount += item.quantity;
      await product.save();
    }
  }

  // Update order status
  await order.updateStatus(
    "cancelled",
    `Cancelled by customer. Reason: ${reason}`,
    userId,
  );
  order.dates.cancelledAt = new Date();

  // If payment was made, initiate refund
  if (order.payment.status === "paid") {
    // Implement refund logic here
    // await processRefund(order);
    order.payment.status = "refunded";
  }

  await order.save();

  res.status(200).json({
    status: "success",
    message: "Order cancelled successfully",
    data: {
      order,
    },
  });
});

export const requestReturn = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { items, reason, reasonDetails, images } = req.body;

  const order = await Order.findOne({
    _id: id,
    "customer.user": userId,
    isDeleted: false,
  });

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  // Check if order is returnable
  if (!order.isReturnable) {
    return next(
      new AppError("Return window has expired", 400, "RETURN_WINDOW_EXPIRED"),
    );
  }

  // Validate return items
  const validItems = items.filter((returnItem) => {
    const orderItem = order.items.find(
      (item) => item.product.toString() === returnItem.productId,
    );
    return orderItem && returnItem.quantity <= orderItem.quantity;
  });

  if (validItems.length === 0) {
    return next(
      new AppError("No valid items to return", 400, "INVALID_RETURN_ITEMS"),
    );
  }

  // Generate return ID
  const returnId = `RET-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Add return request
  order.returns.push({
    returnId,
    requestedAt: new Date(),
    reason,
    reasonDetails,
    items: validItems,
    images,
    status: "requested",
  });

  await order.save();

  // Notify admin/seller about return request
  // await notifyReturnRequest(order, returnId);

  res.status(201).json({
    status: "success",
    message: "Return request submitted successfully",
    data: {
      returnId,
      order: order._id,
    },
  });
});

export const getInvoice = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const order = await Order.findOne({
    _id: id,
    "customer.user": userId,
    isDeleted: false,
  }).populate("items.product", "name sku price");

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  const invoice = order.generateInvoice();

  res.status(200).json({
    status: "success",
    data: {
      invoice,
    },
  });
});

export const getSalesStats = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { period = "month", year = new Date().getFullYear() } = req.query;

  let groupFormat;
  let dateFilter = {};

  switch (period) {
    case "day":
      groupFormat = "%Y-%m-%d";
      dateFilter = {
        $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        $lte: new Date(),
      };
      break;
    case "week":
      groupFormat = "%Y-%U";
      dateFilter = {
        $gte: new Date(new Date().setDate(new Date().getDate() - 90)),
        $lte: new Date(),
      };
      break;
    case "month":
      groupFormat = "%Y-%m";
      dateFilter = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      };
      break;
    case "year":
      groupFormat = "%Y";
      dateFilter = {
        $gte: new Date(`${year - 5}-01-01`),
        $lte: new Date(`${year}-12-31`),
      };
      break;
  }

  const salesStats = await Order.aggregate([
    {
      $match: {
        "dates.placedAt": dateFilter,
        "payment.status": "paid",
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: groupFormat, date: "$dates.placedAt" },
        },
        revenue: { $sum: "$pricing.total" },
        orders: { $sum: 1 },
        averageOrderValue: { $avg: "$pricing.total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get top products
  const topProducts = await Order.aggregate([
    {
      $match: {
        "dates.placedAt": dateFilter,
        "payment.status": "paid",
        isDeleted: false,
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $group: {
        _id: "$product._id",
        name: { $first: "$product.name" },
        totalSold: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price.final"] },
        },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      salesStats,
      topProducts,
    },
  });
});

export const confirmCashOnDelivery = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { amountReceived, notes } = req.body;
  const userId = req.user._id;

  if (!["admin", "seller", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const order = await Order.findById(id);

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  if (order.payment.method !== "cash_on_delivery") {
    return next(
      new AppError("Order is not Cash on Delivery", 400, "NOT_COD_ORDER"),
    );
  }

  if (order.payment.status !== "pending") {
    return next(
      new AppError(
        "Payment already processed",
        400,
        "PAYMENT_ALREADY_PROCESSED",
      ),
    );
  }

  // Update payment status
  order.payment.status = "paid";
  order.payment.paidAt = new Date();
  order.payment.transactionId = `COD-${Date.now()}`;
  order.status = "processing";

  // Add to status history
  order.statusHistory.push({
    status: "paid",
    timestamp: new Date(),
    note: `Cash on Delivery received. Amount: ${amountReceived}. ${
      notes || ""
    }`,
    updatedBy: userId,
  });

  // Add COD specific details
  order.codDetails = {
    amountReceived,
    receivedBy: userId,
    receivedAt: new Date(),
    notes,
  };

  await order.save();

  // Send confirmation to customer
  // await sendCODConfirmationEmail(order);

  res.status(200).json({
    status: "success",
    message: "Cash on Delivery payment confirmed",
    data: {
      order,
    },
  });
});
