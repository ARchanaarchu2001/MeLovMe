import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import OtpInput from "./OtpInput";

afterEach(cleanup);

function Code({ start = "", disabled }: { start?: string; disabled?: boolean }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <OtpInput value={value} onChange={setValue} disabled={disabled} />
      <output>{value}</output>
    </>
  );
}

const box = (n: number) => screen.getByRole("textbox", { name: `Digit ${n}` });
const code = () => screen.getByRole("status").textContent;

describe("OtpInput", () => {
  test("shows six boxes, with the first one focused", () => {
    renderWithIntl(<Code />);
    expect(screen.getByRole("group", { name: "One-time password" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(box(1)).toHaveFocus();
  });

  test("typing fills the boxes left to right", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Code />);
    await user.keyboard("123");
    expect(code()).toBe("123");
    expect(box(3)).toHaveValue("3");
    expect(box(4)).toHaveFocus();
  });

  test("letters are ignored", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Code />);
    await user.keyboard("1a2");
    expect(code()).toBe("12");
  });

  test("Backspace clears the last digit and moves back", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Code />);
    await user.keyboard("123{Backspace}");
    expect(code()).toBe("12");
    expect(box(3)).toHaveFocus();
  });

  test("pasting a code fills every box, ignoring spaces and dashes", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Code />);
    await user.paste("12-34 56");
    expect(code()).toBe("123456");
    expect(box(6)).toHaveValue("6");
  });

  test("the phone's SMS autofill putting the whole code in one box fills them all", () => {
    renderWithIntl(<Code />);
    fireEvent.change(box(1), { target: { value: "654321" } });
    expect(code()).toBe("654321");
  });

  test("clicking a box past the end goes to the first empty box", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Code start="12" />);
    await user.click(box(5));
    expect(box(3)).toHaveFocus();
  });

  test("typing past the last box replaces its digit, so the code stays six digits", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Code />);
    await user.keyboard("12345678");
    expect(code()).toBe("123458");
  });

  test("disabled boxes can't be typed in", () => {
    renderWithIntl(<Code disabled />);
    screen.getAllByRole("textbox").forEach((b) => expect(b).toBeDisabled());
  });
});
