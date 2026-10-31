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

export type Banner = {
  enabled: boolean;
  image: BannerImage | null; // wide picture for computers and tablets
  mobileImage: BannerImage | null; // optional taller picture for phones
  alt: string; // what the picture shows, for screen readers and search engines
  showButtons: boolean;
  buttonPosition: BannerButtonPosition;
  buttonStyle: (typeof bannerButtonStyles)[number]; // light buttons suit dark pictures, and the other way round
};

export const defaultBanner: Banner = {
  enabled: false,
  image: null,
  mobileImage: null,
  alt: "",
  showButtons: true,
  buttonPosition: "bottom-left",
  buttonStyle: "light",
};
