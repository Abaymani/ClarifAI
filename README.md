# ClarifAI
AI tool used to scaffold students' reflection on their own AI use.

- Product: [docs/00_product_brief.md](docs/00_product_brief.md)
- Architecture and session lifecycle: [docs/01_architecture.md](docs/01_architecture.md)
- Requirements: [docs/02_functional_requirements.md](docs/02_functional_requirements.md)
- Admin interface requirements: [docs/04_admin_interface_requirements.md](docs/04_admin_interface_requirements.md)
- Decisions: [docs/03_decision_log.md](docs/03_decision_log.md)
- Rules for coding agents: [AGENTS.md](AGENTS.md)

## Stack
Next.js 16 (App Router, TypeScript) with Tailwind CSS and shadcn/ui, Cloud Firestore through the Firebase Admin SDK, OpenAI for analysis, hosted on Vercel. The user interface is in Swedish.

## Getting started
Prerequisites:
- Node.js 24 (see `.nvmrc`)
- pnpm 11.26.0 (pinned in `package.json`)
- Java 21, for the Firestore emulator
- gitleaks, which the pre-commit hook needs
- GitHub CLI (`gh`), for the issue workflow

### Linux (Arch)

```bash
sudo pacman -S --needed nodejs-lts-krypton npm pnpm jdk21-openjdk github-cli gitleaks
```

### Windows

Run these commands in PowerShell. The first four use official WinGet packages:

```powershell
winget install --exact --id OpenJS.NodeJS.LTS
winget install --exact --id EclipseAdoptium.Temurin.21.JDK
winget install --exact --id GitHub.cli
winget install --exact --id Gitleaks.Gitleaks
npm.cmd install --global pnpm@11.26.0
```

Restart the terminal after installing the prerequisites. Verify the versions before continuing:

```powershell
node --version       # v24.x
pnpm.cmd --version   # 11.26.0
java -version        # 21.x
gitleaks version
gh --version
```

PowerShell may prefer the generated `pnpm.ps1` file when script execution is restricted. `pnpm.cmd` is the same pnpm installation and does not require changing the execution policy. A machine-wide installation can expose the shorter `pnpm` command, but the documented Windows commands use `pnpm.cmd` so they work with the default restrictive policy.

### Install and run

On Linux, use `pnpm`. On Windows PowerShell, use `pnpm.cmd` if `pnpm` is blocked by the execution policy:

```bash
pnpm install                              # also activates the git hooks
pnpm exec playwright install chromium firefox # browsers for the end-to-end tests
pnpm dev                                  # app on :3000, Firestore emulator UI on :4000
```

```powershell
pnpm.cmd install
pnpm.cmd exec playwright install chromium firefox
pnpm.cmd dev
```

`pnpm dev` runs the app against local Firestore and Authentication emulators, so local work never touches the research database or real researcher accounts. Emulator data is discarded when it stops.

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` | App plus Firestore emulator and emulator UI |
| `pnpm check` | Everything below except the build and end-to-end tests; run before opening a PR |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm format` / `pnpm format:check` | Prettier (code only; Markdown docs keep their authors' formatting) |
| `pnpm test` | Unit tests (Vitest, next to the code as `*.test.ts(x)`) |
| `pnpm test:emulator` | Firestore security-rule and Admin SDK tests (`tests/emulator/`) |
| `pnpm test:e2e` | Playwright end-to-end tests (`tests/e2e/`), in Chromium and Firefox, one test at a time (DL-050) |
| `pnpm scrape <link>` | Scrape a Gemini share link into `private-data/transcripts/` (local stand-in for S1) |
| `pnpm codes:generate [count]` | Create participant codes with PINs and write the hand-out list to `private-data/` (named after the target database) |
| `pnpm build` | Production build |

## Participant codes
Codes and their PINs are generated together and handed out by the teacher (DL-029). Re-running the generator keeps the PINs of codes that already exist, so slips already handed out stay valid.

Against the local emulator:

```bash
pnpm exec firebase emulators:exec --only firestore --project demo-clarifai "pnpm codes:generate 5"
```

To try the login while `pnpm dev` is running, seed that emulator from a second terminal:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm codes:generate 5
```

The emulator forgets everything when it stops, so this is repeated per session.

Against the real project, put the Firebase service-account values in `.env.local` first, then:

```bash
pnpm codes:generate
```

The list lands in `private-data/participant-codes-<project>.csv`, which is git-ignored. The file is named after the database it was written to, so a preview list is never mistaken for the real one. It pairs every code with its PIN, so treat it like a password list: hand it out on paper and keep it off shared drives.

### If a student is locked out
Three wrong PINs block that code for 30 minutes, and a correct PIN is refused until the block expires. To let a student in sooner, open their document under `participants` in the Firebase console and set `lockedUntil` to null and `failedAttempts` to 0. Clearing only `lockedUntil` blocks them again on the next wrong attempt.

The same document holds the student's `pin`, which is what to read out when someone forgets theirs.

## Analysis framework
`framework/` holds what the analysis (S2) gives the model. The files are read on every analysis, so edits apply without a restart.

| File | What it holds |
|---|---|
| `prompt_coding.JSON` | The ICAP categories and the prompt codes |
| `sequence_coding.JSON` | The sequence patterns |
| `behaviour_grouping.JSON` | The behaviour groups, each with an intro (feedback, for the F groups), its questions and a tip for the answer |
| `analysis_guidelines.md` | The researchers' guidelines for coding. Required. |
| `reflection_guidelines.md` | Optional: the researchers' guidelines for choosing examples and adapting the questions. Only the second step sees this file, so put that guidance here rather than in the coding guidelines (DL-035). |

What the requirements demand is built into the prompts themselves (`src/lib/analysis/prompts.ts`) and holds whatever the guidelines say: the transcript is data and never instructions, no code is forced, every excerpt is quoted word for word, nothing is graded, and students are addressed in Swedish. A student prompt can get several codes, listed in the priority order the guidelines define, or none when there is too little context (DL-039) or when it only states a fact about the student's own situation, such as a part missing from the kit (DL-051).

**The three JSON files are the study's framework (DL-041).** The codes, patterns and groups were copied from the working version of the "Framework for scaffolding" Google Sheet on 2026-09-29, and the intros, questions and tips from the researchers' document "Reflektionsfrågor" on 2026-09-30 (DL-040). Code A6, its group F11 and the wider notes for C10 were added on 2026-10-01 (DL-055). Later that day came NA8 and the rule that prompts outside the learning outcomes only get NA codes (DL-056). To try out a changed framework without risk, set `"status": "TEST"` in all three files: production then refuses to analyse with it, and the reflection page says it is a test. The files are checked every time they are loaded, and by `pnpm test`: they share one status and version, every behaviour code is in exactly one group, every group a student can get has an intro and questions, and texts that are shown as written contain no brackets.

Parts of an intro or question in `[square brackets]` are fitted to each student by the model, for example `[hitta felet / säga vad du skulle ändra]`. The model replaces only those parts; words outside the brackets stay as written unless grammar requires a change. Tips appear as placeholders in the free-text fields and disappear visually as soon as the student starts writing. The texts of the general group (R0) reach the student exactly as written. Group R01 is used when a lesson 2 or 3 student states that they did not use Gemini; its texts also reach the student exactly as written.

## Transcript analysis (S2)
For lessons 2 and 3, confirming the transcript starts the analysis (DL-035, DL-036). The confirm button returns at once, the analysis keeps running on the server, and the page shows "Vi analyserar din chatt" and checks back every few seconds. A student who closes the tab finds the result when logging in again.

Transcript messages are shown with a safe subset of Markdown for readability. Headings stay compact inside a message, lists, quotes, code and tables are formatted, links are displayed without becoming clickable, and removed images appear as a small “Bild borttagen” label. Raw HTML and original images are never rendered. Student messages align to the right and remain fully visible; Gemini messages align to the left and long responses can be expanded from a compact preview. The same pattern is used in confirmation and reflection, where excerpts have a labelled chat frame. The stored transcript and analysis input remain unchanged (DL-053, DL-054, DL-057).

1. **Coding.** The model gets the coding guidelines and framework, then the transcript, and codes every student prompt and sequence. Our code checks the result before storing it as research data: every code exists in the framework, every cited message exists, and every excerpt is really in its message. An invalid result gets one more try, then counts as a failure.
2. **Reflection.** The model sees the coding conversation so far, chooses at most three observations (`REFLECTION_MAX_QUESTIONS`) from the checked coding, never two from the same prompt, and fits each group's intro and questions to what the student did. This is checked too: every question is there and no brackets are left. Both the fitted texts and the originals are stored, so they can be compared. If nothing is suitable, the student gets the general questions (group R0) as written, recorded as insufficient evidence rather than a failure.

Each step opens the same way for every student, so after the first analysis OpenAI reads the framework (about 7,800 tokens) from its prompt cache at a tenth of the price. The output format is part of that opening, so each step has its own cache. On the synthetic test chat, each step took 7–13 seconds.

Both results are stored with the framework version, analyser, model, duration and token use, so waiting times and costs can be measured. A failure stores an error code (`S2-…`) and shows the student a retry button; a retry after step 1 only redoes step 2. An analysis that has not reported back after six minutes (Vercel stops it after five) is shown as interrupted and can be retried too. Each example gets one free-text answer; its questions are suggestions, shown under "Frågor för att sätta igång tankarna".

**Without an OpenAI key**, `pnpm dev` uses a fake analyser that codes by keyword, so the whole flow can be tried locally (DL-038). Its results say "Testanalys utan AI" on the page and are stored with analyser `fake`. The browser tests always use it. Deployed builds never do: without a key they fail with `S2-CONFIG`.

**With a key**, put `OPENAI_API_KEY` in `.env.local` and restart `pnpm dev`. The model defaults to `gpt-6-sol` with medium reasoning; `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` change that (DL-037).

## Student reflection (S3)
For every concrete analysed example, the student chooses **Ja**, **Delvis**, or **Nej** to say whether they recognise themselves in the analysis. The page explains that the analysis is only a possible interpretation and can miss work outside Gemini. **Delvis** and **Nej** add a prompt to explain why in the same free-text response. R0 and R01 have no concrete analysis, so they ask only for the free-text response.

Students can state on the transcript screen that they did not use Gemini. Lessons 1 and 4 then record `no_gemini` and show a reversible confirmation before completion. Lessons 2 and 3 skip scraping and analysis, show R01, and complete after its answer is saved. Before completion, both paths let the student return to transcript submission; doing so clears the no-Gemini choice and any generated R01 questions. Reflection answers are redacted before storage and saved atomically with their agreement choices, then followed by a dedicated completion page.

Until the reflection is handed in, what the student has written is kept in that browser tab (`sessionStorage`), so a reload brings it back, and the browser asks before a page with unsent text is left (DL-049). The copy never leaves the computer; it is removed at hand-in and disappears when the tab closes.

## Researcher portal

The researcher portal is intentionally absent from the participant interface. Researchers open `/admin` directly and sign in with Google. Only the two verified addresses configured as `ADMIN_RESEARCHER_1_EMAIL` and `ADMIN_RESEARCHER_2_EMAIL` are accepted; they are stored in Vercel and `.env.local`, never in Git. Their work is stored under the stable identifiers `R1` and `R2`, while the interface consistently displays those researchers as Armin and Frida. Email addresses are not copied into research records (DL-059, DL-060).

Enable Google as a sign-in provider under Firebase Authentication and put the Firebase project's Web API key in `FIREBASE_WEB_API_KEY`. The portal exchanges the Google/Firebase ID token for an eight-hour secure server cookie and verifies the exact allowlist on every admin read and write. Firestore remains inaccessible from browsers.

For local development, `pnpm dev` starts the Firebase Authentication emulator. Put two non-real test addresses in the admin email variables in `.env.local`, visit `/admin`, and use the emulator's mock Google sign-in screen. Production and Preview need their own Firebase Authentication configuration, matching their separate Firebase projects.

`firebase-admin` currently needs the repository patch for `jwks-rsa` recorded in DL-062 so its authentication module can load in Vercel's CommonJS server runtime while continuing to use supported `jose` 6. `pnpm test:firebase-admin-runtime` guards the exact failure. Remove the patch when the upstream lazy-import fix ships in a released `jwks-rsa` version.

The overview defaults to session status and has a separate researcher-coding matrix that shows Armin's and Frida's coding coverage for every transcript. A view-only filter can hide participants with no session in any of the four lessons; it never changes stored data. A session detail view exposes the already stored transcript and AI coding, including expandable stored justifications and excerpts, and keeps each researcher's manual notes and coding separate. Its `Reflektion` tab shows all stored reflection moments, answers and agreement choices together with the same AI, Armin and Frida code badges. Both researchers' comments are visible for each moment, while only the signed-in researcher's own comment is editable. The portal never calls an AI API, regenerates analysis or consumes model tokens, and never changes student or AI records; its only writes are researcher-authored coding and comments (DL-063).

## Environment variables
Copy `.env.example` to `.env.local` and fill in values there. **Never commit real values.** Every `.env*` file except `.env.example` is git-ignored, and a gitleaks pre-commit hook blocks commits that contain secrets. The Firebase service-account values are only needed on Vercel; locally the emulator is used.

## Data safety
- Browsers never talk to Firestore. The security rules deny all client access, and every read and write goes through server code (Next.js Server Actions) that uses the Admin SDK (`src/lib/firebase/admin.ts`).
- Gemini links are allow-listed and resolved only through supported Gemini hosts. Transcript text is redacted locally before it is saved or shown in the confirmation preview; raw transcript content and submitted links are never written to application logs.
- The analysis sends the redacted transcript to OpenAI with `store: false`, so OpenAI keeps only its standard abuse-monitoring logs (up to 30 days, never used for training). Analysis errors are logged as codes and message numbers only.
- Never put real student data (transcripts, exports) in the repository. Use the git-ignored `private-data/` folder if you need it locally.

## Deployment (Vercel)
- Build settings are Vercel's Next.js defaults. Don't override the Install Command: an overridden `pnpm install` runs with the oldest pnpm Vercel has.
- `ENABLE_EXPERIMENTAL_COREPACK=1` is set in the Vercel project. Vercel only detects pnpm up to version 10 on its own; with this set, it uses the pnpm version from `package.json`.
- Functions run in Stockholm (`arn1`, under Settings → Functions), next to Firestore in `europe-north2`. Keep both in the EU (DL-026).
- The variables from `.env.example` are set in Vercel, per environment: Production uses the Firebase project `clarifai-19445`, Preview uses `clarifai-preview`, so preview deployments cannot reach the research data (DL-028).
- `OPENAI_API_KEY` must be set in Vercel for Preview and Production before the analysis can run there. The session page allows 300 seconds per request (the Hobby maximum), which is what the analysis gets to finish in.
- Firebase projects: `clarifai-19445` (production) and `clarifai-preview` (previews). After changing `firestore.rules`, deploy to both: `pnpm exec firebase login`, then `pnpm exec firebase deploy --only firestore:rules --project clarifai-19445` and the same with `--project clarifai-preview`.
  On Windows PowerShell, use `pnpm.cmd` for these commands if the shorter command is unavailable.

## Workflow
- Work on a branch per feature and claim the matching GitHub issue. Unclaimed issues are up for grabs, and anyone, human or agent, may open new ones.
- Run `pnpm check` before asking for a merge. Humans merge into `main` manually once an agent says the work is ready.
- Record important decisions in the [decision log](docs/03_decision_log.md).
