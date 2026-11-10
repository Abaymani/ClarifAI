import type { CodedBehaviour, SequenceCoding } from "@/lib/analysis/types";

// The AI's reasoning behind a code, shared by the researcher portal and the expo
// demo (DL-079) so both show the coding the same way.
export function AiCodeDetails({
  coding,
  name,
}: {
  coding: CodedBehaviour;
  name: string;
}) {
  return (
    <details className="group rounded-lg border p-3">
      <summary className="cursor-pointer list-none font-medium marker:hidden">
        <span className="mr-2 inline-flex rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-900">
          {coding.code}
        </span>
        {name}
        <span className="float-right text-xs text-muted-foreground group-open:hidden">
          Visa motivering
        </span>
        <span className="float-right hidden text-xs text-muted-foreground group-open:inline">
          Dölj motivering
        </span>
      </summary>
      <Reasoning
        justification={coding.justification}
        excerpt={coding.excerpt}
      />
    </details>
  );
}

export function AiSequenceDetails({
  sequence,
  name,
  selected = false,
}: {
  sequence: SequenceCoding;
  name: string;
  selected?: boolean;
}) {
  return (
    <details
      open={selected || undefined}
      className={`group rounded-lg border p-3 ${
        selected ? "ring-2 ring-emerald-400/60" : ""
      }`}
    >
      <summary className="cursor-pointer list-none font-medium marker:hidden">
        <span className="mr-2 inline-flex rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-900">
          {sequence.pattern}
        </span>
        {name}
        <span className="block pt-1 text-xs font-normal text-muted-foreground">
          Meddelande {sequence.firstMessage}–{sequence.lastMessage}
          <span className="group-open:hidden"> · Visa motivering</span>
          <span className="hidden group-open:inline"> · Dölj motivering</span>
        </span>
      </summary>
      <Reasoning
        justification={sequence.justification}
        excerpt={sequence.excerpt}
      />
    </details>
  );
}

function Reasoning({
  justification,
  excerpt,
}: {
  justification: string;
  excerpt: string;
}) {
  return (
    <div className="mt-3 space-y-3 border-t pt-3 text-sm">
      <div>
        <h4 className="font-medium">Motivering</h4>
        <p className="mt-1 text-muted-foreground">{justification}</p>
      </div>
      <div>
        <h4 className="font-medium">Utdrag ur chatten</h4>
        <blockquote className="mt-1 rounded-lg bg-muted p-3 text-muted-foreground">
          {excerpt}
        </blockquote>
      </div>
    </div>
  );
}
