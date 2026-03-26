# Actual Implementation: Council of Models MCP Server

This document describes what is built, how it works, and where to find everything. It is intended to be read by an LLM that needs to understand, modify, or extend this project.

**Built**: March 26, 2026
**Last updated**: March 26, 2026 (v3 — workflow layer + npm publish)
**Built by**: Claude Opus 4.6 executing `agentic_implementation_guide_v2.md` (initial build) then `agentic_guide_implementation.md` (v3 workflow layer)
**Repo**: https://github.com/russellmoss/Council_of_models_mcp
**Branch**: `master`
**npm package**: `council-of-models-mcp@1.0.0` — https://www.npmjs.com/package/council-of-models-mcp
**Runtime**: Node.js v24.14.0, TypeScript 6.0.2, npm 11.9.0
**Platform**: Windows 11 (paths use Windows-native format in config, bash in Claude Code shell)

---

## What This Project Does

An MCP (Model Context Protocol) server that runs locally over stdio and exposes three tools to Claude Code:

| Tool | What it does |
|---|---|
| `ask_openai` | Sends a prompt to OpenAI's Responses API, returns the response |
| `ask_gemini` | Sends a prompt to Google Gemini with thinking enabled, returns the response |
| `ask_all` | Sends the same prompt to both providers in parallel, returns both responses |

Once registered with `claude mcp add --scope user`, these tools are available in every Claude Code session across all projects.

The project also ships **example Claude Code slash command templates** (`/council`, `/refine`, `/setup-council`) that users copy into their projects to orchestrate cross-LLM validation workflows.

---

## File Structure

```
Council_of_models_mcp/
├── examples/
│   └── claude-commands/
│       ├── council.md             # Generic /council — works for any project
│       ├── refine.md              # Generic /refine — works with council.md
│       └── setup-council.md       # Interactive wizard for tailored commands
├── src/
│   ├── index.ts                   # MCP server entry point, tool registrations (has shebang)
│   ├── config.ts                  # Model defaults, resolveModel(), shouldFallback()
│   ├── smoke.ts                   # Standalone smoke test script
│   └── providers/
│       ├── index.ts               # Re-exports askOpenAI, askGemini, ProviderResponse
│       ├── types.ts               # ProviderResponse interface
│       ├── openai.ts              # OpenAI client (Responses API)
│       └── gemini.ts              # Gemini client (@google/genai SDK, dual API key support)
├── dist/                          # Compiled JS output (gitignored)
├── .env                           # Local API keys (gitignored)
├── .env.example                   # Placeholder keys — mentions both GEMINI_API_KEY and GOOGLE_API_KEY
├── .gitignore
├── package.json                   # Published to npm as council-of-models-mcp@1.0.0
├── tsconfig.json
├── README.md                      # npm install primary, workflow layer docs
├── QUICKSTART.md                  # npm install primary, Step 6 for workflow setup
├── actual_implementation.md       # This file
└── agentic_guide_implementation.md # v3 implementation guide
```

---

## Key Dependencies (from package.json)

```json
{
  "dependencies": {
    "@google/genai": "^1.46.0",
    "@modelcontextprotocol/sdk": "^1.25.2",
    "dotenv": "^17.3.1",
    "openai": "^6.33.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "rimraf": "^6.1.3",
    "typescript": "^6.0.2"
  }
}
```

The project uses `"type": "module"` in package.json and all imports use `.js` extensions (TypeScript Node16 module resolution).

---

## npm Package Details

```json
{
  "name": "council-of-models-mcp",
  "version": "1.0.0",
  "bin": { "council-mcp": "dist/index.js" },
  "files": ["dist/", "examples/", ".env.example", "README.md", "QUICKSTART.md"],
  "engines": { "node": ">=18.0.0" }
}
```

- **Package name**: `council-of-models-mcp`
- **Binary/executable name**: `council-mcp` (this is what users type after `npm install -g`)
- **Published files**: `dist/`, `examples/`, `.env.example`, `README.md`, `QUICKSTART.md`, `package.json` (35 files total, ~22 kB packed)
- **NOT published**: `src/` (TypeScript source), `.env` (secrets), `node_modules/`, `actual_implementation.md`, `agentic_guide_implementation.md`
- **`prepublishOnly`**: runs `npm run rebuild` to ensure clean compile before every publish
- The shebang `#!/usr/bin/env node` is present in `src/index.ts` and survives `tsc` compilation into `dist/index.js`

### Install paths

**npm (recommended):**
```bash
npm install -g council-of-models-mcp
claude mcp add --scope user council-mcp -- council-mcp
```

**Clone:**
```bash
git clone https://github.com/russellmoss/Council_of_models_mcp.git
cd Council_of_models_mcp && npm install && npm run build
claude mcp add --scope user council-mcp -- node "$(pwd)/dist/index.js"
```

---

## How Each File Works

### `src/config.ts` — Model Configuration

Central config file. This is the only file that needs editing when models change.

**Interfaces:**

```typescript
export interface ModelConfig {
  id: string;        // Model ID sent to the API (e.g. "gpt-5.4")
  name: string;      // Human-readable name for responses
  description: string;
}

export interface ProviderConfig {
  default: ModelConfig;      // Used when no model specified
  fallback: ModelConfig;     // Used on transient errors
  available: ModelConfig[];  // All models the user can request
  apiKeyEnvVar: string;      // Env var name (e.g. "OPENAI_API_KEY")
}
```

**Current defaults:**

| Provider | Default | Fallback |
|---|---|---|
| OpenAI | `gpt-5.4` | `gpt-5.4-mini` |
| Gemini | `gemini-3.1-pro-preview` | `gemini-3-flash-preview` |

**`resolveModel(config, requestedModel?)`** — Returns the matching `ModelConfig` from the `available` list (by ID or case-insensitive name). If the requested model isn't in the list, it passes through as a custom model (the provider API validates it).

**`shouldFallback(error)`** — Returns `true` only for transient/availability errors. Returns `false` (no fallback) for auth errors, invalid model, bad request, permission, or quota errors. Uses this regex:

```typescript
const noFallbackPatterns =
  /api.?key|unauthorized|authentication|forbidden|invalid.*model|bad.?request|permission|quota/i;
return !noFallbackPatterns.test(message);
```

### `src/providers/types.ts` — Shared Response Type

```typescript
export interface ProviderResponse {
  text: string;          // The model's response text
  model: string;         // Model ID actually used
  provider: string;      // "openai" or "gemini"
  usedFallback: boolean; // true if fallback model was used
  error?: string;        // Error message (may coexist with text if fallback succeeded)
}
```

### `src/providers/openai.ts` — OpenAI Client

Uses the **Responses API** (`openai.responses.create`), not the legacy Chat Completions API.

```typescript
const response = await openai.responses.create({
  model: model.id,
  ...(systemPrompt ? { instructions: systemPrompt } : {}),
  input: prompt,
  ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
});

const text = response.output_text;
```

Key details:
- System prompts go in the `instructions` field (Responses API pattern)
- `reasoning.effort` is an optional parameter (`"low"`, `"medium"`, `"high"`) for latency/quality tuning
- Lazy-initializes the client singleton on first call
- Throws immediately if `OPENAI_API_KEY` env var is missing
- On transient errors: falls back to `gpt-5.4-mini` (unless already using the fallback model)
- On auth/config errors: returns the error directly, no fallback

### `src/providers/gemini.ts` — Gemini Client

Uses `@google/genai` SDK with native `systemInstruction` and `ThinkingLevel` enum.

**Dual API key support** (added in v3): The client checks both `GEMINI_API_KEY` and `GOOGLE_API_KEY`, preferring `GEMINI_API_KEY` if both are set:

```typescript
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey =
      process.env[GEMINI_CONFIG.apiKeyEnvVar] ||
      process.env["GOOGLE_API_KEY"];
    if (!apiKey) {
      throw new Error(
        `Missing Gemini API key. Set either ${GEMINI_CONFIG.apiKeyEnvVar} or GOOGLE_API_KEY ` +
          `in your shell profile (~/.bashrc or ~/.zshrc) or in a .env file.`
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
```

**Thinking config:**

```typescript
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const response = await genai.models.generateContent({
  model: model.id,
  contents: prompt,
  config: {
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.HIGH,  // NOT the string "high"
    },
  },
});

const text = response.text;
```

The available `ThinkingLevel` enum values are:
```
THINKING_LEVEL_UNSPECIFIED, LOW, MEDIUM, HIGH, MINIMAL
```

Fallback behavior mirrors OpenAI: transient-only, gated by `shouldFallback()`.

### `src/index.ts` — MCP Server Entry Point

**Line 1:** `#!/usr/bin/env node` — shebang for npm global install binary.

**Critical:** `import "dotenv/config"` is the very first import, before any provider code, so `.env` variables are available when clients initialize. Note: for global npm installs, `dotenv` looks for `.env` in `process.cwd()` (the user's project directory), so npm users should export keys in their shell profile instead.

**Critical:** No `console.log` anywhere — `stdout` is reserved for MCP JSON-RPC. All diagnostics use `console.error` (writes to `stderr`).

Registers three tools with the MCP SDK:

```typescript
const server = new McpServer({
  name: "council-of-models",
  version: "1.0.0",
});
```

**Tool registration signature** (SDK v1.25.2 supports annotations):

```typescript
server.tool(
  "ask_openai",           // tool name
  `description...`,       // tool description (dynamic, includes model list)
  { /* zod schema */ },   // parameter schema
  {                       // MCP tool annotations
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async (params) => { /* handler */ }
);
```

All three tools include annotations (`readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: true`).

**Tool parameters:**

| Tool | Parameters |
|---|---|
| `ask_openai` | `prompt` (required), `system_prompt`, `model`, `reasoning_effort` |
| `ask_gemini` | `prompt` (required), `system_prompt`, `model` |
| `ask_all` | `prompt` (required), `system_prompt`, `openai_model`, `gemini_model`, `openai_reasoning_effort` |

**`ask_all` dual-failure detection:**

```typescript
const [openaiResult, geminiResult] = await Promise.allSettled([
  askOpenAI(prompt, system_prompt, openai_model, openai_reasoning_effort),
  askGemini(prompt, system_prompt, gemini_model),
]);

const openaiFailed =
  openaiResult.status === "rejected" ||
  (openaiResult.status === "fulfilled" && !!openaiResult.value.error && !openaiResult.value.text);

const geminiFailed =
  geminiResult.status === "rejected" ||
  (geminiResult.status === "fulfilled" && !!geminiResult.value.error && !geminiResult.value.text);

// If BOTH failed, return { isError: true }
// If only one failed, still return the successful response
```

**Server startup:**

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[council-mcp] Server running on stdio");
}
```

### `src/smoke.ts` — Provider Smoke Test

Standalone script that tests both providers with `"Reply with exactly: OK"`. Exits 0 if both pass, exits 1 if either fails. All output goes to `stderr` via `console.error`.

Run with: `npm run smoke` (which runs `node dist/smoke.js`)

### `src/providers/index.ts` — Barrel Export

```typescript
export { askOpenAI } from "./openai.js";
export { askGemini } from "./gemini.js";
export type { ProviderResponse } from "./types.js";
```

---

## Example Claude Code Command Templates

These live in `examples/claude-commands/` and are shipped with the npm package. Users copy them into their project's `.claude/commands/` directory.

### `examples/claude-commands/council.md` — Generic /council

A ready-to-use `/council` command that works for any project:
- Auto-detects implementation plans, build guides, and architecture docs
- Sends tailored prompts to OpenAI (with `reasoning_effort: "high"`) and Gemini separately
- OpenAI prompt focuses on: missing steps, wrong paths, phase ordering, ambiguity, error handling
- Gemini prompt focuses on: design alternatives, architecture gaps, failure modes, assumptions, unasked questions
- Synthesizes both responses into `council-feedback.md` with sections: Critical Issues, Design Questions, Suggested Improvements, Things to Consider, Raw Responses
- Reports progress to the user at each step ("Sending to OpenAI...", "Waiting for Gemini...", "Synthesizing...")
- Has bounded investigation rules — does NOT read `.env`, `node_modules/`, `dist/`, `.git/`

### `examples/claude-commands/refine.md` — Generic /refine

A ready-to-use `/refine` command that works alongside `/council`:
- Reads the implementation plan + `council-feedback.md` + conversation history
- Triages feedback into three buckets: Apply Immediately, Apply Based on User's Answers, Note but Don't Apply
- Edits the plan directly, updates validation gates if affected
- Appends a Refinement Log with changes applied, design decisions, and deferred items
- Self-reviews the updated plan for consistency

### `examples/claude-commands/setup-council.md` — Interactive Wizard

An interactive setup wizard for generating project-tailored `/council` and `/refine` commands:
- Verifies the council-mcp MCP server is available (tool availability check only, no API call)
- Silently investigates the project (bounded: only config files, README, top-level listing)
- Asks 5 conversational questions: tech stack, risk areas, users/impact, existing workflow, custom checks
- Checks for existing `/council` and `/refine` commands — offers `.bak` backup before overwriting
- Generates tailored commands with version/date headers and progress reporting
- Maps risk areas to the right provider (see table in the file)
- Supports single-provider scenarios (generates commands that use only available providers)
- One-time generator — can be deleted after use

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Note: `tsc` preserves the shebang (`#!/usr/bin/env node`) from `src/index.ts` into `dist/index.js`. No postbuild step needed.

---

## npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run the MCP server directly |
| `dev` | `tsc --watch` | Watch mode for development |
| `clean` | `rimraf dist` | Delete build output |
| `rebuild` | `clean && build` | Full clean build |
| `smoke` | `node dist/smoke.js` | Test both providers |
| `prepublishOnly` | `npm run rebuild` | Ensure clean build before npm publish |

---

## Registration

### Via npm (recommended)

```bash
npm install -g council-of-models-mcp
claude mcp add --scope user council-mcp -- council-mcp
```

### Via clone

```bash
claude mcp add --scope user council-mcp -- node "$(pwd)/dist/index.js"
```

Both write to `~/.claude.json`. After registration, new Claude Code sessions see the `council-mcp` server and its three tools.

---

## API Key Management

Keys are loaded via these mechanisms (in priority order):
1. Shell environment variables (`OPENAI_API_KEY`, `GEMINI_API_KEY` or `GOOGLE_API_KEY`)
2. `.env` file in `process.cwd()` (loaded by `dotenv` at startup)

**Important for npm global installs:** `dotenv` resolves `.env` relative to `process.cwd()`, which is the user's current project directory — not the npm package directory. Global npm users should export keys in their shell profile rather than relying on `.env`.

The `.env` file is gitignored. The `.env.example` file contains placeholders and documents both `GEMINI_API_KEY` and `GOOGLE_API_KEY`.

**Gemini dual key support:** The Gemini client checks `GEMINI_API_KEY` first, then falls back to `GOOGLE_API_KEY`. If both are set, `GEMINI_API_KEY` takes precedence.

---

## Deviations from the Original Guides

### From `agentic_implementation_guide_v2.md` (initial build)

| Area | Guide Said | What We Did | Why |
|---|---|---|---|
| Gemini thinkingLevel | `thinkingLevel: "high"` (string) | `thinkingLevel: ThinkingLevel.HIGH` (enum) | `@google/genai@1.46.0` requires the enum, not a string. TypeScript compilation error `TS2820` caught this. |
| MCP tool annotations | "Check if SDK supports them, skip if not" | Added to all three tools | SDK 1.25.2 supports `tool(name, desc, schema, annotations, cb)` signature. Confirmed by compilation. |
| TypeScript version | Expected 5.x | Got 6.0.2 | Latest available at build time. No compatibility issues. |
| Node.js version | Required 18+ | Got v24.14.0 | No issues. |
| npm version | Required 9+ | Got 11.9.0 | No issues. |
| MCP SDK pinning | Pin to exact 1.25.2 | `^1.25.2` in package.json | npm installed with caret range by default. Functionally equivalent since no 2.x exists yet. |
| Default branch | Guide assumed `main` | Pushed to `master` | Git defaulted to `master` on init. |
| API key setup | Shell profile as primary | `.env` file as primary | README was later rewritten to prefer `.env` for beginner friendliness. |
| Paths | Guide used WSL `/mnt/c/...` paths | Used Windows-native `C:/Users/...` paths | Built on Windows 11 with Git Bash, not WSL. |

### From `agentic_guide_implementation.md` (v3 workflow layer)

| Area | Guide Said | What We Did | Why |
|---|---|---|---|
| Phase 3 QA cleanup | `rm -rf .claude/commands/` | Deleted only the 3 specific files we copied | Council feedback flagged blanket rm -rf as destructive — could delete pre-existing commands |
| Phase 3 /refine test | Run /refine as part of QA | Skipped — only tested /council end-to-end | /council was the critical path; /refine depends on council-feedback.md which was generated by the /council test |
| Phase 7 npm publish | `npm publish` directly | Required interactive 2FA authentication | npm account has 2FA enabled; had to run `npm publish` interactively for OTP |

---

## Verified Working (Integration Test Results)

### MCP Tools (initial build, March 26, 2026)

All three tools tested in a live Claude Code session:

```
ask_openai (prompt: "Say hello and confirm which model you are. One sentence.")
→ "Hello, I'm ChatGPT, an AI language model from OpenAI."
   model: gpt-5.4

ask_gemini (prompt: "Say hello and confirm which model you are. One sentence.")
→ "Hello, I am Gemini, a large language model built by Google."
   model: gemini-3.1-pro-preview

ask_all (prompt: "Say hello and confirm which model you are. One sentence.")
→ OpenAI (gpt-5.4): "Hello, I'm ChatGPT, an AI language model from OpenAI."
→ Gemini (gemini-3.1-pro-preview): "Hello, I am Gemini, a large language model built by Google."
```

### Workflow Layer (v3 QA, March 26, 2026)

- `/council`, `/refine`, and `/setup-council` all discovered by Claude Code from `.claude/commands/`
- `/council` ran end-to-end: found `agentic_guide_implementation.md`, sent tailored prompts to GPT (reasoning_effort: high) and Gemini in parallel, synthesized feedback into `council-feedback.md`
- Smoke test passed after GEMINI_API_KEY/GOOGLE_API_KEY change: 2 passed, 0 failed

### npm Package (v3, March 26, 2026)

- Published as `council-of-models-mcp@1.0.0`
- `npm pack --dry-run`: 35 files, 22.1 kB packed
- Binary `council-mcp` correctly points to `dist/index.js` with shebang
- No secrets (`.env`) or source (`src/`) in published package

---

## How to Modify This Project

**Add a new provider:** Create `src/providers/newprovider.ts` following the same pattern as `openai.ts` or `gemini.ts`. Add a config block in `src/config.ts`. Register a new tool in `src/index.ts`. Re-export from `src/providers/index.ts`.

**Change default models:** Edit only `src/config.ts` — change the `default` and/or `fallback` fields in `OPENAI_CONFIG` or `GEMINI_CONFIG`. Rebuild and smoke test.

**Add parameters to a tool:** Add a new zod field in the tool's schema in `src/index.ts`, then pass it through to the provider function.

**Change fallback behavior:** Edit the `shouldFallback()` regex in `src/config.ts` to include or exclude additional error patterns.

**Update example templates:** Edit files in `examples/claude-commands/`. These ship with the npm package, so bump the version and republish after changes.

**Publish a new version:** Bump version in `package.json`, then `npm publish` (runs `prepublishOnly` automatically for clean build). Requires 2FA.

**Add a new example command:** Create a new `.md` file in `examples/claude-commands/`. It will be included in the npm package automatically (the `files` array includes `examples/`).
