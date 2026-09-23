# ClarifAI
AI tool used to scaffold students' reflection on their own AI use.

- Product: [docs/00_product_brief.md](docs/00_product_brief.md)
- Architecture and session lifecycle: [docs/01_architecture.md](docs/01_architecture.md)
- Requirements: [docs/02_functional_requirements.md](docs/02_functional_requirements.md)
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
pnpm exec playwright install chromium     # browser for the end-to-end tests
pnpm dev                                  # app on :3000, Firestore emulator UI on :4000
```

```powershell
pnpm.cmd install
pnpm.cmd exec playwright install chromium
pnpm.cmd dev
```

`pnpm dev` runs the app against a local Firestore emulator, so local work never touches the research database. Emulator data is discarded when it stops.

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` | App plus Firestore emulator and emulator UI |
| `pnpm check` | Everything below except the build and end-to-end tests; run before opening a PR |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm format` / `pnpm format:check` | Prettier (code only; Markdown docs keep their authors' formatting) |
| `pnpm test` | Unit tests (Vitest, next to the code as `*.test.ts(x)`) |
| `pnpm test:emulator` | Firestore security-rule and Admin SDK tests (`tests/emulator/`) |
| `pnpm test:e2e` | Playwright end-to-end tests (`tests/e2e/`) |
| `pnpm scrape <link>` | Scrape a Gemini share link into `private-data/transcripts/` (local stand-in for S1) |
| `pnpm codes:generate [count]` | Create participant codes with PINs and write the hand-out list to `private-data/` |
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

The list lands in `private-data/participant-codes.csv`, which is git-ignored. It pairs every code with its PIN, so treat it like a password list: hand it out on paper and keep it off shared drives.

## Environment variables
Copy `.env.example` to `.env.local` and fill in values there. **Never commit real values.** Every `.env*` file except `.env.example` is git-ignored, and a gitleaks pre-commit hook blocks commits that contain secrets. The Firebase service-account values are only needed on Vercel; locally the emulator is used.

## Data safety
- Browsers never talk to Firestore. The security rules deny all client access, and every read and write goes through route handlers that use the Admin SDK (`src/lib/firebase/admin.ts`).
- Never put real student data (transcripts, exports) in the repository. Use the git-ignored `private-data/` folder if you need it locally.

## Deployment (Vercel)
- Build settings are Vercel's Next.js defaults. Don't override the Install Command: an overridden `pnpm install` runs with the oldest pnpm Vercel has.
- `ENABLE_EXPERIMENTAL_COREPACK=1` is set in the Vercel project. Vercel only detects pnpm up to version 10 on its own; with this set, it uses the pnpm version from `package.json`.
- Functions run in Stockholm (`arn1`, under Settings → Functions), next to Firestore in `europe-north2`. Keep both in the EU (DL-026).
- The variables from `.env.example` are set in Vercel, per environment: Production uses the Firebase project `clarifai-19445`, Preview uses `clarifai-preview`, so preview deployments cannot reach the research data (DL-028).
- Firebase projects: `clarifai-19445` (production) and `clarifai-preview` (previews). After changing `firestore.rules`, deploy to both: `pnpm exec firebase login`, then `pnpm exec firebase deploy --only firestore:rules --project clarifai-19445` and the same with `--project clarifai-preview`.
  On Windows PowerShell, use `pnpm.cmd` for these commands if the shorter command is unavailable.

## Workflow
- Work on a branch per feature and claim the matching GitHub issue. Unclaimed issues are up for grabs, and anyone, human or agent, may open new ones.
- Run `pnpm check` before asking for a merge. Humans merge into `main` manually once an agent says the work is ready.
- Record important decisions in the [decision log](docs/03_decision_log.md).
