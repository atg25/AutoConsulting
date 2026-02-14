import {
  mapGithubApiError,
  normalizeGithubFetchFailure,
  parseGeneratedPayload,
  sanitizePrompt,
} from "./foundation.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env),
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json(
        { ok: true, service: "worker", now: new Date().toISOString() },
        200,
        env,
      );
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return json({ error: "Not found" }, 404, env);
  },
};

async function handleChat(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, env);
    }

    let prompt;
    try {
      prompt = sanitizePrompt(
        body?.prompt,
        Number(env.MAX_PROMPT_CHARS || 4000),
      );
    } catch (error) {
      return json({ error: error.message || "Invalid prompt" }, 400, env);
    }

    const generated = await callLlmForCode(prompt, env);
    const filesToCommit = buildFileMap(generated, env);
    const commitMessage =
      generated.commitMessage || `chore: AI update ${new Date().toISOString()}`;

    const commitResult = await commitFilesToGithub({
      filesToCommit,
      commitMessage,
      env,
    });

    return json(
      {
        ok: true,
        branch: env.GITHUB_BRANCH || "main",
        commitSha: commitResult.commitSha,
        commitUrl: commitResult.commitUrl,
        files: Object.keys(filesToCommit),
      },
      200,
      env,
    );
  } catch (error) {
    return json({ error: error.message || "Internal error" }, 500, env);
  }
}

async function callLlmForCode(userPrompt, env) {
  const llmUrl =
    env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = env.LLM_MODEL || "gpt-4.1-mini";

  const systemPrompt = [
    "You are a Content Data Engineer.",
    "You are not a web designer and must never produce HTML, CSS, or JS.",
    "Return ONLY a strict JSON object for content.json (no markdown, no prose, no wrapper keys).",
    "Brand pillars to preserve in all wording: Efficiency, Transparency, Automation.",
    "If the user asks to update philosophy-related content, keep tone sophisticated, professional, and consistent with Minimal Art Deco Chic voice.",
    "Rules:",
    "- JSON must match this exact top-level structure:",
    "  personal_brand, services, portfolio_demos, social_proof, connect_links",
    "- personal_brand keys: hero_statement, about_me, core_values (array), work_philosophy",
    "- services is an array of objects with: service_name, description, client_value_add",
    "- portfolio_demos is an array with: project_title, problem_solved, demo_url, repo_url",
    "- social_proof has: google_reviews (array of { quote, stars })",
    "- connect_links keys: linkedin, github, facebook, instagram, scheduling_url",
    "- ZERO pricing, tier, or style data is allowed anywhere.",
    "- Do not add any keys outside this schema.",
    "- Do not include html, css, js, or any non-JSON content.",
  ].join("\n");

  const response = await fetch(llmUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `LLM request failed (${response.status})`,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM returned an empty response");
  }

  return parseGeneratedPayload(content);
}

function buildFileMap(generated, env) {
  return {
    "content.json": generated.contentJson,
  };
}

async function commitFilesToGithub({ filesToCommit, commitMessage, env }) {
  const owner = required(env.GITHUB_OWNER, "GITHUB_OWNER");
  const repo = required(env.GITHUB_REPO, "GITHUB_REPO");
  const branch = env.GITHUB_BRANCH || "main";
  const token = required(env.GITHUB_PAT, "GITHUB_PAT");

  const refData = await githubRequest(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    { method: "GET" },
    token,
  );
  const headSha = refData.object.sha;

  const headCommit = await githubRequest(
    `/repos/${owner}/${repo}/git/commits/${headSha}`,
    { method: "GET" },
    token,
  );
  const baseTreeSha = headCommit.tree.sha;

  const treeEntries = [];
  for (const [path, content] of Object.entries(filesToCommit)) {
    const blob = await githubRequest(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({
          content,
          encoding: "utf-8",
        }),
      },
      token,
    );

    treeEntries.push({
      path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const newTree = await githubRequest(
    `/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    },
    token,
  );

  const newCommit = await githubRequest(
    `/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: commitMessage,
        tree: newTree.sha,
        parents: [headSha],
      }),
    },
    token,
  );

  await githubRequest(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        sha: newCommit.sha,
        force: false,
      }),
    },
    token,
  );

  return {
    commitSha: newCommit.sha,
    commitUrl: newCommit.html_url || "",
  };
}

async function githubRequest(path, init, token) {
  let response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(normalizeGithubFetchFailure(error));
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = mapGithubApiError(response.status, payload);
    throw new Error(message);
  }
  return payload;
}

function required(value, key) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function json(payload, status, env) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env),
    },
  });
}
