import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import PendingButton from "./PendingButton";

afterEach(cleanup);

describe("PendingButton", () => {
  test("is a submit button showing its text", () => {
    render(<form><PendingButton>Save</PendingButton></form>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
  });

  test("stays disabled when disabled is passed", () => {
    render(<form><PendingButton disabled>Save</PendingButton></form>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("is disabled and busy while the form's action runs, then comes back", async () => {
    let finish!: () => void;
    const action = () => new Promise<void>((r) => (finish = r));
    const user = userEvent.setup();
    render(<form action={action}><PendingButton>Save</PendingButton></form>);
    const button = screen.getByRole("button", { name: "Save" });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await act(async () => finish());
    expect(button).toBeEnabled();
  });
});
