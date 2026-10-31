import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { savePaymentSettings } from "@/app/actions/admin";
import PaymentSettingsForm from "./PaymentSettingsForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ savePaymentSettings: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(savePaymentSettings).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const razorpay = () => screen.getByRole("switch", { name: /Online payment \(Razorpay\)/ });
const cod = () => screen.getByRole("switch", { name: /Cash on delivery/ });
const save = () => screen.getByRole("button", { name: "Save changes" });

describe("PaymentSettingsForm", () => {
  test("the switches start as saved", () => {
    render(<PaymentSettingsForm initial={{ razorpay: true, cod: false }} />);
    expect(razorpay()).toBeChecked();
    expect(cod()).not.toBeChecked();
  });

  test("saving sends both switches and says the shop is updated", async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsForm initial={{ razorpay: true, cod: false }} />);
    await user.click(cod());
    await user.click(save());
    expect(savePaymentSettings).toHaveBeenCalledWith({ razorpay: true, cod: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The shop is updated.");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("with both switched off it explains why and can't be saved", async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsForm initial={{ razorpay: true, cod: false }} />);
    await user.click(razorpay());
    expect(screen.getByRole("alert")).toHaveTextContent("Switch on at least one payment method");
    expect(save()).toBeDisabled();
    await user.click(cod());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(save()).toBeEnabled();
  });

  test("an error from the server is shown and nothing is marked saved", async () => {
    const user = userEvent.setup();
    vi.mocked(savePaymentSettings).mockResolvedValue({ error: "Keep at least one payment method switched on." });
    render(<PaymentSettingsForm initial={{ razorpay: true, cod: true }} />);
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Keep at least one payment method switched on.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  test("changing a switch after saving hides the Saved message", async () => {
    const user = userEvent.setup();
    render(<PaymentSettingsForm initial={{ razorpay: true, cod: false }} />);
    await user.click(save());
    await screen.findByRole("status");
    await user.click(cod());
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("shows Saving… and is disabled while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(savePaymentSettings).mockReturnValue(new Promise((r) => (finish = r)));
    render(<PaymentSettingsForm initial={{ razorpay: true, cod: false }} />);
    await user.click(save());
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(save()).toBeEnabled());
  });
});
