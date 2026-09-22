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
- pnpm 11
- Java 21, for the Firestore emulator
- gitleaks, which the pre-commit hook needs
- GitHub CLI (`gh`), for the issue workflow

On Arch Linux:

```bash
sudo pacman -S --needed nodejs-lts-krypton npm pnpm jdk21-openjdk github-cli gitleaks
```

Then:

```bash
pnpm install                              # also activates the git hooks
pnpm exec playwright install chromium     # browser for the end-to-end tests
pnpm dev                                  # app on :3000, Firestore emulator UI on :4000
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
| `pnpm build` | Production build |

## Environment variables
Copy `.env.example` to `.env.local` and fill in values there. **Never commit real values.** Every `.env*` file except `.env.example` is git-ignored, and a gitleaks pre-commit hook blocks commits that contain secrets. The Firebase service-account values are only needed on Vercel; locally the emulator is used.

## Data safety
- Browsers never talk to Firestore. The security rules deny all client access, and every read and write goes through route handlers that use the Admin SDK (`src/lib/firebase/admin.ts`).
- Never put real student data (transcripts, exports) in the repository. Use the git-ignored `private-data/` folder if you need it locally.

## Deployment (Vercel)
- In the Vercel project settings, set `ENABLE_EXPERIMENTAL_COREPACK=1`. Vercel only detects pnpm up to version 10 on its own; with this set, it uses the pnpm version from `package.json`.
- Add the variables from `.env.example` as Vercel environment variables.
- Once the real Firebase project exists, deploy the Firestore rules: `pnpm exec firebase login`, then `pnpm exec firebase deploy --only firestore:rules --project <project-id>`.

## Workflow
- Work on a branch per feature and claim the matching GitHub issue. Unclaimed issues are up for grabs, and anyone, human or agent, may open new ones.
- Run `pnpm check` before asking for a merge. Humans merge into `main` manually once an agent says the work is ready.
- Record important decisions in the [decision log](docs/03_decision_log.md).
