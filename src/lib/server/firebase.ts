import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { firebaseConfig } from "@/lib/firebase-config";

// Google's public keys for Firebase ID tokens (cached and refreshed by jose)
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

// Checks a Firebase ID token (issued after the customer entered the SMS OTP) and
// returns their 10-digit Indian mobile number, or null if the token isn't valid.
// Follows Firebase's rules for verifying ID tokens with a JWT library:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
export async function verifyPhoneToken(idToken: string) {
  const { projectId } = firebaseConfig;
  if (!projectId || typeof idToken !== "string" || !idToken) return null;
  try {
    const { payload } = await jwtVerify<{ phone_number?: string; auth_time?: number }>(idToken, keys, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub || !payload.auth_time || payload.auth_time > Date.now() / 1000) return null;
    const match = payload.phone_number?.match(/^\+91([6-9]\d{9})$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
