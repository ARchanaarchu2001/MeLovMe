import Spinner from "./Spinner";

// Shown by loading.tsx while a page's data is loaded on the server
export default function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-gold" role="status" aria-live="polite">
      <Spinner className="h-9 w-9" />
      <p className="text-xs uppercase tracking-[0.3em] text-chocolate/60">{label}</p>
    </div>
  );
}
