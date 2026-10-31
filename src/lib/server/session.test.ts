// @vitest-environment node
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { afterLoginPath, createSession, deleteSession, getAdmin, getUser, requireAdmin, requireUser } from "./session";

const { jar, db, nav } = vi.hoisted(() => {
  // A fake cookie jar, like the one next/headers gives a request
  const values = new Map<string, string>();
  const jar = {
    values,
    get: vi.fn((name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined)),
    set: vi.fn<(name: string, value: string, options?: object) => void>((name, value) => void values.set(name, value)),
    delete: vi.fn((name: string) => void values.delete(name)),
  };
  // Fake collections: sessions and users kept in arrays, with just enough query support
  const store = { sessions: [] as Record<string, unknown>[], users: [] as Record<string, unknown>[] };
  const db = {
    store,
    sessions: {
      insertOne: vi.fn(async (doc: Record<string, unknown>) => void store.sessions.push(doc)),
      deleteOne: vi.fn(async ({ token }: { token: string }) => {
        store.sessions = store.sessions.filter((s) => s.token !== token);
      }),
      findOne: vi.fn(async ({ token, expiresAt }: { token: string; expiresAt: { $gt: Date } }) =>
        store.sessions.find((s) => s.token === token && (s.expiresAt as Date) > expiresAt.$gt) ?? null,
      ),
    },
    users: {
      findOne: vi.fn(async ({ _id }: { _id: { equals(o: unknown): boolean } }) => store.users.find((u) => _id.equals(u._id)) ?? null),
    },
  };
  // Like Next.js, redirect() and notFound() stop the page by throwing
  const nav = {
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("NOT_FOUND");
    }),
  };
  return { jar, db, nav };
});

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("next/navigation", () => nav);
vi.mock("./db", () => ({ getDb: async () => db }));

const NOW = Date.parse("2026-06-15T12:00:00+05:30");
const DAY = 24 * 60 * 60 * 1000;
const anjali = { _id: new ObjectId("665f1c2e9b1d8a3f4c2e7a10"), phone: "9876543210", name: "Anjali", superAdmin: false };
const admin = { _id: new ObjectId("665f1c2e9b1d8a3f4c2e7a20"), phone: "9123456780", name: "Shop", superAdmin: true };

const loggedInAs = (user: typeof anjali, expiresAt = new Date(NOW + DAY)) => {
  db.store.users.push(user);
  db.store.sessions.push({ token: "tok", userId: user._id, expiresAt });
  jar.values.set("melovme-session", "tok");
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  jar.values.clear();
  db.store.sessions = [];
  db.store.users = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("createSession", () => {
  test("saves a random 64-character token for the user, valid for 30 days", async () => {
    await createSession(anjali._id);
    const [saved] = db.store.sessions;
    expect(saved.token).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.userId).toBe(anjali._id);
    expect(saved.expiresAt).toEqual(new Date(NOW + 30 * DAY)); // 15 July 2026
  });

  test("gives the browser the same token in a login cookie that JavaScript can't read", async () => {
    await createSession(anjali._id);
    const token = db.store.sessions[0].token;
    expect(jar.set).toHaveBeenCalledWith("melovme-session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 2,592,000 seconds
    });
  });

  test("the cookie is HTTPS-only on the live site", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession(anjali._id);
    expect(jar.set.mock.calls[0][2]).toMatchObject({ secure: true });
  });

  test("each login gets a different token", async () => {
    await createSession(anjali._id);
    await createSession(anjali._id);
    expect(db.store.sessions[0].token).not.toBe(db.store.sessions[1].token);
  });
});

describe("deleteSession", () => {
  test("ends the session in the database and removes the cookie", async () => {
    loggedInAs(anjali);
    await deleteSession();
    expect(db.sessions.deleteOne).toHaveBeenCalledWith({ token: "tok" });
    expect(db.store.sessions).toEqual([]);
    expect(jar.values.has("melovme-session")).toBe(false);
  });

  test("a guest logging out doesn't touch the database", async () => {
    await deleteSession();
    expect(db.sessions.deleteOne).not.toHaveBeenCalled();
    expect(jar.delete).toHaveBeenCalledWith("melovme-session");
  });
});

describe("getUser", () => {
  test("a guest without a login cookie is nobody", async () => {
    expect(await getUser()).toBeNull();
    expect(db.sessions.findOne).not.toHaveBeenCalled();
  });

  test("finds the user from the session in their cookie", async () => {
    loggedInAs(anjali);
    expect(await getUser()).toEqual(anjali);
  });

  test("only looks for sessions that haven't expired yet", async () => {
    loggedInAs(anjali);
    await getUser();
    expect(db.sessions.findOne).toHaveBeenCalledWith({ token: "tok", expiresAt: { $gt: new Date(NOW) } });
  });

  test("an expired session is logged out", async () => {
    loggedInAs(anjali, new Date(NOW - 1000));
    expect(await getUser()).toBeNull();
  });

  test("a token that isn't in the database (e.g. logged out elsewhere) is nobody", async () => {
    jar.values.set("melovme-session", "made-up");
    expect(await getUser()).toBeNull();
  });
});

describe("requireUser", () => {
  test("returns the logged-in user", async () => {
    loggedInAs(anjali);
    expect(await requireUser("/orders/")).toEqual(anjali);
  });

  test("sends guests to the login page, which brings them back afterwards", async () => {
    await expect(requireUser("/checkout/?step=2")).rejects.toThrow("REDIRECT /login/?next=%2Fcheckout%2F%3Fstep%3D2");
  });
});

describe("getAdmin", () => {
  test("is the user when they are a super admin", async () => {
    loggedInAs(admin);
    expect(await getAdmin()).toEqual(admin);
  });

  test("is null for customers and guests", async () => {
    expect(await getAdmin()).toBeNull();
    loggedInAs(anjali);
    expect(await getAdmin()).toBeNull();
  });

  test("only superAdmin: true counts, not other truthy values", async () => {
    loggedInAs({ ...anjali, superAdmin: "yes" as unknown as boolean });
    expect(await getAdmin()).toBeNull();
  });
});

describe("requireAdmin", () => {
  test("returns an admin", async () => {
    loggedInAs(admin);
    expect(await requireAdmin()).toEqual(admin);
  });

  test("sends guests to the login page, back to the admin dashboard by default", async () => {
    await expect(requireAdmin()).rejects.toThrow("REDIRECT /login/?next=%2Fadmin%2F");
  });

  test("logged-in customers get a 404, so the admin area isn't advertised", async () => {
    loggedInAs(anjali);
    await expect(requireAdmin("/admin/orders/")).rejects.toThrow("NOT_FOUND");
  });
});

describe("afterLoginPath", () => {
  test("customers go back where they came from", () => {
    expect(afterLoginPath({ superAdmin: false }, "/orders/")).toBe("/orders/");
    expect(afterLoginPath({}, "/products/")).toBe("/products/");
  });

  test("admins land on the admin dashboard", () => {
    expect(afterLoginPath({ superAdmin: true }, "/orders/")).toBe("/admin/");
  });

  test("admins who were checking out go back to checkout, so test purchases still work", () => {
    expect(afterLoginPath({ superAdmin: true }, "/checkout/")).toBe("/checkout/");
  });
});
