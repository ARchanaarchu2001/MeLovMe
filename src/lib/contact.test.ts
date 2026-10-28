import { describe, expect, test } from "vitest";
import { validateContact, type ContactMessage } from "./contact";

const valid: ContactMessage = {
  name: "Anjali R. D'Souza",
  email: "anjali@example.com",
  phone: "9876543210",
  topic: "General enquiry",
  message: "Do you ship to Kochi?",
};
const check = (change: Partial<ContactMessage>) => validateContact({ ...valid, ...change });

describe("validateContact", () => {
  test("accepts a complete message, with or without a phone number", () => {
    expect(check({})).toEqual({});
    expect(check({ phone: "" })).toEqual({});
  });

  test("requires name, email and message", () => {
    expect(check({ name: "", email: "", message: "" })).toEqual({
      name: "required",
      email: "required",
      message: "required",
    });
  });

  test("checks the name", () => {
    expect(check({ name: "A" }).name).toBe("nameShort");
    expect(check({ name: "Anjali123" }).name).toBe("nameInvalid");
    expect(check({ name: "अंजलि" }).name).toBeUndefined();
  });

  test("checks the email", () => {
    for (const email of ["anjali", "anjali@", "anjali@example", "anj ali@example.com"]) {
      expect(check({ email }).email).toBe("invalidEmail");
    }
  });

  test("only takes 10-digit Indian mobile numbers", () => {
    for (const phone of ["987654321", "98765432101", "1234567890", "98765-43210"]) {
      expect(check({ phone }).phone).toBe("invalidPhone");
    }
  });

  test("checks the message length", () => {
    expect(check({ message: "Hi" }).message).toBe("messageShort");
    expect(check({ message: "x".repeat(5001) }).message).toBe("tooLong");
  });
});
