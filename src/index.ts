#!/usr/bin/env node

// Load .env FIRST — before any provider code runs
import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { askOpenAI, askCodex, askGemini } from "./providers/index.js";
import { OPENAI_CONFIG, CODEX_CONFIG, GEMINI_CONFIG } from "./config.js";

const server = new McpServer({
  name: "council-of-models",
  version: "2.0.0",
});

// --- Tool: ask_openai ---
server.tool(
  "ask_openai",
  `Send a prompt to OpenAI via API (requires OPENAI_API_KEY). Default model: ${OPENAI_CONFIG.default.id} (${OPENAI_CONFIG.default.description}). Available models: ${OPENAI_CONFIG.available.map((m) => m.id).join(", ")}`,
  {
    prompt: z.string().describe("The prompt to send to OpenAI"),
    system_prompt: z
      .string()
      .optional()
      .describe("Optional system prompt to set the context/role for the model"),
    model: z
      .string()
      .optional()
      .describe(
        `Model to use. Defaults to ${OPENAI_CONFIG.default.id}. Options: ${OPENAI_CONFIG.available.map((m) => m.id).join(", ")}`
      ),
    reasoning_effort: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe(
        'Controls how much reasoning effort the model spends. "high" = more thorough but slower/costlier.'
      ),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async ({ prompt, system_prompt, model, reasoning_effort }) => {
    const response = await askOpenAI(prompt, system_prompt, model, reasoning_effort);

    if (response.error && !response.text) {
      return {
        content: [
          {
            type: "text" as const,
            text: `ERROR from OpenAI (${response.model}): ${response.error}`,
          },
        ],
        isError: true,
      };
    }

    let header = `**OpenAI Response** (model: ${response.model})`;
    if (response.usedFallback) {
      header += `\n⚠️ Used fallback model: ${response.error}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n\n---\n\n${response.text}`,
        },
      ],
    };
  }
);

// --- Tool: ask_codex ---
server.tool(
  "ask_codex",
  `Send a prompt to OpenAI via the locally-installed Codex CLI (no API key needed — uses codex login). Default model: ${CODEX_CONFIG.default.id} (${CODEX_CONFIG.default.description}). Available models: ${CODEX_CONFIG.available.map((m) => m.id).join(", ")}`,
  {
    prompt: z.string().describe("The prompt to send to Codex CLI"),
    system_prompt: z
      .string()
      .optional()
      .describe("Optional system prompt to set the context/role for the model"),
    model: z
      .string()
      .optional()
      .describe(
        `Model to use. Defaults to ${CODEX_CONFIG.default.id}. Options: ${CODEX_CONFIG.available.map((m) => m.id).join(", ")}`
      ),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async ({ prompt, system_prompt, model }) => {
    const response = await askCodex(prompt, system_prompt, model);

    if (response.error && !response.text) {
      return {
        content: [
          {
            type: "text" as const,
            text: `ERROR from Codex (${response.model}): ${response.error}`,
          },
        ],
        isError: true,
      };
    }

    let header = `**Codex Response** (model: ${response.model})`;
    if (response.usedFallback) {
      header += `\n⚠️ Used fallback model: ${response.error}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n\n---\n\n${response.text}`,
        },
      ],
    };
  }
);

// --- Tool: ask_gemini ---
server.tool(
  "ask_gemini",
  `Send a prompt to Google Gemini and get a response. Default model: ${GEMINI_CONFIG.default.id} (${GEMINI_CONFIG.default.description}). Thinking is enabled at "high" level by default. Available models: ${GEMINI_CONFIG.available.map((m) => m.id).join(", ")}`,
  {
    prompt: z.string().describe("The prompt to send to Gemini"),
    system_prompt: z
      .string()
      .optional()
      .describe("Optional system prompt to set the context/role for the model"),
    model: z
      .string()
      .optional()
      .describe(
        `Model to use. Defaults to ${GEMINI_CONFIG.default.id}. Options: ${GEMINI_CONFIG.available.map((m) => m.id).join(", ")}`
      ),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async ({ prompt, system_prompt, model }) => {
    const response = await askGemini(prompt, system_prompt, model);

    if (response.error && !response.text) {
      return {
        content: [
          {
            type: "text" as const,
            text: `ERROR from Gemini (${response.model}): ${response.error}`,
          },
        ],
        isError: true,
      };
    }

    let header = `**Gemini Response** (model: ${response.model})`;
    if (response.usedFallback) {
      header += `\n⚠️ Used fallback model: ${response.error}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n\n---\n\n${response.text}`,
        },
      ],
    };
  }
);

// --- Tool: ask_all ---
server.tool(
  "ask_all",
  `Send the same prompt to TWO providers in parallel and compare responses. Use mode "codex" (default) for Codex CLI + Gemini — no OpenAI API costs. Use mode "openai" for OpenAI API + Gemini. If one provider fails, the other's response is still returned. Ideal for the /council workflow.`,
  {
    prompt: z.string().describe("The prompt to send to both providers"),
    system_prompt: z
      .string()
      .optional()
      .describe("Optional system prompt applied to both providers"),
    mode: z
      .enum(["codex", "openai"])
      .optional()
      .describe(
        'Which provider to pair with Gemini. "codex" (default) = local Codex CLI, free. "openai" = OpenAI API, requires API key.'
      ),
    openai_model: z
      .string()
      .optional()
      .describe(`OpenAI API model override (only used in "openai" mode). Default: ${OPENAI_CONFIG.default.id}`),
    codex_model: z
      .string()
      .optional()
      .describe(`Codex CLI model override (only used in "codex" mode). Default: ${CODEX_CONFIG.default.id}`),
    gemini_model: z
      .string()
      .optional()
      .describe(`Gemini model override. Default: ${GEMINI_CONFIG.default.id}`),
    openai_reasoning_effort: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe('OpenAI reasoning effort (only used in "openai" mode).'),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async ({ prompt, system_prompt, mode, openai_model, codex_model, gemini_model, openai_reasoning_effort }) => {
    const useCodex = (mode ?? "codex") === "codex";

    // Build the non-Gemini provider call
    const otherProviderPromise = useCodex
      ? askCodex(prompt, system_prompt, codex_model)
      : askOpenAI(prompt, system_prompt, openai_model, openai_reasoning_effort);

    const otherLabel = useCodex ? "Codex" : "OpenAI";

    const [otherResult, geminiResult] = await Promise.allSettled([
      otherProviderPromise,
      askGemini(prompt, system_prompt, gemini_model),
    ]);

    // Detect individual failures
    const otherFailed =
      otherResult.status === "rejected" ||
      (otherResult.status === "fulfilled" &&
        !!otherResult.value.error &&
        !otherResult.value.text);

    const geminiFailed =
      geminiResult.status === "rejected" ||
      (geminiResult.status === "fulfilled" &&
        !!geminiResult.value.error &&
        !geminiResult.value.text);

    // If BOTH failed, return MCP error
    if (otherFailed && geminiFailed) {
      const otherError =
        otherResult.status === "fulfilled"
          ? otherResult.value.error
          : String(otherResult.reason);
      const geminiError =
        geminiResult.status === "fulfilled"
          ? geminiResult.value.error
          : String(geminiResult.reason);

      return {
        content: [
          {
            type: "text" as const,
            text: `Both providers failed.\n\n${otherLabel}: ${otherError}\n\nGemini: ${geminiError}`,
          },
        ],
        isError: true,
      };
    }

    // Build response sections
    const sections: string[] = [];

    // Non-Gemini provider section
    if (otherResult.status === "fulfilled") {
      const r = otherResult.value;
      let header = `## ${otherLabel} Response (model: ${r.model})`;
      if (r.usedFallback) header += `\n⚠️ ${r.error}`;
      if (r.error && !r.text) header += `\n❌ ${r.error}`;
      sections.push(`${header}\n\n${r.text || "No response"}`);
    } else {
      sections.push(
        `## ${otherLabel} Response\n\n❌ FAILED: ${otherResult.reason}`
      );
    }

    // Gemini section
    if (geminiResult.status === "fulfilled") {
      const r = geminiResult.value;
      let header = `## Gemini Response (model: ${r.model})`;
      if (r.usedFallback) header += `\n⚠️ ${r.error}`;
      if (r.error && !r.text) header += `\n❌ ${r.error}`;
      sections.push(`${header}\n\n${r.text || "No response"}`);
    } else {
      sections.push(
        `## Gemini Response\n\n❌ FAILED: ${geminiResult.reason}`
      );
    }

    const modeLabel = useCodex ? "Codex CLI + Gemini" : "OpenAI API + Gemini";

    return {
      content: [
        {
          type: "text" as const,
          text: `# Council of Models — Parallel Response (${modeLabel})\n\n${sections.join("\n\n---\n\n")}`,
        },
      ],
    };
  }
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // IMPORTANT: console.error only — stdout is reserved for MCP JSON-RPC
  console.error("[council-mcp] Server running on stdio (OpenAI API + Codex CLI + Gemini API)");
}

main().catch((error) => {
  console.error("[council-mcp] Fatal error:", error);
  process.exit(1);
});
