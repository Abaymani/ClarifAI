import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpandableText } from "./expandable-text";

const LONG_TEXT =
  "Det här är ett långt meddelande med många instruktioner. ".repeat(8);

describe("ExpandableText", () => {
  it("collapses long content and lets the student expand it", () => {
    render(<ExpandableText text={LONG_TEXT} />);

    const button = screen.getByRole("button", { name: "Visa mer" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Visa mindre" })).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps long content fully visible when collapsing is disabled", () => {
    render(<ExpandableText text={LONG_TEXT} collapsible={false} />);

    expect(screen.queryByRole("button", { name: "Visa mer" })).toBeNull();
  });
});
