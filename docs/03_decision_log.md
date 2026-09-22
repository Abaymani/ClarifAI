# Decision log
**Important decisions must be clearly documented here.** This clarification must include the following:
- Referable ID
- What was the topic?
- What were the options?
- What decision was made?
- what risks/consequences can be expected?
- Who made the decision, was there human approval?

## Log

### DL-001: What is sent to OpenAI, and what the transcript link is for
- **Options:** Send the Gemini link to OpenAI; send the scraped transcript.
- **Decision:** The scraped transcript (with names redacted) is analysed. The original link is stored only as a fallback for researchers.
- **Risks/consequences:** The stored link leads to the unredacted chat for as long as the student keeps it. Students have been told and have consented. Architecture updated.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-002: Number of reflection points
- **Options:** 3–4 (architecture); up to 3 (FR); a configurable number (FR).
- **Decision:** A configurable maximum, default 3.
- **Risks/consequences:** None beyond keeping the configured value in line with lesson time. Architecture and FRs updated.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-003: Transcript confirmation step
- **Options:** Complete lessons 1 and 4 as soon as scraping succeeds; show a preview and let the student confirm the transcript first.
- **Decision:** After scraping, the student sees a preview and confirms "Is this your transcript?" before the session continues. Until the session is completed, they can replace the link.
- **Risks/consequences:** One extra step for students. It prevents wrong transcripts from being locked into completed sessions. Architecture and FRs updated.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-004: FAILURE is recoverable
- **Options:** FAILURE as an end state (earlier diagrams); FAILURE with retry (FR on error handling).
- **Decision:** A failure shows a friendly message, keeps the error code, and lets the student retry the failed step. Data saved earlier is kept.
- **Risks/consequences:** Each step must be safe to retry without creating duplicate records. Architecture diagrams updated.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-005: Images in transcripts
- **Options:** Store images; store nothing; replace each image with a placeholder.
- **Decision:** Images are not stored. Each image is replaced by the text `[PICTURE]`.
- **Risks/consequences:** Analysis loses what the images showed; the surrounding text is expected to give enough context. No identifiable image data is stored, and no image recognition or Cloud Storage (paid Blaze plan) is needed. Architecture updated.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-006: Participant PIN
- **Options:** Participant code only; code plus a PIN; longer random codes.
- **Decision:** The student chooses a 4-digit PIN at their first session. From then on, the code and the PIN are needed for all of their sessions (the PIN belongs to the student, not to a session). It is stored in clear text, so researchers can tell a student who forgets it. Repeated failed attempts are temporarily blocked.
- **Risks/consequences:** Students must remember the PIN for several weeks. Anyone with database access can read the PINs, which is acceptable because codes are pseudonymous. Students may pick birthdays; the UI should advise against it. A classmate who uses a code before its owner's first session can set the PIN, and researchers then have to reset it. Architecture and FRs updated.
- **Decided by:** Armin Baymani (human), 2026-09-22. Attempt limit and birthday advice proposed by Claude (agent); attempt limit approved by Armin.

### DL-007: What is redacted
- **Options:** All identifying information; names only.
- **Decision:** Mainly names. Students are told that their scraped transcript goes to OpenAI and not to include details that identify them.
- **Risks/consequences:** Names are hard to detect reliably, especially in Swedish, and some will be missed. The method is still open; Claude will propose one when S1 starts.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-008: One Gemini chat per lesson
- **Options:** Accept several links per session; one chat per lesson.
- **Decision:** One chat per lesson is a rule given to students. The system accepts one link per session.
- **Risks/consequences:** If a student breaks the rule, prompts from other lessons can end up in the analysis.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-009: Access to Gemini share links and scraping
- **Options:** —
- **Decision:** The researchers will ask the school to enable public Gemini link sharing (off by default for Google Workspace accounts since March 2026). Scraping will be tested early on real chats that the researchers provide.
- **Risks/consequences:** If sharing stays disabled, or Google changes the share page, scraping fails for everyone.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-010: GDPR and hosting regions
- **Options:** —
- **Decision:** Written consent has been obtained. The researchers set EU regions for Firebase (the Firestore location is permanent) and Vercel.
- **Risks/consequences:** A wrong Firestore location can only be fixed by creating a new database.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-011: Team workflow
- **Options:** —
- **Decision:** Unclaimed GitHub issues are up for grabs, and anyone, human or agent, may open new ones. Humans merge into `main` manually once an agent says the work is ready.
- **Risks/consequences:** Agents must claim an issue before starting, to avoid duplicate work. Added to AGENTS.md.
- **Decided by:** Armin Baymani (human), 2026-09-22.

### DL-012: Package manager
- **Options:** npm; pnpm.
- **Decision:** pnpm 11, pinned through `packageManager` in `package.json`.
- **Risks/consequences:** Everyone needs pnpm, and Vercel needs `ENABLE_EXPERIMENTAL_COREPACK=1` to use version 11. In return, pnpm skips package versions published less than a day ago, blocks dependencies from git or tarball URLs, and runs no install scripts unless they are allowed in `pnpm-workspace.yaml` (none are).
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-013: UI components
- **Options:** Tailwind Plus templates (paid); shadcn/ui; other free component kits.
- **Decision:** shadcn/ui.
- **Risks/consequences:** Components are copied into `src/components/ui`, so we maintain them ourselves. Architecture updated.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-014: shadcn/ui base library
- **Options:** Base UI (shadcn's default), Radix, React Aria.
- **Decision:** Base UI, through shadcn's default `base-nova` preset. It also brings shadcn's new `cn` package, a replacement for `clsx` and `tailwind-merge`.
- **Risks/consequences:** `cn` is a new pre-1.0 package (August 2026). It is published by shadcn, from the official `shadcn-ui` GitHub organisation, and has no dependencies or install scripts. Changing the base library later means re-adding components.
- **Decided by:** Claude (agent), 2026-09-22. Not yet reviewed by a human.

### DL-015: Node.js version
- **Options:** Node 22, 24 or 26.
- **Decision:** Node 24 LTS, pinned in `.nvmrc` and `engines`.
- **Risks/consequences:** Vercel Functions don't support Node 26 yet and disable Node 20 from October 2026. `firebase-admin` and `openai` need Node 22 or newer.
- **Decided by:** Claude (agent), within the setup proposal approved by Armin Baymani (human), 2026-09-22.

### DL-016: Firestore access only through the server
- **Options:** Browser Firebase SDK with security rules; Admin SDK in route handlers only.
- **Decision:** Only route handlers access Firestore, through the Admin SDK (`src/lib/firebase/admin.ts`, marked `server-only`). The security rules deny all client access, and emulator tests check this.
- **Risks/consequences:** Without Firebase sign-in, rules could not tell students apart, so any client access would expose every session. Every feature needs a route handler.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-017: Local development and tests use the Firestore emulator
- **Options:** Develop against a real Firebase project; the local emulator.
- **Decision:** `pnpm dev`, the emulator tests and the end-to-end tests all run against the emulator, with the demo project `demo-clarifai`. The Admin SDK prefers the emulator whenever one is running.
- **Risks/consequences:** Developers need Java 21. Local work can never write to the research database.
- **Decided by:** Claude (agent), within the setup proposal approved by Armin Baymani (human), 2026-09-22.

### DL-018: Testing stack
- **Options:** Jest or Vitest for unit tests; Playwright or Cypress for end-to-end tests.
- **Decision:** Vitest (unit), Vitest plus the Firebase emulator (security rules and Admin SDK), and Playwright (end-to-end, Chromium).
- **Risks/consequences:** Vitest cannot render `async` Server Components; those need end-to-end tests.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-019: Keeping secrets out of git
- **Options:** Rely on `.gitignore`; add automated secret scanning.
- **Decision:** All `.env*` files except `.env.example` are git-ignored. A gitleaks pre-commit hook scans every commit and blocks it if gitleaks is missing. CI scans the full history with a checksum-verified gitleaks binary. CI actions are pinned to commit SHAs.
- **Risks/consequences:** Everyone who commits needs gitleaks installed. Edits made on the GitHub website skip the hook, but CI still scans them.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-020: Next.js automatically editing AGENTS.md
- **Options:** Let `next dev` add its agent-rules block to `AGENTS.md`; turn this off.
- **Decision:** Turned off (`agentRules: false` in `next.config.ts`), because `AGENTS.md` holds the team's own rules. Next's block points agents to the version-matched Next.js docs in `node_modules/next/dist/docs/`.
- **Risks/consequences:** Next.js can't keep the reminder current, so AGENTS.md now carries a one-line pointer to those docs in the team's own wording.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-22.

### DL-021: ESLint 9
- **Options:** ESLint 9 (no longer supported); ESLint 10.
- **Decision:** ESLint 9, because the React plugin in `eslint-config-next` 16.3 crashes on ESLint 10.
- **Risks/consequences:** A development-only tool without security updates. Revisit when `eslint-config-next` supports ESLint 10.
- **Decided by:** Claude (agent), 2026-09-22. Not yet reviewed by a human.
### DL-022: Known moderate advisories in dependencies
- **Options:** Force patched versions through pnpm overrides; accept until upstream updates.
- **Decision:** Accept for now (`pnpm audit`, 2026-09-22: 4 moderate, no high or critical). The one runtime advisory is `uuid` < 11.1.1 inside `firebase-admin`'s Cloud Storage client. It affects uuid v3/v5/v6 called with a buffer, but the code only calls `v4()`, and we don't use Cloud Storage. The other three (`@opentelemetry/core`, `stream-json`, `csv-parse`) come from `firebase-tools`, a development-only CLI.
- **Risks/consequences:** Forcing new major versions under Google's libraries could break them. Re-run `pnpm audit` when updating dependencies.
- **Decided by:** Claude (agent), 2026-09-22. Not yet reviewed by a human.

### DL-023: Windows and Linux development parity
- **Options:** Support the original Linux setup only; document Windows as an unsupported workaround; maintain and test both Windows and Linux development environments.
- **Decision:** The project supports both Windows and Linux. Text files use repository-controlled line endings, setup instructions cover both platforms, and the main CI checks run on Ubuntu and Windows. Package scripts and emulator safeguards remain shared across platforms.
- **Risks/consequences:** CI takes longer because the full check suite runs twice. Windows PowerShell can block npm-generated `.ps1` launchers under a restrictive execution policy, so the Windows instructions document the equivalent `.cmd` launchers without weakening that policy.
- **Decided by:** Requested and approved by Armin Baymani (human), 2026-09-22. Implemented by Codex (agent).
