"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { devSendOtp, login } from "@/app/actions/auth";
import { firebaseEnabled } from "@/lib/firebase-config";
import { field } from "./AddressForm";

// Friendly messages for the Firebase errors customers can actually hit
const firebaseErrors: Record<string, string> = {
  "auth/invalid-phone-number": "Enter a valid 10-digit mobile number.",
  "auth/invalid-verification-code": "Incorrect OTP. Please check and try again.",
  "auth/code-expired": "This OTP has expired. Please request a new one.",
  "auth/too-many-requests": "Too many attempts. Please wait a while and try again.",
  "auth/quota-exceeded": "We can't send OTPs right now. Please try again later.",
  // Firebase console settings not finished (SMS region policy / Blaze plan) — see README
  "auth/operation-not-allowed": "We can't send OTPs right now. Please try again later.",
  "auth/billing-not-enabled": "We can't send OTPs right now. Please try again later.",
};

function errorMessage(err: unknown) {
  console.error(err);
  const code = (err as { code?: string })?.code ?? "";
  return firebaseErrors[code] ?? "Something went wrong. Please try again.";
}

// Mobile number -> SMS OTP -> (first time only) name.
// Firebase sends and checks the OTP, then the server checks Firebase's proof and logs the customer in.
export default function LoginForm({ next }: { next: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const idToken = useRef("");

  function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        if (firebaseEnabled) {
          const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
          const { firebaseAuth } = await import("@/lib/firebase");
          const auth = firebaseAuth();
          // Invisible reCAPTCHA: Firebase's spam check, usually with no puzzle for the customer
          verifier.current ??= new RecaptchaVerifier(auth, "recaptcha", { size: "invisible" });
          confirmation.current = await signInWithPhoneNumber(auth, `+91${phone}`, verifier.current);
        } else {
          const res = await devSendOtp(phone);
          if ("error" in res) return setError(res.error);
        }
        setStep("otp");
        setCode("");
        setNotice(`We've sent a 6-digit OTP to +91 ${phone}.`);
      } catch (err) {
        // A used reCAPTCHA can't be reused, so start fresh for the next try
        verifier.current?.clear();
        verifier.current = null;
        setError(errorMessage(err));
      }
    });
  }

  function finish(withName?: string) {
    return login({ idToken: idToken.current, phone, code, name: withName, next }).then((res) => {
      // On success the server redirects, so a returned value is either an error or a name request
      if ("needsName" in res) setStep("name");
      else setError(res.error);
    });
  }

  function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        if (firebaseEnabled) {
          if (!confirmation.current) return setError("Please request a new OTP.");
          const { signOut } = await import("firebase/auth");
          const { firebaseAuth } = await import("@/lib/firebase");
          const result = await confirmation.current.confirm(code);
          idToken.current = await result.user.getIdToken();
          // Our own session cookie keeps them logged in; Firebase's login isn't needed after this
          await signOut(firebaseAuth());
        }
        await finish();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function handleName(e: FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(() => finish(name));
  }

  return (
    <>
      {step === "phone" && (
        <form onSubmit={requestOtp} className="space-y-5">
          <label className="block text-sm text-chocolate/75" htmlFor="phone">
            Mobile number
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-chocolate/60">+91</span>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              required
              autoFocus
              className={field}
            />
          </div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={pending || !/^[6-9]\d{9}$/.test(phone)}>
            {pending ? "Sending OTP…" : "Send OTP"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerify} className="space-y-5">
          <p className="text-sm text-chocolate/75" aria-live="polite">{notice}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter OTP *"
            aria-label="One-time password"
            required
            autoFocus
            className={`${field} tracking-[0.4em]`}
          />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={pending || code.length !== 6}>
            {pending ? "Verifying…" : "Verify & Login"}
          </button>
          <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-chocolate/60">
            <button type="button" onClick={() => setStep("phone")} className="hover:text-gold">
              Change number
            </button>
            <button type="button" onClick={() => requestOtp()} disabled={pending} className="hover:text-gold">
              Resend OTP
            </button>
          </div>
        </form>
      )}

      {step === "name" && (
        <form onSubmit={handleName} className="space-y-5">
          <p className="text-sm text-chocolate/75">Welcome! What should we call you?</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name *"
            aria-label="Your name"
            required
            autoFocus
            className={field}
          />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={pending || name.trim().length < 2}>
            {pending ? "Creating account…" : "Create Account"}
          </button>
        </form>
      )}

      {/* Firebase renders its invisible reCAPTCHA here */}
      <div id="recaptcha" />
    </>
  );
}
