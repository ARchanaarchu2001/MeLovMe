import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdminToast from "./AdminToast";

beforeEach(() => {
  // Only the timers the toast uses, so user-event and React keep working
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  window.history.replaceState(null, "", "/admin/products/?added=rose-mist");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminToast", () => {
  test("shows the title and message", () => {
    render(<AdminToast title="Product added" message="Rose Mist" />);
    expect(screen.getByRole("status")).toHaveTextContent("Product added");
    expect(screen.getByRole("status")).toHaveTextContent("Rose Mist");
  });

  test("tidies the URL straight away, so a reload doesn't show it again", () => {
    render(<AdminToast title="Product added" message="Rose Mist" />);
    expect(window.location.pathname).toBe("/admin/products/");
    expect(window.location.search).toBe("");
  });

  test("goes away by itself after 4 seconds", () => {
    render(<AdminToast title="Product added" message="Rose Mist" />);
    act(() => vi.advanceTimersByTime(3900));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("the × closes it straight away", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AdminToast title="Product added" message="Rose Mist" />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
