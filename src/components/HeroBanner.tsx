import Link from "next/link";
import type { CSSProperties } from "react";
import type { Banner, BannerButtonPosition, BannerImage } from "@/lib/banner";

type Labels = { heading: string; explore: string; ourStory: string };

// Where the buttons sit over the picture: rows are top/middle/bottom, columns left/center/right
const rows = { top: "items-start", middle: "items-center", bottom: "items-end" };
const columns = { left: "justify-start", center: "justify-center", right: "justify-end" };
const place = (p: BannerButtonPosition) => {
  const [row, column] = p.split("-") as [keyof typeof rows, keyof typeof columns];
  return { box: `${rows[row]} ${columns[column]}`, buttons: columns[column] };
};

const buttonStyles = {
  light: { explore: "btn btn-gold", story: "btn btn-outline text-ivory hover:!border-ivory hover:!bg-ivory hover:!text-chocolate" },
  dark: { explore: "btn btn-primary", story: "btn btn-outline text-chocolate" },
};

const ratio = (i: BannerImage) => `${i.width} / ${i.height}`;

// The admin's banner picture across the top of the home page, shown at its own shape (never cropped)
// so any words on it stay readable. Sizes follow the banner's width rather than the screen's, so the
// admin preview can show the phone layout. `view` (admin preview only) picks which picture to show.
export default function HeroBanner({
  banner,
  labels,
  view,
}: {
  banner: Banner & { image: BannerImage };
  labels: Labels;
  view?: "desktop" | "mobile";
}) {
  const { image, mobileImage } = banner;
  const phoneImage = mobileImage ?? image;
  // A wide picture is too short on a phone to put buttons on, so there they go beneath it
  const overlayOnPhone = !!mobileImage;
  const { box, buttons } = place(banner.buttonPosition);

  const links = (style: keyof typeof buttonStyles) => (
    <>
      <Link href="/products/" className={buttonStyles[style].explore}>
        {labels.explore}
      </Link>
      <Link href="/about/" className={buttonStyles[style].story}>
        {labels.ourStory}
      </Link>
    </>
  );

  // Plain <img>: images aren't resized by Next here (images.unoptimized), and Cloudinary already
  // serves the best format for each device
  /* eslint-disable @next/next/no-img-element */
  const picture = view ? (
    <img
      src={(view === "mobile" ? phoneImage : image).url}
      alt={banner.alt}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <picture>
      <source media="(min-width: 768px)" srcSet={image.url} />
      <img src={phoneImage.url} alt={banner.alt} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
    </picture>
  );
  /* eslint-enable @next/next/no-img-element */

  return (
    <section className="@container relative bg-chocolate">
      {/* The page heading is in the picture; this one is for search engines and screen readers */}
      <h1 className="sr-only">{banner.alt || labels.heading}</h1>
      <div
        className="relative aspect-(--phone) @3xl:aspect-(--wide)"
        style={{ "--phone": ratio(phoneImage), "--wide": ratio(image) } as CSSProperties}
      >
        {picture}
        {banner.showButtons && (
          <div className={`absolute inset-0 ${overlayOnPhone ? "flex" : "hidden @3xl:flex"}`}>
            <div className={`mx-auto flex h-full w-full max-w-7xl px-5 py-6 @3xl:px-8 @3xl:py-12 @6xl:py-16 ${box}`}>
              <div className={`animate-fade-up flex flex-wrap gap-3 @3xl:gap-4 ${buttons}`} style={{ animationDelay: "300ms" }}>
                {links(banner.buttonStyle)}
              </div>
            </div>
          </div>
        )}
      </div>
      {banner.showButtons && !overlayOnPhone && (
        <div className="flex flex-wrap justify-center gap-3 px-5 py-5 @3xl:hidden">{links("light")}</div>
      )}
    </section>
  );
}
