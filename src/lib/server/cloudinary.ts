import "server-only";
import { createHash } from "node:crypto";

// Product images live on Cloudinary (https://cloudinary.com); MongoDB only stores their links.
// Settings: Cloudinary -> Settings -> API Keys (Cloud name, API key, API secret).
export const cloudinaryCloudName = () => process.env.CLOUDINARY_CLOUD_NAME ?? "";

export const PRODUCT_FOLDER = "melovme/products";

// Signs one direct upload from the admin's browser to Cloudinary, so the API secret never leaves
// the server. Cloudinary rejects the upload if any signed value is changed.
// https://cloudinary.com/documentation/authentication_signatures
export function signProductUpload() {
  const cloudName = cloudinaryCloudName();
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !secret) throw new Error("CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET is not set");

  const params = { folder: PRODUCT_FOLDER, timestamp: String(Math.floor(Date.now() / 1000)) };
  // Parameters sorted by name, joined as a=b&c=d, then the secret appended, SHA-1 hex
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + secret).digest("hex");
  return { cloudName, apiKey, signature, ...params };
}
