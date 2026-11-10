import {
  AiCodeDetails,
  AiSequenceDetails,
} from "@/app/session/ai-coding-details";
import { ChatBubble } from "@/app/session/chat-thread";
import { ExpandableText } from "@/app/session/expandable-text";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  icapCounts,
  promptCodeLevels,
  type IcapLevel,
} from "@/lib/admin/icap-counts";
import type { Framework } from "@/lib/analysis/framework";
import type { Coding } from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";
import { sv } from "@/lib/sv";

const LEVELS: IcapLevel[] = ["P", "A", "C"];

// Students never saw the coding; the expo demo (DL-079) shows it so visitors can
// see what the reflection questions are based on.
export function DemoCoding({
  messages,
  analysis,
  framework,
}: {
  messages: TranscriptMessage[];
  analysis: Coding;
  framework: Pick<Framework, "promptCodes" | "sequencePatterns">;
}) {
  const names = new Map(
    [...framework.promptCodes, ...framework.sequencePatterns].map((entry) => [
      entry.code,
      entry.name,
    ]),
  );
  const counts = icapCounts(analysis, promptCodeLevels(framework));
  const prompts = messages.filter((message) => message.role === "student");

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl leading-snug font-medium">
          {sv.demo.codingHeading}
        </h2>
        <CardDescription>{sv.demo.codingIntro}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl aria-label={sv.demo.icapSummary} className="flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <div
              key={level}
              className="flex items-baseline gap-1.5 rounded-lg border px-3 py-2"
            >
              <dt className="text-sm text-muted-foreground">{level}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {counts[level]}
              </dd>
            </div>
          ))}
        </dl>

        <ol className="flex flex-col gap-6">
          {prompts.map((message) => {
            const coding = analysis.prompts.find(
              (prompt) => prompt.message === message.index,
            );
            return (
              <li key={message.index} className="flex flex-col items-end gap-2">
                <ChatBubble message={message}>
                  <ExpandableText text={message.text} collapsible={false} />
                </ChatBubble>
                <div className="flex w-[82%] flex-col gap-2 sm:w-[70%]">
                  {coding?.codes.length ? (
                    coding.codes.map((code) => (
                      <AiCodeDetails
                        key={code.code}
                        coding={code}
                        name={names.get(code.code) ?? code.code}
                      />
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      {coding?.note ?? sv.demo.noCodes}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{sv.demo.sequencesHeading}</h3>
          {analysis.sequences.length ? (
            analysis.sequences.map((sequence, index) => (
              <AiSequenceDetails
                key={`${sequence.pattern}-${sequence.firstMessage}-${index}`}
                sequence={sequence}
                name={names.get(sequence.pattern) ?? sequence.pattern}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {sv.demo.noSequences}
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
