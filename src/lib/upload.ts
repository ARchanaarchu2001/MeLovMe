// Image uploads from the admin's browser straight to Cloudinary (product photos, home banner)

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type UploadKind = "product" | "banner" | "testimonial";

// Shrinks a photo to at most `maxSide` px wide/high and re-encodes it as WebP, so uploads stay small
export async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image"))), "image/webp", 0.85),
  );
}

// Uploads using a one-time signature from our server (the API secret stays there).
// Returns the image's link and size, which is all the shop stores.
export async function uploadToCloudinary(image: Blob, kind: UploadKind = "product") {
  const signRes = await fetch("/api/admin/images/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const sign = (await signRes.json()) as {
    cloudName?: string;
    apiKey?: string;
    signature?: string;
    timestamp?: string;
    folder?: string;
    error?: string;
  };
  if (!signRes.ok || !sign.signature) throw new Error(sign.error ?? "Upload failed");

  const body = new FormData();
  body.append("file", image, "image.webp");
  body.append("api_key", sign.apiKey!);
  body.append("timestamp", sign.timestamp!);
  body.append("signature", sign.signature);
  body.append("folder", sign.folder!);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: "POST", body });
  const data = (await res.json()) as { secure_url?: string; width?: number; height?: number; error?: { message?: string } };
  if (!res.ok || !data.secure_url) throw new Error(data.error?.message ?? "Upload failed");
  return {
    // f_auto,q_auto: Cloudinary picks the best format (WebP/AVIF) and quality for each device
    url: data.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto/"),
    width: data.width ?? 0,
    height: data.height ?? 0,
  };
}
