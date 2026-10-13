import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  LessonOneCodesProblem,
  LessonOneCodesState,
} from "@/lib/admin/lesson-one-codes";

// Says whether lesson 1 is shown through the code mapping, and why not when the
// mapping cannot be applied (DL-072).
export function LessonOneCodesNotice({
  state,
}: {
  state: LessonOneCodesState;
}) {
  if (state.status === "none") return null;
  if (state.status === "ignored") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Kodbytet efter lektion 1 används inte: {problemText(state.problem)}{" "}
          Lektion 1 visas under koden den lämnades in med.
        </AlertDescription>
      </Alert>
    );
  }

  const changed = [...state.codes.toStudyCode].filter(
    ([lessonOneCode, studyCode]) => lessonOneCode !== studyCode,
  ).length;
  return (
    <p className="text-sm text-muted-foreground">
      {changed} deltagare bytte kod efter lektion 1. Deras lektion 1 visas under
      koden de hade i lektion 2–4.
    </p>
  );
}

function problemText(problem: LessonOneCodesProblem): string {
  switch (problem.kind) {
    case "format":
      return "kodmappningen har fel format.";
    case "duplicate":
      return `kod ${problem.code} är angiven för två deltagare.`;
    case "conflict":
      return `deltagare ${problem.code} har redan en egen lektion 1.`;
  }
}
