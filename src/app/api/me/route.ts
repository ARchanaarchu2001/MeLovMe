import { getAdmin } from "@/lib/server/session";

// Tells the shop header whether to show the Admin link. Asked from the browser, so the shop
// pages themselves stay cached for everyone. Access to /admin is still checked on every page.
export async function GET() {
  const admin = !!(await getAdmin());
  return Response.json({ admin }, { headers: { "Cache-Control": "private, no-store" } });
}
