// Site-wide settings and contact details. Demo values — edit freely.
// All text shown to visitors is in src/i18n/messages/en.json.
export const site = {
  name: "MELOVME",
  email: "hello@melovme.com",
  phone: "+91 99466 58691",
  social: {
    instagram: "https://www.instagram.com/melovme.in/",
    facebook: "https://facebook.com/",
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

export const values = [
  { key: "natural", icon: "leaf" },
  { key: "hydration", icon: "drop" },
  { key: "glow", icon: "sparkle" },
  { key: "love", icon: "heart" },
] as const;

export const testimonials = ["priya", "arjun", "sneha"] as const;
