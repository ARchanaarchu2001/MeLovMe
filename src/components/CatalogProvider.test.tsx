import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { makeProduct } from "@/test/render";
import { CatalogProvider, useCanBuy, useCatalog } from "./CatalogProvider";

afterEach(cleanup);

function Probe({ slug }: { slug: string }) {
  const { products, get } = useCatalog();
  return <p>{`${products.length} products; ${get(slug)?.name ?? "not found"}; canBuy ${useCanBuy()}`}</p>;
}

describe("CatalogProvider", () => {
  test("shares the products and finds one by slug", () => {
    render(
      <CatalogProvider products={[makeProduct(), makeProduct({ slug: "scrub", name: "Scrub" })]} canBuy={false}>
        <Probe slug="scrub" />
      </CatalogProvider>,
    );
    expect(screen.getByText("2 products; Scrub; canBuy false")).toBeInTheDocument();
  });

  test("an unknown slug isn't found", () => {
    render(<CatalogProvider products={[makeProduct()]} canBuy><Probe slug="missing" /></CatalogProvider>);
    expect(screen.getByText("1 products; not found; canBuy true")).toBeInTheDocument();
  });

  test("outside the provider there are no products and buying is on", () => {
    render(<Probe slug="x" />);
    expect(screen.getByText("0 products; not found; canBuy true")).toBeInTheDocument();
  });
});
