import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { saveAnnouncement } from "@/app/actions/admin";
import type { Announcement } from "@/lib/announcement";
import AnnouncementForm from "./AnnouncementForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ saveAnnouncement: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveAnnouncement).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const bar: Announcement = {
  enabled: true,
  messages: [{ text: "Free shipping above ₹999" }, { text: "Summer sale", link: "/products/" }],
  background: "#2e1a11",
  textColor: "#c9a36a",
  speed: "normal",
};
const form = (a: Partial<Announcement> = {}) => render(<AnnouncementForm initial={{ ...bar, ...a }} />);
const message = (n: number) => screen.getByRole("textbox", { name: `Message ${n}` });
const link = (n: number) => screen.getByRole("textbox", { name: `Link for message ${n}` });
const save = () => screen.getByRole("button", { name: "Save changes" });
const sent = () => vi.mocked(saveAnnouncement).mock.calls.at(-1)![0];

describe("AnnouncementForm", () => {
  test("the saved messages, links, colours and speed are filled in", () => {
    form();
    expect(message(1)).toHaveValue("Free shipping above ₹999");
    expect(message(2)).toHaveValue("Summer sale");
    expect(link(2)).toHaveValue("/products/");
    expect(screen.getByRole("checkbox", { name: /Show in shop/ })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Background colour code" })).toHaveValue("#2e1a11");
    expect(screen.getByRole("textbox", { name: "Text colour code" })).toHaveValue("#c9a36a");
    expect(screen.getByRole("button", { name: "Use Espresso & gold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "normal" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the preview shows the messages as typed", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(message(1));
    await user.type(message(1), "Flat 30% off");
    expect(screen.getAllByText("Flat 30% off").length).toBeGreaterThan(0);
  });

  test("with no messages there's one empty row and the preview asks for a message", () => {
    form({ messages: [] });
    expect(message(1)).toHaveValue("");
    expect(screen.getByText("Add a message to see the preview.")).toBeInTheDocument();
  });

  test("a switched-off bar says customers won't see it", () => {
    form({ enabled: false });
    expect(screen.getByText("The bar is switched off: customers won't see it.")).toBeInTheDocument();
  });

  test("saving sends the bar and says the shop is updated", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "fast" }));
    await user.click(save());
    expect(sent()).toEqual({ ...bar, speed: "fast" });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The shop is updated.");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("a switched-on bar needs at least one message", async () => {
    const user = userEvent.setup();
    form({ messages: [{ text: "  " }] });
    await user.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one message, or switch the bar off.");
    expect(saveAnnouncement).not.toHaveBeenCalled();
  });

  test("a switched-off bar can be saved without messages", async () => {
    const user = userEvent.setup();
    form({ enabled: false, messages: [] });
    await user.click(save());
    expect(saveAnnouncement).toHaveBeenCalled();
  });

  test("a link without a message is refused on its row", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(message(2));
    await user.click(save());
    expect(screen.getByText("Enter the message for this link, or remove the row.")).toBeInTheDocument();
    expect(message(2)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
    expect(saveAnnouncement).not.toHaveBeenCalled();
  });

  test("a link must be a shop page or https://", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(link(2));
    await user.type(link(2), "www.example.com");
    await user.click(save());
    expect(screen.getByText("Start with / (a shop page) or https://")).toBeInTheDocument();
    expect(link(2)).toHaveAttribute("aria-invalid", "true");
  });

  test("editing a row clears its message", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(message(2));
    await user.click(save());
    await user.type(message(2), "Sale");
    expect(screen.queryByText("Enter the message for this link, or remove the row.")).toBeNull();
  });

  test("text the same colour as the background is refused", async () => {
    const user = userEvent.setup();
    form();
    const text = screen.getByRole("textbox", { name: "Text colour code" });
    await user.clear(text);
    await user.type(text, "2E1A11");
    await user.click(save());
    expect(screen.getByText("The text must be a different colour from the background.")).toBeInTheDocument();
    expect(saveAnnouncement).not.toHaveBeenCalled();
  });

  test("a colour code typed without # is used once it's complete", async () => {
    const user = userEvent.setup();
    form();
    const background = screen.getByRole("textbox", { name: "Background colour code" });
    await user.clear(background);
    await user.type(background, "462B1B");
    await user.click(save());
    expect(sent().background).toBe("#462b1b");
  });

  test("a colour theme sets both colours, and Reset goes back to the brand colours", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "Use Charcoal & white" }));
    expect(screen.getByRole("textbox", { name: "Background colour code" })).toHaveValue("#2b2b2b");
    expect(screen.getByRole("textbox", { name: "Text colour code" })).toHaveValue("#ffffff");
    expect(screen.getByRole("button", { name: "Use Charcoal & white" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Reset to brand colours" }));
    expect(screen.getByRole("textbox", { name: "Background colour code" })).toHaveValue("#2e1a11");
  });

  test("messages can be added and removed", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "+ Add message" }));
    await user.type(message(3), "New in: lip balm");
    await user.click(screen.getByRole("button", { name: "Remove message 1" }));
    await user.click(save());
    expect(sent().messages.map((m) => m.text)).toEqual(["Summer sale", "New in: lip balm"]);
  });

  test("Add message is gone at 10 messages", () => {
    form({ messages: Array.from({ length: 10 }, (_, i) => ({ text: `Message ${i}` })) });
    expect(screen.queryByRole("button", { name: "+ Add message" })).toBeNull();
  });

  test("the arrow keys on a row's handle move it", async () => {
    const user = userEvent.setup();
    form();
    screen.getByRole("button", { name: /^Message 1: drag/ }).focus();
    await user.keyboard("{ArrowDown}");
    expect(message(1)).toHaveValue("Summer sale");
    expect(message(2)).toHaveValue("Free shipping above ₹999");
    await user.click(save());
    expect(sent().messages.map((m) => m.text)).toEqual(["Summer sale", "Free shipping above ₹999"]);
  });

  test("the first row can't move up", async () => {
    const user = userEvent.setup();
    form();
    screen.getByRole("button", { name: /^Message 1: drag/ }).focus();
    await user.keyboard("{ArrowUp}");
    expect(message(1)).toHaveValue("Free shipping above ₹999");
  });

  test("the server's messages are shown", async () => {
    const user = userEvent.setup();
    vi.mocked(saveAnnouncement).mockResolvedValue({ errors: { form: "Up to 10 messages." } });
    form();
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Up to 10 messages.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(saveAnnouncement).mockReturnValue(new Promise((r) => (finish = r)));
    form();
    await user.click(save());
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(save()).toBeEnabled());
  });

  // After a failed Save, fixing the fields leaves "Please fix the highlighted fields." up until the next
  // Save: cleared errors are set to undefined, but hasAnnouncementErrors counts keys
  test.todo("the error banner goes away once the highlighted field is fixed");
});
