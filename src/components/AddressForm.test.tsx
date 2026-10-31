import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { saveAddress } from "@/app/actions/checkout";
import { renderWithIntl } from "@/test/render";
import AddressForm from "./AddressForm";

vi.mock("@/app/actions/checkout", () => ({ saveAddress: vi.fn() }));
beforeEach(() => vi.mocked(saveAddress).mockReset());
afterEach(cleanup);

const valid = { name: "Priya S", phone: "9876543210", address: "12 Lake Road", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
const box = (label: string) => screen.getByRole("textbox", { name: label });

async function fillIn(user: ReturnType<typeof userEvent.setup>, values: Partial<typeof valid>) {
  const labels: Record<keyof typeof valid, string> = {
    name: "Full name",
    phone: "Mobile number (10 digits)",
    address: "House no., street, area, landmark",
    city: "City",
    state: "State",
    pincode: "PIN code",
  };
  for (const [f, v] of Object.entries(values)) await user.type(box(labels[f as keyof typeof valid]), v);
}

describe("AddressForm", () => {
  test("fills in the given defaults", () => {
    renderWithIntl(<AddressForm defaults={{ name: "Priya S", phone: "9876543210" }} onSaved={vi.fn()} />);
    expect(box("Full name")).toHaveValue("Priya S");
    expect(box("Mobile number (10 digits)")).toHaveValue("9876543210");
  });

  test("an empty form shows every problem at once and saves nothing", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AddressForm defaults={{}} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    expect(screen.getAllByText("This field is required.")).toHaveLength(6);
    expect(box("Full name")).toHaveAttribute("aria-invalid", "true");
    expect(box("Full name")).toHaveFocus();
    expect(saveAddress).not.toHaveBeenCalled();
  });

  test("a wrong mobile number and PIN code get their own messages", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AddressForm defaults={{}} onSaved={vi.fn()} />);
    await fillIn(user, { ...valid, phone: "12345", pincode: "012345" });
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    expect(screen.getByText("Enter a valid 10-digit mobile number.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid 6-digit PIN code.")).toBeInTheDocument();
    expect(box("Mobile number (10 digits)")).toHaveFocus();
  });

  test("editing a field clears its message", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AddressForm defaults={{}} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    await user.type(box("City"), "C");
    expect(box("City")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getAllByText("This field is required.")).toHaveLength(5);
  });

  test("a valid address is saved (trimmed) and passed on", async () => {
    const saved = { ...valid, id: "a1" };
    vi.mocked(saveAddress).mockResolvedValue(saved);
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<AddressForm defaults={{}} onSaved={onSaved} />);
    await fillIn(user, { ...valid, city: "  Chennai " });
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    expect(saveAddress).toHaveBeenCalledWith(valid, undefined);
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  test("editing an address saves it under its id", async () => {
    vi.mocked(saveAddress).mockResolvedValue({ ...valid, id: "a1" });
    const user = userEvent.setup();
    renderWithIntl(<AddressForm defaults={valid} editId="a1" onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    expect(saveAddress).toHaveBeenCalledWith(valid, "a1");
  });

  test("a problem found by the shop is shown under the field", async () => {
    vi.mocked(saveAddress).mockResolvedValue({ errors: { address: "You can save up to 10 addresses." } });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<AddressForm defaults={valid} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    expect(await screen.findByText("You can save up to 10 addresses.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("Cancel is offered only when there's somewhere to go back to", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderWithIntl(<AddressForm defaults={{}} onSaved={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    rerender(<AddressForm defaults={{}} onSaved={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
