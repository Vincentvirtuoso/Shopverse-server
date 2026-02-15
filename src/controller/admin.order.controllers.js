import Order from "../models/Orders.js";
import mongoose from "mongoose";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import { sendOrderStatusUpdateEmail } from "../utils/emailService.js";
import {
  calculateAverageOrderAge,
  getDateRange,
} from "../utils/order.utils.js";

export const getOrderAnalytics = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { timeframe = "30d" } = req.query;

  const { start: currentStart, end: currentEnd } = getDateRange(timeframe);

  const duration = currentEnd.getTime() - currentStart.getTime();

  const previousStart = new Date(currentStart.getTime() - duration);
  const previousEnd = new Date(currentStart.getTime());

  const analytics = await Order.aggregate([
    {
      $match: {
        isDeleted: false,
        "dates.placedAt": {
          $gte: previousStart,
          $lte: currentEnd,
        },
      },
    },
    {
      $addFields: {
        period: {
          $cond: [
            { $gte: ["$dates.placedAt", currentStart] },
            "current",
            "previous",
          ],
        },
      },
    },
    {
      $group: {
        _id: "$period",
        totalOrders: { $sum: 1 },
        grossRevenue: { $sum: "$pricing.total" },
        completedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        averageOrderValue: { $avg: "$pricing.total" },
      },
    },
  ]);

  // Convert aggregation result to object
  const formatted = {
    current: {},
    previous: {},
  };

  analytics.forEach((item) => {
    formatted[item._id] = item;
  });

  const calculateChange = (current = 0, previous = 0) => {
    if (!previous) return previous === 0 && current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  };

  const response = {
    timeframe,
    totalOrders: {
      current: formatted.current?.totalOrders || 0,
      previous: formatted.previous?.totalOrders || 0,
      percentageChange: calculateChange(
        formatted.current?.totalOrders,
        formatted.previous?.totalOrders,
      ),
    },
    grossRevenue: {
      current: formatted.current?.grossRevenue || 0,
      previous: formatted.previous?.grossRevenue || 0,
      percentageChange: calculateChange(
        formatted.current?.grossRevenue,
        formatted.previous?.grossRevenue,
      ),
    },
    completedOrders: {
      current: formatted.current?.completedOrders || 0,
      previous: formatted.previous?.completedOrders || 0,
      percentageChange: calculateChange(
        formatted.current?.completedOrders,
        formatted.previous?.completedOrders,
      ),
    },
    cancelledOrders: {
      current: formatted.current?.cancelledOrders || 0,
      previous: formatted.previous?.cancelledOrders || 0,
      percentageChange: calculateChange(
        formatted.current?.cancelledOrders,
        formatted.previous?.cancelledOrders,
      ),
    },
    averageOrderValue: {
      current: formatted.current?.averageOrderValue || 0,
      previous: formatted.previous?.averageOrderValue || 0,
      percentageChange: calculateChange(
        formatted.current?.averageOrderValue,
        formatted.previous?.averageOrderValue,
      ),
    },
  };

  res.status(200).json({
    status: "success",
    data: response,
  });
});

export const getFulfillmentQueue = catchAsync(async (req, res, next) => {
  if (!["admin", "seller", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { type = "pending_fulfillment" } = req.query;

  let query = { isDeleted: false };

  switch (type) {
    case "pending_fulfillment":
      query.status = { $in: ["paid", "processing"] };
      break;
    case "ready_to_ship":
      query.status = "ready_to_ship";
      break;
    case "in_transit":
      query.status = { $in: ["shipped", "out_for_delivery"] };
      break;
    case "delivery_issues":
      query.status = "on_hold";
      break;
  }

  const orders = await Order.find(query)
    .populate("customer.user", "firstName lastName email phone")
    .populate("items.product", "name sku images")
    .sort({ "dates.placedAt": 1 })
    .limit(50);

  // Group by shipping region
  const groupedByRegion = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          state: "$shipping.address.state",
          city: "$shipping.address.city",
        },
        orders: { $push: "$$ROOT" },
        count: { $sum: 1 },
        totalValue: { $sum: "$pricing.total" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      queueType: type,
      orders,
      groupedByRegion,
      queueMetrics: {
        totalOrders: orders.length,
        totalValue: orders.reduce((sum, order) => sum + order.pricing.total, 0),
        averageAge: calculateAverageOrderAge(orders),
      },
    },
  });
});

export const bulkUpdateFulfillment = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { orderIds, status, trackingInfo, estimatedDelivery } = req.body;
  const userId = req.user._id;

  const result = await Order.updateMany(
    { _id: { $in: orderIds } },
    {
      $set: {
        status: status,
        "dates.shippedAt": status === "shipped" ? new Date() : undefined,
        "dates.expectedDelivery": estimatedDelivery,
        ...(trackingInfo && { tracking: trackingInfo }),
      },
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          note: `Bulk update from ${status}`,
          updatedBy: userId,
        },
      },
    },
  );

  res.status(200).json({
    status: "success",
    message: `Updated ${result.modifiedCount} orders`,
    data: result,
  });
});

export const getReturnsDashboard = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { status, startDate, endDate } = req.query;

  const query = {
    "returns.0": { $exists: true },
    isDeleted: false,
  };

  if (status) query["returns.status"] = status;
  if (startDate || endDate) {
    query["returns.requestedAt"] = {};
    if (startDate) query["returns.requestedAt"].$gte = new Date(startDate);
    if (endDate) query["returns.requestedAt"].$lte = new Date(endDate);
  }

  const returnsData = await Order.aggregate([
    { $match: query },
    { $unwind: "$returns" },
    {
      $lookup: {
        from: "products",
        localField: "returns.items.productId",
        foreignField: "_id",
        as: "returnedProducts",
      },
    },
    {
      $group: {
        _id: "$returns.status",
        totalReturns: { $sum: 1 },
        totalRefundAmount: { $sum: "$returns.refund.amount" },
        returns: {
          $push: {
            returnId: "$returns.returnId",
            orderNumber: "$orderNumber",
            customer: "$customer",
            requestedAt: "$returns.requestedAt",
            reason: "$returns.reason",
            status: "$returns.status",
            refundAmount: "$returns.refund.amount",
            items: "$returns.items",
          },
        },
      },
    },
  ]);

  // Calculate return rate
  const returnRate = await Order.aggregate([
    {
      $match: {
        isDeleted: false,
        "dates.placedAt": {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        ordersWithReturns: {
          $sum: { $cond: [{ $gt: [{ $size: "$returns" }, 0] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        returnRate: {
          $multiply: [{ $divide: ["$ordersWithReturns", "$totalOrders"] }, 100],
        },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      returnsByStatus: returnsData,
      returnRate: returnRate[0]?.returnRate || 0,
      totalReturns: returnsData.reduce(
        (sum, item) => sum + item.totalReturns,
        0,
      ),
      totalRefundAmount: returnsData.reduce(
        (sum, item) => sum + item.totalRefundAmount,
        0,
      ),
    },
  });
});

export const processRefund = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { orderId, returnId, action, refundAmount, notes } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const returnRequest = order.returns.id(returnId);
  if (!returnRequest) {
    return next(new AppError("Return request not found", 404));
  }

  // Process refund based on action
  if (action === "approve") {
    returnRequest.status = "approved";
    returnRequest.refund = {
      amount: refundAmount || returnRequest.refund?.amount,
      method: "original_payment",
      processedAt: new Date(),
      transactionId: `REF-${Date.now()}`,
    };

    // Update order totals if partial refund
    order.pricing.total -= returnRequest.refund.amount;
    order.status = "refunded";

    // Add to status history
    order.statusHistory.push({
      status: "refunded",
      timestamp: new Date(),
      note: `Refund processed for return #${returnId}. Amount: ${returnRequest.refund.amount}`,
      updatedBy: req.user._id,
    });
  } else if (action === "reject") {
    returnRequest.status = "rejected";
    returnRequest.rejectionReason = notes;
  }

  await order.save();

  // Trigger refund via payment provider
  await processPaymentRefund(order, returnRequest);

  res.status(200).json({
    status: "success",
    message: `Return ${action}d successfully`,
    data: { order },
  });
});

export const getCustomerOrderInsights = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { customerId } = req.params;

  const customerOrders = await Order.aggregate([
    {
      $match: {
        "customer.user": mongoose.Types.ObjectId(customerId),
        isDeleted: false,
      },
    },
    {
      $facet: {
        // Order summary
        summary: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalSpent: { $sum: "$pricing.total" },
              averageOrderValue: { $avg: "$pricing.total" },
              firstOrderDate: { $min: "$dates.placedAt" },
              lastOrderDate: { $max: "$dates.placedAt" },
            },
          },
        ],

        // Order frequency
        frequency: [
          {
            $group: {
              _id: {
                year: { $year: "$dates.placedAt" },
                month: { $month: "$dates.placedAt" },
              },
              orders: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": -1, "_id.month": -1 } },
        ],

        // Product preferences
        productPreferences: [
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
              _id: "$items.product",
              productName: { $first: "$product.name" },
              category: { $first: "$product.category.name" },
              totalQuantity: { $sum: "$items.quantity" },
              totalSpent: {
                $sum: { $multiply: ["$items.quantity", "$items.price.final"] },
              },
            },
          },
          { $sort: { totalSpent: -1 } },
          { $limit: 10 },
        ],

        // Payment method preferences
        paymentPreferences: [
          {
            $group: {
              _id: "$payment.method",
              count: { $sum: 1 },
              totalAmount: { $sum: "$pricing.total" },
            },
          },
        ],

        // Return history
        returnHistory: [
          { $unwind: { path: "$returns", preserveNullAndEmptyArrays: false } },
          {
            $project: {
              returnId: "$returns.returnId",
              requestedAt: "$returns.requestedAt",
              status: "$returns.status",
              reason: "$returns.reason",
              refundAmount: "$returns.refund.amount",
              orderNumber: 1,
            },
          },
          { $sort: { requestedAt: -1 } },
        ],
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      customerId,
      insights: customerOrders[0],
    },
  });
});

export const getOrderInventoryImpact = catchAsync(async (req, res, next) => {
  if (!["admin", "seller", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { days = 7 } = req.query;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const inventoryImpact = await Order.aggregate([
    {
      $match: {
        "dates.placedAt": { $gte: since },
        isDeleted: false,
        status: { $nin: ["cancelled", "refunded"] },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalOrdered: { $sum: "$items.quantity" },
        orderCount: { $sum: 1 },
        averageQuantityPerOrder: { $avg: "$items.quantity" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        productName: "$product.name",
        sku: "$product.sku",
        currentStock: "$product.stockCount",
        totalOrdered: 1,
        orderCount: 1,
        averageQuantityPerOrder: 1,
        wouldOutstock: {
          $cond: {
            if: { $lte: ["$product.stockCount", "$totalOrdered"] },
            then: true,
            else: false,
          },
        },
        daysUntilOutOfStock: {
          $cond: {
            if: {
              $and: [
                { $gt: ["$product.stockCount", 0] },
                { $gt: ["$totalOrdered", 0] },
              ],
            },
            then: {
              $divide: [
                "$product.stockCount",
                { $divide: ["$totalOrdered", days] },
              ],
            },
            else: null,
          },
        },
      },
    },
    { $sort: { totalOrdered: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      period: `${days} days`,
      inventoryImpact,
      summary: {
        productsAtRisk: inventoryImpact.filter((p) => p.wouldOutstock).length,
        totalOrdered: inventoryImpact.reduce(
          (sum, p) => sum + p.totalOrdered,
          0,
        ),
      },
    },
  });
});

export const exportOrders = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const { format = "csv", dateFrom, dateTo, fields } = req.query;

  const query = {
    isDeleted: false,
    "dates.placedAt": {
      $gte: new Date(
        dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      ),
      $lte: new Date(dateTo || new Date()),
    },
  };

  const orders = await Order.find(query)
    .populate("items.product", "name sku category")
    .lean();

  // Transform data for export
  const exportData = orders.map((order) => ({
    orderNumber: order.orderNumber,
    placedAt: order.dates.placedAt,
    customer: `${order.customer.firstName} ${order.customer.lastName}`,
    email: order.customer.email,
    items: order.items.length,
    total: order.pricing.total,
    status: order.status,
    paymentStatus: order.payment.status,
    paymentMethod: order.payment.method,
    shippingCity: order.shipping.address.city,
    shippingState: order.shipping.address.state,
  }));

  // Generate CSV
  const csv = await generateCSV(exportData, fields);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=orders_${Date.now()}.csv`,
  );

  res.status(200).send(csv);
});

export const getOrderProcessingMetrics = catchAsync(async (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Not authorized", 403, "FORBIDDEN"));
  }

  const metrics = await Order.aggregate([
    {
      $match: {
        isDeleted: false,
        status: { $in: ["delivered", "completed", "cancelled"] },
      },
    },
    {
      $project: {
        orderNumber: 1,
        status: 1,
        processingTime: {
          $divide: [
            { $subtract: ["$dates.processedAt", "$dates.placedAt"] },
            1000 * 60, // Convert to minutes
          ],
        },
        shippingTime: {
          $divide: [
            { $subtract: ["$dates.deliveredAt", "$dates.shippedAt"] },
            1000 * 60 * 60, // Convert to hours
          ],
        },
        totalLeadTime: {
          $divide: [
            { $subtract: ["$dates.deliveredAt", "$dates.placedAt"] },
            1000 * 60 * 60 * 24, // Convert to days
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgProcessingTime: { $avg: "$processingTime" },
        avgShippingTime: { $avg: "$shippingTime" },
        avgLeadTime: { $avg: "$totalLeadTime" },
        p95ProcessingTime: {
          $percentile: { input: "$processingTime", p: 0.95 },
        },
        p95ShippingTime: { $percentile: { input: "$shippingTime", p: 0.95 } },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      metrics: metrics[0],
      benchmark: {
        targetProcessingTime: 30, // minutes
        targetShippingTime: 48, // hours
        targetLeadTime: 5, // days
      },
    },
  });
});

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
      .populate("items.product", "name image images")
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

export const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const userId = req.user._id;

  // Check user permissions
  if (!["admin", "seller", "super_admin"].includes(req.user.role)) {
    return next(
      new AppError("Not authorized to update order status", 403, "FORBIDDEN"),
    );
  }

  const order = await Order.findById(id);

  if (!order) {
    return next(new AppError("Order not found", 404, "ORDER_NOT_FOUND"));
  }

  // Validate status transition
  const validTransitions = getValidStatusTransitions(
    order.status,
    req.user.role,
  );
  if (!validTransitions.includes(status)) {
    return next(
      new AppError(
        `Cannot transition from ${order.status} to ${status}`,
        400,
        "INVALID_STATUS_TRANSITION",
      ),
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
  await sendOrderStatusUpdateEmail(
    order.customer.email,
    order,
    order.customer.firstName,
  );

  res.status(200).json({
    status: "success",
    message: "Order status updated successfully",
    data: {
      order,
    },
  });
});
