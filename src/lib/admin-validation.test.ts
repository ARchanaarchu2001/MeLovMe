import { describe, expect, test } from "vitest";
import {
  hasAnnouncementErrors,
  hasBannerErrors,
  isDate,
  onlyDigits,
  stockError,
  toSlug,
  validateAdminReview,
  validateAnnouncement,
  validateBanner,
  validateOrderUpdate,
  validateProduct,
  type OrderUpdateInput,
  type ProductInput,
} from "./admin-validation";
import { defaultAnnouncement, type Announcement } from "./announcement";
import { defaultBanner, type Banner } from "./banner";
import type { ReviewInput } from "./review";

// ---------- Products ----------

// A complete, valid product as the form sends it: ₹1,550, 20 in stock, 2 for ₹3,000
const mist: ProductInput = {
  slug: "rose-body-mist",
  name: "Rose Body Mist",
  categoryId: "mists",
  size: "100 ml",
  price: 1550,
  stock: 20,
  shortDescription: "A light rose mist.",
  description: "A light, fresh body mist with real rose water.",
  images: ["https://res.cloudinary.com/demo/image/upload/mist.webp"],
  highlights: ["Rose water", "Alcohol free"],
  ingredients: ["Water", "Rose extract"],
  howToUse: "Spray on skin after a bath.",
  enabled: true,
  offer: null,
  combos: [{ qty: 2, price: 3000 }],
};
const check = (change: Partial<ProductInput>) => validateProduct({ ...mist, ...change });
const offer = (change: Partial<NonNullable<ProductInput["offer"]>>) =>
  check({ offer: { type: "percent", value: 20, startDate: "", endDate: "", ...change } });
const lines = (count: number, text = "Line") => Array.from({ length: count }, (_, i) => `${text} ${i + 1}`);

describe("product form: a valid product", () => {
  test("a complete product has no errors", () => {
    expect(check({})).toEqual({});
  });

  test("optional parts can be left empty: highlights, ingredients, how to use, combos", () => {
    expect(check({ highlights: [], ingredients: [], howToUse: "", combos: [] })).toEqual({});
  });

  test("reports every problem at once", () => {
    const errors = check({ slug: "", name: "", categoryId: "", price: 0, images: [], combos: [] });
    expect(Object.keys(errors).sort()).toEqual(["categoryId", "images", "name", "price", "slug"]);
  });
});

describe("product form: URL name (slug)", () => {
  test("is required", () => {
    expect(check({ slug: "" }).slug).toBe("Enter a URL name.");
  });

  test("lowercase words and numbers joined by single dashes are fine", () => {
    expect(check({ slug: "rose-mist-2" }).slug).toBeUndefined();
    expect(check({ slug: "lotion" }).slug).toBeUndefined();
  });

  test("capitals, spaces, underscores, double or end dashes are refused", () => {
    for (const slug of ["Rose-Mist", "rose mist", "rose_mist", "rose--mist", "-rose", "rose-"]) {
      expect(check({ slug }).slug).toMatch(/lowercase letters, numbers and dashes/);
    }
  });

  test("can be up to 60 characters", () => {
    expect(check({ slug: "a".repeat(60) }).slug).toBeUndefined();
    expect(check({ slug: "a".repeat(61) }).slug).toBe("Keep it under 60 characters.");
  });
});

describe("product form: name", () => {
  test("is required, and spaces alone don't count", () => {
    expect(check({ name: "   " }).name).toBe("Enter a name.");
  });

  test("must contain letters", () => {
    expect(check({ name: "12345" }).name).toBe("The name must contain letters.");
  });

  test("letters in any language are fine", () => {
    expect(check({ name: "गुलाब Mist" }).name).toBeUndefined();
  });

  test("can be up to 100 characters, not counting spaces at the ends", () => {
    expect(check({ name: ` ${"a".repeat(100)} ` }).name).toBeUndefined();
    expect(check({ name: "a".repeat(101) }).name).toBe("Keep it under 100 characters.");
  });
});

describe("product form: category and size", () => {
  test("a category must be chosen", () => {
    expect(check({ categoryId: "" }).categoryId).toBe("Choose a category.");
  });

  test("a size is required", () => {
    expect(check({ size: " " }).size).toBe("Enter a size, e.g. 50 ml.");
  });

  test("a size needs a letter or number, not just symbols", () => {
    expect(check({ size: "--" }).size).toBe("Enter a size, e.g. 50 ml.");
    expect(check({ size: "50" }).size).toBeUndefined();
  });

  test("a size can be up to 50 characters", () => {
    expect(check({ size: "a".repeat(50) }).size).toBeUndefined();
    expect(check({ size: "a".repeat(51) }).size).toBe("Keep it under 50 characters.");
  });
});

describe("product form: price and stock", () => {
  test("the price is whole rupees from ₹1 to ₹10,00,000", () => {
    expect(check({ price: 1, combos: [] }).price).toBeUndefined();
    expect(check({ price: 1_000_000 }).price).toBeUndefined();
  });

  test("a price of ₹0, below zero, with paise, too big or empty is refused", () => {
    for (const price of [0, -5, 1.5, 1_000_001, NaN]) {
      expect(check({ price }).price).toBe("Enter a price in whole rupees (at least ₹1).");
    }
  });

  test("stock can be 0 or more whole units", () => {
    expect(check({ stock: 0 }).stock).toBeUndefined();
    expect(check({ stock: 1_000_000 }).stock).toBeUndefined();
  });

  test("stock left untouched while editing isn't checked", () => {
    expect(check({ stock: null }).stock).toBeUndefined();
  });

  test("negative, part or huge stock counts are refused", () => {
    for (const stock of [-1, 2.5, 1_000_001, NaN]) {
      expect(check({ stock }).stock).toBe("Enter how many you have, in whole units (0 if none).");
    }
  });
});

describe("product form: descriptions", () => {
  test("a short description is required", () => {
    expect(check({ shortDescription: "  " }).shortDescription).toBe("Enter a short description.");
  });

  test("a short description needs 10 to 300 characters", () => {
    expect(check({ shortDescription: "Too short" }).shortDescription).toBe("Write at least 10 characters."); // 9
    expect(check({ shortDescription: "Just right" }).shortDescription).toBeUndefined(); // 10
    expect(check({ shortDescription: "a".repeat(300) }).shortDescription).toBeUndefined();
    expect(check({ shortDescription: "a".repeat(301) }).shortDescription).toBe("Keep it under 300 characters.");
  });

  test("a description is required", () => {
    expect(check({ description: "" }).description).toBe("Enter a description.");
  });

  test("a description needs 20 to 5,000 characters", () => {
    expect(check({ description: "a".repeat(19) }).description).toBe("Write at least 20 characters.");
    expect(check({ description: "a".repeat(20) }).description).toBeUndefined();
    expect(check({ description: "a".repeat(5001) }).description).toBe("Keep it under 5000 characters.");
  });

  test("spaces at the ends don't count towards the minimum", () => {
    expect(check({ description: `   ${"a".repeat(19)}   ` }).description).toBe("Write at least 20 characters.");
  });

  test("how to use can be up to 2,000 characters", () => {
    expect(check({ howToUse: "a".repeat(2000) }).howToUse).toBeUndefined();
    expect(check({ howToUse: "a".repeat(2001) }).howToUse).toBe("Keep it under 2000 characters.");
  });
});

describe("product form: highlights and ingredients", () => {
  test("up to 20 highlights", () => {
    expect(check({ highlights: lines(20) }).highlights).toBeUndefined();
    expect(check({ highlights: lines(21) }).highlights).toBe("Up to 20 highlights.");
  });

  test("blank highlight lines aren't counted", () => {
    expect(check({ highlights: [...lines(20), "", "  "] }).highlights).toBeUndefined();
  });

  test("each highlight can be up to 200 characters", () => {
    expect(check({ highlights: ["a".repeat(200)] }).highlights).toBeUndefined();
    expect(check({ highlights: ["a".repeat(201)] }).highlights).toBe("Keep each line under 200 characters.");
  });

  test("up to 30 ingredients", () => {
    expect(check({ ingredients: lines(30) }).ingredients).toBeUndefined();
    expect(check({ ingredients: lines(31) }).ingredients).toBe("Up to 30 ingredients.");
  });

  test("each ingredient can be up to 100 characters", () => {
    expect(check({ ingredients: ["a".repeat(100)] }).ingredients).toBeUndefined();
    expect(check({ ingredients: ["a".repeat(101)] }).ingredients).toBe("Keep each line under 100 characters.");
  });
});

describe("product form: images", () => {
  test("at least one image is needed", () => {
    expect(check({ images: [] }).images).toBe("Add at least one image.");
  });

  test("up to 8 images", () => {
    expect(check({ images: lines(8, "img") }).images).toBeUndefined();
    expect(check({ images: lines(9, "img") }).images).toBe("Up to 8 images.");
  });
});

describe("product form: offer", () => {
  test("a % offer from 1% to 90% is fine", () => {
    expect(offer({ value: 1 })).toEqual({});
    expect(offer({ value: 90 })).toEqual({});
  });

  test("a % offer above 90% or with a fraction is refused", () => {
    expect(offer({ value: 91 }).offerValue).toBe("Enter a whole % between 1 and 90.");
    expect(offer({ value: 12.5 }).offerValue).toBe("Enter a whole % between 1 and 90.");
  });

  test("an empty discount box (0 or not a number) asks for the discount", () => {
    expect(offer({ value: 0 }).offerValue).toBe("Enter the discount.");
    expect(offer({ value: NaN }).offerValue).toBe("Enter the discount.");
  });

  test("a ₹ offer must be whole rupees and less than the price", () => {
    // price is ₹1,550
    expect(offer({ type: "flat", value: 1549 })).toEqual({});
    expect(offer({ type: "flat", value: 1550 }).offerValue).toBe("Enter whole rupees, less than the price.");
    expect(offer({ type: "flat", value: 99.5 }).offerValue).toBe("Enter whole rupees, less than the price.");
  });

  test("an unknown kind of offer is refused", () => {
    expect(offer({ type: "bogo" as "flat" }).offerValue).toBe("Choose % off or ₹ off.");
  });

  test("dates are optional, and either one can be given alone", () => {
    expect(offer({ startDate: "2026-06-10" })).toEqual({});
    expect(offer({ endDate: "2026-06-20" })).toEqual({});
  });

  test("an offer can start and end on the same day", () => {
    expect(offer({ startDate: "2026-06-10", endDate: "2026-06-10" })).toEqual({});
  });

  test("an end date before the start date is refused", () => {
    expect(offer({ startDate: "2026-06-20", endDate: "2026-06-10" }).offerDates).toBe("The end date is before the start date.");
  });

  test("dates that don't exist on the calendar are refused", () => {
    expect(offer({ startDate: "2026-02-30" }).offerDates).toBe("Enter valid dates.");
    expect(offer({ endDate: "20-06-2026" }).offerDates).toBe("Enter valid dates.");
  });

  // Suspected bug: isDate throws "Invalid time value" for month 13, month 00, day 00 or day 32
  test.todo("a date with an impossible month or day (2026-13-01, 2026-06-32) is refused rather than crashing");
});

describe("product form: combos", () => {
  test("up to 4 combos", () => {
    const four = [2, 3, 4, 5].map((qty) => ({ qty, price: 1500 * qty }));
    expect(check({ combos: four }).combos).toBeUndefined();
    expect(check({ combos: [...four, { qty: 6, price: 9000 }] }).combos).toBe("Up to 4 combos.");
  });

  test("a combo is for 2 to 10 whole pieces", () => {
    expect(check({ combos: [{ qty: 10, price: 15000 }] }).combos).toBeUndefined(); // 10 × ₹1,550 = ₹15,500
    for (const qty of [1, 11, 2.5]) {
      expect(check({ combos: [{ qty, price: 1000 }] }).combos).toBe("Pieces must be a whole number from 2 to 10.");
    }
  });

  test("two combos for the same number of pieces are refused", () => {
    const twice = [
      { qty: 2, price: 3000 },
      { qty: 2, price: 2900 },
    ];
    expect(check({ combos: twice }).combos).toBe("There are two combos for 2 pieces. Keep one.");
  });

  test("a combo needs a total price in whole rupees", () => {
    for (const price of [0, 2999.5, NaN]) {
      expect(check({ combos: [{ qty: 2, price }] }).combos).toBe("Enter the total price for 2 pieces in whole rupees.");
    }
  });

  test("a combo must cost less than buying the pieces one by one", () => {
    // 2 × ₹1,550 = ₹3,100
    expect(check({ combos: [{ qty: 2, price: 3099 }] }).combos).toBeUndefined();
    expect(check({ combos: [{ qty: 2, price: 3100 }] }).combos).toBe("2 pieces must cost less than ₹3100 (2 × the price), or it isn't a deal.");
  });

  test("only the first combo problem is shown", () => {
    const bad = [
      { qty: 1, price: 1000 },
      { qty: 3, price: 9999 },
    ];
    expect(check({ combos: bad }).combos).toBe("Pieces must be a whole number from 2 to 10.");
  });
});

describe("URL names from product names: toSlug", () => {
  test("lowercases and joins words with dashes", () => {
    expect(toSlug("Rose Body Mist")).toBe("rose-body-mist");
  });

  test("drops symbols and spaces at the ends", () => {
    expect(toSlug("  Shea & Cocoa Butter (200 ml)!  ")).toBe("shea-cocoa-butter-200-ml");
  });

  test("a name with no letters or numbers becomes 'product'", () => {
    expect(toSlug("!!!")).toBe("product");
  });

  test("is cut to 60 characters, without a dash left at the end", () => {
    // 59 a's, a space, then more: cut at 60 would end in a dash
    expect(toSlug(`${"a".repeat(59)} bcdef`)).toBe("a".repeat(59));
  });

  test("the result always passes the URL name check", () => {
    for (const name of ["Rose Body Mist", "  Shea & Cocoa  ", "123", "!!!"]) expect(check({ slug: toSlug(name) }).slug).toBeUndefined();
  });

  // Suspected bug: accents split the word ("Café Crème" → "cafe-cre-me")
  test.todo("accented letters keep the word together: 'Café Crème' → 'cafe-creme'");
});

describe("number boxes: onlyDigits", () => {
  test("keeps only the digits of what's typed or pasted", () => {
    expect(onlyDigits("₹1,550")).toBe("1550");
  });

  test("allows up to 7 digits by default (₹10,00,000)", () => {
    expect(onlyDigits("12345678")).toBe("1234567");
  });

  test("can allow fewer digits", () => {
    expect(onlyDigits("1234", 3)).toBe("123");
  });

  test("text with no digits becomes empty", () => {
    expect(onlyDigits("abc")).toBe("");
  });
});

describe("dates: isDate", () => {
  test("accepts real calendar dates written YYYY-MM-DD", () => {
    expect(isDate("2026-06-15")).toBe(true);
    expect(isDate("2028-02-29")).toBe(true); // leap year
  });

  test("refuses days that don't exist in that month", () => {
    expect(isDate("2026-02-29")).toBe(false); // not a leap year
    expect(isDate("2026-04-31")).toBe(false);
  });

  test("refuses other ways of writing a date", () => {
    for (const s of ["15-06-2026", "2026/06/15", "2026-6-15", "", "2026-06-15T00:00"]) expect(isDate(s)).toBe(false);
  });
});

describe("quick stock edits: stockError", () => {
  test("0 up to 10,00,000 whole units is fine", () => {
    expect(stockError(0)).toBeNull();
    expect(stockError(1_000_000)).toBeNull();
  });

  test("negative, part, huge or empty counts are refused", () => {
    for (const n of [-1, 2.5, 1_000_001, NaN]) expect(stockError(n)).toBe("Enter whole units (0 if none).");
  });
});

// ---------- Orders ----------

const shipped: OrderUpdateInput = { fulfillment: "shipped", courier: "Delhivery", trackingNumber: "DL-1234567", adminNote: "" };
const checkOrder = (change: Partial<OrderUpdateInput>) => validateOrderUpdate({ ...shipped, ...change });

describe("order updates: validateOrderUpdate", () => {
  test("a shipped order with courier and tracking number has no errors", () => {
    expect(checkOrder({})).toEqual({});
  });

  test("courier and tracking number are optional", () => {
    expect(checkOrder({ fulfillment: "packed", courier: "", trackingNumber: "" })).toEqual({});
  });

  test("an unknown status is refused", () => {
    expect(checkOrder({ fulfillment: "lost" as OrderUpdateInput["fulfillment"] }).fulfillment).toBe("Choose a valid status.");
  });

  test("courier names with letters, numbers, spaces and & . ' ( ) - are fine", () => {
    for (const courier of ["Blue Dart", "DTDC", "India Post (Speed Post)", "Ekart-Logistics", "Shree Maruti & Co."]) {
      expect(checkOrder({ courier }).courier).toBeUndefined();
    }
  });

  test("courier names starting with a symbol or containing other symbols are refused", () => {
    for (const courier of ["-DTDC", "Delhivery!", "Blue/Dart"]) {
      expect(checkOrder({ courier }).courier).toBe("Use letters and numbers only, e.g. Delhivery.");
    }
  });

  test("a courier name can be up to 60 characters", () => {
    expect(checkOrder({ courier: "a".repeat(60) }).courier).toBeUndefined();
    expect(checkOrder({ courier: "a".repeat(61) }).courier).toBe("Keep it under 60 characters.");
  });

  test("a tracking number is at least 4 letters, numbers or dashes", () => {
    expect(checkOrder({ trackingNumber: "AB12" }).trackingNumber).toBeUndefined();
    expect(checkOrder({ trackingNumber: "AB1" }).trackingNumber).toBe("Use letters, numbers and dashes, at least 4.");
    expect(checkOrder({ trackingNumber: "AB 1234" }).trackingNumber).toBe("Use letters, numbers and dashes, at least 4.");
  });

  test("a tracking number can be up to 40 characters", () => {
    expect(checkOrder({ trackingNumber: "A".repeat(40) }).trackingNumber).toBeUndefined();
    expect(checkOrder({ trackingNumber: "A".repeat(41) }).trackingNumber).toBe("Keep it under 40 characters.");
  });

  test("spaces around the courier and tracking number are ignored", () => {
    expect(checkOrder({ courier: "  Delhivery ", trackingNumber: " DL-1234567 " })).toEqual({});
  });

  test("a tracking number needs the courier too", () => {
    expect(checkOrder({ courier: "  " }).courier).toBe("Enter the courier for this tracking number.");
  });

  test("an invalid courier keeps its own message when there is a tracking number", () => {
    expect(checkOrder({ courier: "!!" }).courier).toBe("Use letters and numbers only, e.g. Delhivery.");
  });

  test("a note for the shop can be up to 2,000 characters", () => {
    expect(checkOrder({ adminNote: "a".repeat(2000) }).adminNote).toBeUndefined();
    expect(checkOrder({ adminNote: "a".repeat(2001) }).adminNote).toBe("Keep it under 2000 characters.");
  });
});

// ---------- Announcement bar ----------

const bar: Announcement = { ...defaultAnnouncement, enabled: true };
const checkBar = (change: Partial<Announcement>) => validateAnnouncement({ ...bar, ...change });

describe("announcement bar: validateAnnouncement", () => {
  test("the starting settings switched on have no errors", () => {
    expect(checkBar({})).toEqual({});
    expect(hasAnnouncementErrors(checkBar({}))).toBe(false);
  });

  test("a bar that is on needs at least one message", () => {
    expect(checkBar({ messages: [] }).form).toBe("Add at least one message, or switch the bar off.");
    expect(checkBar({ messages: [{ text: "   " }] }).form).toBe("Add at least one message, or switch the bar off.");
  });

  test("a bar that is off can have no messages", () => {
    expect(checkBar({ enabled: false, messages: [] })).toEqual({});
  });

  test("up to 10 messages", () => {
    const messages = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `Message ${i + 1}` }));
    expect(checkBar({ messages: messages(10) }).form).toBeUndefined();
    expect(checkBar({ messages: messages(11) }).form).toBe("Up to 10 messages.");
  });

  test("empty rows are ignored when counting messages", () => {
    const messages = [...Array.from({ length: 10 }, (_, i) => ({ text: `Message ${i + 1}` })), { text: "" }, { text: " " }];
    expect(checkBar({ messages })).toEqual({});
  });

  test("a message can be up to 120 characters", () => {
    expect(checkBar({ messages: [{ text: "a".repeat(120) }] })).toEqual({});
    expect(checkBar({ messages: [{ text: "a".repeat(121) }] }).messages?.[0]?.text).toBe("Keep it under 120 characters.");
  });

  test("a link without a message asks for the message", () => {
    expect(checkBar({ messages: [{ text: "Sale", link: "/products/" }, { text: "", link: "/products/" }] }).messages).toEqual([
      undefined,
      { text: "Enter the message for this link, or remove the row." },
    ]);
  });

  test("links can be a shop page or a secure link to another site", () => {
    for (const link of ["/products/", "/", "/products/?category=body-care", "https://instagram.com/melovme"]) {
      expect(checkBar({ messages: [{ text: "Sale", link }] })).toEqual({});
    }
  });

  test("other links are refused: insecure, other-site shortcuts, no dot, or plain words", () => {
    for (const link of ["http://example.com", "//evil.com", "https://localhost", "products", "javascript:alert(1)", "/a b"]) {
      expect(checkBar({ messages: [{ text: "Sale", link }] }).messages?.[0]?.link).toBe("Start with / (a shop page) or https://");
    }
  });

  test("a link can be up to 300 characters", () => {
    const link = (n: number) => `/${"a".repeat(n - 1)}`;
    expect(checkBar({ messages: [{ text: "Sale", link: link(300) }] })).toEqual({});
    expect(checkBar({ messages: [{ text: "Sale", link: link(301) }] }).messages?.[0]?.link).toBe("Keep it under 300 characters.");
  });

  test("errors are marked on the right row", () => {
    const errors = checkBar({ messages: [{ text: "Fine" }, { text: "Bad link", link: "http://x.com" }, { text: "Fine too" }] });
    expect(errors.messages).toEqual([undefined, { link: "Start with / (a shop page) or https://" }, undefined]);
  });

  test("colours must be six-digit codes", () => {
    const errors = checkBar({ background: "brown", textColor: "#fff" });
    expect(errors.background).toBe("Enter a colour code like #2E1A11.");
    expect(errors.textColor).toBe("Enter a colour code like #C9A36A.");
  });

  test("the text can't be the same colour as the background, whatever the capitals", () => {
    expect(checkBar({ background: "#2E1A11", textColor: "#2e1a11" }).textColor).toBe("The text must be a different colour from the background.");
  });

  test("any error makes the form invalid", () => {
    expect(hasAnnouncementErrors(checkBar({ background: "brown" }))).toBe(true);
  });
});

// ---------- Home banner ----------

const picture = { url: "https://res.cloudinary.com/demo/image/upload/banner.webp", width: 1920, height: 800 };
const banner: Banner = { ...defaultBanner, enabled: true, image: picture, alt: "Rose mist on a marble table" };
const checkBanner = (change: Partial<Banner>) => validateBanner({ ...banner, ...change });

describe("home banner: validateBanner", () => {
  test("a banner with a picture has no errors", () => {
    expect(checkBanner({})).toEqual({});
    expect(hasBannerErrors(checkBanner({}))).toBe(false);
  });

  test("a phone picture is optional, and allowed", () => {
    expect(checkBanner({ mobileImage: { ...picture, width: 800, height: 1200 } })).toEqual({});
  });

  test("a banner that is on needs a picture", () => {
    expect(checkBanner({ image: null }).image).toBe("Upload a banner picture, or switch the banner off.");
  });

  test("a banner that is off doesn't need a picture", () => {
    expect(checkBanner({ enabled: false, image: null })).toEqual({});
  });

  test("a picture without a size has to be uploaded again", () => {
    expect(checkBanner({ image: { ...picture, width: 0 } }).image).toBe("Upload this picture again.");
    expect(checkBanner({ image: { ...picture, height: NaN } }).image).toBe("Upload this picture again.");
  });

  test("a phone picture without a size has to be uploaded again", () => {
    expect(checkBanner({ mobileImage: { ...picture, height: 0 } }).mobileImage).toBe("Upload this picture again.");
  });

  test("the picture description can be up to 150 characters", () => {
    expect(checkBanner({ alt: "a".repeat(150) })).toEqual({});
    expect(checkBanner({ alt: "a".repeat(151) }).alt).toBe("Keep it under 150 characters.");
  });

  test("any error makes the form invalid", () => {
    expect(hasBannerErrors(checkBanner({ image: null }))).toBe(true);
  });

  test("buttons can link to a shop page, a category, a product or a secure site", () => {
    for (const link of ["/", "/products/?category=gift-sets", "/products/rose-mist/", "https://instagram.com/melovme"]) {
      expect(checkBanner({ primaryButton: { label: "Go", link } })).toEqual({});
    }
  });

  test("a button needs a link", () => {
    expect(checkBanner({ primaryButton: { label: "Go", link: " " } }).primaryLink).toBe("Choose where this button goes.");
    expect(checkBanner({ secondaryButton: { label: "Go", link: "" } }).secondaryLink).toBe("Choose where this button goes.");
  });

  test("a button link that isn't a shop page or https is refused", () => {
    for (const link of ["javascript:alert(1)", "http://example.com", "//evil.example", "products"]) {
      expect(checkBanner({ primaryButton: { label: "Go", link } }).primaryLink).toBe("Start with / (a shop page) or https://");
    }
  });

  test("button text is optional and can be up to 30 characters", () => {
    expect(checkBanner({ primaryButton: { label: "", link: "/products/" } })).toEqual({});
    expect(checkBanner({ primaryButton: { label: "a".repeat(30), link: "/products/" } })).toEqual({});
    expect(checkBanner({ secondaryButton: { label: "a".repeat(31), link: "/about/" } }).secondaryLabel).toBe("Keep it under 30 characters.");
  });

  test("with the buttons switched off, their text and links aren't checked", () => {
    expect(checkBanner({ showButtons: false, primaryButton: { label: "a".repeat(31), link: "" } })).toEqual({});
  });
});

// ---------- Reviews added by the shop ----------

const goodReview: ReviewInput = { name: "Anjali R.", rating: 5, title: "Lovely", text: "Smells like real roses." };
const checkReview = (change: Partial<ReviewInput>, slug = "rose-body-mist") => validateAdminReview(slug, { ...goodReview, ...change });

describe("shop-added reviews: validateAdminReview", () => {
  test("a complete review has no errors", () => {
    expect(checkReview({})).toEqual({});
  });

  test("the title is optional", () => {
    expect(checkReview({ title: "" })).toEqual({});
  });

  test("a product must be chosen", () => {
    expect(checkReview({}, "").productSlug).toBe("Choose a product.");
  });

  test("the rating is 1 to 5 whole stars", () => {
    for (const rating of [1, 5]) expect(checkReview({ rating }).rating).toBeUndefined();
    for (const rating of [0, 6, 4.5, NaN]) expect(checkReview({ rating }).rating).toBe("Choose a rating from 1 to 5 stars.");
  });

  test("a name is required", () => {
    expect(checkReview({ name: "  " }).name).toBe("Enter the name to show with the review.");
  });

  test("a name needs at least 2 letters", () => {
    expect(checkReview({ name: "A" }).name).toBe("Enter at least 2 letters.");
  });

  test("a name can be up to 40 characters", () => {
    expect(checkReview({ name: "a".repeat(40) }).name).toBeUndefined();
    expect(checkReview({ name: "a".repeat(41) }).name).toBe("Keep it under 40 characters.");
  });

  test("names use letters, spaces and . ' - in any language", () => {
    for (const name of ["D'Souza", "Mary-Ann", "अंजलि"]) expect(checkReview({ name }).name).toBeUndefined();
  });

  test("names with numbers or other symbols are refused", () => {
    for (const name of ["Anjali123", "@anjali", ".Anjali"]) expect(checkReview({ name }).name).toBe("Use letters only, e.g. Anjali R.");
  });

  test("a title can be up to 100 characters", () => {
    expect(checkReview({ title: "a".repeat(100) }).title).toBeUndefined();
    expect(checkReview({ title: "a".repeat(101) }).title).toBe("Keep it under 100 characters.");
  });

  test("the review text is required", () => {
    expect(checkReview({ text: " " }).text).toBe("Write the review.");
  });

  test("the review text needs 5 to 2,000 characters", () => {
    expect(checkReview({ text: "Good" }).text).toBe("Write at least 5 characters.");
    expect(checkReview({ text: "Great" }).text).toBeUndefined();
    expect(checkReview({ text: "a".repeat(2000) }).text).toBeUndefined();
    expect(checkReview({ text: "a".repeat(2001) }).text).toBe("Keep it under 2000 characters.");
  });
});
