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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mobile UI smoke", () => {
  it("renders online status when health check succeeds", async () => {
    vi.useFakeTimers();

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
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await Promise.resolve();
    expect(document.getElementById("statusText")?.textContent).toMatch(
      /online/i,
    );
    expect(
      document.getElementById("promptInput")?.getAttribute("maxlength"),
    ).toBe("4000");
  });

  it("renders offline status without crashing when health check fails", async () => {
    vi.useFakeTimers();

    await loadUiWithMockedFetch(async () => {
      throw new Error("network down");
    });

    await Promise.resolve();
    expect(document.getElementById("statusText")?.textContent).toMatch(
      /offline/i,
    );
    expect(document.getElementById("chatForm")).toBeTruthy();
  });
});
