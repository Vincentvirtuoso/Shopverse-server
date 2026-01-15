// controllers/orderController.js
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

export const createOrder = catchAsync(async (req, res, next) => {
  const {
    items,
    shippingAddress,
    paymentMethod,
    discountCode,
    notes,
    billingAddress,
  } = req.body;

  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return next(
        new AppError("Order must have at least one item", 400, "NO_ITEMS")
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
          "INVALID_ADDRESS"
        )
      );
    }

    const validPaymentMethods = ["cash_on_delivery", "card", "bank_transfer"];
    if (!validPaymentMethods.includes(paymentMethod)) {
      await session.abortTransaction();
      return next(
        new AppError("Invalid payment method", 400, "INVALID_PAYMENT_METHOD")
      );
    }

    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).session(
      session
    );

    if (products.length !== productIds.length) {
      await session.abortTransaction();
      return next(
        new AppError("One or more products not found", 404, "PRODUCT_NOT_FOUND")
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
          new AppError("Invalid quantity for product", 400, "INVALID_QUANTITY")
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
              "VARIANT_NOT_FOUND"
            )
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
            "INSUFFICIENT_STOCK"
          )
        );
      }

      // Calculate tax (7.5% VAT for Nigeria - adjust as needed)
      const itemSubtotal = finalPrice * item.quantity;
      const itemTax = itemSubtotal * 0.075; // 7.5% VAT

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
        session
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

    // Create order object
    const orderData = {
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
      status:
        paymentMethod === "cash_on_delivery" ? "pending" : "payment_pending",
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
      status: order.status,
      timestamp: new Date(),
      note: "Order created",
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

    // Update user stats with atomic operations
    await User.updateOne(
      { _id: userId },
      {
        $inc: {
          "stats.totalOrders": 1,
          "stats.totalSpent": total,
        },
      },
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();

    // Send order confirmation email asynchronously (don't await)
    sendOrderConfirmationEmail(user.email, order, user.firstName).catch(
      (err) => {
        console.error("Failed to send order confirmation email:", err);
      }
    );

    // Return success response
    res.status(201).json({
      status: "success",
      message: "Order created successfully",
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.pricing.total,
          currency: order.pricing.currency,
          items: order.items.length,
          createdAt: order.createdAt,
        },
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    throw error;
  } finally {
    // End session
    session.endSession();
  }
});

// Helper function for shipping cost calculation
function calculateShippingCost(shippingAddress, orderItems) {
  // Implement your shipping logic here
  // Example: flat rate or weight-based calculation
  const baseShippingCost = 1000; // Base cost in NGN

  // Calculate based on quantity (simple example)
  const totalQuantity = orderItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const additionalCost = Math.max(0, (totalQuantity - 1) * 200);

  return baseShippingCost + additionalCost;
}

// Helper function for discount validation
async function validateDiscountCode(code, subtotal, userId, session) {
  // Implement your discount validation logic
  // Example structure:
  const discount = await Discount.findOne({
    code: code.toUpperCase(),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).session(session);

  if (!discount) {
    return { valid: false, amount: 0 };
  }

  // Check minimum purchase amount
  if (discount.minimumPurchase && subtotal < discount.minimumPurchase) {
    return { valid: false, amount: 0 };
  }

  // Calculate discount amount
  let amount = 0;
  if (discount.type === "percentage") {
    amount = (subtotal * discount.value) / 100;
    if (discount.maxDiscount) {
      amount = Math.min(amount, discount.maxDiscount);
    }
  } else if (discount.type === "fixed") {
    amount = discount.value;
  }

  return {
    valid: true,
    amount,
    details: {
      type: discount.type,
      value: discount.value,
    },
  };
}

export const getOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const order = await Order.findOne({
    _id: id,
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

// @desc    Get all orders for logged in user
// @route   GET /api/orders/my-orders
// @access  Private
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

// @desc    Update order status (Admin/Seller)
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const userId = req.user._id;

  // Check user permissions
  if (!["admin", "seller", "super_admin"].includes(req.user.role)) {
    return next(
      new AppError("Not authorized to update order status", 403, "FORBIDDEN")
    );
  }

  const order = await Order.findById(id);

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  // Validate status transition
  const validTransitions = getValidStatusTransitions(
    order.status,
    req.user.role
  );
  if (!validTransitions.includes(status)) {
    return next(
      new AppError(
        `Cannot transition from ${order.status} to ${status}`,
        400,
        "INVALID_STATUS_TRANSITION"
      )
    );
  }

  // Update status
  await order.updateStatus(status, note, userId);

  // Update dates based on status
  const dateFields = {
    paid: "paidAt",
    processing: "processedAt",
    shipped: "shippedAt",
    delivered: "deliveredAt",
    completed: "completedAt",
    cancelled: "cancelledAt",
  };

  if (dateFields[status]) {
    order.dates[dateFields[status]] = new Date();
  }

  await order.save();

  // Send status update notification
  // await sendStatusUpdateEmail(order.customer.email, order, order.customer.firstName);

  res.status(200).json({
    status: "success",
    message: "Order status updated successfully",
    data: {
      order,
    },
  });
});

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
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
        "ORDER_NOT_CANCELLABLE"
      )
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
    userId
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

// @desc    Request return
// @route   POST /api/orders/:id/returns
// @access  Private
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
      new AppError("Return window has expired", 400, "RETURN_WINDOW_EXPIRED")
    );
  }

  // Validate return items
  const validItems = items.filter((returnItem) => {
    const orderItem = order.items.find(
      (item) => item.product.toString() === returnItem.productId
    );
    return orderItem && returnItem.quantity <= orderItem.quantity;
  });

  if (validItems.length === 0) {
    return next(
      new AppError("No valid items to return", 400, "INVALID_RETURN_ITEMS")
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

// @desc    Get order invoice
// @route   GET /api/orders/:id/invoice
// @access  Private
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

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
export const getAllOrders = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    customerEmail,
    startDate,
    endDate,
    search,
    sortBy = "-dates.placedAt",
  } = req.query;

  const query = {
    isDeleted: false,
  };

  // Apply filters
  if (status) query.status = status;
  if (paymentStatus) query["payment.status"] = paymentStatus;
  if (customerEmail) query["customer.email"] = customerEmail;

  // Date range filter
  if (startDate || endDate) {
    query["dates.placedAt"] = {};
    if (startDate) query["dates.placedAt"].$gte = new Date(startDate);
    if (endDate) query["dates.placedAt"].$lte = new Date(endDate);
  }

  // Search by order number or customer name
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "customer.firstName": { $regex: search, $options: "i" } },
      { "customer.lastName": { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate("customer.user", "firstName lastName email")
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Calculate summary statistics
  const stats = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricing.total" },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: "$pricing.total" },
      },
    },
  ]);

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
      stats: stats[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
      },
    },
  });
});

// @desc    Get sales statistics (Admin)
// @route   GET /api/orders/stats/sales
// @access  Private/Admin
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

// Helper function to calculate shipping cost
function calculateShippingCost(address, items) {
  // Implement your shipping logic here
  // This is a simplified example
  const baseShipping = 1500; // NGN
  const perItemShipping = 200; // NGN

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Adjust based on location (simplified)
  let locationMultiplier = 1;
  if (address.state.toLowerCase().includes("lagos")) {
    locationMultiplier = 0.8;
  } else if (
    ["abuja", "port harcourt", "ibadan"].includes(address.city.toLowerCase())
  ) {
    locationMultiplier = 1.2;
  } else {
    locationMultiplier = 1.5;
  }

  return Math.round(
    (baseShipping + perItemShipping * totalItems) * locationMultiplier
  );
}

// Helper function to validate status transitions
function getValidStatusTransitions(currentStatus, userRole) {
  const transitions = {
    admin: {
      pending: ["payment_pending", "cancelled"],
      payment_pending: ["paid", "cancelled"],
      paid: ["processing", "cancelled"],
      processing: ["ready_to_ship", "on_hold", "cancelled"],
      ready_to_ship: ["shipped", "cancelled"],
      shipped: ["out_for_delivery", "delivered"],
      out_for_delivery: ["delivered"],
      delivered: ["completed"],
      on_hold: ["processing", "cancelled"],
      cancelled: [],
      completed: [],
      refunded: [],
      failed: [],
    },
    seller: {
      pending: ["payment_pending", "cancelled"],
      payment_pending: ["paid", "cancelled"],
      paid: ["processing", "cancelled"],
      processing: ["ready_to_ship", "on_hold", "cancelled"],
      ready_to_ship: ["shipped", "cancelled"],
      shipped: ["out_for_delivery", "delivered"],
      out_for_delivery: ["delivered"],
      delivered: ["completed"],
      on_hold: ["processing", "cancelled"],
      cancelled: [],
      completed: [],
      refunded: [],
      failed: [],
    },
    customer: {
      pending: ["cancelled"],
      payment_pending: ["cancelled"],
      paid: ["cancelled"],
      processing: ["cancelled"],
      ready_to_ship: [],
      shipped: [],
      out_for_delivery: [],
      delivered: [],
      cancelled: [],
      completed: [],
      refunded: [],
      failed: [],
    },
  };

  return transitions[userRole]?.[currentStatus] || [];
}

// @desc    Process payment webhook (Paystack)
// @route   POST /api/orders/webhook/paystack
// @access  Public (secured with webhook secret)
export const processPaystackWebhook = catchAsync(async (req, res, next) => {
  const signature = req.headers["x-paystack-signature"];
  const rawBody = JSON.stringify(req.body);

  // Verify webhook signature
  const crypto = await import("crypto");
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  if (hash !== signature) {
    return next(
      new AppError("Invalid signature", 401, "INVALID_WEBHOOK_SIGNATURE")
    );
  }

  const { event, data } = req.body;

  if (event === "charge.success") {
    const { reference, metadata } = data;

    // Find order by transaction reference
    const order = await Order.findOne({
      "payment.transactionId": reference,
    });

    if (!order) {
      return res.status(200).json({ status: "success" }); // Acknowledge webhook anyway
    }

    // Update payment status
    order.payment.status = "paid";
    order.payment.paidAt = new Date();
    order.status = "processing";

    // Add to status history
    order.statusHistory.push({
      status: "paid",
      timestamp: new Date(),
      note: "Payment confirmed via Paystack",
      updatedBy: metadata?.userId || null,
    });

    await order.save();

    // Send payment confirmation email
    // await sendPaymentConfirmationEmail(order);
  }

  res.status(200).json({ status: "success" });
});

// @desc    Process COD confirmation
// @route   POST /api/orders/:id/confirm-cod
// @access  Private/Admin/Seller
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
      new AppError("Order is not Cash on Delivery", 400, "NOT_COD_ORDER")
    );
  }

  if (order.payment.status !== "pending") {
    return next(
      new AppError(
        "Payment already processed",
        400,
        "PAYMENT_ALREADY_PROCESSED"
      )
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
