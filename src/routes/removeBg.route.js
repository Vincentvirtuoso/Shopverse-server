import e from "express";
import { uploadSingle } from "../config/multer.js";
import axios from "axios";
import AppError from "../utils/AppError.js";
import FormData from "form-data";

const router = e.Router();

router.post("/remove-bg", uploadSingle("image"), async (req, res) => {
  console.log(req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const formData = new FormData();
    formData.append("size", "auto");
    formData.append("image_file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios({
      method: "post",
      url: "https://api.remove.bg/v1.0/removebg",
      data: formData,
      responseType: "arraybuffer",
      headers: {
        ...formData.getHeaders(),
        "X-Api-Key": process.env.REMOVE_BG_API,
      },
    });

    const base64Image = Buffer.from(response.data, "binary").toString("base64");
    const resultUri = `data:image/png;base64,${base64Image}`;

    return res.status(200).json({
      success: true,
      url: resultUri,
      message: "Background removed successfully",
    });
  } catch (error) {
    const message =
      error.response?.data?.toString() || "Failed to process image";
    console.error(
      "BG Removal Error:",
      error.response?.data?.toString() || error.message,
    );

    const status = error.response?.status || 500;
    res.status(status).json({ error: message });

    return new AppError(
      error.response?.data?.toString() || "Failed to process image",
      status,
      "REMOVE_BG_ERROR",
    );
  }
});

export default router;
