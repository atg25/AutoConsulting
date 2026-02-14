import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { validateHealthPayload } from "../../src/foundation.js";

function createMiniflare() {
  return new Miniflare({
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
    scriptPath: new URL("../../src/index.js", import.meta.url).pathname,
    compatibilityDate: "2025-12-01",
  });
}

describe("worker route integration", () => {
  it("GET /health returns expected shape", async () => {
    const mf = createMiniflare();
    const response = await mf.dispatchFetch("http://localhost/health");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(validateHealthPayload(payload)).toBe(true);
  });

  it("returns 404 for unknown route", async () => {
    const mf = createMiniflare();
    const response = await mf.dispatchFetch("http://localhost/nope");
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toMatch(/not found/i);
  });

  it("returns 400 for malformed /chat JSON", async () => {
    const mf = createMiniflare();
    const response = await mf.dispatchFetch("http://localhost/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/invalid json/i);
  });

  it("returns 400 for empty prompt", async () => {
    const mf = createMiniflare();
    const response = await mf.dispatchFetch("http://localhost/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   " }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/missing prompt/i);
  });
});
