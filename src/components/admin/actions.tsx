"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import Spinner from "@/components/Spinner";

// Round icon buttons for row actions in admin lists (edit, hide, delete), and the themed
// "are you sure?" pop-up, so every list looks and works the same

const round =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-chocolate/15 text-chocolate/70 transition-colors disabled:opacity-60";
const tones = {
  gold: "hover:border-gold hover:text-gold",
  red: "hover:border-red-700 hover:text-red-700",
};

type IconButtonProps = { label: string; tone?: keyof typeof tones; active?: boolean; children: ReactNode };

export function IconButton({ label, tone = "gold", active, children, ...rest }: IconButtonProps & {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" aria-label={label} title={label} className={`${round} ${tones[tone]} ${active ? "border-gold/60 bg-gold/15 text-gold" : ""}`} {...rest}>
      {children}
    </button>
  );
}

export function IconLink({ label, tone = "gold", href, children }: IconButtonProps & { href: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={`${round} ${tones[tone]}`}>
      {children}
    </Link>
  );
}

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const EditIcon = ({ className = "h-4 w-4" }) => (
  <svg {...svg} className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
export const TrashIcon = ({ className = "h-4 w-4" }) => (
  <svg {...svg} className={className}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
);
// Shown in the shop
export const EyeIcon = ({ className = "h-4 w-4" }) => (
  <svg {...svg} className={className}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
// Hidden from the shop
export const EyeOffIcon = ({ className = "h-4 w-4" }) => (
  <svg {...svg} className={className}>
    <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
);

// "Delete this …?" in the shop's style. A native <dialog>: Escape closes it and focus stays
// inside while it's open. Cancel has focus, so Enter doesn't delete by accident.
export function ConfirmDialog({ title, subject, image, icon, text, confirmLabel, pendingLabel, cancelLabel = "Cancel", pending, onConfirm, onClose }: {
  title: string;
  subject?: string; // e.g. the product's name, under the title
  image?: string;
  icon?: ReactNode; // shown when there's no image (a bin by default)
  text: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel?: string; // the button that closes it without doing anything
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Not while it's working: Escape and backdrop clicks are ignored until it's done
      onCancel={(e) => pending && e.preventDefault()}
      // A click on the dimmed backdrop lands on the <dialog> itself
      onClick={(e) => e.target === ref.current && !pending && ref.current.close()}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[2rem] bg-cream p-0 text-chocolate backdrop:bg-espresso/50"
    >
      <div className="relative p-8">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          disabled={pending}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-chocolate/10 hover:text-chocolate disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="flex items-center gap-4 pr-8">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-red-700/10 text-red-700">
            {image ? <Image src={image} alt="" fill sizes="64px" className="object-cover" /> : (icon ?? <TrashIcon className="h-6 w-6" />)}
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="font-medium">{title}</h2>
            {subject && <p className="mt-1 truncate text-sm text-chocolate/60">{subject}</p>}
          </div>
        </div>

        <p className="mt-6 text-sm text-chocolate/75">{text}</p>

        <div className="mt-6 grid gap-3">
          <button type="button" onClick={onConfirm} disabled={pending} className="btn w-full justify-center bg-red-700 text-ivory hover:bg-red-800 disabled:opacity-70">
            {pending && <Spinner />}
            {pending ? pendingLabel : confirmLabel}
          </button>
          <button type="button" onClick={() => ref.current?.close()} disabled={pending} className="btn btn-outline w-full" autoFocus>
            {cancelLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
