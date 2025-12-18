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
    const productInfo = JSON.parse(req.body.product);
    const productAndFiles = { ...productInfo, images: req.files };
    console.log("files:", req.files);

    const { error, value } = createProductSchema.validate(productInfo, {
      abortEarly: false,
    });

    console.log("Creating product with data:", JSON.parse(req.body.product));
    if (error) {
      console.log(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Check if SKU already exists
    if (value.sku) {
      const existingProduct = await Product.findOne({ sku: value.sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    // Handle file uploads if present
    let mainImageUrl = value.image;
    let additionalImageUrls = value.images || [];

    if (req.files) {
      // Handle main image
      if (req.files.mainImage) {
        const mainImageResult = await uploadToCloudinary(
          req.files.mainImage[0],
          "products/main"
        );
        if (!mainImageResult.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to upload main image",
            error: mainImageResult.error,
          });
        }
        mainImageUrl = mainImageResult.url;
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
        additionalImageUrls = [
          ...additionalImageUrls,
          ...successfulUploads.map((img) => img.url),
        ];
      }
    }

    if (!mainImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Main image is required",
      });
    }

    const productData = {
      ...value,
      image: mainImageUrl,
      images: [mainImageUrl, ...additionalImageUrls].filter(
        (url, index, array) => url && array.indexOf(url) === index
      ),
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);

    // Handle duplicate key errors
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
