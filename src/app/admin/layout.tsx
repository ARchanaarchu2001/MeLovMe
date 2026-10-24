import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false },
};

// The shop's back office, for users with superAdmin: true. It replaces the shop's header and
// footer with an admin sidebar. Each page and action checks access again, since a layout
// check alone doesn't protect data.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireAdmin();
  return <AdminShell name={me.name}>{children}</AdminShell>;
}
