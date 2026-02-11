import User from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import { Parser } from "json2csv";

export const getAllCustomers = catchAsync(async (req, res, next) => {
  const {
    // Filters
    role,
    isEmailVerified,
    isPhoneVerified,
    isActive,
    isVerifiedSeller,
    search,
    dateFrom,
    dateTo,
    minOrders,
    maxOrders,
    minSpent,
    maxSpent,
    country,
    state,
    city,

    // Sorting & Pagination
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 20,

    // Fields to select
    fields,
  } = req.query;

  // Build filter object
  const filter = {};

  // Role filter - exclude super_admin from regular listing
  if (role) {
    filter.role = role;
  } else {
    filter.role = { $ne: "super_admin" };
  }

  // Boolean filters
  if (isEmailVerified !== undefined)
    filter.isEmailVerified = isEmailVerified === "true";
  if (isPhoneVerified !== undefined)
    filter.isPhoneVerified = isPhoneVerified === "true";
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (isVerifiedSeller !== undefined)
    filter["sellerProfile.isVerifiedSeller"] = isVerifiedSeller === "true";

  // Search by name, email, phone
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
      { "sellerProfile.storeName": { $regex: search, $options: "i" } },
    ];
  }

  // Date range filter
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  // Stats filters
  if (minOrders || maxOrders) {
    filter["stats.totalOrders"] = {};
    if (minOrders) filter["stats.totalOrders"].$gte = parseInt(minOrders);
    if (maxOrders) filter["stats.totalOrders"].$lte = parseInt(maxOrders);
  }

  if (minSpent || maxSpent) {
    filter["stats.totalSpent"] = {};
    if (minSpent) filter["stats.totalSpent"].$gte = parseFloat(minSpent);
    if (maxSpent) filter["stats.totalSpent"].$lte = parseFloat(maxSpent);
  }

  // Location filters
  if (country) filter["addresses.country"] = country;
  if (state) filter["addresses.state"] = state;
  if (city) filter["addresses.city"] = city;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Field selection
  let select =
    "-refreshTokens -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -passwordChangedAt";
  if (fields) {
    select = fields.split(",").join(" ");
  }

  // Execute query with pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const customers = await User.find(filter)
    .select(select)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Get total count for pagination
  const totalCustomers = await User.countDocuments(filter);

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCustomers / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  res.status(200).json({
    status: "success",
    results: customers.length,
    data: {
      customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCustomers,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null,
      },
    },
  });
});

// @desc    Get customer statistics and trends
// @route   GET /api/admin/customers/stats
// @access  Private/SuperAdmin
export const getCustomerStats = catchAsync(async (req, res, next) => {
  const { period = "monthly" } = req.query;

  // Get current date and date ranges
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Base pipeline for aggregation
  const basePipeline = [
    {
      $match: {
        role: { $ne: "super_admin" },
      },
    },
  ];

  // Get overall statistics
  const overallStats = await User.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        activeCustomers: {
          $sum: { $cond: ["$isActive", 1, 0] },
        },
        inactiveCustomers: {
          $sum: { $cond: ["$isActive", 0, 1] },
        },
        emailVerified: {
          $sum: { $cond: ["$isEmailVerified", 1, 0] },
        },
        phoneVerified: {
          $sum: { $cond: ["$isPhoneVerified", 1, 0] },
        },
        totalOrders: { $sum: "$stats.totalOrders" },
        totalSpent: { $sum: "$stats.totalSpent" },
        avgOrderValue: { $avg: "$stats.totalSpent" },
        customersWithOrders: {
          $sum: { $cond: [{ $gt: ["$stats.totalOrders", 0] }, 1, 0] },
        },
      },
    },
  ]);

  // Get role distribution
  const roleDistribution = await User.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get daily/weekly/monthly registrations
  const registrationsOverTime = await User.aggregate([
    ...basePipeline,
    {
      $match: {
        createdAt: { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          ...(period === "daily" && { day: { $dayOfMonth: "$createdAt" } }),
          ...(period === "weekly" && { week: { $week: "$createdAt" } }),
        },
        count: { $sum: 1 },
        date: { $first: "$createdAt" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    { $limit: 30 },
  ]);

  // Get geographical distribution
  const geographicalDistribution = await User.aggregate([
    ...basePipeline,
    { $unwind: "$addresses" },
    {
      $group: {
        _id: {
          country: "$addresses.country",
          state: "$addresses.state",
          city: "$addresses.city",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  // Get top customers by orders and spending
  const topCustomersByOrders = await User.find({
    role: { $ne: "super_admin" },
    "stats.totalOrders": { $gt: 0 },
  })
    .select("firstName lastName email stats.totalOrders stats.totalSpent")
    .sort({ "stats.totalOrders": -1 })
    .limit(10)
    .lean();

  const topCustomersBySpending = await User.find({
    role: { $ne: "super_admin" },
    "stats.totalSpent": { $gt: 0 },
  })
    .select("firstName lastName email stats.totalOrders stats.totalSpent")
    .sort({ "stats.totalSpent": -1 })
    .limit(10)
    .lean();

  // Calculate trends (percentage change from previous period)
  const previousPeriodStart =
    period === "daily"
      ? new Date(now.setDate(now.getDate() - 1))
      : period === "weekly"
        ? new Date(now.setDate(now.getDate() - 7))
        : new Date(now.setMonth(now.getMonth() - 1));

  const currentPeriodCount = await User.countDocuments({
    role: { $ne: "super_admin" },
    createdAt: { $gte: startOfMonth },
  });

  const previousPeriodCount = await User.countDocuments({
    role: { $ne: "super_admin" },
    createdAt: { $gte: previousPeriodStart, $lt: startOfMonth },
  });

  const growthRate =
    previousPeriodCount > 0
      ? ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100
      : 100;

  res.status(200).json({
    status: "success",
    data: {
      overall: overallStats[0] || {
        totalCustomers: 0,
        activeCustomers: 0,
        inactiveCustomers: 0,
        emailVerified: 0,
        phoneVerified: 0,
        totalOrders: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        customersWithOrders: 0,
      },
      roleDistribution,
      registrationsOverTime,
      geographicalDistribution,
      topCustomers: {
        byOrders: topCustomersByOrders,
        bySpending: topCustomersBySpending,
      },
      trends: {
        growthRate: growthRate.toFixed(2),
        currentPeriodRegistrations: currentPeriodCount,
        previousPeriodRegistrations: previousPeriodCount,
      },
    },
  });
});

// @desc    Get single customer by ID
// @route   GET /api/admin/customers/:id
// @access  Private/SuperAdmin
export const getCustomerById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid customer ID", 400, "INVALID_ID"));
  }

  const customer = await User.findById(id)
    .select(
      "-refreshTokens -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -passwordChangedAt -password",
    )
    .populate("wishlist", "name price images")
    .populate("cart.items", "items total")
    .populate("addresses");

  if (!customer) {
    return next(new AppError("Customer not found", 404, "NOT_FOUND"));
  }

  if (customer.role === "super_admin") {
    return next(
      new AppError("Cannot access super admin accounts", 403, "FORBIDDEN"),
    );
  }

  res.status(200).json({
    status: "success",
    data: { customer },
  });
});

// @desc    Update customer status (activate/deactivate)
// @route   PATCH /api/admin/customers/:id/status
// @access  Private/SuperAdmin
export const updateCustomerStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid customer ID", 400, "INVALID_ID"));
  }

  if (typeof isActive !== "boolean") {
    return next(
      new AppError("isActive must be a boolean value", 400, "INVALID_INPUT"),
    );
  }

  const customer = await User.findById(id);

  if (!customer) {
    return next(new AppError("Customer not found", 404, "NOT_FOUND"));
  }

  if (customer.role === "super_admin") {
    return next(
      new AppError("Cannot modify super admin accounts", 403, "FORBIDDEN"),
    );
  }

  customer.isActive = isActive;
  await customer.save();

  // Log this action for audit trail
  // await AuditLog.create({
  //   admin: req.user.id,
  //   action: isActive ? "ACTIVATE_CUSTOMER" : "DEACTIVATE_CUSTOMER",
  //   target: customer._id,
  //   reason,
  //   timestamp: new Date()
  // });

  res.status(200).json({
    status: "success",
    message: `Customer ${isActive ? "activated" : "deactivated"} successfully`,
    data: {
      id: customer._id,
      email: customer.email,
      fullName: customer.fullName,
      isActive: customer.isActive,
    },
  });
});

// @desc    Update customer role
// @route   PATCH /api/admin/customers/:id/role
// @access  Private/SuperAdmin
export const updateCustomerRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { role, reason } = req.body;

  const validRoles = ["customer", "seller", "admin"];

  if (!validRoles.includes(role)) {
    return next(
      new AppError(
        `Role must be one of: ${validRoles.join(", ")}`,
        400,
        "INVALID_ROLE",
      ),
    );
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid customer ID", 400, "INVALID_ID"));
  }

  const customer = await User.findById(id);

  if (!customer) {
    return next(new AppError("Customer not found", 404, "NOT_FOUND"));
  }

  if (customer.role === "super_admin") {
    return next(
      new AppError("Cannot modify super admin accounts", 403, "FORBIDDEN"),
    );
  }

  const oldRole = customer.role;
  customer.role = role;

  // If role changed to seller, initialize seller profile if not exists
  if (role === "seller" && !customer.sellerProfile) {
    customer.sellerProfile = {
      storeName: `${customer.firstName}'s Store`,
      rating: 0,
      totalReviews: 0,
      isVerifiedSeller: false,
    };
  }

  await customer.save();

  // Log role change
  // await AuditLog.create({
  //   admin: req.user.id,
  //   action: "UPDATE_CUSTOMER_ROLE",
  //   target: customer._id,
  //   changes: { oldRole, newRole: role },
  //   reason,
  //   timestamp: new Date()
  // });

  res.status(200).json({
    status: "success",
    message: `Customer role updated from ${oldRole} to ${role}`,
    data: {
      id: customer._id,
      email: customer.email,
      fullName: customer.fullName,
      role: customer.role,
    },
  });
});

// @desc    Export customers data
// @route   GET /api/admin/customers/export
// @access  Private/SuperAdmin
export const exportCustomers = catchAsync(async (req, res, next) => {
  const { format = "json", fields, ...filters } = req.query;

  // Build filter (similar to getAllCustomers)
  const filter = { role: { $ne: "super_admin" } };

  if (filters.role) filter.role = filters.role;
  if (filters.isActive !== undefined)
    filter.isActive = filters.isActive === "true";
  if (filters.isEmailVerified !== undefined)
    filter.isEmailVerified = filters.isEmailVerified === "true";

  // Select fields to export
  let exportFields = fields
    ? fields.split(",")
    : [
        "id",
        "email",
        "firstName",
        "lastName",
        "fullName",
        "phoneNumber",
        "role",
        "isActive",
        "isEmailVerified",
        "isPhoneVerified",
        "createdAt",
        "updatedAt",
        "stats.totalOrders",
        "stats.totalSpent",
        "stats.lastLogin",
        "stats.loginCount",
      ];

  // Get customers data
  const customers = await User.find(filter)
    .select(exportFields.map((f) => f.replace("stats.", "")))
    .lean();

  // Process data for export
  const exportData = customers.map((customer) => ({
    id: customer._id.toString(),
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    fullName: `${customer.firstName} ${customer.lastName}`,
    phoneNumber: customer.phoneNumber || "",
    role: customer.role,
    isActive: customer.isActive,
    isEmailVerified: customer.isEmailVerified,
    isPhoneVerified: customer.isPhoneVerified,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    totalOrders: customer.stats?.totalOrders || 0,
    totalSpent: customer.stats?.totalSpent || 0,
    lastLogin: customer.stats?.lastLogin || "",
    loginCount: customer.stats?.loginCount || 0,
  }));

  // Handle different export formats
  if (format === "csv") {
    try {
      const json2csvParser = new Parser({ fields: exportFields });
      const csv = json2csvParser.parse(exportData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=customers-export-${Date.now()}.csv`,
      );

      return res.status(200).send(csv);
    } catch (err) {
      return next(
        new AppError("Error generating CSV file", 500, "EXPORT_ERROR"),
      );
    }
  }

  // Default JSON export
  res.status(200).json({
    status: "success",
    results: exportData.length,
    data: { customers: exportData },
    exportMetadata: {
      format: "json",
      exportedAt: new Date(),
      exportedBy: req.user.id,
      filters: filters,
    },
  });
});

// @desc    Delete customer (soft delete or permanent)
// @route   DELETE /api/admin/customers/:id
// @access  Private/SuperAdmin
export const deleteCustomer = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { permanent = false, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid customer ID", 400, "INVALID_ID"));
  }

  const customer = await User.findById(id);

  if (!customer) {
    return next(new AppError("Customer not found", 404, "NOT_FOUND"));
  }

  if (customer.role === "super_admin") {
    return next(
      new AppError("Cannot delete super admin accounts", 403, "FORBIDDEN"),
    );
  }

  // Check if customer has active orders
  // const activeOrders = await Order.countDocuments({
  //   user: customer._id,
  //   status: { $nin: ["delivered", "cancelled"] }
  // });

  // if (activeOrders > 0) {
  //   return next(new AppError("Cannot delete customer with active orders", 400, "ACTIVE_ORDERS"));
  // }

  if (permanent) {
    // Permanently delete customer
    await User.findByIdAndDelete(id);

    // Log permanent deletion
    // await AuditLog.create({
    //   admin: req.user.id,
    //   action: "PERMANENT_DELETE_CUSTOMER",
    //   target: customer._id,
    //   details: { email: customer.email, reason },
    //   timestamp: new Date()
    // });

    res.status(200).json({
      status: "success",
      message: "Customer permanently deleted",
    });
  } else {
    // Soft delete - deactivate account
    customer.isActive = false;
    await customer.save();

    // Log soft deletion
    // await AuditLog.create({
    //   admin: req.user.id,
    //   action: "SOFT_DELETE_CUSTOMER",
    //   target: customer._id,
    //   reason,
    //   timestamp: new Date()
    // });

    res.status(200).json({
      status: "success",
      message: "Customer deactivated successfully",
      data: {
        id: customer._id,
        email: customer.email,
        isActive: customer.isActive,
      },
    });
  }
});

// @desc    Bulk update customers status
// @route   PATCH /api/admin/customers/bulk/status
// @access  Private/SuperAdmin
export const bulkUpdateCustomerStatus = catchAsync(async (req, res, next) => {
  const { customerIds, isActive, reason } = req.body;

  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return next(
      new AppError(
        "Please provide an array of customer IDs",
        400,
        "INVALID_INPUT",
      ),
    );
  }

  if (typeof isActive !== "boolean") {
    return next(
      new AppError("isActive must be a boolean value", 400, "INVALID_INPUT"),
    );
  }

  // Filter out super_admin IDs
  const superAdmins = await User.find({
    _id: { $in: customerIds },
    role: "super_admin",
  }).select("_id");

  const validCustomerIds = customerIds.filter(
    (id) => !superAdmins.some((sa) => sa._id.toString() === id.toString()),
  );

  if (validCustomerIds.length === 0) {
    return next(
      new AppError("No valid customer IDs provided", 400, "NO_VALID_IDS"),
    );
  }

  const result = await User.updateMany(
    { _id: { $in: validCustomerIds } },
    { $set: { isActive } },
  );

  res.status(200).json({
    status: "success",
    message: `Updated ${result.modifiedCount} customers`,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      skipped: customerIds.length - validCustomerIds.length,
    },
  });
});
