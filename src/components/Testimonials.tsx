"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import type { Testimonial, Testimonials as TestimonialsData } from "@/lib/testimonials";

// Seconds between moves when the slider scrolls by itself
const AUTO_SCROLL_SECONDS = 5;
// Seconds each review takes to glide past in the phone marquee
const MARQUEE_SECONDS_PER_REVIEW = 7;
// How long the marquee stands still after a customer swipes it or uses the arrows
const MARQUEE_REST_MS = 3000;

// "Loved by our community": customers' reviews with their photo, set up in /admin/testimonials/.
// On computers and tablets a grid shows them all, or a slider shows a row that scrolls sideways (as chosen
// in the admin area). On phones they always glide past in a marquee.
export default function Testimonials({ data, eyebrow, title }: { data: TestimonialsData; eyebrow: string; title: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:py-24 md:px-8">
      <Reveal className="text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-4 text-3xl font-light md:text-5xl">{title}</h2>
      </Reveal>
      <Marquee items={data.items} />
      {data.layout === "slider" ? (
        <div className="hidden md:block">
          <Slider items={data.items} autoScroll={data.autoScroll} />
        </div>
      ) : (
        <div className="mt-14 hidden gap-8 md:grid md:grid-cols-3">
          {data.items.map((t, i) => (
            <Reveal key={t.id} delay={(i % 3) * 150} className="h-full">
              <Card t={t} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-[2rem] bg-ivory p-6 md:p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-chocolate/10">
      {t.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small Cloudinary photo; Next doesn't resize images here (images.unoptimized)
        <img src={t.photo} alt={t.name} loading="lazy" className="h-16 w-16 rounded-full object-cover ring-2 ring-gold/60 ring-offset-2 ring-offset-ivory" />
      ) : (
        <Icon name="sparkle" className="h-6 w-6 text-gold" />
      )}
      <blockquote className="mt-5 flex-1 leading-relaxed text-chocolate/80">&ldquo;{t.message}&rdquo;</blockquote>
      <figcaption className="mt-6 text-sm">
        <span className="font-medium">{t.name}</span>
        {t.place && <span className="text-chocolate/50"> · {t.place}</span>}
      </figcaption>
    </figure>
  );
}

// Width of one review card (with its gap), and of the whole list once
function sizes(el: HTMLElement, count: number) {
  const card = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
  return { card, list: card * count };
}

// Phones: the reviews glide past in an endless row (the list is there twice, so it joins up seamlessly).
// Customers can also swipe it or use the arrows; it carries on by itself a few seconds after they stop.
function Marquee({ items }: { items: Testimonial[] }) {
  const track = useRef<HTMLDivElement>(null);
  const held = useRef(false); // a finger or the mouse is on it
  const restUntil = useRef(0); // after a swipe or an arrow, it stands still until this time
  const rest = () => (restUntil.current = performance.now() + MARQUEE_REST_MS);
  const count = items.length;

  // Moves it a little every frame. Not on bigger screens (it's hidden there), nor for people who prefer less motion.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const phone = window.matchMedia("(max-width: 767px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    let pos = -1; // where it is, to a fraction of a pixel (scrollLeft may keep whole pixels only)
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const ms = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (!phone.matches || still.matches || held.current || now < restUntil.current) {
        pos = -1;
        return;
      }
      const { card, list } = sizes(el, count);
      if (!list) return;
      if (pos < 0) pos = el.scrollLeft; // carry on from wherever the customer left it
      pos += ((card / MARQUEE_SECONDS_PER_REVIEW) * ms) / 1000;
      if (pos >= list) pos -= list; // into the second copy: jump back to the same spot in the first
      el.scrollLeft = pos;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count]);

  // One review along. Near either end it first jumps to the same spot in the other copy, so it never runs out.
  function step(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const { card, list } = sizes(el, count);
    rest();
    if (dir === -1 && el.scrollLeft < card) el.scrollLeft += list;
    if (dir === 1 && el.scrollLeft + card > list) el.scrollLeft -= list;
    el.scrollBy({ left: dir * card, behavior: "smooth" });
  }

  const row = (copy: boolean) =>
    items.map((t) => (
      <div key={t.id} className="w-72 shrink-0 pr-4" aria-hidden={copy || undefined}>
        <Card t={t} />
      </div>
    ));
  return (
    <div className="mt-8 md:hidden">
      <div
        ref={track}
        className="no-scrollbar -mx-5 flex overflow-x-auto px-5 py-3 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
        role="region"
        aria-label="Customer reviews"
        onTouchStart={() => (held.current = true)}
        onTouchEnd={() => {
          held.current = false;
          rest();
        }}
        onTouchCancel={() => (held.current = false)}
        onMouseEnter={() => (held.current = true)}
        onMouseLeave={() => (held.current = false)}
      >
        {row(false)}
        {/* The repeat only matters while it moves; people who prefer less motion just swipe through the list */}
        <div className="contents motion-reduce:hidden">{row(true)}</div>
      </div>
      <Arrows onMove={step} />
    </div>
  );
}

// One card (and its gap) at a time; at either end it wraps round to the other
function move(el: HTMLElement | null, dir: 1 | -1) {
  const first = el?.firstElementChild as HTMLElement | null;
  if (!el || !first) return;
  const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  const atStart = el.scrollLeft <= 4;
  if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
  else if (dir === -1 && atStart) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  else el.scrollBy({ left: dir * step, behavior: "smooth" });
}

function Slider({ items, autoScroll }: { items: Testimonial[]; autoScroll: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [scrollable, setScrollable] = useState(true);

  // Arrows only when there's more than fits
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 4);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  // Moves on by itself, but not while the customer is reading (hover, touch, focus) or prefers less motion
  useEffect(() => {
    if (!autoScroll || paused || !scrollable) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => move(track.current, 1), AUTO_SCROLL_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [autoScroll, paused, scrollable]);

  return (
    <div
      className="mt-8 md:mt-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={track}
        className="no-scrollbar -my-3 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth py-3 md:gap-8"
        role="region"
        aria-label="Customer reviews"
        tabIndex={0}
      >
        {items.map((t) => (
          <div key={t.id} className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] md:w-[calc((100%-4rem)/3)]">
            <Card t={t} />
          </div>
        ))}
      </div>
      {scrollable && <Arrows onMove={(dir) => move(track.current, dir)} />}
    </div>
  );
}

// The ‹ › buttons under a row of reviews
function Arrows({ onMove }: { onMove: (dir: 1 | -1) => void }) {
  return (
    <div className="mt-6 flex justify-center gap-3 md:mt-8">
      {([-1, 1] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => onMove(dir)}
          aria-label={dir === 1 ? "Next reviews" : "Previous reviews"}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-chocolate/25 text-chocolate transition-colors hover:border-chocolate hover:bg-chocolate hover:text-ivory"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={dir === 1 ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
          </svg>
        </button>
      ))}
    </div>
  );
}
