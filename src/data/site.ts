// Site-wide settings and contact details. Demo values — edit freely.
// All text shown to visitors is in src/i18n/messages/en.json.
export const site = {
  name: "MELOVME",
  email: "hello@melovme.com",
  phone: "+91 98765 43210",
  social: {
    instagram: "https://instagram.com/",
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
