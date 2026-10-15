import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

// Firebase sends and checks the SMS OTP; we only use it to prove the customer owns the number
export function firebaseAuth() {
  const auth = getAuth(getApps()[0] ?? initializeApp(firebaseConfig));
  auth.languageCode = "en";
  return auth;
}
