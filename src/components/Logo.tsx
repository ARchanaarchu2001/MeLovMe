// Text recreation of the stacked "me / lov. / me" wordmark with the droplet accent.
// Replace with the official SVG logo file once available (e.g. /public/logo.svg).

type LogoProps = {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  className?: string;
};

const sizes = {
  sm: { text: "text-[1.05rem]", tag: "text-[0.38rem]" },
  md: { text: "text-[2.2rem]", tag: "text-[0.55rem]" },
  lg: { text: "text-[4.5rem] md:text-[5.5rem]", tag: "text-[0.7rem] md:text-xs" },
};

export function Droplet({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 16" className={className} aria-hidden="true">
      <path d="M6 0C6 0 0 7.2 0 10.4A6 6 0 0 0 12 10.4C12 7.2 6 0 6 0Z" fill="currentColor" />
    </svg>
  );
}

export default function Logo({ size = "md", tagline = true, className = "" }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={`inline-flex flex-col items-center ${className}`} aria-label="MELOVME — Your Signature">
      <span
        className={`font-logo font-semibold leading-[0.78] tracking-[-0.04em] flex flex-col items-start ${s.text}`}
        aria-hidden="true"
      >
        <span className="pl-[0.05em]">me</span>
        <span className="relative">
          lov
          <Droplet className="absolute -right-[0.32em] bottom-[0.06em] h-[0.3em] w-[0.22em]" />
        </span>
        <span>me</span>
      </span>
      {tagline && (
        <span className={`mt-[0.6em] font-sans font-medium uppercase tracking-[0.28em] ${s.tag}`}>
          Your Signature
        </span>
      )}
    </span>
  );
}
