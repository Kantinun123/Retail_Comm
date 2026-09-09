const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (url) {
    return url.startsWith("http") ? url : `https://${url}`;
  }
  return "http://localhost:3000";
};

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "CBM AI",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "SCG",
  copyright: process.env.NEXT_PUBLIC_APP_COPYRIGHT || "CBM AI",
  url: getBaseUrl(),
};

export const getServerConfig = () => {
  const rawAllowEmail = process.env.ALLOW_EMAIL || "";
  return {
    requireAuth: !!process.env.ALLOW_EMAIL,
    allowedEmails: rawAllowEmail
      ? rawAllowEmail
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
      : [],
  };
};
