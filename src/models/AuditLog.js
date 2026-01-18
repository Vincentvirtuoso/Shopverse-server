// models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Can be null for system actions
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "LOGOUT",
        "LOGOUT_ALL_DEVICES",
        "FORCE_LOGOUT",
        "PASSWORD_CHANGE",
        "PROFILE_UPDATE",
        "ADMIN_ACTION",
        "SYSTEM_EVENT",
        "API_CALL",
        "ERROR",
      ],
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
    endpoint: {
      type: String,
      required: false,
    },
    method: {
      type: String,
      required: false,
    },
    statusCode: {
      type: Number,
      required: false,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1 });
auditLogSchema.index({ createdAt: -1 });

// Virtual for user info
auditLogSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Virtual for target user info
auditLogSchema.virtual("targetUser", {
  ref: "User",
  localField: "targetUserId",
  foreignField: "_id",
  justOne: true,
});

// Static method for creating audit logs
auditLogSchema.statics.log = async function (data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return null;
  }
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
