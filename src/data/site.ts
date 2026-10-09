// Site-wide content. Demo copy — edit freely.
export const site = {
  name: "MELOVME",
  tagline: "Your Signature",
  description:
    "MELOVME is a premium body-care brand built around self-love and personal care. Thoughtfully crafted rituals that nourish your skin and become your signature.",
  email: "hello@melovme.com",
  phone: "+91 98765 43210",
  address: "No. 12, Rose Garden Street, Chennai, Tamil Nadu 600001",
  hours: "Mon – Sat, 10:00 AM – 7:00 PM",
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    whatsapp: "https://wa.me/919876543210",
  },
};

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products/", label: "Products" },
  { href: "/about/", label: "Our Story" },
  { href: "/contact/", label: "Contact" },
];

export const values = [
  {
    title: "Natural Care",
    text: "Botanical extracts and skin-loving oils chosen for gentle, everyday nourishment.",
    icon: "leaf",
  },
  {
    title: "Deep Hydration",
    text: "Light, fast-absorbing textures that lock in moisture from morning to night.",
    icon: "drop",
  },
  {
    title: "Lasting Glow",
    text: "A soft, healthy radiance that feels as good as it looks — never greasy.",
    icon: "sparkle",
  },
  {
    title: "Made With Love",
    text: "Dermatologically tested, cruelty-free, and crafted in small, careful batches.",
    icon: "heart",
  },
] as const;

export const testimonials = [
  {
    quote:
      "The body lotion absorbs in seconds and the fragrance stays with me all day. It genuinely feels like a little luxury every morning.",
    name: "Priya R.",
    place: "Chennai",
  },
  {
    quote:
      "I gifted the signature set to my sister and she hasn't stopped talking about the packaging. Beautiful inside and out.",
    name: "Arjun M.",
    place: "Bengaluru",
  },
  {
    quote:
      "Finally a body-care brand that feels premium without being heavy. My skin has never felt softer.",
    name: "Sneha K.",
    place: "Hyderabad",
  },
];
