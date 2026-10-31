import { BANNER_FOLDER, PRODUCT_FOLDER, TESTIMONIAL_FOLDER, signUpload } from "@/lib/server/cloudinary";
import { getAdmin } from "@/lib/server/session";

// Admins only: a one-time signature for uploading an image straight from the browser to Cloudinary
// (see src/lib/upload.ts). The image never passes through here. Body: { kind: "product" | "banner" | "testimonial" }.
export async function POST(request: Request) {
  if (!(await getAdmin())) return Response.json({ error: "Not allowed" }, { status: 403 });
  const { kind } = (await request.json().catch(() => ({}))) as { kind?: string };
  try {
    const folder = kind === "banner" ? BANNER_FOLDER : kind === "testimonial" ? TESTIMONIAL_FOLDER : PRODUCT_FOLDER;
    return Response.json(signUpload(folder));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Image uploads aren't set up yet." }, { status: 500 });
  }
}
