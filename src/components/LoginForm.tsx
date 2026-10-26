"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { devSendOtp, login } from "@/app/actions/auth";
import { firebaseEnabled } from "@/lib/firebase-config";
import { field } from "./AddressForm";
import OtpInput from "./OtpInput";
import Spinner from "./Spinner";

// Friendly messages for the Firebase errors customers can actually hit
// (keys in auth.errors)
const firebaseErrors: Record<string, "invalidPhone" | "incorrectOtp" | "otpExpired" | "tooManyRequests" | "cantSendOtp"> = {
  "auth/invalid-phone-number": "invalidPhone",
  "auth/invalid-verification-code": "incorrectOtp",
  "auth/code-expired": "otpExpired",
  "auth/too-many-requests": "tooManyRequests",
  "auth/quota-exceeded": "cantSendOtp",
  // Firebase console settings not finished (SMS region policy / Blaze plan) — see README
  "auth/operation-not-allowed": "cantSendOtp",
  "auth/billing-not-enabled": "cantSendOtp",
};

function errorKey(err: unknown) {
  console.error(err);
  const code = (err as { code?: string })?.code ?? "";
  return firebaseErrors[code] ?? "generic";
}

// Mobile number -> SMS OTP -> (first time only) name.
// Firebase sends and checks the OTP, then the server checks Firebase's proof and logs the customer in.
export default function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
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
        setNotice(t("form.otpSent", { phone }));
      } catch (err) {
        // A used reCAPTCHA can't be reused, so start fresh for the next try
        verifier.current?.clear();
        verifier.current = null;
        setError(t(`errors.${errorKey(err)}`));
      }
    });
  }

  function finish(withName?: string) {
    return login({ idToken: idToken.current, phone, code, name: withName, next }).then((res) => {
      if ("redirectTo" in res) router.replace(res.redirectTo);
      else if ("needsName" in res) setStep("name");
      else setError(res.error);
    });
  }

  function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        if (firebaseEnabled) {
          if (!confirmation.current) return setError(t("errors.requestNewOtp"));
          const { signOut } = await import("firebase/auth");
          const { firebaseAuth } = await import("@/lib/firebase");
          const result = await confirmation.current.confirm(code);
          idToken.current = await result.user.getIdToken();
          // Our own session cookie keeps them logged in; Firebase's login isn't needed after this
          await signOut(firebaseAuth());
        }
        await finish();
      } catch (err) {
        setError(t(`errors.${errorKey(err)}`));
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
            {t("form.mobileNumber")}
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
              placeholder={t("form.phonePlaceholder")}
              required
              autoFocus
              className={field}
            />
          </div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={pending || !/^[6-9]\d{9}$/.test(phone)}>
            {pending && <Spinner />}
            {pending ? t("form.sendingOtp") : t("form.sendOtp")}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerify} className="space-y-5">
          <p className="text-sm text-chocolate/75" aria-live="polite">{notice}</p>
          <OtpInput
            value={code}
            onChange={(c) => {
              setCode(c);
              setError("");
            }}
            disabled={pending}
          />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={pending || code.length !== 6}>
            {pending && <Spinner />}
            {pending ? t("form.verifying") : t("form.verify")}
          </button>
          <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-chocolate/60">
            <button type="button" onClick={() => setStep("phone")} className="hover:text-gold">
              {t("form.changeNumber")}
            </button>
            <button type="button" onClick={() => requestOtp()} disabled={pending} className="hover:text-gold">
              {t("form.resendOtp")}
            </button>
          </div>
        </form>
      )}

      {step === "name" && (
        <form onSubmit={handleName} className="space-y-5">
          <p className="text-sm text-chocolate/75">{t("form.askName")}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder={t("form.namePlaceholder")}
            aria-label={t("form.nameLabel")}
            required
            autoFocus
            className={field}
          />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={pending || name.trim().length < 2}>
            {pending && <Spinner />}
            {pending ? t("form.creatingAccount") : t("form.createAccount")}
          </button>
        </form>
      )}

      {/* Firebase renders its invisible reCAPTCHA here */}
      <div id="recaptcha" />
    </>
  );
}
