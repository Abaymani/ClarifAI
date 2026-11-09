import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

import { PortalNav } from "@/app/admin/(portal)/portal-nav";

describe("PortalNav", () => {
  test("marks the page the researcher is on", () => {
    pathname.current = "/admin/agreement";
    render(<PortalNav />);

    expect(
      screen
        .getByRole("link", { name: "Överensstämmelse" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Översikt" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  test("marks neither link on a transcript page", () => {
    pathname.current = "/admin/participant/12/lesson/2";
    render(<PortalNav />);

    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("aria-current")),
    ).toEqual([null, null]);
  });
});
