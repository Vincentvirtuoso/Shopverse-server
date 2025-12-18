import Joi from "joi";

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0).required(),
  width: Joi.number().min(0).required(),
  height: Joi.number().min(0).required(),
  unit: Joi.string().valid("cm", "m", "in", "ft").default("cm"),
});

const weightSchema = Joi.object({
  value: Joi.number().min(0).required(),
  unit: Joi.string().valid("g", "kg", "lb", "oz").default("g"),
});

const variantSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().min(0),
  sku: Joi.string(),
  stockCount: Joi.number().min(0).default(0),
  attributes: Joi.object().pattern(/^/, Joi.string()),
});

const metaSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().trim(),
  keywords: Joi.array().items(Joi.string().trim()),
});

const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i;

export const createProductSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(200),
  brand: Joi.string().required().trim().min(1).max(100),
  price: Joi.number().required().min(0),
  originalPrice: Joi.number().min(0).allow(null),
  discount: Joi.number().min(0).max(100).default(0),
  rating: Joi.number().min(0).max(5).default(0),
  reviewCount: Joi.number().min(0).default(0),
  description: Joi.string().required().trim().min(10),
  image: Joi.string()
    .trim()
    .pattern(urlPattern)
    .message("Image must be a valid URL"),
  images: Joi.array().items(
    Joi.string()
      .trim()
      .pattern(urlPattern)
      .message("Each image must be a valid URL")
  ),
  category: Joi.string().required().trim().min(1).max(100),
  subCategory: Joi.string().trim().max(100).allow("", null),
  stockCount: Joi.number().min(0).default(0),
  availabilityType: Joi.string()
    .valid("in-stock", "limited", "out-of-stock", "pre-order")
    .default("in-stock"),
  unit: Joi.string()
    .valid("piece", "pair", "set", "kg", "g", "lb", "oz", "liter", "ml")
    .default("piece"),
  isBestSeller: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string().trim().lowercase()),
  sku: Joi.string().trim().allow("", null),
  isActive: Joi.boolean().default(true),
  warranty: Joi.string().trim().allow("", null),
  features: Joi.array().items(Joi.string().trim()),
  specifications: Joi.object().pattern(/^/, Joi.any()),
  weight: weightSchema,
  dimensions: dimensionsSchema,
  shippingInfo: Joi.object({
    weight: Joi.number().min(0),
    dimensions: Joi.object({
      length: Joi.number().min(0),
      width: Joi.number().min(0),
      height: Joi.number().min(0),
    }),
    shippingClass: Joi.string(),
  }),
  relatedProducts: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  variants: Joi.array().items(variantSchema),
  meta: metaSchema,
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  brand: Joi.string().trim().min(1).max(100),
  price: Joi.number().min(0),
  originalPrice: Joi.number().min(0).allow(null),
  discount: Joi.number().min(0).max(100),
  rating: Joi.number().min(0).max(5),
  reviewCount: Joi.number().min(0),
  description: Joi.string().trim().min(10),
  image: Joi.string()
    .trim()
    .pattern(urlPattern)
    .message("Image must be a valid URL"),
  images: Joi.array().items(
    Joi.string()
      .trim()
      .pattern(urlPattern)
      .message("Each image must be a valid URL")
  ),
  category: Joi.string().trim().min(1).max(100),
  subCategory: Joi.string().trim().max(100).allow("", null),
  stockCount: Joi.number().min(0),
  availabilityType: Joi.string().valid(
    "in-stock",
    "limited",
    "out-of-stock",
    "pre-order"
  ),
  unit: Joi.string().valid(
    "piece",
    "pair",
    "set",
    "kg",
    "g",
    "lb",
    "oz",
    "liter",
    "ml"
  ),
  isBestSeller: Joi.boolean(),
  tags: Joi.array().items(Joi.string().trim().lowercase()),
  sku: Joi.string().trim().allow("", null),
  isActive: Joi.boolean(),
  warranty: Joi.string().trim().allow("", null),
  features: Joi.array().items(Joi.string().trim()),
  specifications: Joi.object().pattern(/^/, Joi.any()),
  weight: weightSchema,
  dimensions: dimensionsSchema,
  shippingInfo: Joi.object({
    weight: Joi.number().min(0),
    dimensions: Joi.object({
      length: Joi.number().min(0),
      width: Joi.number().min(0),
      height: Joi.number().min(0),
    }),
    shippingClass: Joi.string(),
  }),
  relatedProducts: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  variants: Joi.array().items(variantSchema),
  meta: metaSchema,
});

export const productIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

export const productQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  sort: Joi.string().valid(
    "newest",
    "price_asc",
    "price_desc",
    "rating",
    "name"
  ),
  category: Joi.string(),
  subCategory: Joi.string(),
  brand: Joi.string(),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  inStock: Joi.boolean(),
  isBestSeller: Joi.boolean(),
  search: Joi.string(),
});
