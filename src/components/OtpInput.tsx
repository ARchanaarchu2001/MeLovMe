"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

const LENGTH = 6;

// Six one-digit boxes, filled left to right. Typing moves to the next box, Backspace goes
// back, and pasting (or the phone's SMS autofill, which puts the whole code in one box) fills them all.
export default function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  // The code as of the latest keystroke. Focus moves before React re-renders with the new
  // value, so the focus handler must read this rather than the (stale) `value` prop.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const update = (next: string) => {
    latest.current = next;
    onChange(next);
  };
  const focus = (i: number) => boxes.current[Math.max(0, Math.min(i, LENGTH - 1))]?.focus();

  // Put `digits` into the code from box `from` onwards, then move to the next empty box
  function fill(from: number, digits: string) {
    update((value.slice(0, from) + digits + value.slice(from + digits.length)).slice(0, LENGTH));
    focus(from + digits.length);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      // Clear this box, or the one before it if this one is already empty
      const at = value[i] ? i : i - 1;
      if (at >= 0) update(value.slice(0, at) + value.slice(at + 1));
      focus(at);
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH - i));
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="One-time password">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={value[i] ?? ""}
          onChange={(e) => {
            // The box's text is selected on focus, so typing replaces it; several digits means autofill
            const digits = e.target.value.replace(/\D/g, "");
            if (digits) fill(i, digits.length === 2 && value[i] ? digits.replace(value[i], "") || digits[0] : digits);
            // Android keyboards often don't report the Backspace key, so a cleared box also deletes
            else update(value.slice(0, i) + value.slice(i + 1));
          }}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => (i > latest.current.length ? focus(latest.current.length) : e.target.select())}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-full min-w-0 max-w-14 rounded-xl border border-chocolate/20 bg-white/60 text-center text-xl font-medium outline-none transition-colors focus:border-gold disabled:opacity-60"
        />
      ))}
    </div>
  );
}
