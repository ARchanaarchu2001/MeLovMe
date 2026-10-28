// The scrolling announcement bar above the shop header ("Free shipping…", "Flat 30% off…").
// Edited in /admin/announcement/.

export type AnnouncementMessage = {
  text: string;
  link?: string; // optional: a page in the shop ("/products/") or a full https:// link
};

export type Announcement = {
  enabled: boolean;
  messages: AnnouncementMessage[];
  background: string; // "#rrggbb"
  textColor: string; // "#rrggbb"
  speed: "slow" | "normal" | "fast";
};

// Brand colours: espresso background, gold text
export const defaultAnnouncement: Announcement = {
  enabled: false,
  messages: [{ text: "Free shipping on all prepaid orders" }, { text: "New Summer Collection is here", link: "/products/" }],
  background: "#2e1a11",
  textColor: "#c9a36a",
  speed: "normal",
};

export const announcementSpeeds = ["slow", "normal", "fast"] as const;

// Seconds for one message to scroll past
export const secondsPerMessage: Record<Announcement["speed"], number> = { slow: 9, normal: 6, fast: 3.5 };

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
