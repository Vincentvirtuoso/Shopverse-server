import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";
import {
  validateCreateCategory,
  validateUpdateCategory,
  validateSubCategory,
  validateMetaField,
  validateRenameMetaFieldKey,
  validateReorder,
  validateIdParam,
  validateSubCategorySlug,
  validateMetaFieldKey,
  validateSetFallbackCategory,
  validateSlugParam,
  validateImageFile,
} from "../validators/category.validator.js";
import Category from "../models/Category.js";

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const matches = url.match(
    /\/(v\d+\/)?([^/]+)\.(jpg|jpeg|png|webp|gif|avif|svg)$/i,
  );
  return matches ? matches[2] : null;
};

const handleImageUpload = async (
  file,
  folder = "categories",
  oldImageUrl = null,
) => {
  if (!file) return { image: undefined, icon: undefined };

  if (oldImageUrl) {
    const publicId = getPublicIdFromUrl(oldImageUrl);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }
  }

  const { error } = validateImageFile(file);
  if (error) {
    throw new AppError(error, 400, "INVALID_IMAGE");
  }

  const result = await uploadToCloudinary(file, folder);
  if (!result.success) {
    throw new AppError(result.error, 500, "CLOUDINARY_UPLOAD_FAILED");
  }

  return { url: result.url, publicId: result.public_id };
};

export const createCategory = catchAsync(async (req, res) => {
  const bodyData = req.body.data ? JSON.parse(req.body.data) : req.body;

  console.log(bodyData);

  const { error, value } = validateCreateCategory(bodyData);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  if (!value.slug && value.name) {
    value.slug = generateSlug(value.name);
  }

  const existingCategory = await Category.findOne({ slug: value.slug });
  if (existingCategory) {
    throw new AppError(
      "Category with this slug already exists",
      400,
      "DUPLICATE_SLUG",
    );
  }

  if (req.files) {
    if (req.files.image) {
      const { url } = await handleImageUpload(
        req.files.image[0],
        "categories/images",
      );
      value.image = url;
    }
    if (req.files.icon) {
      const { url } = await handleImageUpload(
        req.files.icon[0],
        "categories/icons",
      );
      value.icon = url;
    }
  }

  if (value.parent) {
    const parentCategory = await Category.findById(value.parent);
    if (!parentCategory) {
      throw new AppError("Parent category not found", 404, "PARENT_NOT_FOUND");
    }
    value.level = (parentCategory.level || 0) + 1;
    if (value.level > 3) {
      throw new AppError(
        "Maximum nesting level (3) exceeded",
        400,
        "MAX_LEVEL_EXCEEDED",
      );
    }
  }

  const category = await Category.create(value);

  res.status(201).json({
    success: true,
    data: category,
  });
});

export const updateCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const bodyData = req.body.data ? JSON.parse(req.body.data) : req.body;

  const { error, value } = validateUpdateCategory(bodyData);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  if (req.files) {
    if (req.files.image) {
      const { url } = await handleImageUpload(
        req.files.image[0],
        "categories/images",
        category.image,
      );
      value.image = url;
    } else if (bodyData.image === "") {
      if (category.image) {
        const publicId = getPublicIdFromUrl(category.image);
        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      }
      value.image = null;
    }

    if (req.files.icon) {
      const { url } = await handleImageUpload(
        req.files.icon[0],
        "categories/icons",
        category.icon,
      );
      value.icon = url;
    } else if (bodyData.icon === "") {
      if (category.icon) {
        const publicId = getPublicIdFromUrl(category.icon);
        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      }
      value.icon = null;
    }
  }

  if (value.slug && value.slug !== category.slug) {
    const existingCategory = await Category.findOne({
      slug: value.slug,
      _id: { $ne: category._id },
    });
    if (existingCategory) {
      throw new AppError(
        "Category with this slug already exists",
        400,
        "DUPLICATE_SLUG",
      );
    }
  }

  if (value.parent && value.parent !== category.parent?.toString()) {
    const parentCategory = await Category.findById(value.parent);
    if (!parentCategory) {
      throw new AppError("Parent category not found", 404, "PARENT_NOT_FOUND");
    }
    value.level = (parentCategory.level || 0) + 1;
    if (value.level > 3) {
      throw new AppError(
        "Maximum nesting level (3) exceeded",
        400,
        "MAX_LEVEL_EXCEEDED",
      );
    }
  }

  Object.assign(category, value);
  await category.save();

  res.json({
    success: true,
    data: category,
  });
});

export const renameCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new AppError("Name is required", 400, "NAME_REQUIRED");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const newSlug = generateSlug(name);

  const existingCategory = await Category.findOne({
    slug: newSlug,
    _id: { $ne: category._id },
  });

  if (existingCategory) {
    throw new AppError(
      "Another category with this slug already exists",
      400,
      "DUPLICATE_SLUG",
    );
  }

  category.name = name.trim();
  category.slug = newSlug;
  await category.save();

  res.json({
    success: true,
    data: category,
  });
});

export const deleteCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { globalFallbackId } = req.body;

  if (globalFallbackId && !mongoose.Types.ObjectId.isValid(globalFallbackId)) {
    throw new AppError(
      "Invalid fallback category ID",
      400,
      "INVALID_FALLBACK_ID",
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const category = await Category.findById(req.params.id).session(session);
    if (!category) {
      throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
    }

    if (category.image) {
      const publicId = getPublicIdFromUrl(category.image);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }
    if (category.icon) {
      const publicId = getPublicIdFromUrl(category.icon);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }

    for (const subCategory of category.subCategories) {
      if (subCategory.image) {
        const publicId = getPublicIdFromUrl(subCategory.image);
        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      }
    }

    const result = await Category.safeDelete(
      req.params.id,
      globalFallbackId,
      session,
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Category deleted successfully",
      data: result,
    });
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(error.message, 400, "DELETE_FAILED");
  } finally {
    session.endSession();
  }
});

export const reorderCategories = catchAsync(async (req, res) => {
  const { error, value } = validateReorder(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  await Category.reorderCategories(value.ids);

  res.json({
    success: true,
    message: "Categories reordered successfully",
  });
});

export const updateCategoryStatus = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400, "INVALID_STATUS");
  }

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true, runValidators: true },
  );

  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const setFallbackCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error, value } = validateSetFallbackCategory(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  if (value.fallbackCategoryId) {
    const fallbackCategory = await Category.findById(value.fallbackCategoryId);
    if (!fallbackCategory) {
      throw new AppError(
        "Fallback category not found",
        404,
        "FALLBACK_NOT_FOUND",
      );
    }

    if (fallbackCategory._id.toString() === req.params.id) {
      throw new AppError(
        "Category cannot be its own fallback",
        400,
        "SELF_FALLBACK",
      );
    }
  }

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { fallbackCategory: value.fallbackCategoryId },
    { new: true, runValidators: true },
  ).populate("fallbackCategory", "name slug");

  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const addSubCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const bodyData = req.body.data ? JSON.parse(req.body.data) : req.body;

  const { error, value } = validateSubCategory(bodyData);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  if (req.file) {
    const { url } = await handleImageUpload(
      req.file,
      `categories/${category.slug}/subcategories`,
    );
    value.image = url;
  }

  try {
    await category.addSubCategory(value);
  } catch (err) {
    if (value.image) {
      const publicId = getPublicIdFromUrl(value.image);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }
    throw new AppError(err.message, 400, "ADD_SUBCATEGORY_FAILED");
  }

  res.status(201).json({
    success: true,
    data: category,
  });
});

export const updateSubCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error: slugError } = validateSubCategorySlug({
    subCategorySlug: req.params.subCategorySlug,
  });
  if (slugError) {
    throw new AppError("Invalid subcategory slug", 400, "INVALID_SLUG");
  }

  const bodyData = req.body.data ? JSON.parse(req.body.data) : req.body;

  const { error, value } = validateSubCategory(bodyData);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const subCategory = category.subCategories.find(
    (s) => s.slug === req.params.subCategorySlug,
  );

  if (!subCategory) {
    throw new AppError("Subcategory not found", 404, "SUBCATEGORY_NOT_FOUND");
  }

  if (req.file) {
    if (subCategory.image) {
      const oldPublicId = getPublicIdFromUrl(subCategory.image);
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    }

    const { url } = await handleImageUpload(
      req.file,
      `categories/${category.slug}/subcategories`,
    );
    value.image = url;
  } else if (bodyData.image === "") {
    if (subCategory.image) {
      const publicId = getPublicIdFromUrl(subCategory.image);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }
    value.image = null;
  }

  if (value.slug && value.slug !== subCategory.slug) {
    const exists = category.subCategories.some(
      (s) =>
        s.slug === value.slug &&
        s._id.toString() !== subCategory._id.toString(),
    );
    if (exists) {
      throw new AppError(
        "Subcategory slug already exists in this category",
        400,
        "DUPLICATE_SLUG",
      );
    }
  }

  Object.assign(subCategory, value);
  await category.save();

  res.json({
    success: true,
    data: category,
  });
});

export const removeSubCategory = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error: slugError } = validateSubCategorySlug({
    subCategorySlug: req.params.subCategorySlug,
  });
  if (slugError) {
    throw new AppError("Invalid subcategory slug", 400, "INVALID_SLUG");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const subCategory = category.subCategories.find(
    (s) => s.slug === req.params.subCategorySlug,
  );

  if (subCategory && subCategory.image) {
    const publicId = getPublicIdFromUrl(subCategory.image);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }
  }

  try {
    await category.removeSubCategory(req.params.subCategorySlug);
  } catch (err) {
    throw new AppError(err.message, 404, "REMOVE_SUBCATEGORY_FAILED");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const reorderSubCategories = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error, value } = validateReorder(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  try {
    await category.reorderSubCategories(value.ids);
  } catch (err) {
    throw new AppError(err.message, 400, "REORDER_FAILED");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const addMetaField = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error, value } = validateMetaField(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  try {
    await category.addMetaField(value);
  } catch (err) {
    throw new AppError(err.message, 400, "ADD_METAFIELD_FAILED");
  }

  res.status(201).json({
    success: true,
    data: category,
  });
});

export const updateMetaField = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error: keyError } = validateMetaFieldKey({ key: req.params.key });
  if (keyError) {
    throw new AppError("Invalid meta field key", 400, "INVALID_KEY");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  try {
    await category.updateMetaField(req.params.key, req.body);
  } catch (err) {
    throw new AppError(err.message, 404, "UPDATE_METAFIELD_FAILED");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const renameMetaFieldKey = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error: keyError } = validateMetaFieldKey({ key: req.params.key });
  if (keyError) {
    throw new AppError("Invalid meta field key", 400, "INVALID_KEY");
  }

  const { error, value } = validateRenameMetaFieldKey({
    oldKey: req.params.key,
    newKey: req.body.newKey,
  });
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const exists = category.metaFields.some(
    (f) => f.key === value.newKey && f.key !== value.oldKey,
  );
  if (exists) {
    throw new AppError(
      "Meta field with this key already exists",
      400,
      "DUPLICATE_KEY",
    );
  }

  const field = category.metaFields.find((f) => f.key === value.oldKey);
  if (!field) {
    throw new AppError("Meta field not found", 404, "METAFIELD_NOT_FOUND");
  }

  field.key = value.newKey;
  await category.save();

  res.json({
    success: true,
    data: category,
  });
});

export const removeMetaField = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error: keyError } = validateMetaFieldKey({ key: req.params.key });
  if (keyError) {
    throw new AppError("Invalid meta field key", 400, "INVALID_KEY");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  try {
    await category.removeMetaField(req.params.key);
  } catch (err) {
    throw new AppError(err.message, 404, "REMOVE_METAFIELD_FAILED");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const reorderMetaFields = catchAsync(async (req, res) => {
  const { error: idError } = validateIdParam({ id: req.params.id });
  if (idError) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const { error, value } = validateReorder(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, "VALIDATION_ERROR");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  try {
    await category.reorderMetaFields(value.ids);
  } catch (err) {
    throw new AppError(err.message, 400, "REORDER_FAILED");
  }

  res.json({
    success: true,
    data: category,
  });
});

export const getAllCategories = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sortBy = "sortOrder",
    sortOrder = "asc",
    parent,
    isActive,
    isFeatured,
    search,
  } = req.query;

  console.log("Query", req.query);

  const query = { isArchived: { $ne: true } };

  if (parent !== undefined) {
    query.parent = parent === "null" || parent === null ? null : parent;
  }
  if (isActive !== undefined) {
    query.isActive = isActive === "true";
  }
  if (isFeatured !== undefined) {
    query.isFeatured = isFeatured === "true";
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  const test = await Category.find({});
  console.log("Categories in DB:", test);

  const [categories, total] = await Promise.all([
    Category.find(query)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate("parent", "name slug")
      .populate("fallbackCategory", "name slug")
      .lean(),
    Category.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: categories,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

export const getCategoryById = catchAsync(async (req, res) => {
  const { error } = validateIdParam({ id: req.params.id });
  if (error) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const category = await Category.findById(req.params.id)
    .populate("parent", "name slug fullSlug")
    .populate("fallbackCategory", "name slug")
    .populate({
      path: "parent",
      populate: {
        path: "parent",
        select: "name slug",
      },
    })
    .lean();

  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const Product = mongoose.model("Product");
  const productCount = await Product.countDocuments({ category: category._id });

  res.json({
    success: true,
    data: {
      ...category,
      productCount,
    },
  });
});

export const getCategoryBySlug = catchAsync(async (req, res) => {
  const { error } = validateSlugParam({ slug: req.params.slug });
  if (error) {
    throw new AppError("Invalid category slug", 400, "INVALID_SLUG");
  }

  const category = await Category.findOne({ slug: req.params.slug })
    .populate("parent", "name slug fullSlug")
    .populate("fallbackCategory", "name slug")
    .populate({
      path: "parent",
      populate: {
        path: "parent",
        select: "name slug",
      },
    })
    .lean();

  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const Product = mongoose.model("Product");
  const productCount = await Product.countDocuments({ category: category._id });

  res.json({
    success: true,
    data: {
      ...category,
      productCount,
    },
  });
});

export const getActiveCategories = catchAsync(async (req, res) => {
  const categories = await Category.getActiveTree();

  const Product = mongoose.model("Product");
  const categoryIds = categories.map((c) => c._id);

  const productCounts = await Product.aggregate([
    { $match: { category: { $in: categoryIds } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const countMap = productCounts.reduce((acc, curr) => {
    acc[curr._id.toString()] = curr.count;
    return acc;
  }, {});

  const categoriesWithCounts = categories.map((cat) => ({
    ...cat,
    productCount: countMap[cat._id.toString()] || 0,
    activeSubCategoryCount: cat.activeSubCategoryCount,
  }));

  res.json({
    success: true,
    data: categoriesWithCounts,
  });
});

export const getProductCount = catchAsync(async (req, res) => {
  const { error } = validateIdParam({ id: req.params.id });
  if (error) {
    throw new AppError("Invalid category ID", 400, "INVALID_ID");
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const Product = mongoose.model("Product");
  const count = await Product.countDocuments({ category: req.params.id });

  res.json({
    success: true,
    data: { count },
  });
});

export const getCategoryHierarchy = catchAsync(async (req, res) => {
  const categories = await Category.find({ isActive: true, isArchived: false })
    .sort({ sortOrder: 1 })
    .populate("parent", "name slug")
    .lean();

  const buildTree = (parentId = null) => {
    return categories
      .filter((cat) => {
        const catParentId = cat.parent ? cat.parent._id.toString() : null;
        return catParentId === parentId;
      })
      .map((cat) => ({
        ...cat,
        children: buildTree(cat._id.toString()),
      }));
  };

  const hierarchy = buildTree();

  res.json({
    success: true,
    data: hierarchy,
  });
});
