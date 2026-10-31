import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { makeProduct, mockDialog, renderWithIntl } from "@/test/render";
import RemoveItemDialog from "./RemoveItemDialog";

beforeAll(mockDialog);
afterEach(cleanup);

function setup() {
  const props = { onMoveToWishlist: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() };
  renderWithIntl(<RemoveItemDialog product={makeProduct()} {...props} />);
  return props;
}

describe("RemoveItemDialog", () => {
  test("opens asking whether to remove the product", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Remove item?" })).toBeInTheDocument();
    expect(screen.getByText("Body Lotion")).toBeInTheDocument();
  });

  test("Move to Wishlist calls onMoveToWishlist", async () => {
    const user = userEvent.setup();
    const { onMoveToWishlist, onRemove } = setup();
    await user.click(screen.getByRole("button", { name: "Move to Wishlist" }));
    expect(onMoveToWishlist).toHaveBeenCalledOnce();
    expect(onRemove).not.toHaveBeenCalled();
  });

  test("Remove calls onRemove", async () => {
    const user = userEvent.setup();
    const { onRemove } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  test("the close button closes it without removing anything", async () => {
    const user = userEvent.setup();
    const { onClose, onRemove, onMoveToWishlist } = setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onMoveToWishlist).not.toHaveBeenCalled();
  });
});
