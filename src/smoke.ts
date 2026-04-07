#!/usr/bin/env node

import "dotenv/config";
import { askOpenAI } from "./providers/openai.js";
import { askCodex, isCodexAvailable } from "./providers/codex.js";
import { askGemini } from "./providers/gemini.js";

const TEST_PROMPT = "Reply with exactly: OK";

async function smoke() {
  console.error("=== Council of Models — Smoke Test ===\n");

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Test OpenAI
  console.error("Testing OpenAI (API)...");
  try {
    const openaiResult = await askOpenAI(TEST_PROMPT);
    if (openaiResult.text) {
      console.error(`  ✅ OpenAI OK (model: ${openaiResult.model})`);
      console.error(`  Response: "${openaiResult.text.trim().substring(0, 50)}"`);
      passed++;
    } else {
      console.error(`  ❌ OpenAI returned empty response`);
      if (openaiResult.error) console.error(`  Error: ${openaiResult.error}`);
      failed++;
    }
  } catch (error) {
    console.error(
      `  ❌ OpenAI threw: ${error instanceof Error ? error.message : String(error)}`
    );
    failed++;
  }

  console.error("");

  // Test Codex CLI
  console.error("Testing Codex (CLI)...");
  const codexInstalled = await isCodexAvailable();
  if (!codexInstalled) {
    console.error("  ⏭️  Codex CLI not found on PATH — skipped");
    console.error("     Install with: npm i -g @openai/codex");
    console.error("     Then run: codex login");
    skipped++;
  } else {
    try {
      const codexResult = await askCodex(TEST_PROMPT);
      if (codexResult.text) {
        console.error(`  ✅ Codex OK (model: ${codexResult.model})`);
        console.error(`  Response: "${codexResult.text.trim().substring(0, 50)}"`);
        passed++;
      } else {
        console.error(`  ❌ Codex returned empty response`);
        if (codexResult.error) console.error(`  Error: ${codexResult.error}`);
        failed++;
      }
    } catch (error) {
      console.error(
        `  ❌ Codex threw: ${error instanceof Error ? error.message : String(error)}`
      );
      failed++;
    }
  }

  console.error("");

  // Test Gemini
  console.error("Testing Gemini (API)...");
  try {
    const geminiResult = await askGemini(TEST_PROMPT);
    if (geminiResult.text) {
      console.error(`  ✅ Gemini OK (model: ${geminiResult.model})`);
      console.error(`  Response: "${geminiResult.text.trim().substring(0, 50)}"`);
      passed++;
    } else {
      console.error(`  ❌ Gemini returned empty response`);
      if (geminiResult.error) console.error(`  Error: ${geminiResult.error}`);
      failed++;
    }
  } catch (error) {
    console.error(
      `  ❌ Gemini threw: ${error instanceof Error ? error.message : String(error)}`
    );
    failed++;
  }

  const parts = [`${passed} passed`, `${failed} failed`];
  if (skipped > 0) parts.push(`${skipped} skipped`);
  console.error(`\n=== Results: ${parts.join(", ")} ===`);

  if (failed > 0) {
    console.error(
      "\n⚠️  Fix the failing provider(s) before proceeding to MCP registration."
    );
    console.error("   Common fixes:");
    console.error("   - Check API key in .env or shell profile");
    console.error("   - For Codex: run `codex login` to authenticate");
    console.error("   - Verify model IDs in src/config.ts");
    console.error("   - Check provider status pages for outages");
    process.exit(1);
  }

  if (passed >= 2) {
    console.error("\n🎉 Multiple providers working. Safe to register with Claude Code.");
  } else if (passed === 1) {
    console.error("\n⚠️  Only one provider working. Council cross-validation needs at least two.");
  }
  process.exit(0);
}

smoke();
