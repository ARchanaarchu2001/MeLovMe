import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import AdminShell from "./AdminShell";

const nav = vi.hoisted(() => ({ pathname: "/admin/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/app/actions/auth", () => ({ logout: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
afterEach(cleanup);

function shell(pathname: string, name = "Archana") {
  nav.pathname = pathname;
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminShell name={name}>
        <p>Page content</p>
      </AdminShell>
    </NextIntlClientProvider>,
  );
}
// The sidebar is drawn twice (desktop, and the phone menu); the first is the desktop one
const sidebar = () => screen.getAllByRole("navigation", { name: "Admin", hidden: true })[0];

describe("AdminShell", () => {
  test("shows the page with the current section as its title", () => {
    shell("/admin/orders/ML-1001/");
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Orders");
  });

  test("marks the current section in the menu, including its sub-pages", () => {
    shell("/admin/products/rose-mist/");
    expect(within(sidebar()).getByRole("link", { name: "Products", hidden: true })).toHaveAttribute("aria-current", "page");
    expect(within(sidebar()).getByRole("link", { name: "Orders", hidden: true })).not.toHaveAttribute("aria-current");
  });

  test("Dashboard is only current on the dashboard itself", () => {
    shell("/admin");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
    expect(within(sidebar()).getByRole("link", { name: "Dashboard", hidden: true })).toHaveAttribute("aria-current", "page");
  });

  test("an unknown admin page is titled Admin", () => {
    shell("/admin/settings/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Admin");
  });

  test("the menu links every admin section", () => {
    shell("/admin/");
    const names = within(sidebar()).getAllByRole("link", { hidden: true }).map((a) => a.textContent);
    expect(names).toEqual([
      "Dashboard",
      "Orders",
      "Customers",
      "Products",
      "Categories",
      "Reviews",
      "Testimonials",
      "Payments",
      "Home banner",
      "Announcement bar",
    ]);
  });

  test("shows who is signed in, with their initial", () => {
    shell("/admin/", "archana");
    expect(screen.getByTitle("Signed in as archana")).toHaveTextContent("a");
    expect(screen.getAllByText(/Signed in as archana/).length).toBeGreaterThan(0);
  });

  test("has a log out button and a link back to the shop", () => {
    shell("/admin/");
    expect(within(sidebar().parentElement!).getByRole("button", { name: "Log out", hidden: true })).toHaveAttribute("type", "submit");
    expect(within(sidebar().parentElement!).getByRole("link", { name: "View shop", hidden: true })).toHaveAttribute("href", "/");
  });

  test("the phone menu opens from the menu button and closes with Escape", async () => {
    const user = userEvent.setup();
    shell("/admin/");
    const button = screen.getByRole("button", { name: "Open menu" });
    const menu = document.getElementById("admin-menu")!.parentElement!;
    expect(menu).toHaveAttribute("aria-hidden", "true");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(menu).toHaveAttribute("aria-hidden", "false");
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("choosing a page in the phone menu closes it", async () => {
    const user = userEvent.setup();
    shell("/admin/");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const phoneMenu = document.getElementById("admin-menu")!;
    await user.click(within(phoneMenu).getByRole("link", { name: "Orders" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
