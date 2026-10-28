"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/actions/admin";
import { ConfirmDialog, EditIcon, IconButton, IconLink, TrashIcon } from "./actions";

// Edit and delete icons for one product in the product list
export default function ProductActions({ slug, name, image }: { slug: string; name: string; image?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteProduct(slug);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <IconLink href={`/admin/products/${slug}/`} label={`Edit ${name}`}>
        <EditIcon />
      </IconLink>
      <IconButton label={`Delete ${name}`} tone="red" onClick={() => setConfirming(true)} disabled={pending}>
        <TrashIcon />
      </IconButton>
      {confirming && (
        <ConfirmDialog
          title="Delete this product?"
          subject={name}
          image={image}
          text="It will be removed from the shop along with its reviews. Past orders aren't affected. This can't be undone."
          confirmLabel="Yes, delete"
          pendingLabel="Deleting…"
          pending={pending}
          onConfirm={handleDelete}
          onClose={() => !pending && setConfirming(false)}
        />
      )}
    </div>
  );
}
