// The banner picture at the top of the home page, shown in place of the built-in hero, with the
// "Explore Products" and "Our Story" buttons placed over it. Edited in /admin/banner/.

export type BannerImage = {
  url: string;
  width: number; // pixels, so the banner keeps its shape (and the page doesn't jump) while loading
  height: number;
};

export const bannerButtonPositions = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type BannerButtonPosition = (typeof bannerButtonPositions)[number];

// Longest description of the picture
export const BANNER_ALT_MAX = 150;

export const bannerButtonStyles = ["light", "dark"] as const;

// One of the two buttons. An empty label shows the shop's usual wording ("Explore Products", "Our Story").
export type BannerButton = { label: string; link: string };
export const bannerButtonLimits = { label: 30, link: 300 };

// A page the admin can send a button to, listed in the link picker
export type LinkOption = { href: string; name: string };
export type LinkGroup = { name: string; options: LinkOption[] };

export const shopPages: LinkOption[] = [
  { href: "/", name: "Home" },
  { href: "/products/", name: "All products" },
  { href: "/about/", name: "Our story" },
  { href: "/contact/", name: "Contact" },
  { href: "/wishlist/", name: "Wishlist" },
  { href: "/cart/", name: "Cart" },
  { href: "/orders/", name: "My orders" },
  { href: "/profile/", name: "My account" },
  { href: "/privacy-policy/", name: "Privacy policy" },
  { href: "/refund-policy/", name: "Refund policy" },
];

// Every page of the shop: its pages, each category (with its path, e.g. "Body Care › Lips") and each product
export function bannerLinkGroups(
  categories: { slug: string; label: string }[],
  products: { slug: string; name: string }[],
): LinkGroup[] {
  return [
    { name: "Pages", options: shopPages },
    { name: "Categories", options: categories.map((c) => ({ href: `/products/?category=${encodeURIComponent(c.slug)}`, name: c.label })) },
    { name: "Products", options: products.map((p) => ({ href: `/products/${encodeURIComponent(p.slug)}/`, name: p.name })) },
  ].filter((g) => g.options.length > 0);
}

export type Banner = {
  enabled: boolean;
  image: BannerImage | null; // wide picture for computers and tablets
  mobileImage: BannerImage | null; // optional taller picture for phones
  alt: string; // what the picture shows, for screen readers and search engines
  showButtons: boolean;
  buttonPosition: BannerButtonPosition;
  buttonStyle: (typeof bannerButtonStyles)[number]; // light buttons suit dark pictures, and the other way round
  primaryButton: BannerButton; // the filled button, "Explore Products" unless changed
  secondaryButton: BannerButton; // the outlined one, "Our Story" unless changed
};

export const defaultBanner: Banner = {
  enabled: false,
  image: null,
  mobileImage: null,
  alt: "",
  showButtons: true,
  buttonPosition: "bottom-left",
  buttonStyle: "light",
  primaryButton: { label: "", link: "/products/" },
  secondaryButton: { label: "", link: "/about/" },
};
