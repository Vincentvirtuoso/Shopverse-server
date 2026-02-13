import Joi from "joi";

const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

const slugSchema = Joi.string()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .lowercase()
  .trim();

const imageUrlSchema = Joi.alternatives().try(
  Joi.string()
    .pattern(/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif|svg)$/i)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Image must be a valid URL ending with jpg, jpeg, png, webp, gif, avif, or svg",
    }),
  Joi.string().valid(""),
);

const metaFieldSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-z][a-zA-Z0-9_]*$/)
    .required()
    .messages({
      "string.pattern.base":
        "Key must start with a lowercase letter and contain only letters, numbers, or underscores",
    }),
  label: Joi.string().required().trim(),
  type: Joi.string()
    .valid("text", "number", "boolean", "array", "date", "file", "select")
    .required(),
  unit: Joi.string().allow("", null).trim(),
  description: Joi.string().allow("", null).trim(),
  placeholder: Joi.string().allow("", null).trim(),
  options: Joi.array().items(Joi.string().trim()).default([]),
  defaultValue: Joi.any(),
  isRequired: Joi.boolean().default(false),
  isFilterable: Joi.boolean().default(false),
  isSearchable: Joi.boolean().default(false),
  isVisibleOnProductPage: Joi.boolean().default(true),
  sortOrder: Joi.number().default(0),
  _id: Joi.string().allow(null, ""),
});

// Subcategory schema
const subCategorySchema = Joi.object({
  name: Joi.string().required().trim(),
  slug: slugSchema.required(),
  description: Joi.string().allow("", null).trim(),
  image: imageUrlSchema,
  sortOrder: Joi.number().default(0),
  isActive: Joi.boolean().default(true),
  _id: Joi.string(),
});

// Category schema
const categorySchema = Joi.object({
  name: Joi.string().required().trim(),
  slug: slugSchema,
  description: Joi.string().allow("", null).trim(),
  icon: Joi.alternatives().try(
    Joi.string().uri().allow("", null),
    Joi.string().valid(""),
  ),
  image: imageUrlSchema,
  subCategories: Joi.array().items(subCategorySchema).default([]),
  metaFields: Joi.array().items(metaFieldSchema).default([]),
  fallbackCategory: objectIdSchema.allow(null).default(null),
  parent: objectIdSchema.allow("", null).default(null),
  level: Joi.number().min(0).max(3).default(0),
  sortOrder: Joi.number().default(0),
  isFeatured: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  isArchived: Joi.boolean().default(false),
  archivedAt: Joi.date().allow(null),
  meta: Joi.object({
    title: Joi.string().allow("", null).trim(),
    description: Joi.string().allow("", null).trim(),
    keywords: Joi.array().items(Joi.string().trim()),
  }).default({}),
});

// File upload validation
export const validateImageFile = (file) => {
  if (!file) return { error: null, value: null };

  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/svg+xml",
  ];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimes.includes(file.mimetype)) {
    return {
      error:
        "Invalid file type. Allowed types: JPEG, PNG, WEBP, GIF, AVIF, SVG",
    };
  }

  if (file.size > maxSize) {
    return { error: "File too large. Maximum size is 5MB" };
  }

  return { error: null, value: file };
};

// Validation functions (rest remain the same)
export const validateCreateCategory = (data) => {
  const schema = categorySchema.fork(["slug"], (field) => field.optional());
  return schema.validate(data, { abortEarly: false });
};

export const validateUpdateCategory = (data) => {
  const schema = categorySchema.fork(
    ["name", "slug", "subCategories", "metaFields"],
    (field) => field.optional(),
  );
  return schema.validate(data, { abortEarly: false });
};

export const validateSubCategory = (data) => {
  return subCategorySchema.validate(data, { abortEarly: false });
};

export const validateMetaField = (data) => {
  return metaFieldSchema.validate(data, { abortEarly: false });
};

export const validateRenameMetaFieldKey = (data) => {
  const schema = Joi.object({
    oldKey: Joi.string()
      .pattern(/^[a-z][a-zA-Z0-9_]*$/)
      .required(),
    newKey: Joi.string()
      .pattern(/^[a-z][a-zA-Z0-9_]*$/)
      .required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateReorder = (data) => {
  const schema = Joi.object({
    ids: Joi.array().items(Joi.string().required()).min(1).required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateIdParam = (data) => {
  const schema = Joi.object({
    id: objectIdSchema.required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateSlugParam = (data) => {
  const schema = Joi.object({
    slug: slugSchema.required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateCategoryId = (data) => {
  const schema = Joi.object({
    categoryId: objectIdSchema.required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateSubCategorySlug = (data) => {
  const schema = Joi.object({
    subCategorySlug: slugSchema.required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateMetaFieldKey = (data) => {
  const schema = Joi.object({
    key: Joi.string()
      .pattern(/^[a-z][a-zA-Z0-9_]*$/)
      .required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateSetFallbackCategory = (data) => {
  const schema = Joi.object({
    fallbackCategoryId: objectIdSchema.allow(null).required(),
  });
  return schema.validate(data, { abortEarly: false });
};

export const validateBulkOperation = (data) => {
  const schema = Joi.object({
    ids: Joi.array().items(objectIdSchema.required()).min(1).required(),
    data: Joi.object().required(),
  });
  return schema.validate(data, { abortEarly: false });
};
