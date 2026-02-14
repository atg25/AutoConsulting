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

const validGeneratedPayload =
  '{"contentJson":{"personal_brand":{"hero_statement":"I do not maintain this website manually.","about_me":"Bio","core_values":["Reliability"],"work_philosophy":"Outcome-first"},"services":[{"service_name":"AI Strategy","description":"Advisory","client_value_add":"Clear direction"}],"portfolio_demos":[{"project_title":"Ops Agent","problem_solved":"Release bottlenecks","demo_url":"https://demo.example","repo_url":"https://github.com/org/repo"}],"social_proof":{"google_reviews":[{"quote":"Great partner","stars":5}]},"connect_links":{"linkedin":"https://linkedin.com/in/user","github":"https://github.com/user","facebook":"https://facebook.com/user","instagram":"https://instagram.com/user","scheduling_url":"https://cal.com/user"}},"commitMessage":"update content"}';

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GitHub commit pipeline", () => {
  it("executes git database REST sequence in order on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [{ message: { content: validGeneratedPayload } }],
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
      body: JSON.stringify({ prompt: "Update portfolio" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls.slice(1, 7)).toEqual([
      "https://api.github.com/repos/owner/repo/git/ref/heads/main",
      "https://api.github.com/repos/owner/repo/git/commits/headsha",
      "https://api.github.com/repos/owner/repo/git/blobs",
      "https://api.github.com/repos/owner/repo/git/trees",
      "https://api.github.com/repos/owner/repo/git/commits",
      "https://api.github.com/repos/owner/repo/git/refs/heads/main",
    ]);
  });

  it("returns controlled auth error on 401 unauthorized", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [{ message: { content: validGeneratedPayload } }],
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ message: "Bad credentials" }, 401),
      );

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Update portfolio" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/authorization failed/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns controlled conflict error on 409 ref update conflict", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [{ message: { content: validGeneratedPayload } }],
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
      .mockResolvedValueOnce(
        makeJsonResponse({ message: "Update is not a fast forward" }, 409),
      );

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Update portfolio" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/conflict/i);
  });

  it("returns timeout error when GitHub API hangs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          choices: [{ message: { content: validGeneratedPayload } }],
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse({ object: { sha: "headsha" } }))
      .mockRejectedValueOnce(new Error("network timeout while calling github"));

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.local/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Update portfolio" }),
    });

    const response = await worker.fetch(request, baseEnv);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/github api timeout/i);
  });
});
