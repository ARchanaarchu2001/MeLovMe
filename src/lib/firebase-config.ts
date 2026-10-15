// Firebase web config (Firebase console -> Project settings -> Your apps -> Web app).
// These values are public by design; they identify the project, they don't grant access.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// While Firebase isn't set up, login falls back to a development-only OTP printed in the terminal
export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);
