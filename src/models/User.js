import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },

    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
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

    phoneNumber: String,

    profileImage: {
      type: String,
      default: "default-avatar.jpg",
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ["customer", "seller", "admin", "super_admin"],
      default: "customer",
    },

    sellerProfile: {
      storeName: String,
      businessType: String,
      taxId: String,
      businessRegistrationNumber: String,
      businessAddress: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
      description: String,
      rating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
      isVerifiedSeller: { type: Boolean, default: false },
    },

    addresses: [
      {
        type: {
          type: String,
          enum: ["home", "work", "other"],
          default: "home",
        },
        isDefault: { type: Boolean, default: false },
        street: String,
        apartment: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
        phone: String,
        instructions: String,
      },
    ],

    preferences: {
      currency: { type: String, default: "NGN", enum: ["USD", "NGN"] },
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: true },
    },

    stats: {
      totalOrders: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      lastLogin: Date,
      loginCount: { type: Number, default: 0 },
    },

    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    cart: {
      items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cart" }],
      couponCode: String,
      cartValue: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now },
    },

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    emailVerificationToken: String,
    emailVerificationExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ====== VIRTUALS ======
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual("isSeller").get(function () {
  return ["seller", "admin", "super_admin"].includes(this.role);
});

// ====== MIDDLEWARE ======
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(this.password, salt);
  this.password = hashedPassword;
});

userSchema.pre("save", function () {
  if (!this.isModified("password") || this.isNew) return;

  this.passwordChangedAt = Date.now() - 1000;
});

// ====== METHODS ======
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return token;
};

userSchema.methods.changedPasswordAfter = function () {
  const lastLogin = new Date(this.stats.lastLogin);

  const mustLogin = lastLogin > new Date(this.passwordChangedAt);

  return mustLogin;
};

userSchema.methods.createEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return { token, v_tokenExpiresIn: 24 * 60 * 60 * 1000 };
};
userSchema.methods.clearEmailVerificationToken = function () {
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
};

// Wishlist helpers
userSchema.methods.addToWishlist = function (productId) {
  if (!this.wishlist.includes(productId)) this.wishlist.push(productId);
  return this.save();
};

userSchema.methods.removeFromWishlist = function (productId) {
  this.wishlist = this.wishlist.filter(
    (p) => p.toString() !== productId.toString()
  );
  return this.save();
};

// ====== STATIC METHODS ======
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model("User", userSchema);
export default User;
