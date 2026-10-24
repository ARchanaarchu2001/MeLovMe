import type { Product } from "@/lib/product";

// The starting catalogue: copied into MongoDB the first time the `products` collection is
// empty (see src/lib/server/db.ts). After that, products are managed in /admin/products and
// editing this file changes nothing.
export const seedProducts: Omit<Product, "enabled">[] = [
  {
    slug: "signature-body-lotion",
    name: "Signature Body Lotion",
    category: "Body Care",
    size: "50 ml",
    price: 899,
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
    price: 1499,
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
  // ₹1 product for testing real payments end to end. Disable it in /admin/products before launch.
  {
    slug: "test-product",
    name: "Test Product",
    category: "Test Only",
    size: "Sample",
    price: 1,
    shortDescription: "₹1 test item for checking payments. Not a real product.",
    description:
      "This ₹1 item exists only to test checkout and payments on the live site. It will not be shipped.",
    images: ["/images/body-lotion-box.webp"],
    highlights: ["For payment testing only", "Will not be shipped"],
    ingredients: ["—"],
    howToUse: "Add to cart, check out and pay ₹1 to test the payment flow.",
  },
];
