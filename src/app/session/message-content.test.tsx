import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageContent } from "./message-content";

describe("MessageContent", () => {
  it("renders restrained headings, lists and code", () => {
    render(
      <MessageContent
        text={[
          "# Koppla sensorn",
          "",
          "## Du behöver",
          "",
          "- En sensor",
          "- En `sladd`",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Koppla sensorn" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Du behöver" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("sladd").tagName).toBe("CODE");
  });

  it("replaces removed and Markdown images without loading an image", () => {
    const { container } = render(
      <MessageContent
        text={"[PICTURE]\n\n![Koppling](https://example.com/private.png)"}
      />,
    );

    expect(screen.getAllByRole("img", { name: "Bild borttagen" })).toHaveLength(
      2,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows link text without making it clickable and ignores raw HTML", () => {
    const { container } = render(
      <MessageContent
        text={"Läs [guiden](https://example.com). <script>alert('x')</script>"}
      />,
    );

    expect(screen.getByText("guiden")).toBeTruthy();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("highlights an excerpt across ordinary whitespace", () => {
    const { container } = render(
      <MessageContent
        text={"Första raden\nmed viktigt innehåll."}
        highlight="raden med viktigt"
      />,
    );

    expect(container.querySelector("mark")?.textContent).toMatch(
      /raden\s+med viktigt/,
    );
  });

  it("renders GFM tables", () => {
    render(
      <MessageContent text={"| Del | Pin |\n| --- | --- |\n| VCC | 5V |"} />,
    );

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Del" })).toBeTruthy();
  });
});
