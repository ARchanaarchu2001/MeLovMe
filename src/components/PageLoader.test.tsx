import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import PageLoader from "./PageLoader";

afterEach(cleanup);

describe("PageLoader", () => {
  test("says Loading…, or the given label", () => {
    const { rerender } = renderWithIntl(<PageLoader />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    rerender(<PageLoader label="Fetching your orders" />);
    expect(screen.getByRole("status")).toHaveTextContent("Fetching your orders");
  });
});
