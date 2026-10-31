// @vitest-environment node
import { describe, expect, test } from "vitest";
import { GET } from "./route";

const visit = (slug: string) =>
  GET(new Request("http://localhost/p/x/"), { params: Promise.resolve({ slug }) } as RouteContext<"/p/[slug]">);

describe("GET /p/<product>/", () => {
  test("forwards permanently to the product page", async () => {
    const res = await visit("rose-mist");
    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe("/products/rose-mist/");
  });

  test("odd characters in the name can't change where it forwards to", async () => {
    // ../admin?x=1 → ..%2Fadmin%3Fx%3D1, still under /products/
    expect((await visit("../admin?x=1")).headers.get("Location")).toBe("/products/..%2Fadmin%3Fx%3D1/");
  });

  test("a name that looks like another site stays on this site", async () => {
    expect((await visit("//evil.example")).headers.get("Location")).toBe("/products/%2F%2Fevil.example/");
  });
});
