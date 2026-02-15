import express from "express";
import {
  createCategory,
  updateCategory,
  renameCategory,
  deleteCategory,
  reorderCategories,
  updateCategoryStatus,
  setFallbackCategory,
  addMetaField,
  updateMetaField,
  renameMetaFieldKey,
  removeMetaField,
  reorderMetaFields,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  getActiveCategories,
  getProductCount,
  getCategoryHierarchy,
} from "../controller/category.controller.js";

import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { uploadFields } from "../config/multer.js";

const router = express.Router();

router.get("/active", getActiveCategories);

router.get("/hierarchy", getCategoryHierarchy);

router.get("/slug/:slug", getCategoryBySlug);

router.get("/:id/product-count", getProductCount);

router.get("/:id", getCategoryById);

router.get("/", getAllCategories);

router.use(protect);
router.use(restrictTo("admin", "super_admin"));

router.post(
  "/",
  uploadFields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  createCategory,
);

router.patch(
  "/:id",
  uploadFields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  updateCategory,
);

router.patch("/:id/rename", renameCategory);

router.delete("/:id", deleteCategory);

router.post("/reorder", reorderCategories);

router.patch("/:id/status", updateCategoryStatus);

router.patch("/:id/fallback", setFallbackCategory);

router.post("/:id/metafields", addMetaField);

router.patch("/:id/metafields/:key", updateMetaField);

router.patch("/:id/metafields/:key/rename", renameMetaFieldKey);

router.delete("/:id/metafields/:key", removeMetaField);

router.patch("/:id/metafields/reorder", reorderMetaFields);

export default router;
