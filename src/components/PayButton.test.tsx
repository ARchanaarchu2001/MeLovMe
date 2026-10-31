import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import PayButton, { SecurePaymentBadge } from "./PayButton";

afterEach(cleanup);

describe("PayButton", () => {
  test("clicking it calls onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<PayButton onClick={onClick}>Checkout</PayButton>);
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("with online payment on it says Secured by Razorpay", () => {
    renderWithIntl(<PayButton>Checkout</PayButton>);
    expect(screen.getByRole("button")).toHaveTextContent(/Razorpay/);
  });

  test("without online payment, or compact, there's no Razorpay note", () => {
    const { rerender } = renderWithIntl(<PayButton razorpay={false}>Checkout</PayButton>);
    expect(screen.getByRole("button")).not.toHaveTextContent(/Razorpay/);
    rerender(<PayButton compact>Buy Now</PayButton>);
    expect(screen.getByRole("button")).not.toHaveTextContent(/Razorpay/);
  });

  test("a tag is shown on the button", () => {
    renderWithIntl(<PayButton tag="Limited Offer">Checkout</PayButton>);
    expect(screen.getByText("Limited Offer")).toBeInTheDocument();
  });

  test("a disabled button can't be clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<PayButton disabled onClick={onClick}>Checkout</PayButton>);
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("SecurePaymentBadge", () => {
  test("shows the secure payment reassurance", () => {
    const { container } = renderWithIntl(<SecurePaymentBadge />);
    expect(container.textContent).not.toBe("");
  });
});
