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

const productUpload = uploadFields([
  { name: "mainImage", maxCount: 1 },
  { name: "additionalImages", maxCount: 5 },
]);

// Product routes
router.post("/", productUpload, createProduct);
router.get("/", getProducts);
router.get("/stats", getProductStats);
router.get("/best-sellers", getBestSellers);
router.get("/category", getProductsByCategory);
router.get("/:id", getProductById);
router.put("/:id", productUpload, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
