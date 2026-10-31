import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteProduct } from "@/app/actions/admin";
import ProductActions from "./ProductActions";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ deleteProduct: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src }: { src: string }) => <img src={src} alt="" /> }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("ProductActions", () => {
  test("the edit icon links to the product's edit page", () => {
    render(<ProductActions slug="rose-mist" name="Rose Mist" />);
    expect(screen.getByRole("link", { name: "Edit Rose Mist" })).toHaveAttribute("href", "/admin/products/rose-mist/");
  });

  test("delete asks first and doesn't delete until confirmed", async () => {
    const user = userEvent.setup();
    render(<ProductActions slug="rose-mist" name="Rose Mist" />);
    await user.click(screen.getByRole("button", { name: "Delete Rose Mist" }));
    expect(screen.getByRole("dialog", { name: "Delete this product?" })).toHaveTextContent("Rose Mist");
    expect(deleteProduct).not.toHaveBeenCalled();
  });

  test("Cancel closes the question and keeps the product", async () => {
    const user = userEvent.setup();
    render(<ProductActions slug="rose-mist" name="Rose Mist" />);
    await user.click(screen.getByRole("button", { name: "Delete Rose Mist" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteProduct).not.toHaveBeenCalled();
  });

  test("confirming deletes the product, shows Deleting… meanwhile, then refreshes the list", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(deleteProduct).mockReturnValue(new Promise((r) => (finish = r)));
    render(<ProductActions slug="rose-mist" name="Rose Mist" />);
    await user.click(screen.getByRole("button", { name: "Delete Rose Mist" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(deleteProduct).toHaveBeenCalledWith("rose-mist");
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Rose Mist", hidden: true })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.refresh).toHaveBeenCalled();
  });

  test("the question shows the product photo", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProductActions slug="rose-mist" name="Rose Mist" image="/images/rose.jpg" />);
    await user.click(screen.getByRole("button", { name: "Delete Rose Mist" }));
    expect(container.ownerDocument.querySelector('dialog img[src="/images/rose.jpg"]')).not.toBeNull();
  });
});
