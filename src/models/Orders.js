import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^ORD-\d{8}-\d{5}$/,
    },

    // Customer Information
    customer: {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      isGuest: {
        type: Boolean,
        default: false,
      },
    },

    // Order Items
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          unit: {
            type: Number,
            required: true,
          },
          final: {
            type: Number,
            required: true,
          },
        },
        tax: {
          amount: {
            type: Number,
            default: 0,
          },
        },
      },
    ],

    // Shipping Information
    shipping: {
      address: {
        addressLine1: {
          type: String,
          required: true,
        },
        addressLine2: String,
        city: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          required: true,
        },
        postalCode: {
          type: String,
          required: true,
        },
        country: {
          type: String,
          required: true,
          default: "Nigeria",
        },
      },
      cost: {
        type: Number,
        default: 0,
      },
    },

    // Payment Information
    payment: {
      method: {
        type: String,
        required: true,
        enum: ["paystack", "cash_on_delivery"],
      },
      status: {
        type: String,
        required: true,
        enum: ["pending", "paid", "refunded", "failed", "cancelled"],
        default: "pending",
        index: true,
      },
      transactionId: {
        type: String,
        index: true,
      },
      paidAt: Date,
    },

    // Pricing Summary
    pricing: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      shipping: {
        type: Number,
        default: 0,
      },
      tax: {
        total: {
          type: Number,
          default: 0,
        },
      },
      discount: {
        amount: {
          type: Number,
          default: 0,
        },
        code: String,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        required: true,
        default: "NGN",
      },
    },

    // Order Status & Workflow
    status: {
      type: String,
      required: true,
      enum: [
        "pending",
        "payment_pending",
        "paid",
        "processing",
        "ready_to_ship",
        "shipped",
        "out_for_delivery",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
        "on_hold",
        "failed",
      ],
      default: "pending",
      index: true,
    },

    // Status History
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
        updatedBy: Schema.Types.ObjectId,
      },
    ],

    // Returns
    returns: [
      {
        returnId: {
          type: String,
          unique: true,
          sparse: true,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          enum: [
            "defective",
            "wrong_item",
            "not_as_described",
            "changed_mind",
            "arrived_late",
            "damaged",
            "size_issue",
            "quality_issue",
            "other",
          ],
        },
        reasonDetails: String,
        items: [
          {
            productId: Schema.Types.ObjectId,
            quantity: Number,
            returnQuantity: Number,
          },
        ],
        status: {
          type: String,
          enum: [
            "requested",
            "approved",
            "rejected",
            "received",
            "inspected",
            "completed",
          ],
          default: "requested",
        },
        refund: {
          amount: Number,
          method: String,
          processedAt: Date,
          transactionId: String,
        },
        images: [String],
      },
    ],

    // Important Dates
    dates: {
      placedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      paidAt: Date,
      processedAt: Date,
      shippedAt: Date,
      deliveredAt: Date,
      completedAt: Date,
      cancelledAt: Date,
      expectedDelivery: Date,
    },

    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: Date,
    deletedBy: Schema.Types.ObjectId,
  },
  {
    timestamps: true,
  }
);

OrderSchema.index({ "customer.user": 1, "dates.placedAt": -1 });
OrderSchema.index({ status: 1, "dates.placedAt": -1 });
OrderSchema.index({ "payment.status": 1 });
OrderSchema.index({ "customer.email": 1 });

// Full customer name
OrderSchema.virtual("customer.fullName").get(function () {
  return `${this.customer.firstName} ${this.customer.lastName}`;
});

// Total items count
OrderSchema.virtual("totalItems").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Is returnable (within return window)
OrderSchema.virtual("isReturnable").get(function () {
  if (!this.dates.deliveredAt) return false;
  const returnWindow = 30; // days
  const daysSinceDelivery =
    (Date.now() - this.dates.deliveredAt) / (1000 * 60 * 60 * 24);
  return daysSinceDelivery <= returnWindow;
});

// Add status update
OrderSchema.methods.updateStatus = function (newStatus, note, updatedBy) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note,
    updatedBy: updatedBy,
  });
  return this.save();
};

// Calculate totals
OrderSchema.methods.calculateTotals = function () {
  // Calculate subtotal
  this.pricing.subtotal = this.items.reduce((sum, item) => {
    return sum + item.price.final * item.quantity;
  }, 0);

  // Calculate total tax
  this.pricing.tax.total = this.items.reduce((sum, item) => {
    return sum + (item.tax.amount || 0) * item.quantity;
  }, 0);

  // Calculate shipping cost
  this.pricing.shipping = this.shipping.cost || 0;

  // Calculate grand total
  this.pricing.total =
    this.pricing.subtotal +
    this.pricing.shipping +
    this.pricing.tax.total -
    this.pricing.discount.amount;

  return this.pricing.total;
};

// Check if order can be cancelled
OrderSchema.methods.canBeCancelled = function () {
  const cancellableStatuses = [
    "pending",
    "payment_pending",
    "paid",
    "processing",
  ];
  return cancellableStatuses.includes(this.status);
};

// Generate order invoice
OrderSchema.methods.generateInvoice = function () {
  return {
    orderNumber: this.orderNumber,
    invoiceDate: new Date(),
    customer: this.customer,
    items: this.items,
    pricing: this.pricing,
    shipping: this.shipping,
    payment: this.payment,
  };
};

OrderSchema.statics.findByCustomer = function (userId, options = {}) {
  const query = {
    "customer.user": userId,
    isDeleted: false,
  };

  return this.find(query)
    .sort({ "dates.placedAt": -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Get orders by status
OrderSchema.statics.findByStatus = function (status) {
  return this.find({
    status: status,
    isDeleted: false,
  }).sort({ "dates.placedAt": -1 });
};

// Get revenue for date range
OrderSchema.statics.getRevenueForPeriod = async function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        "dates.placedAt": { $gte: startDate, $lte: endDate },
        "payment.status": "paid",
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricing.total" },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: "$pricing.total" },
      },
    },
  ]);
};

OrderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    this.orderNumber = `ORD-${dateStr}-${randomNum}`;
  }
  next();
});

OrderSchema.pre("save", function (next) {
  if (this.isModified("items") || this.isModified("pricing")) {
    this.calculateTotals();
  }
  next();
});

OrderSchema.post("save", async function (doc) {
  if (doc.isNew && doc.payment.status === "paid") {
    console.log(`Send order confirmation email for order: ${doc.orderNumber}`);
  }
});

const Order = mongoose.model("Order", OrderSchema);

export default Order;
