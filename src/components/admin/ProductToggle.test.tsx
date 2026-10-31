import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setProductFlag } from "@/app/actions/admin";
import ProductToggle from "./ProductToggle";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ setProductFlag: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setProductFlag).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("ProductToggle", () => {
  test("shows whether the product is enabled", () => {
    render(<ProductToggle slug="rose-mist" name="Rose Mist" flag="enabled" value />);
    const toggle = screen.getByRole("switch", { name: "Rose Mist: enabled" });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveTextContent("Enabled");
  });

  test("a disabled product shows Disabled", () => {
    render(<ProductToggle slug="rose-mist" name="Rose Mist" flag="enabled" value={false} />);
    expect(screen.getByRole("switch", { name: "Rose Mist: disabled" })).not.toBeChecked();
  });

  test("clicking switches it off, saves it and refreshes the list", async () => {
    const user = userEvent.setup();
    render(<ProductToggle slug="rose-mist" name="Rose Mist" flag="enabled" value />);
    await user.click(screen.getByRole("switch"));
    expect(setProductFlag).toHaveBeenCalledWith("rose-mist", "enabled", false);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(screen.getByRole("switch", { name: "Rose Mist: disabled" })).not.toBeChecked();
  });

  test("it can't be clicked again while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(setProductFlag).mockReturnValue(new Promise((r) => (finish = r)));
    render(<ProductToggle slug="rose-mist" name="Rose Mist" flag="enabled" value={false} />);
    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toBeDisabled();
    await user.click(screen.getByRole("switch"));
    expect(setProductFlag).toHaveBeenCalledOnce();
    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole("switch")).toBeEnabled());
    expect(screen.getByRole("switch", { name: "Rose Mist: enabled" })).toBeChecked();
  });
});
