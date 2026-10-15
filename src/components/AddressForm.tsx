"use client";

import { useState, useTransition, type FormEvent, type InputHTMLAttributes } from "react";
import { saveAddress } from "@/app/actions/checkout";
import { addressFields, validateAddress, type Address, type SavedAddress } from "@/lib/order";

export const field =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-3 text-sm placeholder:text-chocolate/40 outline-none focus:border-gold";

const fields: {
  name: keyof Address;
  label: string;
  wide?: boolean;
  multiline?: boolean;
  props: InputHTMLAttributes<HTMLInputElement>;
}[] = [
  { name: "name", label: "Full name", props: { autoComplete: "name" } },
  {
    name: "phone",
    label: "Mobile number (10 digits)",
    props: { type: "tel", autoComplete: "tel-national", inputMode: "numeric", maxLength: 10 },
  },
  { name: "address", label: "House no., street, area, landmark", wide: true, multiline: true, props: {} },
  { name: "city", label: "City", props: { autoComplete: "address-level2" } },
  { name: "state", label: "State", props: { autoComplete: "address-level1" } },
  { name: "pincode", label: "PIN code", props: { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6 } },
];

// Shipping address form: adds a new address to the customer's account, or edits `editId`
export default function AddressForm({
  defaults,
  editId,
  onSaved,
  onCancel,
}: {
  defaults: Partial<Address>;
  editId?: string;
  onSaved: (address: SavedAddress) => void;
  onCancel?: () => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Address, string>>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const address = Object.fromEntries(addressFields.map((f) => [f, String(data.get(f) ?? "").trim()])) as Address;

    // Validate every field up front so all problems are shown together, not one at a time
    const found = validateAddress(address);
    setErrors(found);
    const firstInvalid = fields.find((f) => found[f.name]);
    if (firstInvalid) return (form.elements.namedItem(firstInvalid.name) as HTMLElement).focus();

    startTransition(async () => {
      const res = await saveAddress(address, editId);
      if ("errors" in res) setErrors(res.errors);
      else onSaved(res);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid h-fit gap-5 sm:grid-cols-2">
      {fields.map((f) => {
        const error = errors[f.name];
        const common = {
          name: f.name,
          defaultValue: defaults[f.name],
          required: true,
          placeholder: `${f.label} *`,
          "aria-label": f.label,
          "aria-invalid": !!error,
          "aria-describedby": error ? `${f.name}-error` : undefined,
          className: `${field} ${error ? "!border-red-700" : ""}`,
          // Clear a field's error as soon as the customer edits it
          onChange: () => error && setErrors({ ...errors, [f.name]: undefined }),
        };
        return (
          <div key={f.name} className={f.wide ? "sm:col-span-2" : ""}>
            {f.multiline ? (
              <textarea {...common} rows={3} autoComplete="street-address" />
            ) : (
              <input {...common} {...f.props} />
            )}
            {error && (
              <p id={`${f.name}-error`} className="mt-1.5 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save Address"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
