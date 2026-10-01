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
- **Status:** Superseded by DL-029 (2026-09-23).

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
- **Decided by:** Claude (agent), 2026-09-22; approved by Armin Baymani (human), 2026-09-22.

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
- **Risks/consequences:** Vitest cannot render `async` Server Components; those need end-to-end tests. Updated 2026-09-23: the browser tests run in both Chromium and Firefox.
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
- **Decided by:** Claude (agent), 2026-09-22; approved by Armin Baymani (human), 2026-09-22.
### DL-022: Known moderate advisories in dependencies
- **Options:** Force patched versions through pnpm overrides; accept until upstream updates.
- **Decision:** Accept for now (`pnpm audit`, 2026-09-22: 4 moderate, no high or critical). The one runtime advisory is `uuid` < 11.1.1 inside `firebase-admin`'s Cloud Storage client. It affects uuid v3/v5/v6 called with a buffer, but the code only calls `v4()`, and we don't use Cloud Storage. The other three (`@opentelemetry/core`, `stream-json`, `csv-parse`) come from `firebase-tools`, a development-only CLI.
- **Risks/consequences:** Forcing new major versions under Google's libraries could break them. Re-run `pnpm audit` when updating dependencies.
- **Decided by:** Claude (agent), 2026-09-22; approved by Armin Baymani (human), 2026-09-22.

### DL-023: How transcripts are retrieved from share links
- **Options:** (a) Fetch the share page's HTML; (b) render the page in a headless browser and read what is displayed; (c) call the internal endpoint the share page itself uses (`batchexecute`, RPC `ujx1Bf`) with one plain HTTP request.
- **Decision:** (c). A short link (`share.gemini.google/…` or `g.co/gemini/share/…`) is first resolved by following its redirect by hand, allowing only Gemini hosts. Tested 2026-09-22 on a real chat: (a) doesn't work, because the chat isn't in the HTML. (b) works, but takes about 4.5 s and would need Chromium on Vercel. (c) returns the whole chat in about 0.5 s without cookies, login or consent screens. It gives the prompts exactly as shown on the page, the answers as their original Markdown, a timestamp per prompt, the model, the title and regenerated drafts.
- **Risks/consequences:** The endpoint is undocumented, so Google can change it without notice. The parser checks every field it uses and fails with `UNEXPECTED_FORMAT` rather than storing partial data, and the submitted link is always kept as the researchers' fallback. (b) remains a fallback if the endpoint closes. It works the same from Vercel's servers (tested 2026-09-22 from `iad1` and `arn1`, issue #3). Uploaded images and files have not been seen yet, so they are flagged as unsupported instead of being guessed.
- **Decided by:** Proposed by Claude (agent), 2026-09-22 (issue #3); approved by Armin Baymani (human), 2026-09-22.

### DL-024: Transcript format
- **Options:** Store the page text; store structured messages.
- **Decision:** One JSON record per chat, the canonical format, plus a Markdown rendering for human encoders. Messages are numbered from 1 so the analysis can refer to them. Each message has a role (`student`/`gemini`) and text. Student messages also carry the time they were sent, and Gemini messages any other drafts. The record also holds the submitted link, share URL, title, model, share time, retrieval time, parser version and warnings. Images become `[PICTURE]`; anything unrecognised becomes a visible marker plus a warning.
- **Risks/consequences:** Keeping other drafts and timestamps stores more than the page shows. Both are useful for research (regenerating is itself a behaviour), and Armin decided to keep both.
- **Decided by:** Proposed by Claude (agent), 2026-09-22 (issue #3); approved by Armin Baymani (human), 2026-09-22.

### DL-025: Running TypeScript scripts
- **Options:** Node's built-in type stripping; `tsx`.
- **Decision:** `tsx` (development only), because Node cannot resolve the `@/` import alias. Its `esbuild` install script stays blocked; the binary comes from esbuild's platform package.
- **Risks/consequences:** One more development dependency.
- **Decided by:** Claude (agent), 2026-09-22. Not yet reviewed by a human.

### DL-026: Hosting regions
- **Options:** Vercel's default function region (`iad1`, Washington, D.C.) or an EU region; pin the region in `vercel.json` or set it only in the Vercel dashboard.
- **Decision:** Firestore `(default)` runs in `europe-north2` (Stockholm), Standard edition. Vercel functions run in `arn1` (Stockholm), set in the dashboard only (no `vercel.json`). Follows up DL-010.
- **Risks/consequences:** Anyone with access to the Vercel project can change the region without code review, and the default would move student data processing to the US. Keep it in the EU. A database call took 744 ms from `iad1` and 305 ms from `arn1`.
- **Decided by:** Armin Baymani (human), 2026-09-22. Region check run by Claude (agent).

### DL-027: Preview deployments and the research database
- **Options:** A separate Firebase project for previews; a second database in the same project; previews share the production database for now.
- **Decision:** Previews share the production database for now, and the choice is revisited before S0.
- **Risks/consequences:** Preview deployments hold working credentials for the research database. Nothing writes to it yet, but once features do, testing a preview would write test data among the research data. Previews are behind Vercel's login.
- **Decided by:** Armin Baymani (human), 2026-09-22. A separate project was proposed by Claude (agent).
- **Status:** Superseded by DL-028 (2026-09-23).

### DL-028: Windows and Linux development parity
- **Options:** Support the original Linux setup only; document Windows as an unsupported workaround; maintain and test both Windows and Linux development environments.
- **Decision:** The project supports both Windows and Linux. Text files use repository-controlled line endings, setup instructions cover both platforms, and the main CI checks run on Ubuntu and Windows. Package scripts and emulator safeguards remain shared across platforms.
- **Risks/consequences:** CI takes longer because the full check suite runs twice. Windows PowerShell can block npm-generated `.ps1` launchers under a restrictive execution policy, so the Windows instructions document the equivalent `.cmd` launchers without weakening that policy.
- **Decided by:** Requested and approved by Armin Baymani (human), 2026-09-22. Implemented by Codex (agent).

### DL-028: Separate Firebase project for previews
- **Options:** Previews keep using the production project (DL-027); a second database inside the production project (needs the paid Blaze plan); a second Firebase project (free on Spark, which allows several projects).
- **Decision:** Previews use their own project, `clarifai-preview`: Firestore `(default)`, Standard edition, `europe-north2`, with the repository's rules deployed to it. In Vercel the `FIREBASE_*` variables are set per environment, so Production uses `clarifai-19445` and Preview uses `clarifai-preview`. Supersedes DL-027.
- **Risks/consequences:** Preview deployments hold no credentials for the research database, so testing a preview cannot reach student data, and no pre-study wipe is needed. Two projects must be kept in step: deploy `firestore.rules` to both after changing them. Preview data is disposable; delete protection is on for production and off for preview.
- **Decided by:** Proposed by Claude (agent); decided by Armin Baymani (human), 2026-09-23.

### DL-029: PINs are generated with the participant codes
- **Options:** Students choose their own PIN at the first session (DL-006); PINs are generated together with the codes and handed out by the teacher.
- **Decision:** Codes 1–64 are generated, each with a random 4-digit PIN, written to Firestore and exported to a CSV for the teacher to hand out. Students enter code, PIN and lesson on one screen. Three wrong PINs in a row block that code for 30 minutes. Supersedes DL-006.
- **Risks/consequences:** No student can pick a birthday as a PIN, and nobody can claim another student's code before its owner first logs in. Students must keep the slip they are given; a forgotten PIN means asking a researcher, who can read it. The CSV pairs every code with its PIN, so it is written to the git-ignored `private-data/` folder and must never be committed. The file is named after the database it was written to, so a preview list cannot be mistaken for the one handed to students.
- **Decided by:** Armin Baymani (human), 2026-09-23. Mockup reviewed and approved by Armin.

### DL-030: How a session is identified and resumed
- **Options:** A random session identifier found by searching for participant and lesson; an identifier built from the participant code and the lesson.
- **Decision:** A session document is named `<participant_code>_<lesson>`. Logging in again with the same code and lesson resumes that session, and a completed lesson cannot be reopened. The browser holds a random token in an httpOnly cookie for twelve hours, and only a hash of that token is stored. Logging in again replaces the token, so a previous cookie stops working. A new session starts in the state `awaiting_transcript`.
- **Risks/consequences:** Duplicate sessions for one lesson are impossible by construction, which is what the requirements ask for. Reading the database does not let anyone resume a student's session. A student is signed in on one device at a time; logging in elsewhere ends the earlier browser's access. `awaiting_transcript` extends the list of states named in the requirements.
- **Decided by:** Claude (agent), 2026-09-23. Behaviour reviewed and accepted by Armin Baymani (human) on a preview deployment.

### DL-031: The login form keeps its values in React state
- **Options:** Let the browser hold the form values; keep them in React state.
- **Decision:** The form keeps code, PIN and lesson in React state, and the chosen lesson is submitted from a hidden field bound to that state.
- **Risks/consequences:** React clears a form once its action returns. That emptied the fields after a wrong PIN, and later left the radio group looking selected while the form submitted no lesson at all, so students were told to choose a lesson they had already chosen. Forms built from S1 onwards need the same treatment, and browser tests should assert the value that is submitted rather than what is displayed.
- **Decided by:** Claude (agent), 2026-09-23, after Armin Baymani reported both faults from the preview.

### DL-032: Transcript replacement is atomic
- **Options:** Remove the existing transcript as soon as a student rejects it; keep it until a replacement has been retrieved and saved successfully.
- **Decision:** Keep the existing transcript until its replacement is safely stored. Each scrape has a random attempt ID, and only the newest attempt may update the session. Rejecting a preview returns the session to transcript submission, but does not delete the rejected record. A successful replacement clears any analysis, questions and responses derived from the earlier transcript.
- **Risks/consequences:** A rejected transcript remains in the incomplete research record until it is replaced. This preserves data during recoverable failures and prevents a slow older request from overwriting a newer link. Stored transcripts are limited to 850,000 UTF-8 JSON bytes so the complete session stays below Firestore's 1 MiB document limit.
- **Decided by:** Codex (agent), 2026-09-23. Implements the approved replacement and retry requirements; not yet separately reviewed by a human.

### DL-033: First-stage transcript redaction is local and deterministic
- **Options:** Store the scraped transcript unchanged; send it to an external model for redaction; apply deterministic redaction locally before storage.
- **Decision:** Before Firestore storage or preview, locally redact email addresses, Swedish personal identity numbers, Swedish-format phone numbers, `user@host` terminal identifiers, usernames in common home-directory paths, and names introduced with phrases such as “jag heter” or “my name is”. Query strings and fragments are removed from submitted share links before storage. No transcript content or link is written to diagnostic logs.
- **Risks/consequences:** Deterministic patterns are auditable and keep raw content away from another service, but they cannot reliably find every personal name or contextual identifier, especially in Swedish. This is a first implementation of DL-007 and must be revisited with representative transcripts before S0.
- **Decided by:** Codex (agent), 2026-09-23. Not yet reviewed by a human.

### DL-034: A TEST framework stands in until the real one is ready
- **Options:** Wait for the final coding framework before building the analysis; build it against a TEST copy.
- **Decision:** Build against a TEST framework: the codes, sequence patterns and behaviour groups copied verbatim from the working version of the "Framework for scaffolding" sheet (2026-09-29), with one placeholder question per behaviour group (replaced by the researchers' own texts in DL-040). Every JSON file is marked `TEST`. The guidelines are not part of it: the researchers write those.
- **Risks/consequences:** Results produced with it are only good for testing the pipeline. The analysis will store the framework version with every result, so TEST results can't be mistaken for research data, and production refuses to run on a TEST framework. Tests use a small fixture framework of their own, so replacing the files cannot break them.
- **Decided by:** Armin Baymani (human) asked for a TEST framework from the sheet on 2026-09-29; file format and placeholders by Claude (agent).

### DL-035: The analysis runs in two steps
- **Options:** One request that codes the transcript and writes the reflection questions; a coding request followed by a request for the observations and questions.
- **Decision:** Two steps. Step 1 codes every student prompt and sequence and is stored as soon as it passes validation. Step 2 continues the same conversation: the model chooses at most the configured number of observations (default 3) from the validated coding, using general guidelines rather than fixed rules, and adapts each behaviour group's question. The coding step sees only the coding guidelines (`analysis_guidelines.md`); guidance for choosing and adapting goes in the optional `reflection_guidelines.md`, which only step 2 gets, together with the groups' questions. What the requirements demand (the transcript is data, no forced codes, verbatim excerpts, no grading, Swedish) is written into the prompts in code, so it holds whatever the guidelines contain. The output format gave each student prompt one code, or none; DL-039 changed that. Each step opens identically for every student (output format, then framework), so after the first analysis OpenAI serves the framework from its prompt cache. Step 2 cannot reuse step 1's cache, because OpenAI caches the output format as part of the opening (measured 2026-09-29), so step 2's format must not vary between students either.
- **Risks/consequences:** The AI coding is research data that will be compared with human coding, so it is kept free of the question task, and retrying the questions never changes it. The student waits for a second, shorter request. Adapting the templates, which the architecture had under S3, happens in step 2 of S2, and only answering remains for S3; the architecture document was updated to say so on 2026-09-30, with Armin Baymani's approval.
- **Decided by:** Armin Baymani (human), 2026-09-29: the AI coding is research data, and the model picks observations from general guidelines. Design by Claude (agent), issue #14.

### DL-036: The analysis runs in the background and the page polls
- **Options:** Analyse inside the confirmation request; continue after the response with Next.js `after`; use OpenAI's background mode and poll OpenAI.
- **Decision:** The confirmation (or retry) starts an attempt with a random ID in the same transaction and returns at once. The analysis continues with `after`, within the session page's `maxDuration` of 300 seconds, and every write names its attempt, so a superseded attempt can't overwrite a newer one (as in DL-032). The page shows the status and refreshes every three seconds. A session still processing after six minutes is treated as interrupted and can be retried.
- **Risks/consequences:** Everything stays in our own code and database; OpenAI keeps no stored responses. An analysis that needs more than five minutes is cut off by Vercel and has to be retried; if that turns out to be common, OpenAI's background mode is the alternative.
- **Decided by:** Claude (agent), 2026-09-29, as proposed in issue #14; Armin Baymani (human) gave the go-ahead.

### DL-037: OpenAI settings for the analysis
- **Options:** Model gpt-6-astra, gpt-6-sol or gpt-6-luna; free text or structured output; keep responses at OpenAI or not.
- **Decision:** gpt-6-sol with medium reasoning by default, changeable with `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT`. Answers use strict Structured Outputs whose enums come from the framework, then pass our own validation; an invalid answer gets one automatic retry. Requests use `store: false` and one `prompt_cache_key` per step and framework version. Every result records the model, duration and token use.
- **Risks/consequences:** Sol costs $2 per million input tokens ($0.20 cached) and $10 per million output tokens (September 2026). A rough estimate is 10–25 cents per analysis, so tens of dollars for the roughly 120 analyses in the study; the stored token counts will show the real figure. First measurements on an eight-message synthetic chat (2026-09-29): 7–13 seconds per step, about 8,000–11,000 input tokens per step, of which about 7,800 came from the cache once one analysis had run. The choice of model and reasoning effort should be revisited once real transcripts can be measured. OpenAI processing is covered by the study's existing agreement; abuse-monitoring logs are kept for up to 30 days.
- **Decided by:** Claude (agent), 2026-09-29. Not yet reviewed by a human.

### DL-038: A fake analyser for local development and browser tests
- **Options:** Require an OpenAI key everywhere; stub OpenAI only in unit tests; a fake analyser behind the same interface.
- **Decision:** Without a key, `pnpm dev` uses a fake analyser that codes by keyword and picks varied examples; browser tests always use it (`CLARIFAI_FAKE_ANALYSIS=1`). Its results pass the same validation, are stored with analyser `fake`, and are labelled on the page. Production never uses it, whatever the settings.
- **Risks/consequences:** The whole flow can be tried and tested without a key or cost, but the fake says nothing about how well the real analysis codes. That needs real transcripts and an OpenAI key.
- **Decided by:** Claude (agent), 2026-09-29. Not yet reviewed by a human.

### DL-039: A prompt can have several codes, in priority order
- **Options:** Exactly one code per student prompt; every code that applies, ordered by priority.
- **Decision:** The model gives a prompt every code that clearly applies, each with its own excerpt and justification, listed with the most important first. The priority order comes from the analysis guidelines, which the researchers write. Where the guidelines give none, the code that describes the prompt best comes first. A prompt with too little context gets no codes and a note saying why.
- **Risks/consequences:** Every code of a prompt can be offered for reflection, but one prompt is shown in at most one example. Until the guidelines define a priority order, the order is the model's judgement, which matters when the coding is compared with human coders.
- **Decided by:** Armin Baymani (human), 2026-09-30.

### DL-040: The reflection texts are the researchers' own
- **Options:** One question per behaviour group, freely adapted by the model; the researchers' intro, questions and tip per group, with marked parts to fit.
- **Decision:** `behaviour_grouping.JSON` holds, for every group, the intro (Inledning, or Återkoppling for the F groups), one to three questions and a tip, copied from the researchers' document "Reflektionsfrågor" (2026-09-30). The model keeps their wording and only replaces the parts in square brackets with what the student did; it must return every question, and no brackets may remain. Tips and the general group's texts are shown as written. Group names, codes and descriptions stay as in the sheet: the document's R2 refers to a P10 that does not exist, so R2 keeps P9.
- **Risks/consequences:** Each example gets one free-text answer; its questions are suggestions and are always headed "Frågor för att sätta igång tankarna". Words outside the brackets change only when grammar requires it, and the originals are stored next to the fitted texts so the two can be compared. The document's new group R01 (a student who used no AI) is stored but unused: that needs a way to say so at hand-in, which does not exist (issue #16).
- **Decided by:** Armin Baymani (human), 2026-09-30, who supplied the document; format and open points by Claude (agent).

### DL-041: The framework is no longer marked TEST
- **Options:** Keep the status TEST until the guidelines are written; treat the framework as the study's own now.
- **Decision:** The three JSON files have the status `ACTIVE` and the version `2026-09-30`. Production analyses with them, and the reflection page no longer shows a test notice. The TEST status stays available for trying out a changed framework: production refuses it.
- **Risks/consequences:** The analysis guidelines in the repository are still a three-line stub, and the priority order between codes (DL-039) is not written yet. Until the researchers' guidelines are merged, an analysis relies on the rules built into the prompts and on the framework alone.
- **Decided by:** Armin Baymani (human), 2026-09-30.

### DL-042: Only redacted personal information may not be guessed
- **Options:** Forbid guessing what removed pictures and redacted text contained; forbid it only for redacted personal information.
- **Decision:** The rule built into the prompts now forbids guessing redacted personal information only. What a removed picture showed may be read from the messages around it, as the researchers' analysis guidelines say.
- **Risks/consequences:** The model may read more into a picture than the chat supports. Codes still need an excerpt from the transcript and a justification based on what it shows.
- **Decided by:** Armin Baymani (human), 2026-09-30.

### DL-043: The framework no longer marks S4 as high priority
- **Options:** Keep the sheet's note that S4 is high priority in the reflection; let the reflection guidelines alone say which patterns weigh more.
- **Decision:** The note was removed from `sequence_coding.JSON`, which now differs from the sheet on this point. The framework version is `2026-09-30.2`, so results made before and after the change can be told apart.
- **Risks/consequences:** The sheet still carries the note, so copying it again would bring it back. The version is kept by hand and has to be raised whenever the framework files change.
- **Decided by:** Armin Baymani (human), 2026-09-30; version by Claude (agent).

### DL-044: The researchers' first-draft guidelines are in the repository
- **Options:** Keep the three-line stub until the guidelines are final; commit the first draft now.
- **Decision:** `framework/analysis_guidelines.md` and the new `framework/reflection_guidelines.md` hold the researchers' first draft, converted word for word from the two tabs of their Google Doc on 2026-09-30. The coding step gets only the analysis guidelines; the reflection step also gets the reflection guidelines (DL-035). The analysis guidelines give the first priority rule between codes (DL-039): a passive code takes precedence when a prompt also has active or constructive elements.
- **Risks/consequences:** It is a draft and will change. The framework version (`2026-09-30.2`) is not raised automatically when a guideline file changes, so it has to be raised by hand for results to stay traceable to the guidelines that produced them. No order is defined yet between active and constructive codes, or for the NA codes.
- **Decided by:** Armin Baymani (human), 2026-09-30.

### DL-045: Every lesson accepts an explicit "no Gemini" submission
- **Options:** Offer the choice only in reflection lessons; offer it in every lesson; require a transcript in lessons 1 and 4.
- **Decision:** The transcript screen in all four lessons first asks whether the student used Gemini. If not, the session records `no_gemini` and stores no transcript or link. Lessons 1 and 4 complete immediately. Lessons 2 and 3 skip scraping and analysis and show the R01 intro, questions and tip exactly as written.
- **Risks/consequences:** Lessons 1 and 4 can now produce records without the transcript that those lessons normally collect. A no-Gemini choice supersedes any unconfirmed retrieval attempt so a delayed scrape cannot overwrite it. R01 depends on the framework containing exactly one `no_transcript` group.
- **Decided by:** Proposed by Codex (agent) in a mockup; approved by Armin Baymani (human), 2026-09-30.

### DL-046: Students respond to each concrete analysis with yes, partly or no
- **Options:** One agreement choice for the whole reflection; one per example; free text only; a choice plus a separate explanation field.
- **Decision:** Every concrete analysed example asks "Känner du igen dig i analysen?" with the required choices `yes`, `partly`, and `no`. The interface presents the analysis as a possible interpretation that can miss context. `partly` and `no` show a prompt to explain why in the example's existing free-text answer. They do not alter the researchers' questions or add another answer field. R0 and R01 omit the choice because they contain no concrete analysis. The choice is stored with the answer and reflection item.
- **Risks/consequences:** Completing an analysed reflection now requires one additional choice per example. The student's disagreement is research data, but does not change or overwrite the AI coding being compared with human coding.
- **Decided by:** Proposed by Codex (agent) in a mockup; approved with the conditional explanation prompt by Armin Baymani (human), 2026-09-30.

### DL-047: No-Gemini choices stay reversible until final submission
- **Options:** Complete lessons 1 and 4 immediately; reopen already completed sessions; add a reversible confirmation before completion and allow R01 to return to transcript submission.
- **Decision:** Lessons 1 and 4 enter `awaiting_no_gemini_confirmation` after a no-Gemini choice and complete only when the student chooses “Klar”. Lessons 2 and 3 can return from R01 before its response is submitted. Returning clears `no_gemini`, R01 questions and responses and restores transcript submission. Reflection tips move into the answer fields as placeholders; partly/no guidance appears directly after the agreement choice; and a submitted reflection gets its own positive receipt page.
- **Risks/consequences:** DL-045's “complete immediately” wording for lessons 1 and 4 is superseded. One more explicit action is required, but a mistaken no-Gemini choice no longer locks the lesson. Placeholder tips are no longer visible after typing begins, by design.
- **Decided by:** Proposed by Codex (agent) in reviewed mockups; approved by Armin Baymani (human), 2026-09-30.

### DL-048: A "no Gemini" choice also removes the link from a failed attempt
- **Options:** Keep the submitted link and its error code as the researchers' fallback when "no Gemini" follows a failed retrieval; remove them, as for any other "no Gemini" choice.
- **Decision:** They are removed. The student's statement that there is no transcript is taken at face value, so nothing from an earlier attempt in that session is kept: not the link, not its error code.
- **Risks/consequences:** A record cannot tell a student who used no Gemini from one who gave up on a link that failed. If retrieval breaks for many students at once, their links are not there to fall back on.
- **Decided by:** Armin Baymani (human), 2026-09-30, when a review of DL-045 raised it.

### DL-049: Unsent reflection answers are kept in the browser tab
- **Options:** Leave the answers only in the page, where a reload empties them; have the browser warn before the page is left; also keep a copy in the tab and fill it in again; save drafts on the server.
- **Decision:** Both the warning and the copy. While an answer has text, the browser asks before a reload, a closed tab or a move to another site. Answers and Ja/Delvis/Nej choices are also written to the tab's `sessionStorage` on every change, and filled in again when the same questions are shown in that tab. The copy is removed once the reflection is handed in, and disappears with the tab. Drafts are not saved on the server, because that would store text the student never handed in.
- **Risks/consequences:** The copy is what the student typed, before redaction. It stays in that tab until hand-in or until the tab is closed, also after logging out, but it is only filled in again for the same participant, lesson and set of questions. A closed tab, a crash or another computer still loses unsent text. The browser words the warning itself; handing in and logging out do not trigger it.
- **Decided by:** Armin Baymani (human), 2026-09-30; design by Claude (agent).

### DL-050: The browser tests run one at a time
- **Options:** Give each browser its own participant codes; run Firefox after Chromium; run every browser test one at a time.
- **Decision:** One at a time (`workers: 1` in `playwright.config.ts`). Chromium and Firefox run the same tests with the same participant codes against one emulator, and each test starts by deleting its participant's sessions. Run together, one browser removed the session the other was using: two or three of the 34 tests failed on every local run, while CI passed thanks to different timing and its retries.
- **Risks/consequences:** A run takes about half a minute longer. The browsers still share participant codes, so the tests have to keep running one after the other unless each browser gets codes of its own.
- **Decided by:** Proposed by Claude (agent); approved by Armin Baymani (human), 2026-09-30.

### DL-051: A C code needs the student's own reasoning, and a missing part gets no code
- **Options:** Ask the model for a confidence score and drop low ones; put a threshold rule in our own prompt code; put it in the analysis guidelines that human coders use too; add an A code for a student who points out a missing part.
- **Decision:** A section "Threshold for constructive codes" in `framework/analysis_guidelines.md`. A C code needs the student's own reasoning in the prompt itself. Facts about the student's own situation are not constructive, even when they contradict Gemini, and Gemini's reaction (for example an apology) does not show that the student reasoned. A prompt that only states such a fact, like a part missing from the kit, gets no code. A prompt that passes the test still gets every code that clearly applies. The framework version is raised to `2026-10-01`.
- **Risks/consequences:** In a test chat, "jag har ingen 4x4 keypad i kitet som jag har" was coded C7 in 3 of 3 runs, apparently because Gemini apologised. With the rule it got no code in 3 of 3 runs, while two genuine critiques in another test chat stayed C7 in 3 of 3. Those critiques got a second C code less often than before (2 of 6 against 6 of 6). The rule raises the bar for every C code, so other borderline prompts may be coded differently too.
- **Decided by:** Armin Baymani (human), 2026-10-01; wording proposed and tested by Claude (agent).

### DL-052: Scalar Gemini prompt metadata is not unsupported content
- **Options:** Treat every non-empty undocumented prompt field as unsupported content; special-case the observed field; distinguish scalar metadata from values that can carry content.
- **Decision:** The share parser treats strings, objects and non-empty arrays in Gemini's candidate content fields as content it cannot yet convert. Boolean and numeric values are treated as metadata and do not add an `[UNSUPPORTED CONTENT]` marker. Parser version 2 records the changed interpretation. A regression fixture includes the observed boolean field on every ordinary text prompt.
- **Risks/consequences:** Gemini's endpoint remains undocumented. A future attachment encoded only as a number or boolean would not be marked, but treating ordinary metadata flags as content pollutes every downstream analysis. Structured attachment data continues to produce a visible marker and warning.
- **Decided by:** Armin Baymani (human) requested that the confirmed false positive be prevented in future analyses; implementation by Codex (agent), 2026-10-01.
