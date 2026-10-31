import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { confirmPayment, createOrder, deleteAddress, saveAddress } from "@/app/actions/checkout";
import { addToCart, setSelected } from "@/lib/cart";
import type { Order, SavedAddress } from "@/lib/order";
import { makeProduct, renderWithIntl, resetStores } from "@/test/render";
import CheckoutFlow from "./CheckoutFlow";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/checkout/" }));
vi.mock("@/app/actions/checkout", () => ({ createOrder: vi.fn(), confirmPayment: vi.fn(), deleteAddress: vi.fn(), saveAddress: vi.fn() }));

// A fake Razorpay Checkout: remembers the options it was opened with and its failure handler
type Options = { amount: number; order_id: string; key: string; prefill: unknown; handler: (p: object) => void; modal: { ondismiss: () => void } };
const razorpay = vi.hoisted(() => ({ options: null as Options | null, failed: null as ((r: object) => void) | null, open: vi.fn() }));

const lotion = makeProduct();
const scrub = makeProduct({ slug: "scrub", name: "Body Scrub", price: 500 });
const products = [lotion, scrub];
const user_ = { name: "Priya S", phone: "9876543210" };
const home: SavedAddress = { id: "a1", name: "Priya S", phone: "9876543210", address: "12 Lake Road", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
const office: SavedAddress = { ...home, id: "a2", address: "5 Mount Road" };
const both = { razorpay: true, cod: true };
const online = { razorpay: true, cod: false };

beforeAll(() => {
  // Razorpay's script "loads" straight away instead of being fetched
  const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T) => {
    if (node instanceof HTMLScriptElement && node.src.includes("razorpay")) {
      queueMicrotask(() => node.onload?.(new Event("load")));
      return node;
    }
    return append(node);
  });
  window.Razorpay = class {
    constructor(options: Record<string, unknown>) {
      razorpay.options = options as unknown as Options;
    }
    on(_: string, handler: (r: object) => void) {
      razorpay.failed = handler;
    }
    open = razorpay.open;
  } as unknown as typeof window.Razorpay;
});
beforeEach(() => {
  vi.mocked(createOrder).mockReset();
  vi.mocked(confirmPayment).mockReset();
  vi.mocked(deleteAddress).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(saveAddress).mockReset();
  nav.push.mockReset();
  razorpay.open.mockReset();
  razorpay.options = null;
});
afterEach(() => {
  cleanup();
  resetStores(["body-lotion", "scrub"]);
});
afterAll(() => {
  vi.restoreAllMocks();
  delete window.Razorpay;
});

const fill = (items: [string, number][]) => act(() => items.forEach(([slug, qty]) => addToCart(slug, qty, { notify: false })));
const cartSlugs = () => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]").map((i: { slug: string }) => i.slug);

function show({ addresses = [home], methods = online }: { addresses?: SavedAddress[]; methods?: typeof both } = {}) {
  return renderWithIntl(<CheckoutFlow addresses={addresses} user={user_} razorpayKey="rzp_test" methods={methods} />, { products });
}

const order: Order = {
  id: "ML-1",
  address: home,
  items: [{ name: "Body Lotion", size: "200 ml", qty: 2, price: 1000, total: 2000 }],
  subtotal: 2000,
  shipping: 0,
  total: 2000,
  razorpayOrderId: "order_rzp1",
};

describe("CheckoutFlow", () => {
  test("an empty cart says so", () => {
    show();
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  });

  test("a first-time customer gets the address form with their name and number filled in", () => {
    fill([["body-lotion", 1]]);
    show({ addresses: [] });
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue("Priya S");
    expect(screen.getByRole("textbox", { name: "Mobile number (10 digits)" })).toHaveValue("9876543210");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  test("the last saved address is chosen, and the summary lists what's being bought", () => {
    fill([["body-lotion", 2], ["scrub", 1]]);
    show({ addresses: [home, office] });
    expect(screen.getByRole("radio", { name: /5 Mount Road/ })).toBeChecked();
    expect(screen.getByText("× 2")).toBeInTheDocument();
    // 2 × ₹1,000 + ₹500
    expect(screen.getByRole("button", { name: /Pay ₹2,500/ })).toBeEnabled();
  });

  test("items unticked in the cart aren't ordered", async () => {
    vi.mocked(createOrder).mockResolvedValue({ error: "stop here" });
    fill([["body-lotion", 1], ["scrub", 1]]);
    act(() => setSelected(["body-lotion"], false));
    const user = userEvent.setup();
    show();
    expect(screen.queryByText("Body Lotion")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Pay ₹500/ }));
    expect(createOrder).toHaveBeenCalledWith("a1", [{ slug: "scrub", qty: 1 }], "razorpay");
  });

  test("paying online creates the order, then opens Razorpay for its amount", async () => {
    vi.mocked(createOrder).mockResolvedValue(order);
    fill([["body-lotion", 2]]);
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /Pay ₹2,000/ }));
    expect(createOrder).toHaveBeenCalledWith("a1", [{ slug: "body-lotion", qty: 2 }], "razorpay");
    await waitFor(() => expect(razorpay.open).toHaveBeenCalled());
    expect(razorpay.options).toMatchObject({ key: "rzp_test", order_id: "order_rzp1", amount: 200000, prefill: { contact: "+919876543210" } });
  });

  test("a successful payment is confirmed, the items leave the cart and the order page opens", async () => {
    vi.mocked(createOrder).mockResolvedValue(order);
    vi.mocked(confirmPayment).mockResolvedValue({ ok: true });
    fill([["body-lotion", 2], ["scrub", 1]]);
    act(() => setSelected(["scrub"], false));
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /Pay/ }));
    await waitFor(() => expect(razorpay.open).toHaveBeenCalled());
    const payment = { razorpay_payment_id: "pay_1", razorpay_order_id: "order_rzp1", razorpay_signature: "sig" };
    act(() => razorpay.options!.handler(payment));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/orders/ML-1/"));
    expect(confirmPayment).toHaveBeenCalledWith("ML-1", payment);
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    // The unticked scrub stays in the cart for later
    expect(cartSlugs()).toEqual(["scrub"]);
  });

  test("a failed payment shows why", async () => {
    vi.mocked(createOrder).mockResolvedValue(order);
    fill([["body-lotion", 2]]);
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /Pay/ }));
    await waitFor(() => expect(razorpay.open).toHaveBeenCalled());
    act(() => razorpay.failed!({ error: { description: "Card declined" } }));
    expect(screen.getByRole("alert")).toHaveTextContent("Card declined");
  });

  test("closing Razorpay and paying again reuses the same order", async () => {
    vi.mocked(createOrder).mockResolvedValue(order);
    fill([["body-lotion", 2]]);
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /Pay/ }));
    await waitFor(() => expect(razorpay.open).toHaveBeenCalled());
    act(() => razorpay.options!.modal.ondismiss());
    // Now on the payment step for order ML-1
    expect(screen.getByText(/for order/)).toHaveTextContent("ML-1");
    await user.click(screen.getByRole("button", { name: /Pay ₹2,000/ }));
    await waitFor(() => expect(razorpay.open).toHaveBeenCalledTimes(2));
    expect(createOrder).toHaveBeenCalledOnce();
  });

  test("a problem creating the order is shown", async () => {
    vi.mocked(createOrder).mockResolvedValue({ error: "Sorry, only 1 of Body Lotion left." });
    fill([["body-lotion", 2]]);
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /Pay/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sorry, only 1 of Body Lotion left.");
    expect(razorpay.open).not.toHaveBeenCalled();
  });

  test("cash on delivery places the order straight away", async () => {
    vi.mocked(createOrder).mockResolvedValue({ placed: "ML-2" });
    fill([["scrub", 2]]);
    const user = userEvent.setup();
    show({ methods: both });
    await user.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    expect(screen.getByText("You'll pay ₹1,000 in cash to the delivery person.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Place Order · ₹1,000" }));
    expect(createOrder).toHaveBeenCalledWith("a1", [{ slug: "scrub", qty: 2 }], "cod");
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/orders/ML-2/"));
    expect(screen.getByText("Order placed")).toBeInTheDocument();
    expect(cartSlugs()).toEqual([]);
  });

  test("with only one payment method there's no choice to make", () => {
    fill([["scrub", 1]]);
    show({ methods: online });
    expect(screen.queryByRole("group", { name: "2. Payment Method" })).toBeNull();
  });

  test("with no payment method on, checkout isn't available", () => {
    fill([["scrub", 1]]);
    show({ methods: { razorpay: false, cod: false } });
    expect(screen.getByText("Checkout isn't available right now. Please contact us to order.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay|Place Order/ })).toBeNull();
  });

  test("deleting an address asks first", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fill([["scrub", 1]]);
    const user = userEvent.setup();
    show({ addresses: [home, office] });
    await user.click(screen.getByRole("button", { name: "Delete address: Priya S, 5 Mount Road" }));
    expect(confirm).toHaveBeenCalled();
    expect(deleteAddress).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  test("deleting the chosen address removes it and picks the one left", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fill([["scrub", 1]]);
    const user = userEvent.setup();
    show({ addresses: [home, office] });
    await user.click(screen.getByRole("button", { name: "Delete address: Priya S, 5 Mount Road" }));
    expect(deleteAddress).toHaveBeenCalledWith("a2");
    await waitFor(() => expect(screen.queryByRole("radio", { name: /5 Mount Road/ })).toBeNull());
    expect(screen.getByRole("radio", { name: /12 Lake Road/ })).toBeChecked();
    confirm.mockRestore();
  });

  test("a newly added address is saved and chosen", async () => {
    const added: SavedAddress = { ...home, id: "a3", address: "9 Beach Road" };
    vi.mocked(saveAddress).mockResolvedValue(added);
    fill([["scrub", 1]]);
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "+ Add a new address" }));
    for (const [label, value] of [["Full name", "Priya S"], ["Mobile number (10 digits)", "9876543210"], ["House no., street, area, landmark", "9 Beach Road"], ["City", "Chennai"], ["State", "Tamil Nadu"], ["PIN code", "600001"]]) {
      await user.type(screen.getByRole("textbox", { name: label }), value);
    }
    await user.click(screen.getByRole("button", { name: "Save Address" }));
    expect(await screen.findByRole("radio", { name: /9 Beach Road/ })).toBeChecked();
  });

  test("Remove in the summary takes the item out of the cart", async () => {
    fill([["body-lotion", 1], ["scrub", 1]]);
    const user = userEvent.setup();
    show();
    await user.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(cartSlugs()).toEqual(["body-lotion"]);
    expect(screen.getByRole("button", { name: /Pay ₹1,000/ })).toBeInTheDocument();
  });
});
