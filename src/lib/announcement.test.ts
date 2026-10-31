import { describe, expect, test } from "vitest";
import { validateAnnouncement } from "./admin-validation";
import { HEX_COLOR, announcementSpeeds, defaultAnnouncement, secondsPerMessage } from "./announcement";

describe("colour codes: HEX_COLOR", () => {
  test("accepts six-digit colour codes, in capitals or small letters", () => {
    for (const c of ["#2e1a11", "#C9A36A", "#000000", "#FFFFFF"]) expect(HEX_COLOR.test(c)).toBe(true);
  });

  test("refuses short, long, unprefixed or named colours", () => {
    for (const c of ["#fff", "#2e1a111", "2e1a11", "#2e1a1g", "brown", ""]) expect(HEX_COLOR.test(c)).toBe(false);
  });
});

describe("the announcement bar's starting settings", () => {
  test("are hidden until the shop switches the bar on", () => {
    expect(defaultAnnouncement.enabled).toBe(false);
  });

  test("would pass the admin checks if saved as they are", () => {
    expect(validateAnnouncement(defaultAnnouncement)).toEqual({});
    expect(validateAnnouncement({ ...defaultAnnouncement, enabled: true })).toEqual({});
  });
});

describe("scrolling speed", () => {
  test("every speed has a time per message", () => {
    for (const s of announcementSpeeds) expect(secondsPerMessage[s]).toBeGreaterThan(0);
  });

  test("faster speeds take less time per message", () => {
    expect(secondsPerMessage.slow).toBeGreaterThan(secondsPerMessage.normal);
    expect(secondsPerMessage.normal).toBeGreaterThan(secondsPerMessage.fast);
  });
});
