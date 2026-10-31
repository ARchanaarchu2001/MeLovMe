import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendContactMessage } from "@/app/actions/contact";
import { renderWithIntl } from "@/test/render";
import ContactForm from "./ContactForm";

vi.mock("@/app/actions/contact", () => ({ sendContactMessage: vi.fn() }));
beforeEach(() => vi.mocked(sendContactMessage).mockReset());
afterEach(cleanup);

const box = (name: string) => screen.getByRole("textbox", { name });
const send = () => screen.getByRole("button", { name: "Send Message" });

async function fillIn(user: ReturnType<typeof userEvent.setup>, { name = "Priya S", email = "priya@example.com", phone = "", message = "Do you ship to Kerala?" } = {}) {
  if (name) await user.type(box("Your name"), name);
  if (email) await user.type(box("Email address"), email);
  if (phone) await user.type(box("Phone (optional)"), phone);
  if (message) await user.type(box("How can we help?"), message);
}

describe("ContactForm", () => {
  test("an empty form shows what's missing and sends nothing", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await user.click(send());
    expect(screen.getAllByText("This field is required.")).toHaveLength(3);
    expect(box("Your name")).toHaveFocus();
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  test("a bad email, short name and short message each get their own message", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await fillIn(user, { name: "P", email: "priya@", message: "Hi" });
    await user.click(send());
    expect(screen.getByText("Please enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address, like name@example.com.")).toBeInTheDocument();
    expect(screen.getByText("Please write at least 10 characters.")).toBeInTheDocument();
  });

  test("the phone number keeps only digits, and a wrong one is caught", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await fillIn(user, { phone: "12-345" });
    expect(box("Phone (optional)")).toHaveValue("12345");
    await user.click(send());
    expect(screen.getByText("Enter a valid 10-digit mobile number.")).toBeInTheDocument();
    expect(box("Phone (optional)")).toHaveFocus();
  });

  test("editing a field clears its message", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await user.click(send());
    await user.type(box("Your name"), "P");
    expect(box("Your name")).toHaveAttribute("aria-invalid", "false");
  });

  test("a valid message is sent with the chosen topic, then the form clears and thanks them", async () => {
    vi.mocked(sendContactMessage).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await fillIn(user, { phone: "9876543210" });
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Corporate gifting" }));
    await user.click(send());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Thank you! Your message has been sent"));
    const data = vi.mocked(sendContactMessage).mock.calls[0][0];
    expect(Object.fromEntries(data)).toMatchObject({
      name: "Priya S",
      email: "priya@example.com",
      phone: "9876543210",
      topic: "Corporate gifting",
      message: "Do you ship to Kerala?",
    });
    expect(box("Your name")).toHaveValue("");
  });

  test("when sending fails it says so and gives the shop's email", async () => {
    vi.mocked(sendContactMessage).mockResolvedValue({ error: "failed" });
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await fillIn(user);
    await user.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent("Sorry, we couldn't send your message. Please try again, or email us at hello@melovme.com.");
    expect(box("Your name")).toHaveValue("Priya S");
  });

  test("a network error is treated as a failed send", async () => {
    // The call fails (e.g. offline). Returned as a bare "catch"-able object: a rejected Promise returned
    // from a vi.fn() is reported by Vitest as unhandled even though the form catches it.
    const offline = { catch: <T,>(handle: (e: unknown) => T) => Promise.resolve(handle(new Error("offline"))) };
    vi.mocked(sendContactMessage).mockReturnValue(offline as never);
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await fillIn(user);
    await user.click(send());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  test("problems found by the shop are shown under the fields", async () => {
    vi.mocked(sendContactMessage).mockResolvedValue({ error: "invalid", errors: { email: "invalidEmail" } });
    const user = userEvent.setup();
    renderWithIntl(<ContactForm />);
    await fillIn(user);
    await user.click(send());
    expect(await screen.findByText("Enter a valid email address, like name@example.com.")).toBeInTheDocument();
  });
});
