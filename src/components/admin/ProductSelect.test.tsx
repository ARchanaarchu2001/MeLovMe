import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ProductSelect, { type ProductOption } from "./ProductSelect";

// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src }: { src: string }) => <img src={src} alt="" /> }));
afterEach(cleanup);

const products: ProductOption[] = [
  { slug: "rose-mist", name: "Rose Body Mist", count: 4 },
  { slug: "shea-lotion", name: "Shea Body Lotion", count: 2 },
  { slug: "lip-balm", name: "Lip Balm" },
];

function Picker({ onChange = () => {}, allLabel, start = "" }: { onChange?: (slug: string) => void; allLabel?: string; start?: string }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <ProductSelect
        products={products}
        value={value}
        allLabel={allLabel}
        onChange={(slug) => {
          setValue(slug);
          onChange(slug);
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}


describe("ProductSelect", () => {
  test("shows the placeholder until a product is chosen", () => {
    render(<Picker />);
    expect(screen.getByRole("button", { name: "Choose a product" })).toHaveAttribute("aria-expanded", "false");
  });

  test("shows the chosen product's name", () => {
    render(<Picker start="shea-lotion" />);
    expect(screen.getByRole("button", { name: "Shea Body Lotion" })).toBeInTheDocument();
  });

  test("opens a list of every product with its count", async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Rose Body Mist4", "Shea Body Lotion2", "Lip Balm"]);
  });

  test("choosing a product closes the list and reports it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    await user.click(screen.getByRole("option", { name: /Lip Balm/ }));
    expect(onChange).toHaveBeenCalledWith("lip-balm");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Lip Balm" })).toBeInTheDocument();
  });

  test("choosing the product that's already chosen doesn't report a change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker onChange={onChange} start="lip-balm" />);
    await user.click(screen.getByRole("button", { name: "Lip Balm" }));
    expect(screen.getByRole("option", { name: /Lip Balm/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: /Lip Balm/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("typing filters the list, ignoring case", async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    await user.type(screen.getByRole("combobox"), "BODY");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  test("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    await user.type(screen.getByRole("combobox"), "soap");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No products match “soap”.")).toBeInTheDocument();
  });

  test("arrow keys and Enter pick a product", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("shea-lotion");
  });

  test("Escape and a click elsewhere close the list without choosing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Choose a product" }));
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("as a filter, an All products choice comes first and clears the product", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker onChange={onChange} allLabel="All products" start="lip-balm" />);
    await user.click(screen.getByRole("button", { name: "Lip Balm" }));
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("All products");
    await user.click(screen.getByRole("option", { name: "All products" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("button", { name: "All products" })).toBeInTheDocument();
  });

  test("All products is hidden while searching", async () => {
    const user = userEvent.setup();
    render(<Picker allLabel="All products" />);
    await user.click(screen.getByRole("button", { name: "All products" }));
    await user.type(screen.getByRole("combobox"), "lip");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Lip Balm"]);
  });
});

