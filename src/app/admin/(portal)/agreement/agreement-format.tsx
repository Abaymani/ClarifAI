import type {
  Coder,
  CoderPair,
  Difference,
  Interval,
} from "@/lib/admin/coder-agreement";
import type { IcapLevel } from "@/lib/admin/icap-counts";
import { researcherName } from "@/lib/admin/researchers";

export type AgreementCode = { code: string; name: string; level: IcapLevel };

// Intervals from fewer transcripts are shown but marked as unreliable (DL-077).
export const UNCERTAIN_BELOW = 10;

export const PAIR_CODERS: Record<CoderPair, [Coder, Coder]> = {
  "R1-R2": ["R1", "R2"],
  "AI-R1": ["AI", "R1"],
  "AI-R2": ["AI", "R2"],
};

const ALPHA = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const SIGNED = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
const UNCERTAIN_STYLE =
  "rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";

export function coderName(coder: Coder): string {
  return coder === "AI" ? "AI" : researcherName(coder);
}

export function pairName(pair: CoderPair): string {
  const [first, second] = PAIR_CODERS[pair];
  return `${coderName(first)} – ${coderName(second)}`;
}

export function formatAlpha(value: number | null): string {
  return value === null ? "–" : ALPHA.format(value);
}

// "till" rather than a dash when a bound is negative, so the minus sign can't be
// mistaken for the dash.
export function formatInterval(
  interval: Interval | null,
  label: string,
): string {
  if (!interval) return `${label} kan inte beräknas`;
  const [low, high] = interval.map((bound) => ALPHA.format(bound));
  return `${label} ${low}${interval[0] < 0 ? " till " : "–"}${high}`;
}

// A signed change with its interval, such as "+0,03 (95 % KI 0,01–0,05)".
export function formatChange(difference: Difference | null): string {
  if (!difference) return "kan inte beräknas";
  return `${SIGNED.format(difference.estimate)} (${formatInterval(difference.interval, "95 % KI")})`;
}

export function formatDifference(difference: Difference | null): string {
  return `Jämfört med ${pairName("R1-R2")}: ${formatChange(difference)}`;
}

export function Uncertain({
  transcripts,
  long = false,
}: {
  transcripts: number;
  long?: boolean;
}) {
  if (transcripts >= UNCERTAIN_BELOW) return null;
  return (
    <span
      className={UNCERTAIN_STYLE}
      title={`Färre än ${UNCERTAIN_BELOW} transkript`}
    >
      {long ? `Osäkert: färre än ${UNCERTAIN_BELOW} transkript` : "Osäkert"}
    </span>
  );
}
