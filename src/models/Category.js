import mongoose from "mongoose";

const metaFieldSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Field key is required."],
      trim: true,
      lowercase: true,
      match: [
        /^[a-z][a-zA-Z0-9_]*$/,
        "Key must start with a letter and contain only letters, numbers, or underscores.",
      ],
    },
    label: {
      type: String,
      required: [true, "Field label is required."],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Field type is required."],
      enum: {
        values: ["string", "number", "boolean", "array", "date"],
        message: "Type must be one of: string, number, boolean, array, date.",
      },
    },

    unit: {
      type: String,
      trim: true, // e.g. "GB", "ml", "kg" — display only
    },
    placeholder: {
      type: String,
      trim: true, // e.g. "e.g. 16GB" — shown in admin form inputs
    },
    options: [
      {
        type: String,
        trim: true, // If set, field renders as a dropdown/multi-select
      },
    ],
    defaultValue: {
      type: mongoose.Schema.Types.Mixed, // Pre-filled default in the product form
      default: null,
    },
    isRequired: {
      type: Boolean,
      default: false, // If true, product cannot be saved without this field
    },
    isFilterable: {
      type: Boolean,
      default: false, // Expose in storefront faceted filters
    },
    isSearchable: {
      type: Boolean,
      default: false, // Include in full-text search index
    },
    isVisibleOnProductPage: {
      type: Boolean,
      default: true, // Show in the product detail specifications section
    },
    sortOrder: {
      type: Number,
      default: 0, // Admin-controlled display order
    },
  },
  { _id: true }, // Keep _id so individual fields can be patched by id
);

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subcategory name is required."],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Subcategory slug is required."],
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase alphanumeric with hyphens only.",
      ],
    },
    description: { type: String, trim: true },
    image: {
      type: String,
      trim: true,
      validate: {
        validator: (v) =>
          !v || /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(v),
        message: (props) => `${props.value} is not a valid image URL.`,
      },
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required."],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Category slug is required."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase alphanumeric with hyphens only.",
      ],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
      validate: {
        validator: (v) =>
          !v || /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(v),
        message: (props) => `${props.value} is not a valid image URL.`,
      },
    },

    // ── Subcategories (fully admin-managed) ───────────────────────────────
    subCategories: {
      type: [subCategorySchema],
      default: [],
      validate: {
        validator: function (subs) {
          // Slug must be unique within a category's subcategories
          const slugs = subs.map((s) => s.slug);
          return slugs.length === new Set(slugs).size;
        },
        message: "Subcategory slugs must be unique within a category.",
      },
    },

    // ── Custom meta field definitions (admin-managed) ─────────────────────
    metaFields: {
      type: [metaFieldSchema],
      default: [],
      validate: {
        validator: function (fields) {
          // Field key must be unique within a category's metaFields
          const keys = fields.map((f) => f.key);
          return keys.length === new Set(keys).size;
        },
        message: "Meta field keys must be unique within a category.",
      },
    },

    // ── Fallback category for product reassignment on deletion ────────────
    // When this category is deleted, all its products are moved here.
    // Super_admin sets this per category. Null = use the global default.
    fallbackCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // ── Hierarchy (optional — for nested categories) ──────────────────────
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    level: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },

    // ── Display & status ──────────────────────────────────────────────────
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Archived state (soft-delete before reassignment completes) ─────────
    // When deletion is triggered: isArchived = true → reassign products →
    // then hard delete. isArchived prevents new products being assigned here.
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },

    // ── SEO ───────────────────────────────────────────────────────────────
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
  },
);

categorySchema.index({ sortOrder: 1, isActive: 1 });
categorySchema.index({ parent: 1, sortOrder: 1 });

categorySchema.virtual("fullSlug").get(function () {
  if (this.parent && this.parent.slug) {
    return `${this.parent.slug}/${this.slug}`;
  }
  return this.slug;
});

categorySchema.virtual("activeSubCategoryCount").get(function () {
  return (this.subCategories || []).filter((s) => s.isActive).length;
});

categorySchema.virtual("requiredMetaFieldCount").get(function () {
  return (this.metaFields || []).filter((f) => f.isRequired).length;
});

categorySchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
  next();
});

categorySchema.methods.addSubCategory = function (subCatData) {
  if (!subCatData.slug && subCatData.name) {
    subCatData.slug = subCatData.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  const exists = this.subCategories.some((s) => s.slug === subCatData.slug);
  if (exists) {
    throw new Error(
      `Subcategory slug "${subCatData.slug}" already exists in category "${this.name}".`,
    );
  }

  if (subCatData.sortOrder === undefined) {
    const max = this.subCategories.reduce(
      (m, s) => Math.max(m, s.sortOrder || 0),
      0,
    );
    subCatData.sortOrder = max + 1;
  }

  this.subCategories.push(subCatData);
  return this.save();
};

categorySchema.methods.removeSubCategory = function (slug) {
  const before = this.subCategories.length;
  this.subCategories = this.subCategories.filter((s) => s.slug !== slug);
  if (this.subCategories.length === before) {
    throw new Error(
      `Subcategory "${slug}" not found in category "${this.name}".`,
    );
  }
  return this.save();
};

categorySchema.methods.reorderSubCategories = function (slugsInOrder) {
  slugsInOrder.forEach((slug, index) => {
    const sub = this.subCategories.find((s) => s.slug === slug);
    if (sub) sub.sortOrder = index + 1;
  });
  return this.save();
};

categorySchema.methods.addMetaField = function (fieldData) {
  const exists = this.metaFields.some((f) => f.key === fieldData.key);
  if (exists) {
    throw new Error(
      `Meta field key "${fieldData.key}" already exists in category "${this.name}".`,
    );
  }

  if (fieldData.sortOrder === undefined) {
    const max = this.metaFields.reduce(
      (m, f) => Math.max(m, f.sortOrder || 0),
      0,
    );
    fieldData.sortOrder = max + 1;
  }

  this.metaFields.push(fieldData);
  return this.save();
};

categorySchema.methods.removeMetaField = function (key) {
  const before = this.metaFields.length;
  this.metaFields = this.metaFields.filter((f) => f.key !== key);
  if (this.metaFields.length === before) {
    throw new Error(
      `Meta field "${key}" not found in category "${this.name}".`,
    );
  }
  return this.save();
};

categorySchema.methods.updateMetaField = function (key, patch) {
  const field = this.metaFields.find((f) => f.key === key);
  if (!field) {
    throw new Error(
      `Meta field "${key}" not found in category "${this.name}".`,
    );
  }
  Object.assign(field, patch);
  return this.save();
};

categorySchema.methods.reorderMetaFields = function (keysInOrder) {
  keysInOrder.forEach((key, index) => {
    const field = this.metaFields.find((f) => f.key === key);
    if (field) field.sortOrder = index + 1;
  });
  return this.save();
};

categorySchema.statics.safeDelete = async function (
  categoryId,
  globalFallbackId,
  session,
) {
  const Category = this;
  const Product = mongoose.model("Product");

  const opts = session ? { session } : {};

  // 1. Load the category
  const cat = await Category.findById(categoryId, null, opts);
  if (!cat) throw new Error(`Category ${categoryId} not found.`);
  if (cat.isArchived)
    throw new Error(`Category ${categoryId} is already archived.`);

  // 2. Determine the reassignment target
  const targetId = cat.fallbackCategory || globalFallbackId;
  if (!targetId) {
    throw new Error(
      "No fallback category set. Provide a globalFallbackId or set category.fallbackCategory.",
    );
  }
  if (String(targetId) === String(categoryId)) {
    throw new Error(
      "Fallback category cannot be the same as the category being deleted.",
    );
  }

  const target = await Category.findById(targetId, null, opts);
  if (!target || target.isArchived || !target.isActive) {
    throw new Error(
      `Fallback category ${targetId} does not exist or is not active.`,
    );
  }

  // 3. Mark as archived (blocks new product assignments immediately)
  cat.isArchived = true;
  cat.archivedAt = new Date();
  cat.isActive = false;
  await cat.save(opts);

  const result = await Product.updateMany(
    { category: categoryId },
    {
      $set: {
        category: targetId,
        subCategory: null, // subCategory is no longer valid for the new category
      },
    },
    opts,
  );

  await Category.findByIdAndDelete(categoryId, opts);

  return {
    deletedCategory: cat.name,
    reassignedTo: target.name,
    productsReassigned: result.modifiedCount,
  };
};

categorySchema.statics.getActiveTree = function () {
  return this.find({ isActive: true, isArchived: false })
    .sort({ sortOrder: 1 })
    .populate("parent", "name slug")
    .lean();
};

categorySchema.statics.reorderCategories = async function (idsInOrder) {
  const bulkOps = idsInOrder.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { sortOrder: index + 1 } },
    },
  }));
  return this.bulkWrite(bulkOps);
};

const Category = mongoose.model("Category", categorySchema);

export default Category;
