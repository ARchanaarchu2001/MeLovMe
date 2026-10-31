import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import Select from "./Select";

afterEach(cleanup);

const topics = ["General enquiry", "Product question", "Wholesale / retail"];

function show(defaultValue?: string) {
  const { container } = render(
    <form>
      <Select name="topic" options={topics} defaultValue={defaultValue} />
      <button type="button">Elsewhere</button>
    </form>,
  );
  const form = container.querySelector("form")!;
  return { value: () => new FormData(form).get("topic") };
}

const box = () => screen.getByRole("combobox");

describe("Select", () => {
  test("starts on the first option, which is what the form sends", () => {
    const { value } = show();
    expect(box()).toHaveTextContent("General enquiry");
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(value()).toBe("General enquiry");
  });

  test("can start on another option", () => {
    const { value } = show("Product question");
    expect(value()).toBe("Product question");
  });

  test("clicking opens it; choosing an option closes it and sends that value", async () => {
    const user = userEvent.setup();
    const { value } = show();
    await user.click(box());
    expect(box()).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("option", { name: "Wholesale / retail" }));
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(box()).toHaveTextContent("Wholesale / retail");
    expect(screen.getByRole("option", { name: "Wholesale / retail" })).toHaveAttribute("aria-selected", "true");
    expect(value()).toBe("Wholesale / retail");
  });

  test("works with the keyboard: arrows move, Enter picks", async () => {
    const user = userEvent.setup();
    const { value } = show();
    box().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    expect(value()).toBe("Wholesale / retail");
  });

  test("arrow up from the first option wraps to the last", async () => {
    const user = userEvent.setup();
    const { value } = show();
    box().focus();
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(value()).toBe("Wholesale / retail");
  });

  test("Escape closes it without changing the choice", async () => {
    const user = userEvent.setup();
    const { value } = show();
    await user.click(box());
    await user.keyboard("{ArrowDown}{Escape}");
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(value()).toBe("General enquiry");
  });

  test("clicking outside closes it", async () => {
    const user = userEvent.setup();
    show();
    await user.click(box());
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(box()).toHaveAttribute("aria-expanded", "false");
  });
});
