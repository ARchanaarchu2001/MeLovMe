// Five stars filled to `rating` (halves allowed for averages, e.g. 4.5). Purely visual:
// pass `label` (e.g. "4.5 out of 5 stars") for screen readers.
export default function Stars({ rating, label, className = "h-4 w-4" }: { rating: number; label?: string; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gold" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((n) => {
        // How much of this star is filled: 0, 0.5 or 1
        const fill = rating >= n ? 1 : rating >= n - 0.5 ? 0.5 : 0;
        return (
          <svg key={n} viewBox="0 0 20 20" className={className} aria-hidden="true">
            <defs>
              <linearGradient id={`star-half-${n}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
              fill={fill === 1 ? "currentColor" : fill === 0.5 ? `url(#star-half-${n})` : "currentColor"}
              fillOpacity={fill === 0 ? 0.2 : 1}
            />
          </svg>
        );
      })}
    </span>
  );
}
