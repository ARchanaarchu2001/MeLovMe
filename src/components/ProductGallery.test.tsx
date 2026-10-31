import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import ProductGallery from "./ProductGallery";

afterEach(cleanup);

describe("ProductGallery", () => {
  test("shows the first image with the product name", () => {
    renderWithIntl(<ProductGallery images={["/a.jpg", "/b.jpg"]} name="Body Lotion" />);
    expect(screen.getByRole("img", { name: "Body Lotion" }).getAttribute("src")).toContain("a.jpg");
  });

  test("clicking a thumbnail shows that image", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProductGallery images={["/a.jpg", "/b.jpg"]} name="Body Lotion" />);
    await user.click(screen.getByRole("button", { name: "Show image 2" }));
    expect(screen.getByRole("img", { name: "Body Lotion" }).getAttribute("src")).toContain("b.jpg");
  });

  test("a single image has no thumbnails", () => {
    renderWithIntl(<ProductGallery images={["/a.jpg"]} name="Body Lotion" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
