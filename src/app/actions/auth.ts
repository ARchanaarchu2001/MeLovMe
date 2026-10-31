"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { firebaseEnabled } from "@/lib/firebase-config";
import { getDb } from "@/lib/server/db";
import { verifyPhoneToken } from "@/lib/server/firebase";
import { afterLoginPath, createSession, deleteSession, requireUser } from "@/lib/server/session";

// In production (and whenever Firebase is configured) the SMS OTP is sent and checked
// by Firebase in the browser. Without Firebase, in development only, we generate the
// OTP here and print it in the terminal so login can be tested.
const devOtpAllowed = () => !firebaseEnabled && process.env.NODE_ENV !== "production";

const OTP_TTL = 10 * 60 * 1000; // 10 minutes
const RESEND_AFTER = 30 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}`).digest();

const validPhone = (phone: unknown): phone is string => typeof phone === "string" && /^[6-9]\d{9}$/.test(phone);

// Only allow returning to a page on this site (never "//evil.com"). Browsers read "\" as "/" and drop
// tabs and line breaks, so "/\evil.com" and "/<tab>/evil.com" also go off-site: refuse both.
const safeNext = (next: unknown) =>
  typeof next === "string" && /^\/(?![/\\])[^\s\\]*$/.test(next) ? next : "/profile/";

export async function devSendOtp(phone: string): Promise<{ error: string } | { ok: true }> {
  const t = await getTranslations("auth.errors");
  if (!devOtpAllowed()) return { error: t("notConfigured") };
  if (!validPhone(phone)) return { error: t("invalidPhone") };
  const { otps } = await getDb();

  const pending = await otps.findOne({ phone });
  if (pending && Date.now() - pending.sentAt.getTime() < RESEND_AFTER) {
    return { error: t("resendWait") };
  }

  const code = String(randomInt(100000, 1000000));
  await otps.updateOne(
    { phone },
    {
      $set: {
        codeHash: hashOtp(phone, code).toString("hex"),
        attempts: 0,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + OTP_TTL),
      },
    },
    { upsert: true },
  );
  console.log(`\n[dev] OTP for ${phone}: ${code}  (set up Firebase to send real SMS)\n`);
  return { ok: true };
}

async function checkDevOtp(phone: string, code: string) {
  const t = await getTranslations("auth.errors");
  if (!validPhone(phone) || !/^\d{6}$/.test(code)) return t("enterOtp");
  const { otps } = await getDb();
  const pending = await otps.findOne({ phone, expiresAt: { $gt: new Date() } });
  if (!pending) return t("otpExpired");
  if (pending.attempts >= MAX_ATTEMPTS) return t("tooManyWrong");
  if (!timingSafeEqual(hashOtp(phone, code), Buffer.from(pending.codeHash, "hex"))) {
    await otps.updateOne({ phone }, { $inc: { attempts: 1 } });
    return t("incorrectOtp");
  }
  return null;
}

// Logs the customer in once their phone number is proven, by a Firebase ID token
// (`idToken`) or, in development without Firebase, by our own OTP (`phone` + `code`).
// A first-time customer gets `needsName` back and calls again with their name.
// On success it starts a session and returns the page to go back to (the one that asked them to log in).
export async function login(input: {
  idToken?: string;
  phone?: string;
  code?: string;
  name?: string;
  next?: string;
}): Promise<{ error: string } | { needsName: true } | { redirectTo: string }> {
  const t = await getTranslations("auth.errors");
  let phone: string;
  if (devOtpAllowed()) {
    const error = await checkDevOtp(String(input.phone ?? ""), String(input.code ?? ""));
    if (error) return { error };
    phone = String(input.phone);
  } else {
    const verified = await verifyPhoneToken(String(input.idToken ?? ""));
    if (!verified) return { error: t("verifyFailed") };
    phone = verified;
  }

  const { users, otps } = await getDb();
  let user = await users.findOne({ phone });
  if (!user) {
    const name = input.name?.trim() ?? "";
    if (!name) return { needsName: true };
    if (name.length < 2 || name.length > 80) return { error: t("enterName") };
    user = { _id: new ObjectId(), phone, name, addresses: [], superAdmin: false, createdAt: new Date() };
    await users.insertOne(user);
  }

  await otps.deleteOne({ phone });
  await createSession(user._id);
  return { redirectTo: afterLoginPath(user, safeNext(input.next)) };
}

export async function logout() {
  await deleteSession();
  redirect("/");
}

export async function updateProfile(name: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireUser("/profile/");
  const trimmed = String(name ?? "").trim();
  if (trimmed.length < 2 || trimmed.length > 80) return { error: (await getTranslations("auth.errors"))("enterName") };
  await (await getDb()).users.updateOne({ _id: user._id }, { $set: { name: trimmed } });
  return { ok: true };
}
