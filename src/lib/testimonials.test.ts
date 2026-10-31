import { describe, expect, it } from "vitest";
import { hasTestimonialErrors, validateTestimonials } from "./admin-validation";
import type { Testimonials } from "./testimonials";

const review = { id: "a", name: "Priya R.", place: "Chennai", message: "Lovely lotion.", photo: null };
const base: Testimonials = { enabled: true, layout: "slider", autoScroll: false, items: [review] };

describe("validateTestimonials", () => {
  it("accepts a complete review, with or without a city or photo", () => {
    expect(hasTestimonialErrors(validateTestimonials(base))).toBe(false);
    expect(hasTestimonialErrors(validateTestimonials({ ...base, items: [{ ...review, place: "" }] }))).toBe(false);
  });

  it("needs the review and who wrote it, marked on the right row", () => {
    const errors = validateTestimonials({ ...base, items: [review, { ...review, id: "b", name: " ", message: "" }] });
    expect(errors.items?.[0]).toBeUndefined();
    expect(errors.items?.[1]).toEqual({ name: "Enter who wrote it.", message: "Enter the review." });
  });

  it("limits the length of a review", () => {
    const errors = validateTestimonials({ ...base, items: [{ ...review, message: "x".repeat(401) }] });
    expect(errors.items?.[0]?.message).toBeTruthy();
  });

  it("needs at least one review while the section is shown", () => {
    expect(validateTestimonials({ ...base, items: [] }).form).toBeTruthy();
    expect(hasTestimonialErrors(validateTestimonials({ ...base, enabled: false, items: [] }))).toBe(false);
  });
});
