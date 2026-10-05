import type { AdminCodeOption } from "@/lib/admin/types";
import type { Framework, FrameworkEntry } from "@/lib/analysis/framework";

export function adminCodeOptions(framework: Framework): AdminCodeOption[] {
  return [
    ...framework.promptCodes.map((entry) => option(entry, "prompt")),
    ...framework.sequencePatterns.map((entry) => option(entry, "sequence")),
  ];
}

function option(
  entry: FrameworkEntry,
  kind: AdminCodeOption["kind"],
): AdminCodeOption {
  const loose = entry as Record<string, unknown>;
  const descriptions = [
    loose.notes,
    loose.characteristics,
    loose.interpretation,
  ].filter((value): value is string => typeof value === "string");
  const examples = Array.isArray(loose.examplePrompts)
    ? loose.examplePrompts.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return {
    code: entry.code,
    name: entry.name,
    description: descriptions.join(" "),
    examples,
    kind,
  };
}
