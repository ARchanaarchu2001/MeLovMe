import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { updateProfile } from "@/app/actions/auth";
import { renderWithIntl } from "@/test/render";
import ProfileForm from "./ProfileForm";

vi.mock("@/app/actions/auth", () => ({ updateProfile: vi.fn() }));
// AddressForm (whose field style the form uses) imports the checkout actions
vi.mock("@/app/actions/checkout", () => ({ saveAddress: vi.fn() }));
beforeEach(() => vi.mocked(updateProfile).mockReset());
afterEach(cleanup);

const show = (name = "Archana M") => renderWithIntl(<ProfileForm name={name} phone="9876543210" memberSince="Member since Jan 2026" />);

describe("ProfileForm", () => {
  test("shows the initials, name, phone and member-since date", () => {
    show();
    expect(screen.getByText("AM")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archana M" })).toBeInTheDocument();
    expect(screen.getByText(/\+91 9876543210/)).toBeInTheDocument();
    expect(screen.getByText("Member since Jan 2026")).toBeInTheDocument();
  });

  test("a one-word name gives one initial", () => {
    show("priya");
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  test("the pencil opens the name for editing; Save is off until it changes", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Archana M");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "enon");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("saving a new name updates the card and says Saved", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    const box = screen.getByRole("textbox", { name: "Name" });
    await user.clear(box);
    await user.type(box, "  Divya Raj ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateProfile).toHaveBeenCalledWith("  Divya Raj ");
    expect(await screen.findByRole("heading", { name: "Divya Raj" })).toBeInTheDocument();
    expect(screen.getByText("DR")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  test("a rejected name shows the shop's message and stays in editing", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ error: "Please enter your name." });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    const box = screen.getByRole("textbox", { name: "Name" });
    await user.clear(box);
    await user.type(box, "A");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Please enter your name.");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  test("Cancel puts the old name back", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "xyz");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Archana M" })).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test("Escape cancels editing too", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "xyz{Escape}");
    expect(screen.getByRole("heading", { name: "Archana M" })).toBeInTheDocument();
  });
});
