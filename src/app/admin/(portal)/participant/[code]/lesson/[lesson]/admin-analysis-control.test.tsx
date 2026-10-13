import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { refresh, requestAnalysis } = vi.hoisted(() => ({
  refresh: vi.fn(),
  requestAnalysis: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("@/app/admin/(portal)/analysis-actions", () => ({
  requestAdminLessonAnalysisAction: requestAnalysis,
}));

import { AdminAnalysisControl } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/admin-analysis-control";

const processingRequest = {
  status: "processing" as const,
  requestedBy: "R1" as const,
  requestedAt: "2026-10-12T10:00:00.000Z",
  finishedAt: null,
  errorCode: null,
};

describe("AdminAnalysisControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("starts the one-time analysis directly from the button", async () => {
    requestAnalysis.mockResolvedValue({
      ok: true,
      request: processingRequest,
    });
    render(
      <AdminAnalysisControl
        sessionId="12_1"
        eligible
        alreadyAnalysed={false}
        initialRequest={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skapa AI-analys" }));

    await waitFor(() =>
      expect(requestAnalysis).toHaveBeenCalledWith({ sessionId: "12_1" }),
    );
    expect(screen.getByText("AI-analys pågår")).toBeTruthy();
  });

  test("removes the card after success but keeps failure information", () => {
    const { rerender } = render(
      <AdminAnalysisControl
        sessionId="12_1"
        eligible
        alreadyAnalysed
        initialRequest={null}
      />,
    );
    expect(screen.queryByText("AI-analys")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Skapa AI-analys" }),
    ).toBeNull();

    rerender(
      <AdminAnalysisControl
        sessionId="12_1"
        eligible
        alreadyAnalysed={false}
        initialRequest={{
          ...processingRequest,
          status: "failed",
          finishedAt: "2026-10-12T10:01:00.000Z",
          errorCode: "S2-OPENAI",
        }}
      />,
    );
    expect(screen.getByText("AI-analysen misslyckades")).toBeTruthy();
    expect(screen.getByText(/S2-OPENAI/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Skapa AI-analys" }),
    ).toBeNull();
  });
});
