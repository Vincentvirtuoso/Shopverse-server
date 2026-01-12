import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
} from "../config/cloudinary.js";
import Product from "../models/Product.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  productQuerySchema,
} from "../validators/product.validator.js";

export const createProduct = async (req, res) => {
  try {
    let productInfo = JSON.parse(req.body.product);

    const forbiddenFields = [
      "id",
      "meta?.slug",
      "shippingInfo.dimensions",
      "shippingInfo.weight",
    ];

    forbiddenFields.forEach((field) => {
      const parts = field.split("?.");
      if (parts.length === 1) delete productInfo[parts[0]];
      else if (productInfo[parts[0]]) delete productInfo[parts[0]][parts[1]];
    });

    // Type conversions
    if (productInfo.price) productInfo.price = Number(productInfo.price);
    if (productInfo.originalPrice)
      productInfo.originalPrice = Number(productInfo.originalPrice);
    if (productInfo.stockCount)
      productInfo.stockCount = Number(productInfo.stockCount);

    if (productInfo.weight?.value)
      productInfo.weight.value = Number(productInfo.weight.value);

    if (productInfo.shippingInfo?.weight)
      productInfo.shippingInfo.weight = Number(productInfo.shippingInfo.weight);

    if (productInfo.shippingInfo?.dimensions) {
      const dims = productInfo.shippingInfo.dimensions;
      if (dims.length) dims.length = Number(dims.length);
      if (dims.width) dims.width = Number(dims.width);
      if (dims.height) dims.height = Number(dims.height);
    }

    if (productInfo.dimensions) {
      const dims = productInfo.dimensions;
      if (dims.length) dims.length = Number(dims.length);
      if (dims.width) dims.width = Number(dims.width);
      if (dims.height) dims.height = Number(dims.height);
    }

    let mainImageUrl = null;
    let additionalImageUrls = [];

    console.log("=== FILE UPLOAD DEBUG ===");
    console.log("req.files:", req.files);
    console.log("req.body:", req.body);

    if (req.files?.mainImage && req.files.mainImage[0]) {
      console.log("Uploading main image...");
      const result = await uploadToCloudinary(
        req.files.mainImage[0],
        "products/main"
      );

      console.log("Main image upload result:", result);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: "Main image upload failed",
          error: result.error,
        });
      }
      mainImageUrl = result.url;
    } else {
      // ✅ Main image is required
      return res.status(400).json({
        success: false,
        message: "Main image is required",
      });
    }

    // ✅ Upload additional images
    if (req.files?.additionalImages && req.files.additionalImages.length > 0) {
      console.log("Uploading additional images...");
      const results = await uploadMultipleToCloudinary(
        req.files.additionalImages,
        "products/additional"
      );

      console.log("Additional images upload results:", results);

      // Filter out failed uploads
      additionalImageUrls = results.filter((r) => r.success).map((r) => r.url);
    }

    // ✅ Build images array - filter out any undefined/null values
    const allImages = [mainImageUrl, ...additionalImageUrls].filter(Boolean);

    // Remove duplicates
    const uniqueImages = [...new Set(allImages)];

    // ----------------------------
    // Build product object for validation
    // ----------------------------
    const productToValidate = {
      ...productInfo,
      image: mainImageUrl,
      images: uniqueImages,
    };

    console.log("PRODUCT TO VALIDATE:", productToValidate);

    // ----------------------------
    // Validate
    // ----------------------------
    const { error, value } = createProductSchema.validate(productToValidate, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d) => d.message),
      });
    }

    // ----------------------------
    // Check SKU uniqueness
    // ----------------------------
    if (value.sku) {
      const existingProduct = await Product.findOne({ sku: value.sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    // ----------------------------
    // Save product
    // ----------------------------
    const product = new Product(value);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate field value entered",
        field: Object.keys(error.keyPattern)[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

export const getProducts = async (req, res) => {
  try {
    const { error, value } = productQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const {
      page = 1,
      limit = 10,
      sort = "newest",
      category,
      subCategory,
      brand,
      minPrice,
      maxPrice,
      inStock,
      isBestSeller,
      search,
    } = value;

    // Build query
    const query = { isActive: true };

    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (brand) query.brand = brand;
    if (isBestSeller !== undefined) query.isBestSeller = isBestSeller;
    if (inStock === true) query.availabilityType = { $ne: "out-of-stock" };
    if (inStock === false) query.availabilityType = "out-of-stock";

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }

    // Search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Sort options
    let sortOption = {};
    switch (sort) {
      case "price_asc":
        sortOption = { price: 1 };
        break;
      case "price_desc":
        sortOption = { price: -1 };
        break;
      case "rating":
        sortOption = { rating: -1, reviewCount: -1 };
        break;
      case "name":
        sortOption = { name: 1 };
        break;
      case "newest":
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate("relatedProducts", "name price image"),
      Product.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting products:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving products",
      error: error.message,
    });
  }
};

/**
 * Get single product by ID
 */
export const getProductById = async (req, res) => {
  try {
    // Validate product ID
    const { error, value } = productIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(value.id)
      .populate("relatedProducts", "name price image brand category")
      .populate({
        path: "variants",
        select: "name price sku stockCount attributes",
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error getting product:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving product",
      error: error.message,
    });
  }
};

/**
 * Update product
 */
export const updateProduct = async (req, res) => {
  try {
    // Validate product ID
    const { error: idError, value: idValue } = productIdSchema.validate(
      req.params
    );
    if (idError) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // Validate request body
    const { error, value } = updateProductSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Check if product exists
    const existingProduct = await Product.findById(idValue.id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if SKU already exists (if being updated)
    if (value.sku && value.sku !== existingProduct.sku) {
      const productWithSku = await Product.findOne({ sku: value.sku });
      if (productWithSku) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    // Handle file uploads if present
    if (req.files) {
      // Handle main image update
      if (req.files.mainImage) {
        const mainImageResult = await uploadToCloudinary(
          req.files.mainImage[0],
          "products/main"
        );
        if (mainImageResult.success) {
          value.image = mainImageResult.url;
          // Add to images array if not already present
          if (!value.images) {
            value.images = existingProduct.images;
          }
          if (!value.images.includes(mainImageResult.url)) {
            value.images.unshift(mainImageResult.url);
          }
        }
      }

      // Handle additional images
      if (req.files.additionalImages) {
        const additionalImagesResult = await uploadMultipleToCloudinary(
          req.files.additionalImages,
          "products/additional"
        );

        const successfulUploads = additionalImagesResult.filter(
          (img) => img.success
        );
        const newImageUrls = successfulUploads.map((img) => img.url);

        if (!value.images) {
          value.images = existingProduct.images;
        }
        value.images = [...value.images, ...newImageUrls];
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      idValue.id,
      { $set: value },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate field value entered",
        field: Object.keys(error.keyPattern)[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

/**
 * Delete product (soft delete)
 */
export const deleteProduct = async (req, res) => {
  try {
    // Validate product ID
    const { error, value } = productIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(value.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Soft delete by setting isActive to false
    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message,
    });
  }
};

/**
 * Get best selling products
 */
export const getBestSellers = async (req, res) => {
  try {
    const products = await Product.findBestSellers(10);

    res.status(200).json({
      success: true,
      message: "Best selling products retrieved successfully",
      data: products,
    });
  } catch (error) {
    console.error("Error getting best sellers:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving best selling products",
      error: error.message,
    });
  }
};

/**
 * Get products by category
 */
export const getProductsByCategory = async (req, res) => {
  try {
    const { category, subCategory } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const products = await Product.findByCategory(category, subCategory);

    res.status(200).json({
      success: true,
      message: `Products in ${category}${
        subCategory ? ` > ${subCategory}` : ""
      } retrieved successfully`,
      data: products,
    });
  } catch (error) {
    console.error("Error getting products by category:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving products by category",
      error: error.message,
    });
  }
};

/**
 * Get product statistics
 */
export const getProductStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: "$stockCount" },
          averagePrice: { $avg: "$price" },
          averageRating: { $avg: "$rating" },
          totalOutOfStock: {
            $sum: {
              $cond: [{ $eq: ["$availabilityType", "out-of-stock"] }, 1, 0],
            },
          },
          totalBestSellers: {
            $sum: {
              $cond: ["$isBestSeller", 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalProducts: 1,
          totalStock: 1,
          averagePrice: { $round: ["$averagePrice", 2] },
          averageRating: { $round: ["$averageRating", 2] },
          totalOutOfStock: 1,
          totalBestSellers: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Product statistics retrieved successfully",
      data: stats[0] || {},
    });
  } catch (error) {
    console.error("Error getting product stats:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving product statistics",
      error: error.message,
    });
  }
};
