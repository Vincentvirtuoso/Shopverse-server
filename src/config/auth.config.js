export const AUTH_CONFIG = {
  access: {
    expiresIn: "7d",
  },
  refresh: {
    expiresInDays: 30,
  },
  roles: {
    super_admin: {
      tokenName: "admin_token",
      refreshTokenName: "admin_refresh_token",
      tokenSecret: process.env.ADMIN_TOKEN_SECRET,
      refreshSecret: process.env.ADMIN_REFRESH_TOKEN_SECRET,
    },
    admin: {
      tokenName: "admin_token",
      refreshTokenName: "admin_refresh_token",
      tokenSecret: process.env.ADMIN_TOKEN_SECRET,
      refreshSecret: process.env.ADMIN_REFRESH_TOKEN_SECRET,
    },
    customer: {
      tokenName: "user_token",
      refreshTokenName: "user_refresh_token",
      tokenSecret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    user: {
      tokenName: "user_token",
      refreshTokenName: "user_refresh_token",
      tokenSecret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
  },
};
