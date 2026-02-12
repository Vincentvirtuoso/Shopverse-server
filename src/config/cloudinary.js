import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (file, folder = "products", options = {}) => {
  try {
    const uploadOptions = {
      folder: folder,
      resource_type: "auto",
      ...options,
    };

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else if (file.path) {
        fs.createReadStream(file.path).pipe(uploadStream);
      }
    });

    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return {
      success: false,
      error: error.message,
    };
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === "ok",
      result: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const uploadMultipleToCloudinary = async (files, folder = "products") => {
  const uploadPromises = files.map((file) => uploadToCloudinary(file, folder));
  return Promise.all(uploadPromises);
};

export {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadMultipleToCloudinary,
};
