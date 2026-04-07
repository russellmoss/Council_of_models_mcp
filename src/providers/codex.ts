import { execFile } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink } from "fs/promises";
import { randomBytes } from "crypto";
import { CODEX_CONFIG, resolveModel } from "../config.js";
import type { ProviderResponse } from "./types.js";

/** Timeout for Codex CLI calls (5 minutes) */
const CODEX_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * On Windows, npm global bins are .cmd shims that require a shell to execute.
 * On Unix, `codex` is a plain executable that execFile can invoke directly.
 */
const IS_WINDOWS = process.platform === "win32";
const CODEX_CMD = "codex";

/**
 * Check whether the `codex` CLI is reachable.
 * Exported so smoke.ts and setup.ts can call it.
 */
export async function isCodexAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(CODEX_CMD, ["--version"], {
      timeout: 5000,
      shell: IS_WINDOWS,  // .cmd shims need a shell on Windows
    }, (err) => {
      resolve(!err);
    });
  });
}

export async function askCodex(
  prompt: string,
  systemPrompt?: string,
  requestedModel?: string,
): Promise<ProviderResponse> {
  const model = resolveModel(CODEX_CONFIG, requestedModel);

  // Codex exec doesn't have a separate system-prompt flag,
  // so we prepend it to the user prompt when provided.
  const fullPrompt = systemPrompt
    ? `[System Instructions]\n${systemPrompt}\n\n[User Prompt]\n${prompt}`
    : prompt;

  const outputFile = join(
    tmpdir(),
    `codex-council-${randomBytes(8).toString("hex")}.txt`
  );

  try {
    await runCodex(fullPrompt, model.id, outputFile);
    const text = (await readFile(outputFile, "utf-8")).trim();

    await cleanupTempFile(outputFile);

    if (!text) {
      throw new Error("Empty response from Codex CLI");
    }

    return {
      text,
      model: model.id,
      provider: "codex",
      usedFallback: false,
    };
  } catch (error) {
    await cleanupTempFile(outputFile);

    // Try fallback model if it's a different model
    if (model.id !== CODEX_CONFIG.fallback.id) {
      console.error(
        `[council-mcp] Codex ${model.id} failed, trying fallback ${CODEX_CONFIG.fallback.id}:`,
        error instanceof Error ? error.message : error
      );

      const fallbackOutput = join(
        tmpdir(),
        `codex-council-fb-${randomBytes(8).toString("hex")}.txt`
      );

      try {
        await runCodex(fullPrompt, CODEX_CONFIG.fallback.id, fallbackOutput);
        const text = (await readFile(fallbackOutput, "utf-8")).trim();
        await cleanupTempFile(fallbackOutput);

        if (!text) {
          throw new Error("Empty response from Codex CLI fallback");
        }

        return {
          text,
          model: CODEX_CONFIG.fallback.id,
          provider: "codex",
          usedFallback: true,
          error: `Primary model ${model.id} failed, used fallback ${CODEX_CONFIG.fallback.id}`,
        };
      } catch (fallbackError) {
        await cleanupTempFile(fallbackOutput);
        return {
          text: "",
          model: CODEX_CONFIG.fallback.id,
          provider: "codex",
          usedFallback: true,
          error: `Both ${model.id} and fallback ${CODEX_CONFIG.fallback.id} failed: ${
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError)
          }`,
        };
      }
    }

    return {
      text: "",
      model: model.id,
      provider: "codex",
      usedFallback: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Remove a temp file, logging (not throwing) on failure. */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err) {
    // ENOENT is fine — file was already removed or never created
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[council-mcp] Warning: failed to clean up ${filePath}:`, err);
    }
  }
}

/**
 * Spawn `codex exec` and pipe the prompt via stdin.
 *
 * Security: The user-supplied prompt is delivered exclusively via stdin,
 * never as a command-line argument. All args are hardcoded strings controlled
 * by this module. On Windows, shell:true is required because npm global
 * binaries are .cmd shims, but shell injection risk is mitigated because
 * no user input flows into the args array.
 *
 * On Unix, shell is not used — execFile invokes codex directly.
 */
function runCodex(
  prompt: string,
  model: string,
  outputFile: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "exec",
      "-m",
      model,
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--skip-git-repo-check",
      "-o",
      outputFile,
      "-",  // read prompt from stdin
    ];

    const child = execFile(CODEX_CMD, args, {
      timeout: CODEX_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10 MB — codex can be chatty on stderr
      shell: IS_WINDOWS,  // .cmd shims need a shell on Windows; Unix does not
    }, (error, _stdout, stderr) => {
      if (error) {
        const stderrTail = stderr.trim().split("\n").slice(-10).join("\n");
        reject(
          new Error(
            `Codex CLI failed (code ${error.code ?? "?"}): ${stderrTail || error.message}`
          )
        );
      } else {
        resolve();
      }
    });

    // Pipe the prompt into codex's stdin — never passes through the shell
    child.stdin!.write(prompt);
    child.stdin!.end();
  });
}
