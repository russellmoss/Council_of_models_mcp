# Council of Models MCP Server

**This project adds 4 AI tools to Claude Code so Claude can ask OpenAI, Gemini, and the local Codex CLI for second opinions.**

It works by running a small local server that Claude Code talks to behind the scenes. You set it up once, and then any Claude Code session can call `ask_openai`, `ask_codex`, `ask_gemini`, or `ask_all` as native tools.

> New to MCP? It stands for Model Context Protocol — it's how Claude Code connects to external tools. You don't need to understand the protocol to use this project.

### Prerequisites

| Requirement | How to check | Where to get it |
|---|---|---|
| Node.js 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm 9+ | `npm --version` | Comes with Node.js |
| Claude Code | `claude --version` | [claude.ai/code](https://claude.ai/code) |
| OpenAI API key | — | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Gemini API key | — | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Codex CLI (optional) | `codex --version` | `npm i -g @openai/codex` then `codex login` |

> **Tip**: You don't need all providers. At minimum you need **one API key** (OpenAI or Gemini). Codex CLI is optional — it lets you access OpenAI models through your local Codex installation instead of paying for API calls separately.

---

## 5-Minute Quick Start

### Option A: Install via npm (recommended)

```bash
npm install -g council-of-models-mcp
```

Add your API keys to your shell profile:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export OPENAI_API_KEY="sk-your-actual-key-here"
export GEMINI_API_KEY="your-actual-key-here"
```

> **Tip**: Either `GEMINI_API_KEY` or `GOOGLE_API_KEY` works — set whichever you prefer.

Reload your shell (`source ~/.bashrc`), then register with Claude Code:

```bash
claude mcp add --scope user council-mcp -- council-mcp
```

### Option B: Clone the repo

```bash
git clone https://github.com/russellmoss/Council_of_models_mcp.git
cd Council_of_models_mcp
npm install
npm run build
```

Add your API keys:

```bash
cp .env.example .env
# Edit .env with your real keys
```

Verify both providers work:

```bash
npm run smoke
```

You should see green checkmarks for your configured providers:

```
Testing OpenAI (API)...
  ✅ OpenAI OK (model: gpt-5.4)

Testing Codex (CLI)...
  ✅ Codex OK (model: gpt-5.4)

Testing Gemini (API)...
  ✅ Gemini OK (model: gemini-3.1-pro-preview)

=== Results: 3 passed, 0 failed ===
```

> Codex CLI shows as "skipped" if not installed — that's fine, it's optional.

If either provider fails, check [Common First-Run Problems](#common-first-run-problems) below.

Register with Claude Code:

```bash
claude mcp add --scope user council-mcp -- node "$(pwd)/dist/index.js"
```

### Alternative: interactive setup wizard

Instead of the manual steps above, you can run the setup wizard which handles everything interactively:

```bash
# If you cloned the repo:
npm run setup

# If you installed via npm:
council-mcp-setup
```

It walks you through API keys, tests providers, registers with Claude Code, and copies templates to your project — all in one go.

### Verify it works

Start a **new** Claude Code session (important — existing sessions don't pick up new servers), then try:

```
Use ask_all to summarize what this repo does in one paragraph.
```

That's it. You're done. By default, `ask_all` uses Codex CLI + Gemini (no extra API costs).

---

## What Success Looks Like

- **Smoke test passes**: Both providers show a green checkmark and respond with "OK". This means your API keys are valid and the server can reach both providers.
- **Claude Code sees the server**: Run `claude mcp list` and look for `council-mcp: ... ✓ Connected`.
- **Tools work in Claude Code**: In a new session, ask Claude to use `ask_openai`, `ask_codex`, `ask_gemini`, or `ask_all` and you get responses back.

---

## Common First-Run Problems

### `claude: command not found`
Claude Code isn't installed or isn't on your PATH. Install it from [claude.ai/code](https://claude.ai/code). If you just installed it, restart your terminal.

### Smoke test says "Missing OPENAI_API_KEY" or "Missing Gemini API key"
Your API keys aren't set. If you cloned the repo, make sure you ran `cp .env.example .env` and edited it with your real keys. If you installed via npm, export the keys in your shell profile. The server accepts either `GEMINI_API_KEY` or `GOOGLE_API_KEY` — many Google tutorials use `GOOGLE_API_KEY`, and that works too.

### Smoke test says "429 quota exceeded"
Your API account has hit its usage limit. Check your billing:
- OpenAI: [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)
- Gemini: [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)

### "Cannot find module" errors at runtime
You forgot to build. Run `npm run build` in the project directory.

### Claude Code doesn't see `council-mcp` after registration
You need to start a **new** Claude Code session. Existing sessions don't pick up newly registered MCP servers. Run `claude mcp list` to confirm the server is registered.

### Smoke test says "model not found"
The model ID may have changed. Check the provider's docs for current model IDs and update `src/config.ts`. See the [Advanced](#advanced) section.

---

## Codex CLI vs OpenAI API — Which Should I Use?

Both `ask_codex` and `ask_openai` access the same OpenAI models (gpt-5.4, etc.) — they just use different paths to get there:

| | Codex CLI (`ask_codex`) | OpenAI API (`ask_openai`) |
|---|---|---|
| **Cost** | Uses your existing Codex/ChatGPT subscription — no per-token API charges | Pay-per-token via OpenAI API billing |
| **Setup** | `npm i -g @openai/codex && codex login` | Get an API key from platform.openai.com |
| **Auth** | Local login session | `OPENAI_API_KEY` env var |
| **Speed** | Slightly slower (spawns CLI process) | Direct API call, lower latency |
| **Best for** | Personal use, avoiding double billing | Teams with API budgets, CI/CD pipelines |

**The `ask_all` tool defaults to `mode: "codex"`** — pairing Codex CLI with Gemini API. This gives you cross-model validation without paying for OpenAI API calls on top of your existing subscription.

To switch to OpenAI API mode:
```
Use ask_all with mode "openai" to review this implementation plan.
```

**If you already have Codex installed and logged in, you don't need an OpenAI API key at all.** Just set your Gemini API key and you're ready to go.

---

## Demo Prompts

After setup, open a **new** Claude Code session and try these:

1. **Ask OpenAI (API):**
   ```
   Use ask_openai to summarize what this repo does in one paragraph.
   ```

2. **Ask Codex (CLI, free):**
   ```
   Use ask_codex to summarize what this repo does in one paragraph.
   ```

3. **Ask Gemini:**
   ```
   Use ask_gemini to critique this implementation plan.
   ```

4. **Ask both and compare (free mode):**
   ```
   Use ask_all to compare both answers about the pros and cons of microservices vs monoliths.
   ```
   This defaults to `mode: "codex"` (Codex CLI + Gemini). To use OpenAI API instead:
   ```
   Use ask_all with mode "openai" to compare both answers about microservices vs monoliths.
   ```

---

## Using It in Your Projects

The tools above (`ask_openai`, `ask_codex`, `ask_gemini`, `ask_all`) are the building blocks. The real power comes from **project-specific slash commands** that orchestrate those tools into a cross-validation workflow.

### The two-layer architecture

```
┌──────────────────────────────────────────────────┐
│  Your Project (.claude/commands/)                 │
│                                                   │
│  /council  — what to review, what questions to    │
│              ask each model, how to synthesize     │
│                                                   │
│  /refine   — takes feedback + your answers,       │
│              updates the implementation plan       │
│                                                   │
│  These are project-specific. A dashboard app      │
│  asks different questions than a data pipeline.    │
├──────────────────────────────────────────────────┤
│  Council MCP Server (global, registered once)     │
│                                                   │
│  ask_openai  — sends prompts to GPT via API       │
│  ask_codex   — sends prompts to GPT via Codex CLI │
│  ask_gemini  — sends prompts to Gemini            │
│  ask_all     — two providers in parallel           │
│               mode "codex"  = Codex + Gemini       │
│               mode "openai" = OpenAI API + Gemini  │
│                                                   │
│  Same everywhere. Doesn't know what project       │
│  you're in.                                       │
└──────────────────────────────────────────────────┘
```

You set up the MCP server once. The slash commands are different for every project because every project has different risks, different files to review, and different questions to ask.

### Interactive setup (recommended)

The fastest way to get started — run the setup wizard:

```bash
# If installed via npm:
council-mcp-setup

# If cloned the repo:
npm run setup
```

It handles API keys, provider verification, MCP registration, and copies the generic `/council` and `/refine` templates into your project. Takes about 30 seconds.

If you prefer manual setup, see the steps below.

### Quick start: use the generic templates

This package ships with ready-to-use `/council` and `/refine` commands that work for any project:

**1. Find the templates:**

```bash
# If you installed via npm:
npm root -g
# Look in: <global_root>/council-of-models-mcp/examples/claude-commands/

# If you cloned the repo, they're in:
# examples/claude-commands/
```

**2. Copy them into your project:**

```bash
cd /path/to/your/project
mkdir -p .claude/commands
cp /path/to/examples/claude-commands/council.md .claude/commands/council.md
cp /path/to/examples/claude-commands/refine.md .claude/commands/refine.md
```

**3. Start a new Claude Code session** in your project and run:

```
/council
```

That's it. The generic templates auto-detect your project's implementation plans and send them for cross-LLM review.

### Upgrade: the interactive wizard

For project-specific review prompts tailored to your risk areas, use the setup wizard:

```bash
cp /path/to/examples/claude-commands/setup-council.md .claude/commands/setup-council.md
```

Start a new Claude Code session and run `/setup-council`. Answer 5 questions about your project, and it generates custom `/council` and `/refine` commands that focus on what matters most for your codebase. Delete the wizard after — it's a one-time generator.

### Example workflow

```
/new-feature      →  explore codebase, discover what needs to change
/build-guide      →  generate a phased implementation plan
/council          →  Codex + Gemini cross-validate the plan
  ↳ you answer the design questions they surface
/refine           →  update the plan with all feedback
  ↳ optionally run /council again on the refined plan
Execute           →  follow the refined guide phase by phase
```

### What each model is good at

| Review Type | Best Provider | Why |
|---|---|---|
| Missing code paths / construction sites | OpenAI (GPT) | Strong at exhaustive enumeration and finding gaps |
| Business logic / data assumptions | Gemini | Strong at challenging assumptions and reasoning about intent |
| Pattern consistency | OpenAI (GPT) | Strong at comparing code against established conventions |
| Data quality / edge cases | Gemini | Strong at thinking through edge cases and distributions |
| Security / auth | OpenAI (GPT) | Strong at systematic security review |

### Generated commands should be committed

The `/council` and `/refine` commands contain no secrets — they're just instructions. **Commit them to git** so your whole team uses the same cross-validation workflow.

---

## What It Does

Exposes four tools to any Claude Code session:

| Tool | Description |
|------|-------------|
| `ask_openai` | Send a prompt to OpenAI via API (default: gpt-5.4, requires API key) |
| `ask_codex` | Send a prompt to OpenAI via local Codex CLI (default: gpt-5.4, no API key needed) |
| `ask_gemini` | Send a prompt to Google Gemini (default: gemini-3.1-pro-preview with thinking enabled) |
| `ask_all` | Send to two providers in parallel — use `mode: "codex"` (default, free) or `mode: "openai"` (API) |

---

## Advanced

### Shell profile environment variables

If you want your API keys available globally (not just in this project), add them to your shell profile instead of `.env`:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export OPENAI_API_KEY="sk-your-key-here"
export GEMINI_API_KEY="your-key-here"
```

Then reload: `source ~/.bashrc` (or `~/.zshrc`)

For Windows PowerShell (run as Administrator):
```powershell
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-your-key", "User")
[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-key", "User")
```

### Model overrides

Override the default model on any tool call:

- `"Use ask_openai with model gpt-5.4-pro to deeply analyze this build guide"` (slower, deeper reasoning)
- `"Use ask_openai with reasoning_effort high to review this architecture"` (more thorough without changing model)

### Available models

**OpenAI (API) and Codex (CLI) — same model family, different access method:**
- `gpt-5.4` — Best overall (default for both)
- `gpt-5.4-pro` — Deep reasoning (slower, opt-in)
- `gpt-5.4-mini` — Fast and cheap
- `gpt-5.4-nano` — Ultra fast

> OpenAI API requires an API key and charges per token. Codex CLI uses your local `codex login` session — same models, no separate API charges.

**Google Gemini:**
- `gemini-3.1-pro-preview` — Flagship reasoning (default, thinking enabled)
- `gemini-3-flash-preview` — Fast and efficient
- `gemini-3.1-flash-lite-preview` — Budget option

### Updating models

When new models launch, edit `src/config.ts` — it's the only file that needs to change. Then rebuild and verify:

```bash
npm run build
npm run smoke
```

### Architecture

- **Transport**: stdio (standard for Claude Code MCP servers)
- **OpenAI API**: Responses API (`responses.create`) with optional `reasoning.effort` control
- **Codex CLI**: Spawns `codex exec` as a child process, pipes prompt via stdin, reads response from temp file. No shell invocation (uses `execFile` directly). Requires `codex login` for auth.
- **Gemini API**: `@google/genai` with native `systemInstruction` and `thinkingLevel: "high"`
- **Fallback**: Only on transient errors — auth/config errors surface immediately
- **Keys**: Environment variables or `.env` file (loaded via dotenv). Codex CLI manages its own auth.
- **MCP SDK**: Pinned to exact tested version (1.25.2)

---

## License

MIT
