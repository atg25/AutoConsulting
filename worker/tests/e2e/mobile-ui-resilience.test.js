// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";

const appPath = path.resolve(process.cwd(), "../frontend/app.js");
const indexPath = path.resolve(process.cwd(), "../frontend/index.html");

async function loadUiWithMockedFetch(fetchImpl) {
  const html = await fs.readFile(indexPath, "utf8");
  const appScript = await fs.readFile(appPath, "utf8");
  document.documentElement.innerHTML = html;

  window.matchMedia =
    window.matchMedia ||
    function matchMedia(query) {
      return {
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      };
    };

  window.APP_CONFIG = { workerBaseUrl: "" };
  global.fetch = vi.fn(fetchImpl);
  window.eval(appScript);
}

function createDeferredResponse() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function waitUntil(assertion, timeoutMs = 1200, intervalMs = 20) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start >= timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mobile UI resilience", () => {
  it("shows clean conflict notification on 409 errors", async () => {
    await loadUiWithMockedFetch(async (url) => {
      if (String(url).includes("/health")) {
        return new Response(
          JSON.stringify({
            ok: true,
            service: "worker",
            now: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: "GitHub branch reference conflict; retry the operation.",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const promptInput = document.getElementById("promptInput");
    const chatForm = document.getElementById("chatForm");
    promptInput.value = "Ship update";
    chatForm.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    await waitUntil(() => {
      const transcript = document.getElementById("chatWrap")?.textContent || "";
      expect(transcript).toMatch(/network conflict, please retry/i);
      expect(transcript).not.toMatch(/gitHub branch reference conflict/i);
    });
  });

  it("shows clean retry notification on timeout errors", async () => {
    await loadUiWithMockedFetch(async (url) => {
      if (String(url).includes("/health")) {
        return new Response(
          JSON.stringify({
            ok: true,
            service: "worker",
            now: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: "GitHub API timeout; retry the operation." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const promptInput = document.getElementById("promptInput");
    const chatForm = document.getElementById("chatForm");
    promptInput.value = "Ship update";
    chatForm.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    await waitUntil(() => {
      const transcript = document.getElementById("chatWrap")?.textContent || "";
      expect(transcript).toMatch(/network conflict, please retry/i);
      expect(transcript).not.toMatch(/github api timeout/i);
    });
  });

  it("keeps clear Thinking and Pushing feedback during 15s+ waits", async () => {
    vi.useFakeTimers();
    const deferred = createDeferredResponse();

    await loadUiWithMockedFetch(async (url) => {
      if (String(url).includes("/health")) {
        return new Response(
          JSON.stringify({
            ok: true,
            service: "worker",
            now: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return deferred.promise;
    });

    const promptInput = document.getElementById("promptInput");
    const chatForm = document.getElementById("chatForm");
    const progress = document.getElementById("progressPills");
    const generating = document.getElementById("pillGenerating");
    const committing = document.getElementById("pillCommitting");

    promptInput.value = "Ship update";
    chatForm.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    expect(progress.classList.contains("hidden")).toBe(false);
    expect(generating.classList.contains("active")).toBe(true);
    expect(generating.textContent).toMatch(/thinking/i);
    expect(committing.textContent).toMatch(/pushing/i);

    await vi.advanceTimersByTimeAsync(16000);
    expect(committing.classList.contains("active")).toBe(true);

    deferred.resolve(
      new Response(
        JSON.stringify({
          ok: true,
          branch: "main",
          commitSha: "abc123",
          files: ["content.json"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await Promise.resolve();

    expect(progress.classList.contains("hidden")).toBe(true);
    const transcript = document.getElementById("chatWrap")?.textContent || "";
    expect(transcript).toMatch(/deployment committed/i);
  });
});
