// Line icons echoing the brand's graphic elements (leaf, drop, sparkle, floral).

type IconProps = { name: "leaf" | "drop" | "sparkle" | "heart"; className?: string };

export function Icon({ name, className = "h-6 w-6" }: IconProps) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
  switch (name) {
    case "leaf":
      return (
        <svg {...common}>
          <path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15Z" />
          <path d="M5 19 14 10" />
        </svg>
      );
    case "drop":
      return (
        <svg {...common}>
          <path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z" />
          <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" />
          <path d="M19 16c.2 1.4.9 2.1 2 2.3-1.1.2-1.8.9-2 2.2-.2-1.3-.9-2-2-2.2 1.1-.2 1.8-.9 2-2.3Z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
        </svg>
      );
  }
}

export function SocialIcon({ name, className = "h-5 w-5" }: { name: "instagram" | "facebook"; className?: string }) {
  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

// Decorative botanical line-art, like the gold leaf print on the packaging
export function LeafArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" className={className} fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M40 255C70 190 100 130 170 20" />
      <path d="M60 210c-30-10-48-32-50-60 28 4 46 26 50 60Z" />
      <path d="M60 210c-14-18-30-30-50-60" />
      <path d="M85 160c30-4 52-22 62-50-30 0-52 18-62 50Z" />
      <path d="M85 160c22-16 42-30 62-50" />
      <path d="M100 135c-34-8-54-32-58-64 32 6 52 30 58 64Z" />
      <path d="M100 135C82 116 62 96 42 71" />
      <path d="M128 85c26-10 40-30 42-56-26 6-40 26-42 56Z" />
      <path d="M128 85c16-18 30-36 42-56" />
      <path d="M72 185c26 6 50 0 68-20-26-8-50-2-68 20Z" />
      <path d="M72 185c22-4 46-10 68-20" />
    </svg>
  );
}
