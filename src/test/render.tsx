// Shared helpers for component tests: render inside the providers the shop's pages have
// (English text from en.json, and optionally the product catalogue), plus a sample product.
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { CatalogProvider } from "@/components/CatalogProvider";
import en from "@/i18n/messages/en.json";
import { timeZone } from "@/i18n/config";
import { removeFromCart } from "@/lib/cart";
import type { Product } from "@/lib/product";
import { removeFromWishlist } from "@/lib/wishlist";

export function IntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}

type Options = Omit<RenderOptions, "wrapper"> & { products?: Product[]; canBuy?: boolean };

// render() with English text; pass `products` (and `canBuy`) to also provide the shop's catalogue
export function renderWithIntl(ui: ReactElement, { products, canBuy = true, ...options }: Options = {}) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider>
      {products ? (
        <CatalogProvider products={products} canBuy={canBuy}>
          {children}
        </CatalogProvider>
      ) : (
        children
      )}
    </IntlProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

// A simple in-stock product: ₹1,000, no offer, no combos. Override any field.
export function makeProduct(overrides: Partial<Product> = {}): Product {
  const slug = overrides.slug ?? "body-lotion";
  return {
    slug,
    name: "Body Lotion",
    categoryId: "body",
    category: "Body Care",
    size: "200 ml",
    price: 1000,
    shortDescription: "Soft skin all day",
    description: "A rich lotion.",
    images: [`/images/${slug}.jpg`],
    highlights: [],
    ingredients: [],
    howToUse: "",
    enabled: true,
    stock: null,
    inStock: true,
    offer: null,
    combos: [],
    ...overrides,
  };
}

// The cart and wishlist are kept in memory as well as localStorage, so clearing localStorage
// isn't enough between tests: empty them through their own functions too.
export function resetStores(slugs: string[]) {
  removeFromCart(slugs);
  slugs.forEach(removeFromWishlist);
  localStorage.clear();
}

// jsdom has no window.matchMedia. `mobile` makes phone-width queries match (the slide-in cart),
// otherwise desktop-width queries match (the "added to cart" pop-up).
export function mockScreen(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width") ? mobile : !mobile,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

// jsdom has no <dialog> methods: showModal() opens it, close() shuts it and fires "close" like a browser
export function mockDialog() {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
