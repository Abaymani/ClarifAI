"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  CodingSourceBadge,
  type CodingSourceBadgeData,
} from "@/app/admin/(portal)/coding-source-badge";
import {
  deleteSequenceCodingAction,
  savePromptCodingAction,
  saveSequenceCodingAction,
} from "@/app/admin/(portal)/coding-actions";
import { ChatBubble } from "@/app/session/chat-thread";
import { ExpandableText } from "@/app/session/expandable-text";
import { MessageContent } from "@/app/session/message-content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResearcherId } from "@/lib/admin/auth";
import { researcherName } from "@/lib/admin/researchers";
import type {
  AdminCodeOption,
  ResearcherCoding,
  ResearcherPromptCoding,
  ResearcherSequenceCoding,
} from "@/lib/admin/types";
import type { StoredCoding } from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";

type CodingByResearcher = Record<ResearcherId, ResearcherCoding[]>;
type Panel = "ai" | "researcher";
type ManualTarget = "prompt" | "sequence";
type TranscriptCodingVisibility = Record<"ai" | ResearcherId, boolean>;

type TranscriptSequence = {
  key: string;
  source: "ai" | ResearcherId;
  sourceLabel: string;
  codes: string[];
  names: string[];
  firstMessage: number;
  lastMessage: number;
  researcherEntryId: string | null;
};

type PositionedTranscriptSequence = TranscriptSequence & { lane: number };

export function TranscriptWorkspace({
  sessionId,
  participantCode,
  messages,
  analysis,
  coding: initialCoding,
  currentResearcher,
  codeOptions,
}: {
  sessionId: string;
  participantCode: string;
  messages: TranscriptMessage[];
  analysis: StoredCoding | null;
  coding: CodingByResearcher;
  currentResearcher: ResearcherId;
  codeOptions: AdminCodeOption[];
}) {
  const firstPrompt = messages.find((message) => message.role === "student");
  const [selectedMessage, setSelectedMessage] = useState(
    firstPrompt?.index ?? messages[0]?.index ?? 1,
  );
  const [showAi, setShowAi] = useState(false);
  const [panel, setPanel] = useState<Panel>("researcher");
  const [selectedResearcher, setSelectedResearcher] =
    useState<ResearcherId>(currentResearcher);
  const [researcherTarget, setResearcherTarget] =
    useState<ManualTarget>("prompt");
  const [coding, setCoding] = useState(initialCoding);
  const [transcriptCoding, setTranscriptCoding] =
    useState<TranscriptCodingVisibility>({ ai: false, R1: false, R2: false });
  const [hoveredSequence, setHoveredSequence] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const codeNames = useMemo(
    () => new Map(codeOptions.map((option) => [option.code, option.name])),
    [codeOptions],
  );
  const sequences = useMemo(
    () => transcriptSequences(analysis, coding, transcriptCoding, codeNames),
    [analysis, codeNames, coding, transcriptCoding],
  );
  const positionedSequences = useMemo(
    () => positionTranscriptSequences(sequences),
    [sequences],
  );
  const highlightedSequence =
    sequences.find(
      (sequence) => sequence.key === (hoveredSequence ?? selectedSequence),
    ) ?? null;

  function toggleAi(checked: boolean) {
    setShowAi(checked);
    setPanel(checked ? "ai" : "researcher");
  }

  function replaceEntry(entry: ResearcherCoding) {
    setCoding((current) => ({
      ...current,
      [entry.researcherId]: [
        ...current[entry.researcherId].filter(
          (candidate) => candidate.id !== entry.id,
        ),
        ...(entry.note || entry.codes.length > 0 ? [entry] : []),
      ],
    }));
  }

  function removeEntry(researcherId: ResearcherId, id: string) {
    setCoding((current) => ({
      ...current,
      [researcherId]: current[researcherId].filter(
        (candidate) => candidate.id !== id,
      ),
    }));
  }

  function toggleTranscriptCoding(source: keyof TranscriptCodingVisibility) {
    setTranscriptCoding((current) => ({
      ...current,
      [source]: !current[source],
    }));
  }

  function selectTranscriptSequence(sequence: TranscriptSequence) {
    setSelectedSequence(sequence.key);
    if (sequence.source === "ai") {
      setShowAi(true);
      setPanel("ai");
      return;
    }
    setPanel("researcher");
    setSelectedResearcher(sequence.source);
    setResearcherTarget("sequence");
  }

  function selectTranscriptMessage(message: number) {
    setSelectedMessage(message);
    setSelectedSequence(null);
    setResearcherTarget("prompt");
  }

  return (
    <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
      <div className="min-w-0 rounded-xl border bg-background p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Kodning i transkriptet</h2>
            <p className="text-xs text-muted-foreground">Av som standard</p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Kodning i transkriptet"
          >
            <TranscriptCodingToggle
              label="AI"
              source="ai"
              pressed={transcriptCoding.ai}
              onClick={() => toggleTranscriptCoding("ai")}
            />
            <TranscriptCodingToggle
              label={researcherName("R1")}
              source="R1"
              pressed={transcriptCoding.R1}
              onClick={() => toggleTranscriptCoding("R1")}
            />
            <TranscriptCodingToggle
              label={researcherName("R2")}
              source="R2"
              pressed={transcriptCoding.R2}
              onClick={() => toggleTranscriptCoding("R2")}
            />
          </div>
        </div>
        <TranscriptSequenceGrid
          participantCode={participantCode}
          messages={messages}
          analysis={analysis}
          coding={coding}
          visibility={transcriptCoding}
          codeNames={codeNames}
          sequences={positionedSequences}
          highlightedSequence={highlightedSequence}
          selectedSequence={selectedSequence}
          selectedMessage={selectedMessage}
          onMessageSelect={selectTranscriptMessage}
          onSequenceHover={setHoveredSequence}
          onSequenceSelect={selectTranscriptSequence}
        />
      </div>

      <aside className="min-w-0 self-start rounded-xl border bg-background p-4 xl:sticky xl:top-4">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="font-semibold">Analys och forskarkodning</h2>
            <p className="text-xs text-muted-foreground">
              Visar endast redan lagrad data.
            </p>
          </div>
          <Label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAi}
              onChange={(event) => toggleAi(event.target.checked)}
              className="size-4 accent-foreground"
            />
            Visa AI-kodning
          </Label>
        </div>

        {showAi ? (
          <div className="mt-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setPanel("ai")}
              className={`rounded-md px-3 py-2 font-medium ${panel === "ai" ? "bg-background shadow-xs" : "text-muted-foreground"}`}
            >
              AI-kodning
            </button>
            <button
              type="button"
              onClick={() => setPanel("researcher")}
              className={`rounded-md px-3 py-2 font-medium ${panel === "researcher" ? "bg-background shadow-xs" : "text-muted-foreground"}`}
            >
              Forskarens kodning
            </button>
          </div>
        ) : null}

        <div className="mt-4">
          {panel === "ai" && showAi ? (
            <AiCodingPanel
              analysis={analysis}
              selectedMessage={selectedMessage}
              codeOptions={codeOptions}
              selectedSequence={selectedSequence}
            />
          ) : (
            <ResearcherCodingPanel
              sessionId={sessionId}
              messages={messages}
              selectedMessage={selectedMessage}
              selectedResearcher={selectedResearcher}
              currentResearcher={currentResearcher}
              onResearcherChange={setSelectedResearcher}
              target={researcherTarget}
              onTargetChange={setResearcherTarget}
              entries={coding[selectedResearcher]}
              codeOptions={codeOptions}
              onSaved={replaceEntry}
              onDeleted={(id) => removeEntry(selectedResearcher, id)}
              selectedSequenceEntry={highlightedResearcherSequenceId(
                selectedSequence,
                sequences,
                selectedResearcher,
              )}
            />
          )}
        </div>
      </aside>
    </section>
  );
}

function TranscriptSequenceGrid({
  participantCode,
  messages,
  analysis,
  coding,
  visibility,
  codeNames,
  sequences,
  highlightedSequence,
  selectedSequence,
  selectedMessage,
  onMessageSelect,
  onSequenceHover,
  onSequenceSelect,
}: {
  participantCode: string;
  messages: TranscriptMessage[];
  analysis: StoredCoding | null;
  coding: CodingByResearcher;
  visibility: TranscriptCodingVisibility;
  codeNames: Map<string, string>;
  sequences: PositionedTranscriptSequence[];
  highlightedSequence: TranscriptSequence | null;
  selectedSequence: string | null;
  selectedMessage: number;
  onMessageSelect: (message: number) => void;
  onSequenceHover: (key: string | null) => void;
  onSequenceSelect: (sequence: TranscriptSequence) => void;
}) {
  const laneCount = Math.max(
    0,
    ...sequences.map((sequence) => sequence.lane + 1),
  );
  const rowByMessage = new Map(
    messages.map((message, index) => [message.index, index + 1]),
  );
  const gridTemplateColumns = `${laneCount ? `repeat(${laneCount}, 2.25rem) ` : ""}minmax(0, 1fr)`;

  return (
    <div>
      {laneCount ? (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Sekvenser
        </p>
      ) : null}
      <div className="grid gap-x-1 gap-y-3" style={{ gridTemplateColumns }}>
        {sequences.map((sequence) => {
          const firstRow = rowByMessage.get(sequence.firstMessage);
          const lastRow = rowByMessage.get(sequence.lastMessage);
          if (!firstRow || !lastRow) return null;
          return (
            <SequenceTrack
              key={sequence.key}
              sequence={sequence}
              selected={selectedSequence === sequence.key}
              style={{
                gridColumn: sequence.lane + 1,
                gridRow: `${firstRow} / ${lastRow + 1}`,
              }}
              onHover={onSequenceHover}
              onSelect={onSequenceSelect}
            />
          );
        })}

        {messages.map((message, index) => {
          const selectable = message.role === "student";
          const selected = selectable && message.index === selectedMessage;
          const highlighted =
            highlightedSequence &&
            message.index >= highlightedSequence.firstMessage &&
            message.index <= highlightedSequence.lastMessage;
          const badges = selectable
            ? transcriptCodeBadges(
                message.index,
                analysis,
                coding,
                visibility,
                codeNames,
              )
            : [];
          return (
            <div
              key={message.index}
              data-sequence-highlighted={highlighted ? "true" : undefined}
              className="flex min-w-0 flex-col"
              style={{
                gridColumn: laneCount + 1,
                gridRow: index + 1,
              }}
            >
              <ChatBubble
                message={message}
                headerLabel={`${message.index}. ${
                  selectable ? `Deltagare ${participantCode}` : "Gemini"
                }`}
                headerActions={
                  selected || badges.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1 normal-case">
                      {selected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-700 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-normal text-white normal-case dark:bg-blue-300 dark:text-blue-950">
                          <Check aria-hidden="true" className="size-3" />
                          Vald för kodning
                        </span>
                      ) : null}
                      {badges.map((badge) => (
                        <CodingSourceBadge
                          key={`${badge.source}-${badge.code}`}
                          {...badge}
                        />
                      ))}
                    </div>
                  ) : null
                }
                role={selectable ? "button" : undefined}
                tabIndex={selectable ? 0 : undefined}
                aria-pressed={selectable ? selected : undefined}
                data-selected={selected ? "true" : undefined}
                onClick={
                  selectable ? () => onMessageSelect(message.index) : undefined
                }
                onKeyDown={
                  selectable
                    ? (event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        onMessageSelect(message.index);
                      }
                    : undefined
                }
                className={`${selectable ? "cursor-pointer border border-transparent transition-[background-color,border-color,box-shadow] hover:border-blue-400 hover:bg-blue-100/80 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none data-[selected=true]:border-blue-700 data-[selected=true]:bg-blue-100 data-[selected=true]:shadow-sm data-[selected=true]:ring-2 data-[selected=true]:ring-blue-700 data-[selected=true]:ring-offset-2 data-[selected=true]:ring-offset-background dark:hover:border-blue-500 dark:hover:bg-blue-900/60 dark:data-[selected=true]:border-blue-300 dark:data-[selected=true]:bg-blue-900/70 dark:data-[selected=true]:ring-blue-300" : ""} ${
                  highlighted
                    ? sequenceMessageHighlight(highlightedSequence.source)
                    : ""
                }`}
              >
                {message.role === "gemini" ? (
                  <ExpandableText text={message.text} />
                ) : (
                  <MessageContent text={message.text} />
                )}
              </ChatBubble>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SequenceTrack({
  sequence,
  selected,
  style,
  onHover,
  onSelect,
}: {
  sequence: PositionedTranscriptSequence;
  selected: boolean;
  style: { gridColumn: number; gridRow: string };
  onHover: (key: string | null) => void;
  onSelect: (sequence: TranscriptSequence) => void;
}) {
  const tone = sequenceTrackTone(sequence.source);
  const codes = sequence.codes.join(" + ") || "—";
  const names = sequence.names.join(" · ") || "Ingen sekvenskod";
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  function moveTooltip(clientX: number, clientY: number) {
    const width = 224;
    const height = 120;
    const gap = 12;
    const edge = 8;
    const left =
      clientX + gap + width <= window.innerWidth - edge
        ? clientX + gap
        : clientX - gap - width;

    setTooltipPosition({
      left: Math.max(edge, left),
      top: Math.max(
        edge,
        Math.min(clientY + gap, window.innerHeight - height - edge),
      ),
    });
  }

  return (
    <button
      type="button"
      style={style}
      aria-pressed={selected}
      aria-label={`${sequence.sourceLabel}: ${codes}, ${names}, meddelande ${sequence.firstMessage}–${sequence.lastMessage}`}
      onMouseEnter={(event) => {
        onHover(sequence.key);
        moveTooltip(event.clientX, event.clientY);
      }}
      onMouseMove={(event) => moveTooltip(event.clientX, event.clientY)}
      onMouseLeave={() => {
        onHover(null);
        setTooltipPosition(null);
      }}
      onFocus={() => onHover(sequence.key)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(sequence)}
      className={`group relative mx-auto min-h-16 w-8 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? tone.selected : ""}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-2 bottom-2 left-1/2 w-px -translate-x-1/2 ${tone.line}`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-1.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 border-background ${tone.line}`}
      />
      <span
        aria-hidden="true"
        className={`absolute bottom-1.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 border-background ${tone.line}`}
      />
      <span
        aria-hidden="true"
        className={`relative mt-5 inline-flex min-w-7 flex-col rounded-md border px-1 py-1 text-[0.625rem] leading-3 font-semibold shadow-xs ${tone.label}`}
      >
        <span>{sequence.source === "ai" ? "AI" : sequence.sourceLabel[0]}</span>
        <span>{codes}</span>
      </span>
      <span
        role="tooltip"
        style={tooltipPosition ?? undefined}
        className={`pointer-events-none z-30 flex w-56 flex-col rounded-lg border bg-popover p-3 text-left text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${tooltipPosition ? "fixed" : "absolute top-4 left-full ml-2"}`}
      >
        <strong>
          {sequence.sourceLabel} · {codes}
        </strong>
        <span className="mt-1">{names}</span>
        <span className="mt-1 text-muted-foreground">
          Meddelande {sequence.firstMessage}–{sequence.lastMessage}
        </span>
        <span className="mt-2 font-medium text-foreground">Visa i panelen</span>
      </span>
    </button>
  );
}

function transcriptCodeBadges(
  message: number,
  analysis: StoredCoding | null,
  coding: CodingByResearcher,
  visibility: TranscriptCodingVisibility,
  codeNames: Map<string, string>,
): CodingSourceBadgeData[] {
  const badges: CodingSourceBadgeData[] = [];
  if (visibility.ai) {
    const prompt = analysis?.prompts.find(
      (candidate) => candidate.message === message,
    );
    badges.push(
      ...(prompt?.codes.map((entry) => ({
        source: "ai" as const,
        label: "AI",
        code: entry.code,
        name: codeNames.get(entry.code),
      })) ?? []),
    );
  }
  for (const researcherId of ["R1", "R2"] as const) {
    if (!visibility[researcherId]) continue;
    const prompt = coding[researcherId].find(
      (entry): entry is ResearcherPromptCoding =>
        entry.kind === "prompt" && entry.message === message,
    );
    badges.push(
      ...(prompt?.codes.map((code) => ({
        source: researcherId,
        label: researcherName(researcherId),
        code,
        name: codeNames.get(code),
      })) ?? []),
    );
  }
  return badges;
}

function transcriptSequences(
  analysis: StoredCoding | null,
  coding: CodingByResearcher,
  visibility: TranscriptCodingVisibility,
  codeNames: Map<string, string>,
): TranscriptSequence[] {
  const sequences: TranscriptSequence[] = [];
  if (visibility.ai) {
    analysis?.sequences.forEach((sequence, index) => {
      sequences.push({
        key: aiSequenceKey(sequence, index),
        source: "ai",
        sourceLabel: "AI",
        codes: [sequence.pattern],
        names: [codeNames.get(sequence.pattern) ?? sequence.pattern],
        firstMessage: sequence.firstMessage,
        lastMessage: sequence.lastMessage,
        researcherEntryId: null,
      });
    });
  }
  for (const researcherId of ["R1", "R2"] as const) {
    if (!visibility[researcherId]) continue;
    for (const entry of coding[researcherId]) {
      if (entry.kind !== "sequence") continue;
      sequences.push({
        key: `${researcherId}-${entry.id}`,
        source: researcherId,
        sourceLabel: researcherName(researcherId),
        codes: entry.codes,
        names: entry.codes.map((code) => codeNames.get(code) ?? code),
        firstMessage: entry.firstMessage,
        lastMessage: entry.lastMessage,
        researcherEntryId: entry.id,
      });
    }
  }
  return sequences;
}

function aiSequenceKey(
  sequence: StoredCoding["sequences"][number],
  index: number,
) {
  return `ai-${index}-${sequence.pattern}-${sequence.firstMessage}-${sequence.lastMessage}`;
}

function positionTranscriptSequences(
  sequences: TranscriptSequence[],
): PositionedTranscriptSequence[] {
  const laneEnds: number[] = [];
  return [...sequences]
    .sort(
      (a, b) =>
        a.firstMessage - b.firstMessage ||
        a.lastMessage - b.lastMessage ||
        a.key.localeCompare(b.key),
    )
    .map((sequence) => {
      let lane = laneEnds.findIndex(
        (lastMessage) => lastMessage < sequence.firstMessage,
      );
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = sequence.lastMessage;
      return { ...sequence, lane };
    });
}

function highlightedResearcherSequenceId(
  selectedKey: string | null,
  sequences: TranscriptSequence[],
  researcherId: ResearcherId,
) {
  const sequence = sequences.find(
    (candidate) =>
      candidate.key === selectedKey && candidate.source === researcherId,
  );
  return sequence?.researcherEntryId ?? null;
}

function sequenceTrackTone(source: "ai" | ResearcherId) {
  return source === "ai"
    ? {
        line: "bg-emerald-400 dark:bg-emerald-600",
        label:
          "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
        selected: "ring-2 ring-emerald-400/60",
      }
    : source === "R1"
      ? {
          line: "bg-blue-400 dark:bg-blue-600",
          label:
            "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
          selected: "ring-2 ring-blue-400/60",
        }
      : {
          line: "bg-violet-400 dark:bg-violet-600",
          label:
            "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100",
          selected: "ring-2 ring-violet-400/60",
        };
}

function sequenceMessageHighlight(source: "ai" | ResearcherId) {
  return source === "ai"
    ? "outline-2 outline-emerald-300/60 dark:outline-emerald-700/60"
    : source === "R1"
      ? "outline-2 outline-blue-300/60 dark:outline-blue-700/60"
      : "outline-2 outline-violet-300/60 dark:outline-violet-700/60";
}

function TranscriptCodingToggle({
  label,
  source,
  pressed,
  onClick,
}: {
  label: string;
  source: "ai" | ResearcherId;
  pressed: boolean;
  onClick: () => void;
}) {
  const tone =
    source === "ai"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
      : source === "R1"
        ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
        : "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100";
  const Icon = source === "ai" ? Sparkles : UserRound;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`Visa ${label}-koder i transkriptet`}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-opacity ${tone} ${pressed ? "opacity-100 shadow-xs" : "opacity-45 grayscale"}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
      <span aria-hidden="true">{pressed ? "På" : "Av"}</span>
    </button>
  );
}

function AiCodingPanel({
  analysis,
  selectedMessage,
  codeOptions,
  selectedSequence,
}: {
  analysis: StoredCoding | null;
  selectedMessage: number;
  codeOptions: AdminCodeOption[];
  selectedSequence: string | null;
}) {
  const names = new Map(
    codeOptions.map((option) => [option.code, option.name]),
  );
  if (!analysis) {
    return (
      <PanelEmpty>Ingen AI-kodning finns lagrad för lektionen.</PanelEmpty>
    );
  }

  const prompt = analysis.prompts.find(
    (candidate) => candidate.message === selectedMessage,
  );
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="text-sm font-semibold">Prompt {selectedMessage}</h3>
        <div className="mt-2 flex flex-col gap-2">
          {prompt?.codes.length ? (
            prompt.codes.map((coding) => (
              <details
                key={coding.code}
                className="group rounded-lg border p-3"
              >
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="mr-2 inline-flex rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-900">
                    {coding.code}
                  </span>
                  {names.get(coding.code) ?? coding.code}
                  <span className="float-right text-xs text-muted-foreground group-open:hidden">
                    Visa motivering
                  </span>
                  <span className="float-right hidden text-xs text-muted-foreground group-open:inline">
                    Dölj motivering
                  </span>
                </summary>
                <div className="mt-3 space-y-3 border-t pt-3 text-sm">
                  <div>
                    <h4 className="font-medium">Motivering</h4>
                    <p className="mt-1 text-muted-foreground">
                      {coding.justification}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Utdrag ur chatten</h4>
                    <blockquote className="mt-1 rounded-lg bg-muted p-3 text-muted-foreground">
                      {coding.excerpt}
                    </blockquote>
                  </div>
                </div>
              </details>
            ))
          ) : (
            <PanelEmpty>
              {prompt?.note ?? "Prompten har inga lagrade koder."}
            </PanelEmpty>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Sekvenskoder</h3>
        <div className="mt-2 flex flex-col gap-2">
          {analysis.sequences.length ? (
            analysis.sequences.map((sequence, index) => (
              <details
                key={`${sequence.pattern}-${sequence.firstMessage}-${index}`}
                open={
                  selectedSequence === aiSequenceKey(sequence, index) ||
                  undefined
                }
                className={`group rounded-lg border p-3 ${
                  selectedSequence === aiSequenceKey(sequence, index)
                    ? "ring-2 ring-emerald-400/60"
                    : ""
                }`}
              >
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="mr-2 inline-flex rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-900">
                    {sequence.pattern}
                  </span>
                  {names.get(sequence.pattern) ?? sequence.pattern}
                  <span className="block pt-1 text-xs font-normal text-muted-foreground">
                    Meddelande {sequence.firstMessage}–{sequence.lastMessage}
                    <span className="group-open:hidden">
                      {" "}
                      · Visa motivering
                    </span>
                    <span className="hidden group-open:inline">
                      {" "}
                      · Dölj motivering
                    </span>
                  </span>
                </summary>
                <div className="mt-3 space-y-3 border-t pt-3 text-sm">
                  <div>
                    <h4 className="font-medium">Motivering</h4>
                    <p className="mt-1 text-muted-foreground">
                      {sequence.justification}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Utdrag ur chatten</h4>
                    <blockquote className="mt-1 rounded-lg bg-muted p-3 text-muted-foreground">
                      {sequence.excerpt}
                    </blockquote>
                  </div>
                </div>
              </details>
            ))
          ) : (
            <PanelEmpty>Inga sekvenskoder finns lagrade.</PanelEmpty>
          )}
        </div>
      </section>
    </div>
  );
}

function ResearcherCodingPanel({
  sessionId,
  messages,
  selectedMessage,
  selectedResearcher,
  currentResearcher,
  onResearcherChange,
  target,
  onTargetChange,
  entries,
  codeOptions,
  onSaved,
  onDeleted,
  selectedSequenceEntry,
}: {
  sessionId: string;
  messages: TranscriptMessage[];
  selectedMessage: number;
  selectedResearcher: ResearcherId;
  currentResearcher: ResearcherId;
  onResearcherChange: (researcher: ResearcherId) => void;
  target: ManualTarget;
  onTargetChange: (target: ManualTarget) => void;
  entries: ResearcherCoding[];
  codeOptions: AdminCodeOption[];
  onSaved: (entry: ResearcherCoding) => void;
  onDeleted: (id: string) => void;
  selectedSequenceEntry: string | null;
}) {
  const editable = selectedResearcher === currentResearcher;
  const prompt = entries.find(
    (entry): entry is ResearcherPromptCoding =>
      entry.kind === "prompt" && entry.message === selectedMessage,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Visar kodning för
        </p>
        <div className="mt-2 grid grid-cols-2 rounded-lg bg-muted p-1">
          {(["R1", "R2"] as const).map((researcher) => (
            <button
              key={researcher}
              type="button"
              onClick={() => onResearcherChange(researcher)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${selectedResearcher === researcher ? "bg-background shadow-xs" : "text-muted-foreground"}`}
            >
              {researcherName(researcher)}
              {researcher === currentResearcher ? " (du)" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b text-sm">
        <button
          type="button"
          onClick={() => onTargetChange("prompt")}
          className={`border-b-2 px-3 py-2 font-medium ${target === "prompt" ? "border-foreground" : "border-transparent text-muted-foreground"}`}
        >
          Prompt
        </button>
        <button
          type="button"
          onClick={() => onTargetChange("sequence")}
          className={`border-b-2 px-3 py-2 font-medium ${target === "sequence" ? "border-foreground" : "border-transparent text-muted-foreground"}`}
        >
          Sekvenser
        </button>
      </div>

      {!editable ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Du visar {researcherName(selectedResearcher)}s kodning. Byt till{" "}
          {researcherName(currentResearcher)} för att redigera din egen.
        </p>
      ) : null}

      {target === "prompt" ? (
        editable ? (
          <PromptEditor
            key={`${selectedResearcher}-${selectedMessage}-${prompt?.updatedAt ?? "empty"}`}
            sessionId={sessionId}
            message={selectedMessage}
            initial={prompt}
            codeOptions={codeOptions.filter(
              (option) => option.kind === "prompt",
            )}
            onSaved={onSaved}
          />
        ) : (
          <ReadOnlyEntry entry={prompt} codeOptions={codeOptions} />
        )
      ) : (
        <SequencePanel
          key={selectedResearcher}
          sessionId={sessionId}
          researcherId={selectedResearcher}
          messages={messages}
          entries={entries.filter(
            (entry): entry is ResearcherSequenceCoding =>
              entry.kind === "sequence",
          )}
          editable={editable}
          codeOptions={codeOptions.filter(
            (option) => option.kind === "sequence",
          )}
          onSaved={onSaved}
          onDeleted={onDeleted}
          highlightedId={selectedSequenceEntry}
        />
      )}
    </div>
  );
}

function PromptEditor({
  sessionId,
  message,
  initial,
  codeOptions,
  onSaved,
}: {
  sessionId: string;
  message: number;
  initial?: ResearcherPromptCoding;
  codeOptions: AdminCodeOption[];
  onSaved: (entry: ResearcherPromptCoding) => void;
}) {
  const [note, setNote] = useState(initial?.note ?? "");
  const [codes, setCodes] = useState(initial?.codes ?? []);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await savePromptCodingAction({
        sessionId,
        message,
        note,
        codes,
      });
      if (!result.ok) return setStatus(result.error);
      onSaved(result.entry);
      setStatus("Sparat.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Prompt {message}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`prompt-note-${message}`}>Anteckning</Label>
        <Textarea
          id={`prompt-note-${message}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={5_000}
          placeholder="Skriv en anteckning om prompten…"
        />
      </div>
      <CodePicker options={codeOptions} selected={codes} onChange={setCodes} />
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {status}
        </p>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Sparar…" : "Spara"}
        </Button>
      </div>
    </div>
  );
}

function SequencePanel({
  sessionId,
  researcherId,
  messages,
  entries,
  editable,
  codeOptions,
  onSaved,
  onDeleted,
  highlightedId,
}: {
  sessionId: string;
  researcherId: ResearcherId;
  messages: TranscriptMessage[];
  entries: ResearcherSequenceCoding[];
  editable: boolean;
  codeOptions: AdminCodeOption[];
  onSaved: (entry: ResearcherSequenceCoding) => void;
  onDeleted: (id: string) => void;
  highlightedId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const selected = entries.find((entry) => entry.id === selectedId);

  if (editable && (selected || draftId)) {
    return (
      <SequenceEditor
        key={selected?.updatedAt ?? draftId}
        sessionId={sessionId}
        messages={messages}
        initial={selected}
        id={selected?.id ?? draftId!}
        codeOptions={codeOptions}
        onCancel={() => {
          setSelectedId(null);
          setDraftId(null);
        }}
        onSaved={(entry) => {
          onSaved(entry);
          setSelectedId(entry.id);
          setDraftId(null);
        }}
        onDeleted={(id) => {
          onDeleted(id);
          setSelectedId(null);
          setDraftId(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.length ? (
        entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => editable && setSelectedId(entry.id)}
            className={`rounded-lg border p-3 text-left hover:bg-muted/50 disabled:cursor-default ${
              highlightedId === entry.id
                ? researcherId === "R1"
                  ? "ring-2 ring-blue-400/60"
                  : "ring-2 ring-violet-400/60"
                : ""
            }`}
            disabled={!editable}
          >
            <span className="text-sm font-medium">
              Meddelande {entry.firstMessage}–{entry.lastMessage}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {entry.codes.join(", ") || "Ingen kod"}
              {entry.note ? ` · ${entry.note}` : ""}
            </span>
          </button>
        ))
      ) : (
        <PanelEmpty>Inga sekvenser har kodats av forskaren.</PanelEmpty>
      )}
      {editable ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setDraftId(`sequence-${crypto.randomUUID()}`)}
        >
          <Plus aria-hidden="true" />
          Ny sekvens
        </Button>
      ) : null}
    </div>
  );
}

function SequenceEditor({
  sessionId,
  messages,
  initial,
  id,
  codeOptions,
  onCancel,
  onSaved,
  onDeleted,
}: {
  sessionId: string;
  messages: TranscriptMessage[];
  initial?: ResearcherSequenceCoding;
  id: string;
  codeOptions: AdminCodeOption[];
  onCancel: () => void;
  onSaved: (entry: ResearcherSequenceCoding) => void;
  onDeleted: (id: string) => void;
}) {
  const firstIndex = messages[0]?.index ?? 1;
  const lastIndex = messages.at(-1)?.index ?? firstIndex;
  const [firstMessage, setFirstMessage] = useState(
    initial?.firstMessage ?? firstIndex,
  );
  const [lastMessage, setLastMessage] = useState(
    initial?.lastMessage ?? lastIndex,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [codes, setCodes] = useState(initial?.codes ?? []);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveSequenceCodingAction({
        sessionId,
        id,
        firstMessage,
        lastMessage,
        note,
        codes,
      });
      if (!result.ok) return setStatus(result.error);
      onSaved(result.entry);
      setStatus("Sparat.");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSequenceCodingAction({ sessionId, id });
      if (!result.ok) return setStatus(result.error);
      onDeleted(id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {initial ? "Redigera sekvens" : "Ny sekvens"}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectMessage
          label="Från meddelande"
          value={firstMessage}
          messages={messages}
          onChange={setFirstMessage}
        />
        <SelectMessage
          label="Till meddelande"
          value={lastMessage}
          messages={messages}
          onChange={setLastMessage}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`sequence-note-${id}`}>Anteckning</Label>
        <Textarea
          id={`sequence-note-${id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={5_000}
          placeholder="Skriv en anteckning om sekvensen…"
        />
      </div>
      <CodePicker options={codeOptions} selected={codes} onChange={setCodes} />
      {status ? (
        <Alert variant={status === "Sparat." ? "default" : "destructive"}>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-between gap-2">
        {initial ? (
          <Button
            type="button"
            variant="destructive"
            onClick={remove}
            disabled={pending}
          >
            <Trash2 aria-hidden="true" />
            Ta bort
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Sparar…" : "Spara sekvens"}
        </Button>
      </div>
    </div>
  );
}

function SelectMessage({
  label,
  value,
  messages,
  onChange,
}: {
  label: string;
  value: number;
  messages: TranscriptMessage[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 rounded-lg border bg-background px-2"
      >
        {messages.map((message) => (
          <option key={message.index} value={message.index}>
            {message.index}. {message.role === "student" ? "Elev" : "Gemini"}
          </option>
        ))}
      </select>
    </label>
  );
}

function CodePicker({
  options,
  selected,
  onChange,
}: {
  options: AdminCodeOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("sv");
    if (!needle) return [];
    return options
      .filter((option) => !selected.includes(option.code))
      .filter((option) =>
        [option.code, option.name, option.description, ...option.examples]
          .join(" ")
          .toLocaleLowerCase("sv")
          .includes(needle),
      )
      .slice(0, 8);
  }, [options, query, selected]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="admin-code-search">Lägg till kod</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="admin-code-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök kod, beskrivning eller exempel"
          className="h-10 pl-9"
        />
      </div>
      {query ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border bg-background p-1 shadow-lg">
          {results.length ? (
            results.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  onChange([...selected, option.code]);
                  setQuery("");
                }}
                className="block w-full rounded-md px-3 py-2 text-left hover:bg-muted"
              >
                <span className="text-sm font-medium">
                  {option.code} · {option.name}
                </span>
                {option.description ? (
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Ingen kod matchar sökningen.
            </p>
          )}
        </div>
      ) : null}
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((code) => {
            const option = options.find((candidate) => candidate.code === code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
              >
                {code} · {option?.name ?? "Okänd kod"}
                <button
                  type="button"
                  onClick={() =>
                    onChange(selected.filter((candidate) => candidate !== code))
                  }
                  aria-label={`Ta bort ${code}`}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ReadOnlyEntry({
  entry,
  codeOptions,
}: {
  entry?: ResearcherPromptCoding;
  codeOptions: AdminCodeOption[];
}) {
  if (!entry)
    return <PanelEmpty>Ingen kodning har sparats för prompten.</PanelEmpty>;
  const names = new Map(
    codeOptions.map((option) => [option.code, option.name]),
  );
  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div>
        <h3 className="font-medium">Anteckning</h3>
        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
          {entry.note || "Ingen anteckning."}
        </p>
      </div>
      <div>
        <h3 className="font-medium">Koder</h3>
        <p className="mt-1 text-muted-foreground">
          {entry.codes.length
            ? entry.codes
                .map((code) => `${code} · ${names.get(code) ?? "Okänd kod"}`)
                .join(", ")
            : "Inga koder."}
        </p>
      </div>
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
