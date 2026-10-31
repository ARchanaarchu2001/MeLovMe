import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import Stars from "./Stars";

afterEach(cleanup);

describe("Stars", () => {
  test("with a label it is an image read out as that label", () => {
    render(<Stars rating={4.5} label="4.5 out of 5 stars" />);
    expect(screen.getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
  });

  test("without a label it is hidden from screen readers", () => {
    const { container } = render(<Stars rating={3} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  test("4.5 fills four stars and half-fills the fifth", () => {
    const { container } = render(<Stars rating={4.5} />);
    const fills = [...container.querySelectorAll("path")].map((p) => p.getAttribute("fill"));
    expect(fills).toEqual(["currentColor", "currentColor", "currentColor", "currentColor", "url(#star-half-5)"]);
  });

  test("2 stars leaves the last three faint", () => {
    const { container } = render(<Stars rating={2} />);
    const faint = [...container.querySelectorAll("path")].filter((p) => p.getAttribute("fill-opacity") === "0.2");
    expect(faint).toHaveLength(3);
  });
});
