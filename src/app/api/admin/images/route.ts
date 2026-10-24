import { signProductUpload } from "@/lib/server/cloudinary";
import { getAdmin } from "@/lib/server/session";

// Admins only: a one-time signature for uploading a product image straight from the browser to
// Cloudinary (see src/components/admin/ProductForm.tsx). The image never passes through here.
export async function POST() {
  if (!(await getAdmin())) return Response.json({ error: "Not allowed" }, { status: 403 });
  try {
    return Response.json(signProductUpload());
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Image uploads aren't set up yet." }, { status: 500 });
  }
}
