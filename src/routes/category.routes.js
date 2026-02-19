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

router.get("/", getAllCategories);
router.get("/active", getActiveCategories);
router.get("/hierarchy", getCategoryHierarchy);
router.get("/slug/:slug", getCategoryBySlug);
router.get("/:id/product-count", getProductCount);
router.get("/:id", getCategoryById);

router.use(protect);
router.use(restrictTo("admin", "super_admin"));

router.route("/").post(
  uploadFields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  createCategory,
);

router
  .route("/:id")
  .patch(
    uploadFields([
      { name: "image", maxCount: 1 },
      { name: "icon", maxCount: 1 },
    ]),
    updateCategory,
  )
  .delete(deleteCategory);

router.patch("/:id/rename", renameCategory);
router.patch("/:id/status", updateCategoryStatus);
router.patch("/:id/fallback", setFallbackCategory);
router.post("/reorder", reorderCategories);

router.route("/:id/metafields").post(addMetaField);

router.patch("/:id/metafields/reorder", reorderMetaFields);

router
  .route("/:id/metafields/:key")
  .patch(updateMetaField)
  .delete(removeMetaField);

router.patch("/:id/metafields/:key/rename", renameMetaFieldKey);

export default router;
