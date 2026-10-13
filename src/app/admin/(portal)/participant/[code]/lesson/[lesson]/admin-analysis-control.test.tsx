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
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  test("starts the one-time analysis after explicit confirmation", async () => {
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

  test("does not consume the one-time request when confirmation is cancelled", () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(
      <AdminAnalysisControl
        sessionId="12_4"
        eligible
        alreadyAnalysed={false}
        initialRequest={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skapa AI-analys" }));
    expect(requestAnalysis).not.toHaveBeenCalled();
  });

  test("never offers another request after a result or failure", () => {
    const { rerender } = render(
      <AdminAnalysisControl
        sessionId="12_1"
        eligible
        alreadyAnalysed
        initialRequest={null}
      />,
    );
    expect(screen.getByText("AI-analys skapad")).toBeTruthy();
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
