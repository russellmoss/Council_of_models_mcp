# Agentic Implementation Guide: Rename counsel → council

## Reference

This guide renames every occurrence of "counsel" to "council" across the entire codebase, sets up the new GitHub repo, publishes a new npm package, and deprecates the old one.

**Source directory**: `C:\Users\russe\Documents\Counsel_of_models_mcp`
**Target directory**: `C:\Users\russe\Documents\Council_of_models_mcp`
**New GitHub repo**: `https://github.com/russellmoss/Council_of_models_mcp`
**New npm package**: `council-of-models-mcp`
**Old npm package**: `counsel-of-models-mcp` (will be deprecated)

## Rename Map

Every identifier change in one table:

| Old | New | Where |
|---|---|---|
| `counsel-of-models-mcp` | `council-of-models-mcp` | package.json name, all docs |
| `counsel-of-models` | `council-of-models` | src/index.ts MCP server name |
| `counsel-mcp` | `council-mcp` | package.json bin, MCP registration, all docs, setup.ts, provider logs |
| `counsel-mcp-setup` | `council-mcp-setup` | package.json bin, setup.ts, docs |
| `counsel-feedback.md` | `council-feedback.md` | templates, docs |
| `counsel-feedback` | `council-feedback` | templates, docs |
| `/counsel` | `/council` | slash command name in templates, docs, setup.ts |
| `counselSrc` | `councilSrc` | src/setup.ts variable |
| `counselExists` | `councilExists` | src/setup.ts variable |
| `counsel-mcp__ask_*` | `council-mcp__ask_*` | .claude/settings.local.json |
| `setup-counsel` | `setup-council` | slash command name, filenames, docs |
| `counsel.md` | `council.md` | template filename in examples/ and .claude/commands/ |
| `setup-counsel.md` | `setup-council.md` | template filename in examples/ and .claude/commands/ |
| `Counsel_of_models_MCP` | `Council_of_models_mcp` | GitHub URL in docs |
| `counsel-of-models-mcp` (npm URLs) | `council-of-models-mcp` | docs |

## Pre-Flight Checklist

```bash
# Verify source exists
ls "C:/Users/russe/Documents/Counsel_of_models_mcp/package.json"
# Expected: exists

# Verify target directory is empty or doesn't exist yet
ls "C:/Users/russe/Documents/Council_of_models_mcp/" 2>/dev/null
# Expected: empty or only .git

# Verify new npm name is available
npm view council-of-models-mcp 2>&1 | head -1
# Expected: 404 Not Found

# Verify npm login
npm whoami
# Expected: mossrussell
```

---

# PHASE 1: Copy Project to New Directory

## Context

Copy the source project to the new directory, excluding git history, node_modules, and dist. We'll init fresh git in the new location.

## Step 1.1: Copy files

**Claude Code prompt**: "Copy the project files from the old directory to the new one. Exclude .git, node_modules, dist, and any counsel-feedback.md or exploration files that were working docs."

```bash
cd "C:/Users/russe/Documents"

# Copy everything except git, node_modules, dist, and working docs
rsync -av --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='counsel-feedback.md' \
  --exclude='rename_exploration.md' \
  --exclude='CLI_exploration.md' \
  --exclude='agentic_guide_CLI.md' \
  --exclude='agentic_guide_implementation.md' \
  --exclude='agentic_implementation_guide_v2.md' \
  --exclude='package-lock.json' \
  Counsel_of_models_mcp/ Council_of_models_mcp/
```

If rsync isn't available on Windows, use:
```bash
cp -r Counsel_of_models_mcp/ Council_of_models_mcp/
cd Council_of_models_mcp
rm -rf .git node_modules dist package-lock.json
rm -f counsel-feedback.md rename_exploration.md CLI_exploration.md
rm -f agentic_guide_CLI.md agentic_guide_implementation.md agentic_implementation_guide_v2.md
```

## Step 1.2: Initialize git and set remote

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"
git init
git remote add origin https://github.com/russellmoss/Council_of_models_mcp.git
```

## Step 1.3: Install dependencies

```bash
npm install
```

## PHASE 1 — VALIDATION GATE

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"

ls package.json src/index.ts src/setup.ts src/config.ts
# Expected: all exist

ls .git/config
# Expected: exists

git remote -v | grep Council_of_models_mcp
# Expected: shows the new remote

ls node_modules/@clack/prompts/package.json
# Expected: exists
```

**STOP AND REPORT**: Tell the user:
- "Phase 1 complete: project copied, git initialized, dependencies installed."
- "Ready to proceed to Phase 2 (the rename)?"

---

# PHASE 2: Rename All Occurrences

## Context

This is the main rename phase. We do it in a specific order: source code first (so we can compile and catch errors), then templates, then docs. Every `sed` command uses word-aware patterns to avoid partial replacements.

**CRITICAL**: Work from the NEW directory `C:/Users/russe/Documents/Council_of_models_mcp` for ALL remaining phases.

## Step 2.1: Rename in TypeScript source files

**Claude Code prompt**: "Rename all occurrences of 'counsel' to 'council' in the TypeScript source files. Use exact string replacements — do not use regex that could match partial words incorrectly. Process each file individually."

### src/index.ts

Replace these exact strings:
- `"counsel-of-models"` → `"council-of-models"`
- `"/counsel workflow"` → `"/council workflow"`
- `"[counsel-mcp]"` → `"[council-mcp]"`

### src/setup.ts

Replace these exact strings:
- `"counsel-of-models-mcp"` → `"council-of-models-mcp"` (in isCloneContext and error messages)
- `"counsel-mcp-setup"` → `"council-mcp-setup"` (in .env comment)
- `"counsel-mcp"` → `"council-mcp"` (in buildRegistrationArgs, MCP registration check, all log messages)
- `counselSrc` → `councilSrc` (variable name, all occurrences)
- `counselExists` → `councilExists` (variable name, all occurrences)
- `"counsel.md"` → `"council.md"` (in copyTemplates and overwrite detection)
- `"counsel.md.bak"` → `"council.md.bak"`
- `"/counsel"` → `"/council"` (in user-facing strings like "Set up /council and /refine")
- `"npm install -g counsel-of-models-mcp"` → `"npm install -g council-of-models-mcp"`
- `"Copied counsel.md"` → `"Copied council.md"`

### src/providers/openai.ts

Replace:
- `"[counsel-mcp]"` → `"[council-mcp]"`

### src/providers/gemini.ts

Replace:
- `"[counsel-mcp]"` → `"[council-mcp]"`

### src/smoke.ts

Replace:
- `"Counsel of Models"` → `"Council of Models"` (in the banner text, if present)

## Step 2.2: Rename template files and their contents

**Claude Code prompt**: "Rename the template files in examples/claude-commands/ and update all occurrences of 'counsel' to 'council' inside them."

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"

# Rename the files themselves
mv examples/claude-commands/counsel.md examples/claude-commands/council.md
mv examples/claude-commands/setup-counsel.md examples/claude-commands/setup-council.md
```

Then edit the contents of all three files in `examples/claude-commands/`:

### examples/claude-commands/council.md (was counsel.md)

Replace all occurrences:
- `/counsel` → `/council`
- `counsel-feedback.md` → `council-feedback.md`
- `setup-counsel` → `setup-council`
- `Counsel of Models` → `Council of Models`
- `counsel_of_models_MCP` → `Council_of_models_mcp`

### examples/claude-commands/refine.md

Replace all occurrences:
- `/counsel` → `/council`
- `counsel-feedback.md` → `council-feedback.md`
- `counsel feedback` → `council feedback`
- `setup-counsel` → `setup-council`
- `Counsel of Models` → `Council of Models`

### examples/claude-commands/setup-council.md (was setup-counsel.md)

Replace all occurrences:
- `counsel-mcp` → `council-mcp`
- `counsel-of-models-mcp` → `council-of-models-mcp`
- `/counsel` → `/council`
- `/setup-counsel` → `/setup-council`
- `counsel-feedback.md` → `council-feedback.md`
- `counsel.md` → `council.md`
- `counsel.md.bak` → `council.md.bak`
- `counsel-v2.md` → `council-v2.md`
- `setup-counsel.md` → `setup-council.md`
- `Counsel of Models` → `Council of Models`
- `Counsel_of_models_MCP` → `Council_of_models_mcp`
- `counsel commands` → `council commands`
- `counsel prompts` → `council prompts`
- `counsel command` → `council command`
- `counsel can still` → `council can still`

## Step 2.3: Rename in .claude/commands/ (if they exist)

```bash
# These may or may not exist from earlier QA testing
if [ -d ".claude/commands" ]; then
  [ -f ".claude/commands/counsel.md" ] && mv .claude/commands/counsel.md .claude/commands/council.md
  [ -f ".claude/commands/setup-counsel.md" ] && mv .claude/commands/setup-counsel.md .claude/commands/setup-council.md
  # Also update contents of any files in .claude/commands/
  # Apply same replacements as Step 2.2
fi
```

## Step 2.4: Update .claude/settings.local.json (if it exists)

**Claude Code prompt**: "If `.claude/settings.local.json` exists, replace all 'counsel' occurrences with 'council'."

Replace:
- `counsel-mcp__ask_openai` → `council-mcp__ask_openai`
- `counsel-mcp__ask_gemini` → `council-mcp__ask_gemini`
- `counsel-mcp__ask_all` → `council-mcp__ask_all`
- `counsel.md` → `council.md`
- `setup-counsel.md` → `setup-council.md`

## Step 2.5: Update package.json

**Claude Code prompt**: "Update package.json with the new names."

Replace:
- `"name": "counsel-of-models-mcp"` → `"name": "council-of-models-mcp"`
- `"counsel-mcp": "dist/index.js"` → `"council-mcp": "dist/index.js"`
- `"counsel-mcp-setup": "dist/setup.js"` → `"council-mcp-setup": "dist/setup.js"`
- Any `counsel` in the repository URL → update to `Council_of_models_mcp`
- Any `counsel` in the bugs/homepage URLs → update to `Council_of_models_mcp`

Set version to `1.0.0` (this is a new package, fresh start).

## PHASE 2 — VALIDATION GATE

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"

# Verify NO occurrences of "counsel" remain in source code
grep -rn "counsel" src/ --include="*.ts"
# Expected: NO OUTPUT — zero occurrences

# Verify NO occurrences in package.json
grep -in "counsel" package.json
# Expected: NO OUTPUT

# Verify NO occurrences in template files
grep -rin "counsel" examples/claude-commands/
# Expected: NO OUTPUT

# Verify template files were renamed
ls examples/claude-commands/council.md
ls examples/claude-commands/setup-council.md
ls examples/claude-commands/refine.md
# Expected: all three exist, no counsel.md or setup-counsel.md

# Verify package.json has correct name
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.name, p.bin)"
# Expected: council-of-models-mcp { 'council-mcp': 'dist/index.js', 'council-mcp-setup': 'dist/setup.js' }
```

**STOP AND REPORT**: Tell the user:
- "Phase 2 complete: all 'counsel' occurrences renamed to 'council'."
- "Zero occurrences remain in source code, templates, or package.json."
- "Ready to proceed to Phase 3?"

---

# PHASE 3: Update README.md and QUICKSTART.md

## Context

Global find-and-replace in the docs. These have the most occurrences (~30 combined).

## Step 3.1: Update README.md

**Claude Code prompt**: "Replace ALL occurrences of 'counsel' with 'council' in README.md. This includes package names, binary names, slash commands, feedback filenames, MCP registration names, GitHub URLs, and npm URLs. Also update the GitHub repo URL from Counsel_of_models_MCP to Council_of_models_mcp."

Key replacements (apply ALL):
- `counsel-of-models-mcp` → `council-of-models-mcp`
- `counsel-mcp-setup` → `council-mcp-setup`
- `counsel-mcp` → `council-mcp`
- `/counsel` → `/council`
- `counsel-feedback` → `council-feedback`
- `setup-counsel` → `setup-council`
- `counsel.md` → `council.md`
- `Counsel of Models` → `Council of Models`
- `Counsel_of_models_MCP` → `Council_of_models_mcp`

## Step 3.2: Update QUICKSTART.md

**Claude Code prompt**: "Replace ALL occurrences of 'counsel' with 'council' in QUICKSTART.md. Same replacements as README."

## Step 3.3: Update actual_implementation.md

**Claude Code prompt**: "Replace ALL occurrences of 'counsel' with 'council' in actual_implementation.md. Same replacements."

## PHASE 3 — VALIDATION GATE

```bash
# Verify NO occurrences of "counsel" remain in any docs
grep -in "counsel" README.md
# Expected: NO OUTPUT

grep -in "counsel" QUICKSTART.md
# Expected: NO OUTPUT

grep -in "counsel" actual_implementation.md
# Expected: NO OUTPUT

# Verify the new terms are present
grep -c "council-of-models-mcp" README.md
# Expected: 3+ (npm install, GitHub URL, etc.)

grep -c "council-mcp" README.md
# Expected: 5+ (registration, binary name, etc.)

grep -c "/council" README.md
# Expected: 5+ (slash command references)
```

**STOP AND REPORT**: Tell the user:
- "Phase 3 complete: README, QUICKSTART, and actual_implementation.md updated."
- "Zero 'counsel' occurrences remain in any documentation."
- "Ready to proceed to Phase 4?"

---

# PHASE 4: Build, Smoke Test, and Re-register MCP

## Context

Compile the renamed code, verify it works, and re-register the MCP server under the new name.

## Step 4.1: Build

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"
npm run rebuild
# Expected: clean compile, zero errors
```

## Step 4.2: Verify no "counsel" leaked into compiled output

```bash
grep -rn "counsel" dist/ --include="*.js"
# Expected: NO OUTPUT
```

## Step 4.3: Smoke test

```bash
npm run smoke
# Expected: 2 passed, 0 failed
```

## Step 4.4: Remove old MCP registration and add new one

**Claude Code prompt**: "Remove the old counsel-mcp MCP registration and add the new council-mcp registration."

```bash
# Remove old
claude mcp remove counsel-mcp --scope user

# Register new
claude mcp add --scope user council-mcp -- node "C:/Users/russe/Documents/Council_of_models_mcp/dist/index.js"

# Verify
claude mcp list 2>&1 | grep -i council
# Expected: council-mcp: ... ✓ Connected
```

## PHASE 4 — VALIDATION GATE

```bash
# Build clean
npm run rebuild 2>&1 | tail -1
# Expected: no errors

# No "counsel" in compiled output
grep -c "counsel" dist/*.js dist/providers/*.js
# Expected: all zeros

# Smoke test passes
npm run smoke
# Expected: 2 passed, 0 failed

# MCP registered under new name
claude mcp list 2>&1 | grep "council-mcp"
# Expected: council-mcp: ... ✓ Connected

# Old registration gone
claude mcp list 2>&1 | grep "counsel-mcp" | grep -v "council"
# Expected: NO OUTPUT
```

**STOP AND REPORT**: Tell the user:
- "Phase 4 complete: build clean, smoke test passed, MCP re-registered as council-mcp."
- "Ready to proceed to Phase 5?"

---

# PHASE 5: Final Sweep and Git Push

## Context

One last sweep for any missed occurrences, then commit and push to the new repo.

## Step 5.1: Final sweep

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"

# Nuclear sweep — find ANY remaining "counsel" anywhere
grep -rin "counsel" . --include="*.ts" --include="*.json" --include="*.md" --include="*.example" | grep -v node_modules | grep -v dist | grep -v package-lock.json
# Expected: NO OUTPUT — absolutely zero occurrences
```

If any occurrences are found, fix them before proceeding.

## Step 5.2: Stage, commit, and push

```bash
git add -A

# Review
git status

# Verify no secrets
git diff --cached | grep -i "sk-" | grep -v "your-key" | grep -v "placeholder" | grep -v "example"
# Expected: no output

git commit -m "Initial commit: Council of Models MCP Server v1.0.0

MCP server exposing ask_openai, ask_gemini, ask_all tools for Claude Code.
Interactive CLI setup wizard via council-mcp-setup.
Generic /council and /refine templates in examples/claude-commands/.

Renamed from 'counsel' to 'council' — this is the canonical repo.
Old package (counsel-of-models-mcp) is deprecated in favor of this one."

git push -u origin master
```

## PHASE 5 — VALIDATION GATE

```bash
git log --oneline -1
# Expected: shows commit message

git remote -v
# Expected: Council_of_models_mcp.git

git status
# Expected: clean working tree
```

**STOP AND REPORT**: Tell the user:
- "Phase 5 complete: pushed to https://github.com/russellmoss/Council_of_models_mcp"
- "Ready to proceed to Phase 6 (npm publish)?"

---

# PHASE 6: Publish New npm Package and Deprecate Old

## Context

Publish `council-of-models-mcp` as a new package. Then deprecate `counsel-of-models-mcp` with a message pointing to the new one.

## Step 6.1: Verify package name is available

```bash
npm view council-of-models-mcp 2>&1 | head -1
# Expected: 404 (not found — name is available)
```

## Step 6.2: Publish

```bash
cd "C:/Users/russe/Documents/Council_of_models_mcp"

npm whoami
# Expected: mossrussell

npm publish
# Expected: + council-of-models-mcp@1.0.0
```

## Step 6.3: Verify the new package

```bash
npm view council-of-models-mcp version
# Expected: 1.0.0

npm view council-of-models-mcp bin
# Expected: { 'council-mcp': 'dist/index.js', 'council-mcp-setup': 'dist/setup.js' }
```

## Step 6.4: Deprecate the old package

```bash
npm deprecate counsel-of-models-mcp "Renamed to council-of-models-mcp. Install the new package: npm install -g council-of-models-mcp"
```

## PHASE 6 — VALIDATION GATE

```bash
# New package live
npm view council-of-models-mcp version
# Expected: 1.0.0

# Old package deprecated
npm view counsel-of-models-mcp 2>&1 | grep -i deprecat
# Expected: shows deprecation message
```

**STOP AND REPORT**: Tell the user:
- "Phase 6 complete."
- "`council-of-models-mcp@1.0.0` is live on npm."
- "`counsel-of-models-mcp` is deprecated with a redirect message."
- ""
- "**New install command:**"
- "```"
- "npm install -g council-of-models-mcp"
- "council-mcp-setup"
- "```"
- ""
- "**Don't forget to update your Dashboard project:**"
- "```"
- "cd C:\\Users\\russe\\Documents\\Dashboard"
- "rm -rf .claude/commands/"
- "mkdir -p .claude/commands"
- "cp C:\\Users\\russe\\Documents\\Council_of_models_mcp\\examples\\claude-commands\\council.md .claude/commands/council.md"
- "cp C:\\Users\\russe\\Documents\\Council_of_models_mcp\\examples\\claude-commands\\refine.md .claude/commands/refine.md"
- "```"
- "Then start a new Claude Code session."

---

# Troubleshooting

## "counsel-mcp" still shows in claude mcp list

The old registration wasn't removed. Run:
```bash
claude mcp remove counsel-mcp --scope user
```

## npm publish says "name already exists"

The name `council-of-models-mcp` was taken between checking and publishing. Check `npm view council-of-models-mcp` — if it's yours from a previous attempt, you're fine.

## grep still finds "counsel" somewhere

Check if it's in `node_modules/` or `dist/` (these are regenerated, not source). If it's in `package-lock.json`, that's fine — it references the old `counsel-of-models-mcp` dependency name which npm resolves automatically. Run `npm install` to regenerate.
