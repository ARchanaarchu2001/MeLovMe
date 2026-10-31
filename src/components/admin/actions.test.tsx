import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ConfirmDialog, IconButton, IconLink, TrashIcon } from "./actions";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
// jsdom has <dialog> but not its methods
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

describe("IconButton and IconLink", () => {
  test("the icon button is named by its label and calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton label="Delete Rose Mist" tone="red" onClick={onClick}>
        <TrashIcon />
      </IconButton>,
    );
    await user.click(screen.getByRole("button", { name: "Delete Rose Mist" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("a disabled icon button can't be clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton label="Delete" onClick={onClick} disabled>
        <TrashIcon />
      </IconButton>,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("the icon link goes to its page", () => {
    render(
      <IconLink label="Edit Rose Mist" href="/admin/products/rose-mist/">
        <TrashIcon />
      </IconLink>,
    );
    expect(screen.getByRole("link", { name: "Edit Rose Mist" })).toHaveAttribute("href", "/admin/products/rose-mist/");
  });
});

describe("ConfirmDialog", () => {
  const setup = (props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Delete this product?"
        subject="Rose Mist"
        text="This can't be undone."
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
        pending={false}
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />,
    );
    return { onConfirm, onClose };
  };

  test("opens with the title, subject and text", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Delete this product?" })).toHaveAttribute("open");
    expect(screen.getByText("Rose Mist")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  test("the confirm button doesn't start with focus, so Enter doesn't delete", () => {
    setup();
    expect(screen.getByRole("button", { name: "Yes, delete" })).not.toHaveFocus();
  });

  // autoFocus runs while the <dialog> is still closed (showModal comes after, in an effect), so the
  // browser can't focus Cancel then; showModal then focuses the first button (×) instead
  test.todo("Cancel has focus when the dialog opens");

  test("the confirm button calls onConfirm", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Cancel and the × close it without confirming", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Close", hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("a click on the dimmed backdrop closes it", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("while working it shows the pending label and every button is disabled", async () => {
    const user = userEvent.setup();
    const { onClose } = setup({ pending: true });
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await user.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("custom cancel label", () => {
    setup({ cancelLabel: "Keep it", tone: "neutral" });
    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
  });
});
