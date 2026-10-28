"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReview, setReviewHidden } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import { ConfirmDialog, EditIcon, EyeIcon, EyeOffIcon, IconButton, IconLink, TrashIcon } from "./actions";

// Hide/show, edit (reviews the shop added) and delete, for one review in the admin list
export default function ReviewActions({ id, hidden, editable, by }: { id: string; hidden: boolean; editable: boolean; by: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [toggling, startToggle] = useTransition();
  const [deleting, startDelete] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {/* Open eye = shown in the shop; crossed out = hidden. Clicking switches it. */}
      <IconButton
        label={hidden ? "Hidden from the shop. Click to show it" : "Shown in the shop. Click to hide it"}
        active={hidden}
        disabled={toggling}
        onClick={() =>
          startToggle(async () => {
            await setReviewHidden(id, !hidden);
            router.refresh();
          })
        }
      >
        {toggling ? <Spinner className="h-4 w-4" /> : hidden ? <EyeOffIcon /> : <EyeIcon />}
      </IconButton>
      {editable && (
        <IconLink href={`/admin/reviews/${id}/`} label="Edit review">
          <EditIcon />
        </IconLink>
      )}
      <IconButton label="Delete review" tone="red" disabled={deleting} onClick={() => setConfirming(true)}>
        <TrashIcon />
      </IconButton>
      {confirming && (
        <ConfirmDialog
          title="Delete this review?"
          subject={`By ${by}`}
          text="It will be removed from the shop and the product's rating. This can't be undone. To take it down for now, hide it instead."
          confirmLabel="Yes, delete"
          pendingLabel="Deleting…"
          pending={deleting}
          onConfirm={() =>
            startDelete(async () => {
              await deleteReview(id);
              setConfirming(false);
              router.refresh();
            })
          }
          onClose={() => !deleting && setConfirming(false)}
        />
      )}
    </div>
  );
}
