// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendContactMessage } from "./contact";

const valid = {
  name: "Anjali",
  email: "anjali@example.com",
  phone: "9876543210",
  topic: "General enquiry",
  message: "Do you ship to Kochi?",
};
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("EMAILJS_SERVICE_ID", "service_1");
  vi.stubEnv("EMAILJS_TEMPLATE_ID", "template_1");
  vi.stubEnv("EMAILJS_PUBLIC_KEY", "public_1");
  vi.stubEnv("EMAILJS_PRIVATE_KEY", "private_1");
  // EmailJS is faked: nothing is really sent
  fetchMock = vi.fn(async () => new Response("OK", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("sendContactMessage", () => {
  test("a bot that fills the hidden field gets a fake success and nothing is sent", async () => {
    expect(await sendContactMessage(form({ ...valid, website: "http://spam.example" }))).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an invalid message returns the errors and nothing is sent", async () => {
    const res = await sendContactMessage(form({ ...valid, email: "anjali@", message: "" }));
    expect(res).toEqual({ error: "invalid", errors: { email: "invalidEmail", message: "required" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an empty form is invalid", async () => {
    const res = await sendContactMessage(new FormData());
    expect(res).toMatchObject({ error: "invalid", errors: { name: "required", email: "required", message: "required" } });
  });

  test("without the EmailJS keys it says it isn't set up", async () => {
    vi.stubEnv("EMAILJS_PRIVATE_KEY", "");
    expect(await sendContactMessage(form(valid))).toEqual({ error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a valid message is sent to EmailJS with the server's keys", async () => {
    expect(await sendContactMessage(form(valid))).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.emailjs.com/api/v1.0/email/send");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(sentBody()).toEqual({
      service_id: "service_1",
      template_id: "template_1",
      user_id: "public_1",
      accessToken: "private_1",
      template_params: { ...valid, reply_to: "anjali@example.com" },
    });
  });

  test("fields are trimmed and a missing phone is shown as a dash", async () => {
    await sendContactMessage(form({ ...valid, name: "  Anjali  ", phone: "" }));
    expect(sentBody().template_params).toMatchObject({ name: "Anjali", phone: "-" });
  });

  test("fields the form doesn't have are not passed on", async () => {
    await sendContactMessage(form({ ...valid, admin: "yes" }));
    expect(sentBody().template_params).not.toHaveProperty("admin");
  });

  test("an EmailJS error reports a failure", async () => {
    fetchMock.mockResolvedValue(new Response("Bad request", { status: 400 }));
    expect(await sendContactMessage(form(valid))).toEqual({ error: "failed" });
  });

  test("a network error reports a failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await sendContactMessage(form(valid))).toEqual({ error: "failed" });
  });
});
