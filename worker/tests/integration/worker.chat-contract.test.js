import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../src/index.js";

const baseEnv = {
  GITHUB_OWNER: "owner",
  GITHUB_REPO: "repo",
  GITHUB_PAT: "token",
  GITHUB_BRANCH: "main",
  LLM_API_KEY: "llm-key",
  LLM_API_URL: "https://llm.example/v1/chat/completions",
};

function makeJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/chat contract integration", () => {
  it("accepts valid contentJson payload and commits content.json only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [
            {
              message: {
                content:
                  '{"contentJson":{"personal_brand":{"hero_statement":"I do not maintain this website manually.","about_me":"Bio","core_values":["Reliability"],"work_philosophy":"Outcome-first"},"services":[{"service_name":"AI Strategy","description":"Advisory","client_value_add":"Clear direction"}],"portfolio_demos":[{"project_title":"Ops Agent","problem_solved":"Release bottlenecks","demo_url":"https://demo.example","repo_url":"https://github.com/org/repo"}],"social_proof":{"google_reviews":[{"quote":"Great partner","stars":5}]},"connect_links":{"linkedin":"https://linkedin.com/in/user","github":"https://github.com/user","facebook":"https://facebook.com/user","instagram":"https://instagram.com/user","scheduling_url":"https://cal.com/user"}},"commitMessage":"update content"}',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ object: { sha: "headsha" } }))
      .mockResolvedValueOnce(makeJsonResponse({ tree: { sha: "basetree" } }))
      .mockResolvedValueOnce(makeJsonResponse({ sha: "blobsha" }))
      .mockResolvedValueOnce(makeJsonResponse({ sha: "newtree" }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          sha: "commitsha",
          html_url: "https://github.com/commit/commitsha",
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ ref: "refs/heads/main" }));

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Update hero section" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.files).toEqual(["content.json"]);

    const blobCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/git/blobs"),
    );
    expect(blobCall).toBeTruthy();
    const blobBody = JSON.parse(blobCall[1].body);
    expect(() => JSON.parse(blobBody.content)).not.toThrow();
  });

  it("rejects html/css/js style payload attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        choices: [
          {
            message: {
              content:
                '{"html":"<html></html>","css":"body{}","js":"console.log(1)"}',
            },
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Modify HTML" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/must not contain html\/css\/js/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects pricing injection and does not attempt GitHub commit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        choices: [
          {
            message: {
              content:
                '{"contentJson":{"personal_brand":{"hero_statement":"x","about_me":"y","core_values":["z"],"work_philosophy":"w"},"services":[{"service_name":"AI","description":"d","client_value_add":"v","tier":"gold"}],"portfolio_demos":[],"social_proof":{"google_reviews":[]},"connect_links":{"linkedin":"l","github":"g","facebook":"f","instagram":"i","scheduling_url":"s"}}}',
            },
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Add premium pricing tier" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(
      /pricing or style\/tier data is not allowed/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown schema keys and does not attempt GitHub commit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [
            {
              message: {
                content:
                  '{"contentJson":{"personal_brand":{"hero_statement":"x","about_me":"y","core_values":["z"],"work_philosophy":"w"},"services":[{"service_name":"svc","description":"desc","client_value_add":"val","extra":"dropme"}],"portfolio_demos":[{"project_title":"p","problem_solved":"ps","demo_url":"d","repo_url":"r"}],"social_proof":{"google_reviews":[{"quote":"q","stars":5}]},"connect_links":{"linkedin":"l","github":"g","facebook":"f","instagram":"i","scheduling_url":"s"},"bonus_section":{"x":1}}}',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ object: { sha: "headsha" } }))
      .mockResolvedValueOnce(makeJsonResponse({ tree: { sha: "basetree" } }))
      .mockResolvedValueOnce(makeJsonResponse({ sha: "blobsha" }))
      .mockResolvedValueOnce(makeJsonResponse({ sha: "newtree" }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          sha: "commitsha",
          html_url: "https://github.com/commit/commitsha",
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ ref: "refs/heads/main" }));

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Add a surprise bonus section" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const blobCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/git/blobs"),
    );
    expect(blobCall).toBeTruthy();
    const blobBody = JSON.parse(blobCall[1].body);
    const committed = JSON.parse(blobBody.content);
    expect(committed.bonus_section).toBeUndefined();
    expect(committed.services[0].extra).toBeUndefined();
  });

  it("rejects conversational wrappers around JSON output", async () => {
    const conversationalResponse = [
      "Here is your update:",
      JSON.stringify({
        personal_brand: {
          hero_statement: "AI runs this site.",
          about_me: "Bio",
          core_values: ["Trust"],
          work_philosophy: "Outcome-first",
        },
        services: [
          {
            service_name: "AI Advisory",
            description: "Guidance",
            client_value_add: "Faster execution",
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
      "Let me know if you want revisions.",
    ].join("\n");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [{ message: { content: conversationalResponse } }],
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ object: { sha: "headsha" } }))
      .mockResolvedValueOnce(makeJsonResponse({ tree: { sha: "basetree" } }))
      .mockResolvedValueOnce(makeJsonResponse({ sha: "blobsha" }))
      .mockResolvedValueOnce(makeJsonResponse({ sha: "newtree" }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          sha: "commitsha",
          html_url: "https://github.com/commit/commitsha",
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ ref: "refs/heads/main" }));

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Refresh brand copy" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/strict json/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps LLM timeout failures to controlled error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("The operation timed out")),
    );

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Update content" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/timed out/i);
  });
});
