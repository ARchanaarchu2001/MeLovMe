import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import QtyStepper from "./QtyStepper";

afterEach(cleanup);

function Stepper({ start = 1, min, max }: { start?: number; min?: number; max?: number }) {
  const [qty, setQty] = useState(start);
  return <QtyStepper qty={qty} onChange={setQty} min={min} max={max} />;
}

describe("QtyStepper", () => {
  test("plus and minus change the quantity shown", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Stepper start={2} />);
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByText("3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("minus is disabled at the minimum of 1", () => {
    renderWithIntl(<Stepper start={1} />);
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });

  test("plus is disabled at the cart limit of 10", () => {
    renderWithIntl(<Stepper start={10} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  test("with only 3 in stock, plus stops at 3", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Stepper start={2} max={3} />);
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    await user.click(plus);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(plus).toBeDisabled();
  });

  test("with a minimum of 0 the quantity can go down to 0", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<QtyStepper qty={1} min={0} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
