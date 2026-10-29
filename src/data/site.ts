// Site-wide settings and contact details. Demo values — edit freely.
// All text shown to visitors is in src/i18n/messages/en.json.
export const site = {
  name: "MELOVME",
  email: "hello@melovme.com",
  phone: "+91 99466 58691",
  social: {
    instagram: "https://www.instagram.com/melovme.in/",
    // TODO: the shop's own pages; all point to Instagram for now
    facebook: "https://www.instagram.com/melovme.in/",
    x: "https://www.instagram.com/melovme.in/",
    youtube: "https://www.instagram.com/melovme.in/",
    pinterest: "https://www.instagram.com/melovme.in/",
  },
  shipping: {
    fee: 0, // flat delivery charge in rupees
    freeAbove: 0, // orders at or above this subtotal ship free
  },
  // Optional: URL that is also sent each paid order as a JSON POST (e.g. Formspree,
  // Web3Forms or a Google Apps Script web app), so the shop gets notified.
  // Orders are always saved in MongoDB (`orders` collection) either way.
  orderEndpoint: "",
};

// The shop's public address, e.g. https://melovme.in (NEXT_PUBLIC_SITE_URL). Used for links that
// leave the site, like the product photo WhatsApp shows when a product link is shared. On Vercel it
// falls back to the production domain; on your own computer, to localhost.
export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:4000");

// Opens a WhatsApp chat with the shop's number (site.phone), with `text` typed in ready to send.
// The default text is common.whatsappMessage in en.json.
export const whatsappUrl = (text: string) =>
  `https://wa.me/${site.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

// Labels and copy for these are in src/i18n/messages/en.json (common.nav, common.values, home.testimonials)
export const navLinks = [
  { href: "/", key: "home" },
  { href: "/products/", key: "products" },
  { href: "/about/", key: "about" },
  { href: "/contact/", key: "contact" },
] as const;

// Order the social icons appear in (header menu and footer)
export const socialLinks = ["instagram", "facebook", "x", "youtube", "pinterest"] as const;
export type SocialName = (typeof socialLinks)[number];

export const values = [
  { key: "natural", icon: "leaf" },
  { key: "hydration", icon: "drop" },
  { key: "glow", icon: "sparkle" },
  { key: "love", icon: "heart" },
] as const;

export const testimonials = ["priya", "arjun", "sneha"] as const;
