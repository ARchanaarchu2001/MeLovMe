// Static product catalogue. To add a product, append an object to this array
// and drop its images into /public/images — a page is generated for it automatically.

export type Product = {
  slug: string;
  name: string;
  category: string;
  size: string;
  price: string;
  shortDescription: string;
  description: string;
  images: string[];
  highlights: string[];
  ingredients: string[];
  howToUse: string;
};

export const products: Product[] = [
  {
    slug: "signature-body-lotion",
    name: "Signature Body Lotion",
    category: "Body Care",
    size: "50 ml",
    price: "₹899",
    shortDescription:
      "A silky, fast-absorbing lotion that deeply hydrates and leaves a soft signature scent.",
    description:
      "Our Signature Body Lotion is a lightweight, non-greasy formula enriched with shea butter, jasmine extract and vitamin E. It melts into the skin to deliver lasting hydration, restoring softness and a natural glow — wrapped in a delicate floral note that becomes uniquely yours.",
    images: ["/images/body-lotion.webp", "/images/body-lotion-box.webp"],
    highlights: [
      "24-hour hydration",
      "Non-greasy, fast-absorbing texture",
      "Delicate jasmine & white-floral scent",
      "Suitable for all skin types",
    ],
    ingredients: ["Shea Butter", "Jasmine Extract", "Vitamin E", "Aloe Vera", "Almond Oil"],
    howToUse:
      "Apply generously to clean, slightly damp skin after bathing. Massage gently in circular motions until fully absorbed. Use daily for best results.",
  },
  {
    slug: "signature-gift-set",
    name: "Signature Gift Set",
    category: "Gift Collection",
    size: "Gift Box + Velvet Pouch",
    price: "₹1,499",
    shortDescription:
      "More than just a scent — our signature essentials in a luxurious keepsake box and velvet pouch.",
    description:
      "The Signature Gift Set brings together our most-loved body-care essentials, presented in a textured chocolate gift box with gold-foil botanical detailing and a soft velvet drawstring pouch. Complete with a personal message card, it's the perfect way to say “you deserve this” — to someone special, or to yourself.",
    images: ["/images/gift-set.webp"],
    highlights: [
      "Premium textured gift box with gold-foil details",
      "Reusable velvet drawstring pouch",
      "Personal message card included",
      "Ready to gift — no wrapping needed",
    ],
    ingredients: ["Shea Butter", "Jasmine Extract", "Sandalwood Notes", "Vitamin E"],
    howToUse:
      "Unbox, unwind and enjoy. Use the lotion daily after bathing; keep the velvet pouch for travel essentials.",
  },
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}
