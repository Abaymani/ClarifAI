// Trying framework changes on the agreement page (DL-078): merges and deletions are
// applied to an in-memory copy of the coding and the framework, never to stored
// data. A deleted code is treated as if nobody had given it, but it still makes a
// transcript count as coded, as an NA code does (DL-076).
import type { AgreementSessionInput } from "@/lib/admin/coder-agreement";
import { promptCodeLevels, type IcapLevel } from "@/lib/admin/icap-counts";
import type { Framework } from "@/lib/analysis/framework";

export type FrameworkChange =
  | { kind: "merge"; codes: string[]; level: IcapLevel }
  | { kind: "delete"; code: string };

export const MAX_FRAMEWORK_CHANGES = 30;

type PromptCodes = Pick<Framework, "promptCodes">;

// The first problem with the changes, or null when they can be applied.
export function frameworkChangesProblem(
  changes: readonly FrameworkChange[],
  framework: PromptCodes,
): string | null {
  if (changes.length === 0) return "Lägg till minst en ändring.";
  if (changes.length > MAX_FRAMEWORK_CHANGES) {
    return `Högst ${MAX_FRAMEWORK_CHANGES} ändringar åt gången.`;
  }
  const levels = promptCodeLevels(framework);
  const used = new Set<string>();
  for (const change of changes) {
    const codes = change.kind === "merge" ? change.codes : [change.code];
    for (const code of codes) {
      const level = levels.get(code);
      if (level !== "P" && level !== "A" && level !== "C") {
        return `${code} är ingen P-, A- eller C-kod i ramverket.`;
      }
      if (used.has(code)) return `${code} ingår i mer än en ändring.`;
      used.add(code);
    }
    if (change.kind === "merge") {
      if (change.codes.length < 2)
        return "En sammanslagning behöver minst två koder.";
      const own = new Set(change.codes.map((code) => levels.get(code)));
      if (own.size === 1 && !own.has(change.level)) {
        return `${change.codes.join(" + ")} ligger alla på nivå ${[...own][0]}.`;
      }
    }
  }
  return null;
}

// A merged code is named after its codes in framework order, e.g. "P1+A2".
export function mergedCode(
  codes: readonly string[],
  framework: PromptCodes,
): string {
  const order = framework.promptCodes.map((entry) => entry.code);
  return [...codes]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .join("+");
}

// Assumes frameworkChangesProblem found none.
export function applyFrameworkChanges(
  sessions: readonly AgreementSessionInput[],
  framework: PromptCodes,
  changes: readonly FrameworkChange[],
): { sessions: AgreementSessionInput[]; framework: PromptCodes } {
  const replacement = new Map<string, string>();
  const removed = new Set<string>();
  const added = new Map<string, PromptCodes["promptCodes"][number]>();
  for (const change of changes) {
    if (change.kind === "delete") {
      removed.add(change.code);
      continue;
    }
    const code = mergedCode(change.codes, framework);
    const names = change.codes.map(
      (member) =>
        framework.promptCodes.find((entry) => entry.code === member)?.name ??
        member,
    );
    for (const member of change.codes) {
      replacement.set(member, code);
      removed.add(member);
    }
    added.set(code.split("+")[0], {
      code,
      name: [...new Set(names)].join(" / "),
      level: change.level,
    });
  }

  // A merged code takes the place of its first code, so tables keep their order.
  const promptCodes = framework.promptCodes.flatMap((entry) => {
    const merged = added.get(entry.code);
    if (merged) return [merged];
    return removed.has(entry.code) ? [] : [entry];
  });
  return {
    framework: { promptCodes },
    sessions: sessions.map((session) => ({
      ...session,
      coding: {
        R1: replaceCodes(session.coding.R1, replacement),
        R2: replaceCodes(session.coding.R2, replacement),
        AI: replaceCodes(session.coding.AI, replacement),
      },
    })),
  };
}

function replaceCodes(
  entries: AgreementSessionInput["coding"]["R1"],
  replacement: ReadonlyMap<string, string>,
): AgreementSessionInput["coding"]["R1"] {
  return entries.map((entry) => ({
    message: entry.message,
    codes: entry.codes.map((code) => replacement.get(code) ?? code),
  }));
}
