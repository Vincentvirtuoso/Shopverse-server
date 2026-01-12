import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getBestSellers,
  getProductsByCategory,
  getProductStats,
} from "../controller/product.controller.js";
import { uploadFields } from "../config/multer.js";

const router = express.Router();

const requireMainImage = (req, res, next) => {
  if (!req.files?.mainImage || !req.files.mainImage[0]) {
    return res.status(400).json({
      success: false,
      message: "Main image is required",
    });
  }
  next();
};

const productUpload = uploadFields([
  { name: "mainImage", maxCount: 1 },
  { name: "additionalImages", maxCount: 5 },
]);

router.post("/", requireMainImage, productUpload, createProduct);
router.get("/", getProducts);
router.get("/stats", getProductStats);
router.get("/best-sellers", getBestSellers);
router.get("/category", getProductsByCategory);
router.get("/:id", getProductById);
router.put("/:id", productUpload, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
