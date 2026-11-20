import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { writeXlsxFile, toBlob } = vi.hoisted(() => {
  const toBlob = vi.fn();
  return { toBlob, writeXlsxFile: vi.fn(() => ({ toBlob })) };
});
vi.mock("write-excel-file/universal", () => ({ default: writeXlsxFile }));

import { ReflectionWordsDownload } from "@/app/admin/(portal)/overview/reflection-words-download";
import { reflectionWordsSheet } from "@/lib/admin/reflection-words-export";

const participants = [
  {
    participantCode: "801",
    sessions: {
      2: {
        participantCode: "801",
        lesson: 2 as const,
        state: "completed" as const,
        status: "completed" as const,
        transcriptSubmission: "transcript" as const,
        codedBy: [],
        reflectionAssessment: { state: "unavailable" as const },
        reflectionWords: { state: "submitted" as const, moments: [5, 7] },
      },
    },
  },
];

describe("ReflectionWordsDownload", () => {
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no object URLs and cannot follow a download link.
    URL.createObjectURL = vi.fn(() => "blob:reflektionslangd");
    URL.revokeObjectURL = vi.fn();
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => click.mockRestore());

  test("writes the sheet for the participants it was given and downloads it", async () => {
    const blob = new Blob(["xlsx"]);
    toBlob.mockResolvedValue(blob);
    render(<ReflectionWordsDownload participants={participants} />);

    fireEvent.click(screen.getByRole("button", { name: "Ladda ner Excel" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(writeXlsxFile).toHaveBeenCalledWith(
      reflectionWordsSheet(participants),
      expect.objectContaining({ sheet: "Reflektionslängd" }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^reflektionslangd-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(link.href).toBe("blob:reflektionslangd");
  });

  test("says so when the file cannot be made", async () => {
    toBlob.mockRejectedValue(new Error("broken"));
    render(<ReflectionWordsDownload participants={participants} />);

    fireEvent.click(screen.getByRole("button", { name: "Ladda ner Excel" }));

    expect(await screen.findByText("Filen kunde inte skapas.")).toBeTruthy();
    expect(click).not.toHaveBeenCalled();
  });
});
