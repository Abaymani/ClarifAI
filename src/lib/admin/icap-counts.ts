// How many of the AI's prompt codes fall on each ICAP level, for the overview
// (DL-074). Every prompt code counts at its framework level, so a prompt coded P2
// and C10 adds one P and one C, and NA codes are not counted. The framework has no
// Interactive prompt codes, so Interactive is not counted.
import type { Framework } from "@/lib/analysis/framework";
import type { Coding } from "@/lib/analysis/types";

export type IcapLevel = "P" | "A" | "C";
export type IcapCounts = Record<IcapLevel, number>;

const LEVELS: readonly string[] = ["P", "A", "C"] satisfies IcapLevel[];

// Prompt code → its ICAP level, as the framework file states it.
export function promptCodeLevels(
  framework: Pick<Framework, "promptCodes">,
): ReadonlyMap<string, string> {
  return new Map(
    framework.promptCodes.map((entry) => [
      entry.code,
      typeof entry.level === "string" ? entry.level : "",
    ]),
  );
}

export function icapCounts(
  coding: Pick<Coding, "prompts">,
  levels: ReadonlyMap<string, string>,
): IcapCounts {
  const counts: IcapCounts = { P: 0, A: 0, C: 0 };
  for (const prompt of coding.prompts) {
    for (const { code } of prompt.codes) {
      const level = levels.get(code);
      if (level && LEVELS.includes(level)) counts[level as IcapLevel] += 1;
    }
  }
  return counts;
}
