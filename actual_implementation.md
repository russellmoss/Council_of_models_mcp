# Actual Implementation: Council of Models MCP Server

This document describes what is built, how it works, and where to find everything. It is intended to be read by an LLM that needs to understand, modify, or extend this project.

**Built**: March 26, 2026
**Last updated**: March 26, 2026
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

The project also ships:
- **Example Claude Code slash command templates** (`/council`, `/refine`, `/setup-council`) that users copy into their projects to orchestrate cross-LLM validation workflows.
- **An interactive setup wizard** (`council-mcp-setup`) that walks users through API key configuration, provider verification, MCP registration, and template installation.

---

## File Structure

```
Council_of_models_mcp/
├── .claude/
│   ├── commands/
│   │   ├── council.md             # /council command (local copy for this repo)
│   │   ├── refine.md              # /refine command (local copy for this repo)
│   │   └── setup-council.md       # /setup-council command (local copy for this repo)
│   └── settings.local.json        # Local permission overrides for development
├── examples/
│   └── claude-commands/
│       ├── council.md             # Generic /council — works for any project
│       ├── refine.md              # Generic /refine — works with council.md
│       └── setup-council.md       # Interactive wizard for tailored commands
├── src/
│   ├── index.ts                   # MCP server entry point, tool registrations (has shebang)
│   ├── config.ts                  # Model defaults, resolveModel(), shouldFallback()
│   ├── smoke.ts                   # Standalone smoke test script
│   ├── setup.ts                   # Interactive setup wizard (council-mcp-setup binary)
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
└── agentic_guide_rename.md        # Implementation guide used during the build
```

---

## Key Dependencies (from package.json)

```json
{
  "dependencies": {
    "@clack/prompts": "^1.1.0",
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
  "bin": {
    "council-mcp": "dist/index.js",
    "council-mcp-setup": "dist/setup.js"
  },
  "files": ["dist/", "examples/", ".env.example", "README.md", "QUICKSTART.md"],
  "engines": { "node": ">=18.0.0" }
}
```

- **Package name**: `council-of-models-mcp`
- **Binaries**:
  - `council-mcp` — the MCP server (runs over stdio)
  - `council-mcp-setup` — interactive setup wizard
- **Published files**: `dist/`, `examples/`, `.env.example`, `README.md`, `QUICKSTART.md`, `package.json`
- **NOT published**: `src/` (TypeScript source), `.env` (secrets), `.claude/` (local commands), `node_modules/`, `actual_implementation.md`, `agentic_guide_rename.md`
- **`prepublishOnly`**: runs `npm run rebuild` to ensure clean compile before every publish
- The shebang `#!/usr/bin/env node` is present in both `src/index.ts` and `src/setup.ts`, and survives `tsc` compilation into `dist/`

### Install paths

**npm (recommended):**
```bash
npm install -g council-of-models-mcp
council-mcp-setup              # Interactive wizard handles everything
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

**All available models:**

| Provider | Models |
|---|---|
| OpenAI | `gpt-5.4-pro`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Gemini | `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview` |

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

**Dual API key support**: The client checks both `GEMINI_API_KEY` and `GOOGLE_API_KEY`, preferring `GEMINI_API_KEY` if both are set:

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

Note: The fallback path for Gemini does NOT include `thinkingConfig` — it calls `generateContent` with just the model, contents, and optional systemInstruction.

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

**Response formatting:**

Each tool wraps provider responses with a markdown header:
- Single-provider tools: `**OpenAI Response** (model: gpt-5.4)` or `**Gemini Response** (model: ...)`
- `ask_all`: `# Council of Models — Parallel Response` with `## OpenAI Response` and `## Gemini Response` subsections separated by `---`
- Fallback warnings show as `⚠️ Used fallback model: ...`
- Errors without text return `{ isError: true }`

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

### `src/setup.ts` — Interactive Setup Wizard

An interactive CLI wizard built with `@clack/prompts` that walks new users through the full setup. It is exposed as the `council-mcp-setup` binary.

**What it does (4 steps):**

1. **API Key Configuration** — Detects existing keys in the environment. Prompts for missing keys via password input. In clone context, writes keys to `.env`. In global install context, shows the `export` commands to add to shell profile.

2. **Provider Verification** — Tests each configured provider by sending `"Reply with exactly: OK"` via the same `askOpenAI`/`askGemini` functions the MCP server uses. Shows spinner during each test. Exits if all configured providers fail.

3. **MCP Registration** — Checks if `claude` CLI is on PATH, checks if `council-mcp` is already registered (via `claude mcp list`). If not registered, offers to auto-register. Detects whether global binary is available or falls back to `node dist/index.js` path.

4. **Template Installation** — Asks for the user's project folder path. Copies `council.md` and `refine.md` from `examples/claude-commands/` into the project's `.claude/commands/` directory. Backs up existing commands as `.bak` before overwriting.

**Context detection:**
- `isCloneContext()` — checks if `process.cwd()` contains a `package.json` with `name: "council-of-models-mcp"`. Determines whether to write `.env` or show export commands.
- `isNpxContext()` — checks if the package root path contains `/_npx/` or `/.npm/`. Warns about unstable cache paths.

**Key helper: `mergeEnvFile()`** — Reads an existing `.env` file, preserves all lines that aren't managed keys, then appends the new keys under a `# Managed by council-mcp-setup` comment.

**Key helper: `buildRegistrationArgs()`** — Tries `council-mcp --help` first to check if the global binary is available. If it works, registers as `-- council-mcp`. If not, falls back to `-- node <path>/index.js`.

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

These live in `examples/claude-commands/` and are shipped with the npm package. Users copy them into their project's `.claude/commands/` directory (either manually or via the `council-mcp-setup` wizard).

### `examples/claude-commands/council.md` — Generic /council

A ready-to-use `/council` command that works for any project:
- Auto-detects implementation plans, build guides, and architecture docs (checks `*implementation*guide*.md`, `*build*guide*.md`, `*implementation*plan*.md`, `ARCHITECTURE.md`, `DESIGN.md`)
- Reads context files: `README.md`, `package.json`/`tsconfig.json`/`pyproject.toml`/`Cargo.toml`
- Investigates the project silently (top-level listing, `src/` listing, tech stack, tests, CI)
- Sends tailored prompts to OpenAI (with `reasoning_effort: "high"`) and Gemini **separately** (not via `ask_all`) so each prompt can be customized
- OpenAI prompt focuses on: missing steps, wrong paths, phase ordering, ambiguity, error handling
- Gemini prompt focuses on: design alternatives, architecture gaps, failure modes, assumptions, unasked questions
- Both prompts require structured response format: CRITICAL / SHOULD FIX / DESIGN QUESTIONS
- Synthesizes both responses into `council-feedback.md` with sections: Critical Issues, Design Questions, Suggested Improvements, Things to Consider, Raw Responses
- Reports progress to the user at each step ("Sending to OpenAI...", "Waiting for Gemini...", "Synthesizing...")
- Has bounded investigation rules — does NOT read `.env`, `node_modules/`, `dist/`, `.git/`

### `examples/claude-commands/refine.md` — Generic /refine

A ready-to-use `/refine` command that works alongside `/council`:
- Requires both the implementation plan and `council-feedback.md` to exist
- Reads the implementation plan + `council-feedback.md` + conversation history
- Triages feedback into three buckets:
  - **Apply Immediately**: wrong paths, incorrect field names, missing error handling, pattern inconsistencies, phase ordering fixes
  - **Apply Based on User's Answers**: business logic choices, design tradeoffs, items flagged as Design Questions
  - **Note but Don't Apply**: scope expansions, alternative approaches where current is valid, items user explicitly declined
- Edits the plan directly, updates validation gates if affected
- Appends a Refinement Log with changes applied, design decisions, and deferred items
- Self-reviews the updated plan for consistency
- Does NOT begin executing the plan — stops and waits for the user

### `examples/claude-commands/setup-council.md` — Interactive Wizard

An interactive setup wizard for generating project-tailored `/council` and `/refine` commands:
- Verifies the council-mcp MCP server is available (tool availability check only, no API call)
- Silently investigates the project (bounded: only config files, README, top-level listing)
- Asks 5 conversational questions: project purpose, risk areas, users/impact, existing workflow, custom checks
- Checks for existing `/council` and `/refine` commands — offers `.bak` backup before overwriting
- Generates tailored commands with version/date headers and progress reporting
- Maps risk areas to the right provider:
  - **OpenAI**: type safety, database/query, API contracts, security, pattern consistency
  - **Gemini**: business logic, data quality/exports, UI/display logic
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
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Note: `tsc` preserves the shebang (`#!/usr/bin/env node`) from source files into `dist/`. No postbuild step needed.

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
| `setup` | `node dist/setup.js` | Run the interactive setup wizard |
| `prepublishOnly` | `npm run rebuild` | Ensure clean build before npm publish |

---

## Registration

### Via npm (recommended)

```bash
npm install -g council-of-models-mcp
council-mcp-setup    # Interactive wizard handles API keys, verification, registration, and templates
```

Or manually:

```bash
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

## .gitignore

```
node_modules/
dist/
.env
*.js.map
```

---

## How to Modify This Project

**Add a new provider:** Create `src/providers/newprovider.ts` following the same pattern as `openai.ts` or `gemini.ts`. Add a config block in `src/config.ts`. Register a new tool in `src/index.ts`. Re-export from `src/providers/index.ts`.

**Change default models:** Edit only `src/config.ts` — change the `default` and/or `fallback` fields in `OPENAI_CONFIG` or `GEMINI_CONFIG`. Rebuild and smoke test.

**Add parameters to a tool:** Add a new zod field in the tool's schema in `src/index.ts`, then pass it through to the provider function.

**Change fallback behavior:** Edit the `shouldFallback()` regex in `src/config.ts` to include or exclude additional error patterns.

**Update example templates:** Edit files in `examples/claude-commands/`. These ship with the npm package, so bump the version and republish after changes.

**Update the setup wizard:** Edit `src/setup.ts`. The wizard uses `@clack/prompts` for interactive UI (spinners, selects, confirms, password inputs). Rebuild to compile.

**Publish a new version:** Bump version in `package.json`, then `npm publish` (runs `prepublishOnly` automatically for clean build). Requires 2FA.

**Add a new example command:** Create a new `.md` file in `examples/claude-commands/`. It will be included in the npm package automatically (the `files` array includes `examples/`).
