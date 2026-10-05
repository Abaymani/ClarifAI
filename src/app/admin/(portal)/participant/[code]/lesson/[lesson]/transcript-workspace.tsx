"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";

import {
  deleteSequenceCodingAction,
  savePromptCodingAction,
  saveSequenceCodingAction,
} from "@/app/admin/(portal)/coding-actions";
import { ChatBubble, ChatThread } from "@/app/session/chat-thread";
import { ExpandableText } from "@/app/session/expandable-text";
import { MessageContent } from "@/app/session/message-content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResearcherId } from "@/lib/admin/auth";
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

export function TranscriptWorkspace({
  sessionId,
  messages,
  analysis,
  coding: initialCoding,
  currentResearcher,
  codeOptions,
}: {
  sessionId: string;
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
  const [coding, setCoding] = useState(initialCoding);

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

  return (
    <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
      <div className="min-w-0 rounded-xl border bg-background p-3 sm:p-4">
        <ChatThread className="border-0 bg-transparent p-0">
          {messages.map((message) => {
            const selectable = message.role === "student";
            const selected = selectable && message.index === selectedMessage;
            return (
              <ChatBubble
                key={message.index}
                message={message}
                className={
                  selected
                    ? "ring-2 ring-foreground/30 ring-offset-2 ring-offset-background"
                    : undefined
                }
              >
                {message.role === "gemini" ? (
                  <ExpandableText text={message.text} />
                ) : (
                  <MessageContent text={message.text} />
                )}
                {selectable ? (
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(message.index)}
                    className="mt-3 text-xs font-medium underline-offset-2 hover:underline"
                    aria-pressed={selected}
                  >
                    {selected ? "Vald prompt" : "Välj prompt"}
                  </button>
                ) : null}
              </ChatBubble>
            );
          })}
        </ChatThread>
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
            />
          ) : (
            <ResearcherCodingPanel
              sessionId={sessionId}
              messages={messages}
              selectedMessage={selectedMessage}
              selectedResearcher={selectedResearcher}
              currentResearcher={currentResearcher}
              onResearcherChange={setSelectedResearcher}
              entries={coding[selectedResearcher]}
              codeOptions={codeOptions}
              onSaved={replaceEntry}
              onDeleted={(id) => removeEntry(selectedResearcher, id)}
            />
          )}
        </div>
      </aside>
    </section>
  );
}

function AiCodingPanel({
  analysis,
  selectedMessage,
  codeOptions,
}: {
  analysis: StoredCoding | null;
  selectedMessage: number;
  codeOptions: AdminCodeOption[];
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
                className="group rounded-lg border p-3"
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
  entries,
  codeOptions,
  onSaved,
  onDeleted,
}: {
  sessionId: string;
  messages: TranscriptMessage[];
  selectedMessage: number;
  selectedResearcher: ResearcherId;
  currentResearcher: ResearcherId;
  onResearcherChange: (researcher: ResearcherId) => void;
  entries: ResearcherCoding[];
  codeOptions: AdminCodeOption[];
  onSaved: (entry: ResearcherCoding) => void;
  onDeleted: (id: string) => void;
}) {
  const [target, setTarget] = useState<ManualTarget>("prompt");
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
              {researcher}
              {researcher === currentResearcher ? " (du)" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b text-sm">
        <button
          type="button"
          onClick={() => setTarget("prompt")}
          className={`border-b-2 px-3 py-2 font-medium ${target === "prompt" ? "border-foreground" : "border-transparent text-muted-foreground"}`}
        >
          Prompt
        </button>
        <button
          type="button"
          onClick={() => setTarget("sequence")}
          className={`border-b-2 px-3 py-2 font-medium ${target === "sequence" ? "border-foreground" : "border-transparent text-muted-foreground"}`}
        >
          Sekvenser
        </button>
      </div>

      {!editable ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Du visar {selectedResearcher}:s kodning. Byt till {currentResearcher}{" "}
          för att redigera din egen.
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
  messages,
  entries,
  editable,
  codeOptions,
  onSaved,
  onDeleted,
}: {
  sessionId: string;
  messages: TranscriptMessage[];
  entries: ResearcherSequenceCoding[];
  editable: boolean;
  codeOptions: AdminCodeOption[];
  onSaved: (entry: ResearcherSequenceCoding) => void;
  onDeleted: (id: string) => void;
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
            className="rounded-lg border p-3 text-left hover:bg-muted/50 disabled:cursor-default"
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
