const secure = process.env.NODE_ENV === "production";

export const cookieOptions = (days) => ({
  httpOnly: true,
  secure,
  sameSite: secure ? "none" : "lax",
  expires: new Date(Date.now() + days * 86400000),
});
