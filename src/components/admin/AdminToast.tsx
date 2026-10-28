"use client";

import { useEffect, useState } from "react";

const SHOW_FOR_MS = 4000;

// Success pop-up for admin pages, e.g. "Product added" after creating one. The page passes the
// message from its URL (?added=…); the URL is tidied straight away so a reload doesn't show it again.
export default function AdminToast({ title, message }: { title: string; message: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
    const timer = setTimeout(() => setOpen(false), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;
  return (
    // Compact white pill: bottom centre on phones, top right (under the header) on larger screens
    <div
      role="status"
      aria-live="polite"
      className="animate-toast-in fixed bottom-5 left-1/2 z-[60] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-chocolate/10 bg-white py-2 pl-2 pr-3 text-chocolate shadow-[0_14px_36px_-12px_rgba(46,26,17,0.35)] md:bottom-auto md:left-auto md:right-6 md:top-24 md:max-w-xs md:translate-x-0"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-700/10 text-green-700">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 5 5 9-10" />
        </svg>
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-green-800">{title}</p>
        <p className="truncate text-sm font-medium">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close"
        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-chocolate/50 transition-colors hover:bg-chocolate/5 hover:text-chocolate"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
