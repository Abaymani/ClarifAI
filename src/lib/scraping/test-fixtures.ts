// Synthetic stand-ins for Gemini's share data. They copy the shape observed in real
// responses (September 2026) but no real chat content, which must never enter the repo.

export type FixtureTurn = {
  prompt: string;
  sentAt: number; // Unix seconds
  drafts: string[];
  shownDraft?: number;
  promptFields?: Record<number, unknown>;
};

export function sharePayload(
  turns: FixtureTurn[],
  meta: {
    shareId?: string;
    title?: string;
    model?: string;
    sharedAt?: number;
  } = {},
): unknown {
  const {
    shareId = "abc123def456",
    title = "Blinking an LED",
    model = "3.6 Flash",
    sharedAt = 1790000000,
  } = meta;

  const rawTurns = turns.map((turn, i) => {
    const prompt: unknown[] = [
      [turn.prompt],
      1,
      null,
      1,
      "model-id",
      null,
      null,
      null,
      true,
      null,
      [],
    ];
    for (const [field, value] of Object.entries(turn.promptFields ?? {})) {
      prompt[Number(field)] = value;
    }
    const drafts = turn.drafts.map((text, j) => [
      `rc_${i}_${j}`,
      [text],
      null,
      null,
      null,
      null,
      null,
      null,
      [2],
      "en",
    ]);
    return [
      ["c_chat", `r_${i}`],
      i === 0 ? null : ["c_chat", `r_${i - 1}`, `rc_${i - 1}_0`],
      prompt,
      [drafts, null, null, `rc_${i}_${turn.shownDraft ?? 0}`],
      [turn.sentAt, 500_000_000],
    ];
  });

  return [
    [
      null,
      rawTurns,
      [
        true,
        title,
        null,
        null,
        null,
        ["", "", ""],
        null,
        [1, "model-id", model],
      ],
      shareId,
      [sharedAt, 0],
    ],
    null,
    false,
  ];
}

export function batchExecuteResponse(
  payload: unknown,
  rpcId = "ujx1Bf",
): string {
  const entries = JSON.stringify([
    ["wrb.fr", rpcId, JSON.stringify(payload), null, null, null, "generic"],
    ["di", 181],
  ]);
  return `)]}'\n\n${entries.length}\n${entries}\n25\n[["e",4,null,null,140]]\n`;
}

// Exactly what Gemini returned for a share ID that does not exist.
export const NOT_FOUND_RESPONSE = `)]}'\n\n104\n[["wrb.fr","ujx1Bf",null,null,null,[5],"generic"],["di",181],["af.httprm",181,"-19153627943171611",4]]\n25\n[["e",4,null,null,140]]\n`;
