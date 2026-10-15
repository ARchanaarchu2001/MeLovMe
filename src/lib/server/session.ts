import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

const COOKIE = "melovme-session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Sessions are random tokens kept in MongoDB, so logging out really ends them
export async function createSession(userId: ObjectId) {
  const token = randomBytes(32).toString("hex");
  const { sessions } = await getDb();
  await sessions.insertOne({ token, userId, expiresAt: new Date(Date.now() + MAX_AGE * 1000) });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await (await getDb()).sessions.deleteOne({ token });
  store.delete(COOKIE);
}

// The logged-in user, or null for guests
export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { sessions, users } = await getDb();
  const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
  return session ? users.findOne({ _id: session.userId }) : null;
}

// For pages and actions that need a login: guests are sent to the login page,
// which brings them back to `returnTo` afterwards
export async function requireUser(returnTo: string) {
  const user = await getUser();
  if (!user) redirect(`/login/?next=${encodeURIComponent(returnTo)}`);
  return user;
}
