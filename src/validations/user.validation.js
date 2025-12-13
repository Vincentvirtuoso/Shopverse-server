import Joi from "joi";

// === Reusable pieces ===
const email = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .required();

const password = Joi.string().min(6).required();

const name = Joi.string().min(2).max(50).trim();

// Address schema
const addressSchema = Joi.object({
  type: Joi.string().valid("home", "work", "other").default("home"),
  isDefault: Joi.boolean(),
  street: Joi.string().required(),
  apartment: Joi.string().allow("", null),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  postalCode: Joi.string().required(),
  phone: Joi.string().allow("", null),
  instructions: Joi.string().allow("", null),
});

// Seller profile schema
const sellerProfileSchema = Joi.object({
  storeName: Joi.string(),
  businessType: Joi.string(),
  taxId: Joi.string(),
  businessRegistrationNumber: Joi.string(),
  businessAddress: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string(),
    postalCode: Joi.string(),
  }),
  description: Joi.string().allow("", null),
});

// === Main Validation Schemas ===

// REGISTER
export const registerSchema = Joi.object({
  email,
  password,
  firstName: name.required(),
  lastName: name.required(),
  phoneNumber: Joi.string().allow("", null),
});

// LOGIN
export const loginSchema = Joi.object({
  email,
  password,
});

// UPDATE PROFILE
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim(),
  lastName: Joi.string().trim(),
  phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/),
  profileImage: Joi.string().uri(),
  preferences: Joi.object({
    language: Joi.string().valid("en", "es", "fr", "de", "zh"),
    currency: Joi.string().valid("USD", "EUR", "GBP", "JPY", "CAD"),
    emailNotifications: Joi.boolean(),
    smsNotifications: Joi.boolean(),
    pushNotifications: Joi.boolean(),
    marketingEmails: Joi.boolean(),
  }),
});

// ADD OR UPDATE ADDRESS
export const addressUpdateSchema = addressSchema;

// SELLER PROFILE UPDATE
export const sellerProfileUpdateSchema = sellerProfileSchema;

// REQUEST PASSWORD RESET
export const requestResetSchema = Joi.object({
  email,
});

// RESET PASSWORD
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.ref("newPassword"),
}).with("newPassword", "confirmPassword");
