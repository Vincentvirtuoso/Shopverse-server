import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, "Brand is required."],
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required."],
      min: [0, "Price must be a non-negative number."],
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price must be a non-negative number."],
      default: null,
      validate: {
        validator: function (v) {
          if (v !== null) {
            return this.price <= v;
          }
          return true;
        },
        message:
          "Price ({VALUE}) must be less than or equal to the original price.",
      },
    },
    discount: {
      type: Number,
      min: [0, "Discount must be non-negative."],
      max: [100, "Discount cannot exceed 100."],
      default: 0,
    },
    rating: {
      type: Number,
      min: [0, "Rating must be between 0 and 5."],
      max: [5, "Rating must be between 0 and 5."],
      default: 0,
    },
    reviewCount: {
      type: Number,
      min: [0, "Review count cannot be negative."],
      default: 0,
    },
    description: {
      type: String,
      required: [true, "Description is required."],
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Main image URL is required."],
      trim: true,
      validate: {
        validator: (v) =>
          /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(v),
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    images: [
      {
        type: String,
        validate: {
          validator: (v) =>
            /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(v),
          message: (props) => `${props.value} is not a valid image URL!`,
        },
      },
    ],
    category: {
      type: String,
      required: [true, "Category is required."],
      trim: true,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      index: true,
    },
    stockCount: {
      type: Number,
      min: [0, "Stock count cannot be negative."],
      default: 0,
    },
    availabilityType: {
      type: String,
      enum: {
        values: ["in-stock", "limited", "out-of-stock", "pre-order"],
        message:
          "Availability must be one of: in-stock, limited, out-of-stock, pre-order.",
      },
      default: "in-stock",
    },
    unit: {
      type: String,
      default: "piece",
      enum: ["piece", "pair", "set", "kg", "g", "lb", "oz", "liter", "ml"],
    },
    isBestSeller: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: true,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    sku: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    warranty: {
      type: String,
      trim: true,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    specifications: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    weight: {
      value: {
        type: Number,
        min: [0, "Weight value must be non-negative."],
      },
      unit: {
        type: String,
        enum: ["g", "kg", "lb", "oz"],
        default: "g",
      },
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: {
        type: String,
        enum: ["cm", "m", "in", "ft"],
        default: "cm",
      },
    },
    shippingInfo: {
      isFreeShipping: { type: Boolean },
      deliveryTime: { type: String },
      shippingClass: { type: String },
    },
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    variants: [
      {
        name: { type: String, required: true },
        price: { type: Number, min: 0 },
        sku: { type: String },
        stockCount: { type: Number, min: 0, default: 0 },
        attributes: { type: Map, of: String },
      },
    ],
    meta: {
      title: { type: String, trim: true },
      description: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.index({ name: "text", description: "text", brand: "text" });
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ price: 1, rating: -1 });
productSchema.index({ createdAt: -1 });

productSchema.virtual("isOnSale").get(function () {
  return this.originalPrice && this.originalPrice > this.price;
});

productSchema.virtual("savings").get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return this.originalPrice - this.price;
  }
  return 0;
});

productSchema.pre("save", function (next) {
  if (this.originalPrice && this.originalPrice > 0 && this.price > 0) {
    if (this.price < this.originalPrice) {
      this.discount = Math.round(
        ((this.originalPrice - this.price) / this.originalPrice) * 100
      );
    } else {
      this.discount = 0;
      this.originalPrice = null;
    }
  } else {
    this.discount = 0;
  }

  if (this.image && !this.images.includes(this.image)) {
    this.images.unshift(this.image);
  }

  if (this.isModified("stockCount")) {
    if (this.stockCount === 0) {
      this.availabilityType = "out-of-stock";
    } else if (this.stockCount < 10) {
      this.availabilityType = "limited";
    } else if (this.availabilityType !== "pre-order") {
      this.availabilityType = "in-stock";
    }
  }

  // next();
});

productSchema.methods.getAvailabilityStatus = function () {
  if (this.stockCount === 0) {
    return "out-of-stock";
  }
  if (this.stockCount < 10) {
    return "limited";
  }
  return "in-stock";
};

productSchema.statics.findBestSellers = function (limit = 10) {
  return this.find({
    isBestSeller: true,
    isActive: true,
    availabilityType: { $ne: "out-of-stock" },
  })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(limit);
};

productSchema.statics.findByCategory = function (category) {
  const query = {
    category: category,
    isActive: true,
    availabilityType: { $ne: "out-of-stock" },
  };
  return this.find(query).sort({ isBestSeller: -1, rating: -1, price: 1 });
};

const Product = mongoose.model("Product", productSchema);

export default Product;
