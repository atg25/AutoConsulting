import { describe, expect, it } from "vitest";
import {
  extractJson,
  mapGithubApiError,
  parseGeneratedPayload,
  sanitizePrompt,
  validateHealthPayload,
} from "../../src/foundation.js";

describe("foundation unit tests", () => {
  it("accepts a valid health payload", () => {
    const isValid = validateHealthPayload({
      ok: true,
      service: "worker",
      now: new Date().toISOString(),
    });

    expect(isValid).toBe(true);
  });

  it("rejects malformed health payload", () => {
    expect(validateHealthPayload({ ok: true, service: "worker" })).toBe(false);
    expect(
      validateHealthPayload({ ok: "yes", service: "worker", now: "x" }),
    ).toBe(false);
  });

  it("trims valid prompt and preserves content", () => {
    expect(sanitizePrompt("   update hero copy   ")).toBe("update hero copy");
  });

  it("rejects empty or oversized prompts", () => {
    expect(() => sanitizePrompt("    ")).toThrow(/missing prompt/i);
    expect(() => sanitizePrompt("a".repeat(4001), 4000)).toThrow(/too long/i);
  });

  it("extracts JSON from markdown fence", () => {
    const raw = '```json\n{"contentJson":{"hero":{"title":"AI"}}}\n```';
    const extracted = extractJson(raw);

    expect(extracted.startsWith("{")).toBe(true);
  });

  it("parses generated payload for content.json contract", () => {
    const raw =
      '```json\n{"contentJson":{"personal_brand":{"hero_statement":"I don\'t maintain this website; my custom AI assistant does.","about_me":"Bio","core_values":["Integrity"],"work_philosophy":"Systems-first"},"services":[{"service_name":"AI Architecture","description":"Design resilient systems","client_value_add":"Reduces operational risk"}],"portfolio_demos":[{"project_title":"Demo","problem_solved":"Automated deployments","demo_url":"https://demo.example","repo_url":"https://github.com/org/repo"}],"social_proof":{"google_reviews":[{"quote":"Excellent","stars":5}]},"connect_links":{"linkedin":"https://linkedin.com/in/user","github":"https://github.com/user","facebook":"https://facebook.com/user","instagram":"https://instagram.com/user","scheduling_url":"https://cal.com/user"}},"commitMessage":"update portfolio content"}\n```';
    const parsed = parseGeneratedPayload(raw);

    expect(parsed.contentJson).toContain('"personal_brand"');
    expect(parsed.contentJson).toContain('"services"');
    expect(parsed.commitMessage).toBe("update portfolio content");
  });

  it("throws when generated payload is malformed", () => {
    expect(() => parseGeneratedPayload("not json")).toThrow(/strict json/i);
    expect(() =>
      parseGeneratedPayload('{"html":"<html></html>","css":"body{}"}'),
    ).toThrow(/must not contain html\/css\/js/i);
    expect(() => parseGeneratedPayload('{"contentJson":"not-json"}')).toThrow(
      /contentjson must be a valid json object or array/i,
    );
    expect(() =>
      parseGeneratedPayload('{"commitMessage":"no payload"}'),
    ).toThrow(/missing contentjson/i);
    expect(() =>
      parseGeneratedPayload(
        '{"contentJson":{"personal_brand":{"hero_statement":"x","about_me":"y","core_values":["z"],"work_philosophy":"w"},"services":[{"service_name":"s","description":"d","client_value_add":"v","price":"$100"}],"portfolio_demos":[],"social_proof":{"google_reviews":[]},"connect_links":{"linkedin":"l","github":"g","facebook":"f","instagram":"i","scheduling_url":"s"}}}',
      ),
    ).toThrow(/pricing or style\/tier data is not allowed/i);
    expect(() =>
      parseGeneratedPayload(
        '{"contentJson":{"personal_brand":{"hero_statement":"x","about_me":"y","core_values":["z"],"work_philosophy":"w"},"services":[],"portfolio_demos":[],"social_proof":{"google_reviews":[]},"connect_links":{"linkedin":"l","github":"g","facebook":"f","instagram":"i"}}}',
      ),
    ).toThrow(/scheduling_url/i);
  });

  it("rejects conversational fluff wrappers around JSON", () => {
    const raw = [
      "Here is your update:",
      JSON.stringify({
        personal_brand: {
          hero_statement: "AI runs this site.",
          about_me: "Bio",
          core_values: ["Trust"],
          work_philosophy: "Outcome first",
        },
        services: [
          {
            service_name: "AI Advisory",
            description: "Guidance",
            client_value_add: "Faster execution",
            whimsical_note: "should be removed",
          },
        ],
        portfolio_demos: [
          {
            project_title: "Ops Agent",
            problem_solved: "Release drift",
            demo_url: "https://demo.example",
            repo_url: "https://github.com/org/repo",
          },
        ],
        social_proof: { google_reviews: [{ quote: "Excellent", stars: 5 }] },
        connect_links: {
          linkedin: "https://linkedin.com/in/user",
          github: "https://github.com/user",
          facebook: "https://facebook.com/user",
          instagram: "https://instagram.com/user",
          scheduling_url: "https://cal.com/user",
        },
      }),
      "Let me know if you need anything else!",
    ].join("\n");

    expect(() => parseGeneratedPayload(raw)).toThrow(/strict json/i);
  });

  it("maps GitHub rate limit and timeout failures", () => {
    const rateLimited = mapGithubApiError(403, {
      message: "API rate limit exceeded",
    });
    const timedOut = mapGithubApiError(504, { message: "Gateway Timeout" });

    expect(rateLimited).toMatch(/rate limit/i);
    expect(timedOut).toMatch(/timeout/i);
  });
});
