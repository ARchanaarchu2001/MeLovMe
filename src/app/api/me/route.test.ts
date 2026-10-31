// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session", () => ({ getAdmin: m.getAdmin }));

import { GET } from "./route";

afterEach(() => vi.clearAllMocks());

describe("GET /api/me", () => {
  test("tells an admin to show the Admin link", async () => {
    m.getAdmin.mockResolvedValue({ name: "Owner", superAdmin: true });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ admin: true });
  });

  test("tells guests and customers not to show it", async () => {
    m.getAdmin.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ admin: false });
  });

  test("the answer is never cached or shared between visitors", async () => {
    m.getAdmin.mockResolvedValue(null);
    expect((await GET()).headers.get("Cache-Control")).toBe("private, no-store");
  });
});
