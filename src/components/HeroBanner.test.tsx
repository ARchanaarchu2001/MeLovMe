import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { Banner, BannerImage } from "@/lib/banner";
import HeroBanner from "./HeroBanner";

afterEach(cleanup);

const wide: BannerImage = { url: "https://img/wide.jpg", width: 1600, height: 600 };
const tall: BannerImage = { url: "https://img/tall.jpg", width: 800, height: 1000 };
const labels = { heading: "Body care, your signature", explore: "Explore Products", ourStory: "Our Story" };
const banner = (overrides: Partial<Banner & { image: BannerImage }> = {}): Banner & { image: BannerImage } => ({
  enabled: true,
  image: wide,
  mobileImage: null,
  alt: "Summer collection on a beach",
  showButtons: true,
  buttonPosition: "bottom-left",
  buttonStyle: "light",
  primaryButton: { label: "", link: "/products/" },
  secondaryButton: { label: "", link: "/about/" },
  ...overrides,
});

describe("HeroBanner", () => {
  test("shows the picture with its description, which is also the page heading", () => {
    render(<HeroBanner banner={banner()} labels={labels} />);
    expect(screen.getByRole("img", { name: "Summer collection on a beach" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Summer collection on a beach" })).toBeInTheDocument();
  });

  test("without a description the heading falls back to the shop's", () => {
    render(<HeroBanner banner={banner({ alt: "" })} labels={labels} />);
    expect(screen.getByRole("heading", { level: 1, name: "Body care, your signature" })).toBeInTheDocument();
  });

  test("phones get the tall picture and computers the wide one", () => {
    const { container } = render(<HeroBanner banner={banner({ mobileImage: tall })} labels={labels} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", tall.url);
    expect(container.querySelector("source")).toHaveAttribute("srcset", wide.url);
  });

  test("the admin preview shows the picture for the chosen screen", () => {
    const { rerender } = render(<HeroBanner banner={banner({ mobileImage: tall })} labels={labels} view="mobile" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", tall.url);
    rerender(<HeroBanner banner={banner({ mobileImage: tall })} labels={labels} view="desktop" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", wide.url);
  });

  test("has Explore Products and Our Story buttons", () => {
    render(<HeroBanner banner={banner({ mobileImage: tall })} labels={labels} />);
    expect(screen.getByRole("link", { name: "Explore Products" }).getAttribute("href")).toMatch(/^\/products\/?$/);
    expect(screen.getByRole("link", { name: "Our Story" }).getAttribute("href")).toMatch(/^\/about\/?$/);
  });

  test("the buttons show the admin's own text and go to the admin's links", () => {
    const b = banner({
      mobileImage: tall,
      primaryButton: { label: "Shop the sale", link: "/products/?category=gift-sets" },
      secondaryButton: { label: "Rose Mist", link: "/products/rose-mist/" },
    });
    render(<HeroBanner banner={b} labels={labels} />);
    // Without the app's config, next/link drops the trailing slash
    expect(screen.getByRole("link", { name: "Shop the sale" }).getAttribute("href")).toMatch(/^\/products\/?\?category=gift-sets$/);
    expect(screen.getByRole("link", { name: "Rose Mist" }).getAttribute("href")).toMatch(/^\/products\/rose-mist\/?$/);
    expect(screen.queryByRole("link", { name: "Explore Products" })).toBeNull();
  });

  test("a button with empty text keeps the shop's usual wording", () => {
    render(<HeroBanner banner={banner({ mobileImage: tall, primaryButton: { label: "  ", link: "/contact/" } })} labels={labels} />);
    expect(screen.getByRole("link", { name: "Explore Products" }).getAttribute("href")).toMatch(/^\/contact\/?$/);
  });

  test("a link to another site opens in a new tab", () => {
    const b = banner({ mobileImage: tall, secondaryButton: { label: "Instagram", link: "https://instagram.com/melovme" } });
    render(<HeroBanner banner={b} labels={labels} />);
    const link = screen.getByRole("link", { name: "Instagram" });
    expect(link).toHaveAttribute("href", "https://instagram.com/melovme");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  test("with only a wide picture, phones get the buttons under it (so both sets are in the page)", () => {
    render(<HeroBanner banner={banner()} labels={labels} />);
    expect(screen.getAllByRole("link", { name: "Explore Products" })).toHaveLength(2);
  });

  test("with buttons switched off there are none", () => {
    render(<HeroBanner banner={banner({ showButtons: false })} labels={labels} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("the buttons sit where the admin placed them", () => {
    render(<HeroBanner banner={banner({ mobileImage: tall, buttonPosition: "top-right" })} labels={labels} />);
    const box = screen.getByRole("link", { name: "Explore Products" }).parentElement!.parentElement!;
    expect(box).toHaveClass("items-start", "justify-end");
  });
});
