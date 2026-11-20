"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  reflectionWordsFileName,
  reflectionWordsSheet,
} from "@/lib/admin/reflection-words-export";
import type { AdminParticipantOverview } from "@/lib/admin/types";

// Built in the browser from data the page already has, so a download reads
// nothing from the database (DL-086).
export function ReflectionWordsDownload({
  participants,
}: {
  participants: AdminParticipantOverview[];
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setPending(true);
    setFailed(false);
    try {
      // The universal build needs no Web Worker, which the browser build would.
      const { default: writeXlsxFile } =
        await import("write-excel-file/universal");
      const { data, columns } = reflectionWordsSheet(participants);
      // The sheet is wide, so the header row and participant column stay put.
      const blob = await writeXlsxFile(data, {
        sheet: "Reflektionslängd",
        stickyRowsCount: 1,
        stickyColumnsCount: 1,
        columns,
      }).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = reflectionWordsFileName();
      link.click();
      // Revoking at once can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        variant="outline"
        onClick={download}
        disabled={pending}
      >
        <Download aria-hidden="true" />
        {pending ? "Skapar fil…" : "Ladda ner Excel"}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {failed
          ? "Filen kunde inte skapas."
          : "Alla deltagare, oavsett sökning och filter."}
      </p>
    </div>
  );
}
