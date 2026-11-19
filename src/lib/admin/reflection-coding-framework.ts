import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REFLECTION_CODING_FILE,
  parseReflectionCodingFramework,
  type ReflectionCodingFramework,
} from "@/lib/admin/reflection-coding";

// Read on every use, like the analysis framework, so edits apply without a restart.
export function loadReflectionCodingFramework(): ReflectionCodingFramework {
  return parseReflectionCodingFramework(
    JSON.parse(
      readFileSync(
        join(process.cwd(), "framework", REFLECTION_CODING_FILE),
        "utf8",
      ),
    ),
  );
}
