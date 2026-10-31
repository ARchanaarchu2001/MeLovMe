import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import Logo from "./Logo";

afterEach(cleanup);

describe("Logo", () => {
  test("is read out as the shop's name and tagline", () => {
    renderWithIntl(<Logo />);
    expect(screen.getByLabelText("MELOVME — Your Signature")).toBeInTheDocument();
  });
});
