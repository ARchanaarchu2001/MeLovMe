import Link from "next/link";
import { secondsPerMessage, type Announcement } from "@/lib/announcement";

// The scrolling strip above the shop header, set up in /admin/announcement/. Also used as the
// live preview there. Two identical halves slide left forever, so the loop has no visible seam;
// it pauses on hover, and stands still (one centred line) for people who turn off animations.
export default function AnnouncementBar({ announcement: a, preview }: { announcement: Announcement; preview?: boolean }) {
  const messages = a.messages.filter((m) => m.text.trim());
  if (!messages.length || (!a.enabled && !preview)) return null;

  // Repeat short lists so one half is wider than any screen
  const half = Array.from({ length: Math.ceil(8 / messages.length) }, () => messages).flat();
  const duration = half.length * secondsPerMessage[a.speed];

  const items = (copy: number) =>
    half.map((m, i) => {
      const body = (
        <>
          {m.text}
          {m.link && <span aria-hidden="true">›</span>}
        </>
      );
      const className = "inline-flex items-center gap-2 px-10 sm:px-16";
      // Only the first round of the first half is read out and focusable; the rest are repeats
      const hidden = copy > 0 || i >= messages.length;
      return m.link && !preview ? (
        m.link.startsWith("/") ? (
          <Link key={i} href={m.link} className={className} tabIndex={hidden ? -1 : undefined}>{body}</Link>
        ) : (
          <a key={i} href={m.link} target="_blank" rel="noopener" className={className} tabIndex={hidden ? -1 : undefined}>{body}</a>
        )
      ) : (
        <span key={i} className={className}>{body}</span>
      );
    });

  return (
    <div
      className="announcement overflow-hidden text-[0.7rem] font-medium uppercase tracking-[0.18em] sm:text-xs"
      style={{ background: a.background, color: a.textColor }}
      role="region"
      aria-label="Announcements"
    >
      <div className="announcement-track flex w-max py-2.5" style={{ animationDuration: `${duration}s` }}>
        <div className="flex shrink-0">{items(0)}</div>
        <div className="flex shrink-0" aria-hidden="true">{items(1)}</div>
      </div>
    </div>
  );
}
