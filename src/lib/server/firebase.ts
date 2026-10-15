import "server-only";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { firebaseConfig } from "@/lib/firebase-config";

// Checks a Firebase ID token (issued after the customer entered the SMS OTP) and
// returns their 10-digit Indian mobile number, or null if the token isn't valid.
// Verifying a token only needs the project ID, no service-account key.
export async function verifyPhoneToken(idToken: string) {
  const { projectId } = firebaseConfig;
  if (!projectId || typeof idToken !== "string") return null;
  const app = getApps()[0] ?? initializeApp({ projectId });
  try {
    const { phone_number } = await getAuth(app).verifyIdToken(idToken);
    const match = phone_number?.match(/^\+91([6-9]\d{9})$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
