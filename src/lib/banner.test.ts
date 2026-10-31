import { describe, expect, test } from "vitest";
import { validateBanner } from "./admin-validation";
import { bannerButtonPositions, bannerButtonStyles, bannerLinkGroups, defaultBanner, shopPages } from "./banner";

describe("the home banner's starting settings", () => {
  test("are hidden until the shop uploads a picture and switches the banner on", () => {
    expect(defaultBanner).toMatchObject({ enabled: false, image: null, mobileImage: null });
  });

  test("would pass the admin checks if saved as they are", () => {
    expect(validateBanner(defaultBanner)).toEqual({});
  });

  test("place the buttons in one of the allowed spots, in an allowed style", () => {
    expect(bannerButtonPositions).toContain(defaultBanner.buttonPosition);
    expect(bannerButtonStyles).toContain(defaultBanner.buttonStyle);
  });
});

describe("button positions", () => {
  test("cover a 3 × 3 grid: top, middle and bottom, each left, centre and right", () => {
    expect(bannerButtonPositions).toHaveLength(9);
    expect(new Set(bannerButtonPositions).size).toBe(9);
    for (const row of ["top", "middle", "bottom"]) {
      for (const col of ["left", "center", "right"]) expect(bannerButtonPositions).toContain(`${row}-${col}`);
    }
  });
});

describe("the buttons' starting text and links", () => {
  test("show the usual wording and go to the products and our-story pages", () => {
    expect(defaultBanner.primaryButton).toEqual({ label: "", link: "/products/" });
    expect(defaultBanner.secondaryButton).toEqual({ label: "", link: "/about/" });
  });
});

describe("links a button can go to: bannerLinkGroups", () => {
  const categories = [
    { slug: "body-care", label: "Body Care" },
    { slug: "lips", label: "Body Care › Lips" },
  ];
  const products = [{ slug: "rose-mist", name: "Rose Mist" }];

  test("lists the shop's pages, then every category, then every product", () => {
    const groups = bannerLinkGroups(categories, products);
    expect(groups.map((g) => g.name)).toEqual(["Pages", "Categories", "Products"]);
    expect(groups[0].options).toBe(shopPages);
    expect(groups[1].options).toEqual([
      { href: "/products/?category=body-care", name: "Body Care" },
      { href: "/products/?category=lips", name: "Body Care › Lips" },
    ]);
    expect(groups[2].options).toEqual([{ href: "/products/rose-mist/", name: "Rose Mist" }]);
  });

  test("the pages include the ones the buttons start with", () => {
    const hrefs = shopPages.map((p) => p.href);
    expect(hrefs).toContain(defaultBanner.primaryButton.link);
    expect(hrefs).toContain(defaultBanner.secondaryButton.link);
  });

  test("a shop without categories or products only lists its pages", () => {
    expect(bannerLinkGroups([], []).map((g) => g.name)).toEqual(["Pages"]);
  });

  test("odd characters in a slug can't break out of the link", () => {
    const [, cats] = bannerLinkGroups([{ slug: "a&b c", label: "A" }], []);
    expect(cats.options[0].href).toBe("/products/?category=a%26b%20c");
  });
});
