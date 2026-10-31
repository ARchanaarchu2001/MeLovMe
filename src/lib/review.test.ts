import { describe, expect, test } from "vitest";
import { reviewLimits } from "./review";

describe("review limits", () => {
  test("a review needs at least 5 characters and can have up to 2,000", () => {
    expect(reviewLimits.minText).toBe(5);
    expect(reviewLimits.text).toBe(2000);
  });

  test("names can be up to 40 characters and titles up to 100", () => {
    expect(reviewLimits.name).toBe(40);
    expect(reviewLimits.title).toBe(100);
  });
});
