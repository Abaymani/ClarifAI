import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatBubble, ChatThread } from "./chat-thread";

describe("chat transcript layout", () => {
  it("places student messages right and Gemini messages left", () => {
    const { container } = render(
      <ChatThread label="Utdrag ur din Gemini-chatt">
        <ChatBubble message={{ index: 1, role: "student", text: "Hej" }}>
          Hej
        </ChatBubble>
        <ChatBubble message={{ index: 2, role: "gemini", text: "Hej!" }}>
          Hej!
        </ChatBubble>
      </ChatThread>,
    );

    expect(screen.getByText("Utdrag ur din Gemini-chatt")).toBeTruthy();
    expect(
      container.querySelector('[data-chat-role="student"]')?.className,
    ).toContain("self-end");
    expect(
      container.querySelector('[data-chat-role="gemini"]')?.className,
    ).toContain("self-start");
  });
});
