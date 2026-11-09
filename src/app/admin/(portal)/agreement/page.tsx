import type { AgreementCode } from "@/app/admin/(portal)/agreement/agreement-format";
import { CoderAgreementView } from "@/app/admin/(portal)/agreement/coder-agreement-view";
import { promptCodeLevels } from "@/lib/admin/icap-counts";
import { studyParticipantCode } from "@/lib/admin/lesson-one-codes";
import { loadCoderAgreement, loadLessonOneCodes } from "@/lib/admin/store";
import { loadFramework } from "@/lib/analysis/framework";

export const dynamic = "force-dynamic";
// The run button reads every transcript and all coding before it calculates.
export const maxDuration = 60;

// Formatted here, so the server and the browser never disagree about the time zone.
const CALCULATED_AT = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

export default async function AdminAgreementPage() {
  const [agreement, lessonOneCodes] = await Promise.all([
    loadCoderAgreement(),
    loadLessonOneCodes(),
  ]);
  const framework = loadFramework();
  const levels = promptCodeLevels(framework);
  const codes = framework.promptCodes.flatMap((entry): AgreementCode[] => {
    const level = levels.get(entry.code);
    return level === "P" || level === "A" || level === "C"
      ? [{ code: entry.code, name: entry.name, level }]
      : [];
  });
  const mapping =
    lessonOneCodes.status === "applied" ? lessonOneCodes.codes : null;
  const studyCodes = Object.fromEntries(
    (agreement?.transcripts ?? []).map((row) => [
      row.sessionId,
      studyParticipantCode(mapping, row.participantCode, row.lesson),
    ]),
  );

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 p-5 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold">
          Överensstämmelse
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Hur väl Armin, Frida och AI:n är överens om promptkoderna, mätt med
          Krippendorffs α: 1 betyder full överensstämmelse och 0 inte bättre än
          slumpen.
        </p>
      </div>
      <CoderAgreementView
        agreement={agreement}
        calculatedAt={
          agreement
            ? CALCULATED_AT.format(new Date(agreement.calculatedAt))
            : null
        }
        codes={codes}
        studyCodes={studyCodes}
      />
    </main>
  );
}
