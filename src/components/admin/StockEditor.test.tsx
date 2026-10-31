import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setProductStock } from "@/app/actions/admin";
import StockEditor from "./StockEditor";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ setProductStock: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setProductStock).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const box = () => screen.getByRole("textbox", { name: "Rose Mist: units in stock" });

describe("StockEditor", () => {
  test("shows the saved count and its badge, with no Save button until it changes", () => {
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={12} />);
    expect(box()).toHaveValue("12");
    expect(screen.getByText("In stock · 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  test("a product without a count shows an empty box and Stock not set", () => {
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={null} />);
    expect(box()).toHaveValue("");
    expect(screen.getByText("Stock not set")).toBeInTheDocument();
  });

  test("only digits can be typed, up to 7 of them", async () => {
    const user = userEvent.setup();
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={null} />);
    await user.type(box(), "-1.5a2");
    expect(box()).toHaveValue("152");
    await user.clear(box());
    await user.type(box(), "123456789");
    expect(box()).toHaveValue("1234567");
  });

  test("Save appears once the count changes and goes away when it's changed back", async () => {
    const user = userEvent.setup();
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={12} />);
    await user.type(box(), "0");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    await user.type(box(), "{Backspace}");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  test("saving sends the new count and refreshes the list", async () => {
    const user = userEvent.setup();
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={12} />);
    await user.clear(box());
    await user.type(box(), "30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(setProductStock).toHaveBeenCalledWith("rose-mist", 30);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  test("Enter in the box saves too", async () => {
    const user = userEvent.setup();
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={12} />);
    await user.type(box(), "{Backspace}{Backspace}0{Enter}");
    expect(setProductStock).toHaveBeenCalledWith("rose-mist", 0);
  });

  test("an emptied box is sent as no number, and the server's message is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(setProductStock).mockResolvedValue({ error: "Enter whole units (0 if none)." });
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={12} />);
    await user.clear(box());
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(setProductStock).toHaveBeenCalledWith("rose-mist", NaN);
    expect(await screen.findByText("Enter whole units (0 if none).")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  test("Save is disabled while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(setProductStock).mockReturnValue(new Promise((r) => (finish = r)));
    render(<StockEditor slug="rose-mist" name="Rose Mist" stock={12} />);
    await user.type(box(), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});
