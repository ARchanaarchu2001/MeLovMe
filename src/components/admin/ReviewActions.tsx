"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteReview, setReviewHidden } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";

// Hide/show, edit (reviews the shop added) and delete, for one review in the admin list
export default function ReviewActions({ id, hidden, editable }: { id: string; hidden: boolean; editable: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<unknown>) =>
    startTransition(async () => {
      await action();
      router.refresh();
    });
  const button = "text-xs uppercase tracking-[0.15em] disabled:opacity-60";

  return (
    <div className="flex items-center gap-4">
      {pending && <Spinner className="h-3.5 w-3.5 text-gold" />}
      <button type="button" disabled={pending} onClick={() => run(() => setReviewHidden(id, !hidden))} className={`${button} text-chocolate/70 hover:text-gold`}>
        {hidden ? "Show in shop" : "Hide"}
      </button>
      {editable && (
        <Link href={`/admin/reviews/${id}/`} className={`${button} text-gold hover:underline`}>
          Edit
        </Link>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm("Delete this review? This can't be undone.") && run(() => deleteReview(id))}
        className={`${button} text-red-700 hover:underline`}
      >
        Delete
      </button>
    </div>
  );
}
