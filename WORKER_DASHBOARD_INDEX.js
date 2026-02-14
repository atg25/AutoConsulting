const GITHUB_OWNER = "atg25";
const GITHUB_REPO = "ai-consulting-portfolio";
const GITHUB_BRANCH = "main";
const SETUP_MARKER_PATH = ".ai-setup-complete.json";
const DEFAULT_MAX_PROMPT_CHARS = 4000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json(
          { ok: true, service: "worker", now: new Date().toISOString() },
          200,
          env,
        );
      }

      if (url.pathname === "/setup" && request.method === "POST") {
        return await handleSetup(request, env);
      }

      if (url.pathname === "/chat" && request.method === "POST") {
        return await handleChat(request, env);
      }

      return json({ error: "Not found" }, 404, env);
    } catch (error) {
      return handleError(error, env);
    }
  },
};

async function handleSetup(request, env) {
  const setupKey = required(env.SETUP_KEY, "SETUP_KEY");
  const provided =
    request.headers.get("x-setup-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!provided || provided !== setupKey) {
    throw new AppError("Setup authorization failed.", 401);
  }

  const token = required(env.GITHUB_PAT, "GITHUB_PAT");

  const marker = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(SETUP_MARKER_PATH)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
    { method: "GET" },
    token,
    { allow404: true },
  );

  if (marker) {
    return json(
      {
        ok: true,
        message: "Setup already completed. No changes applied.",
        repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch: GITHUB_BRANCH,
      },
      200,
      env,
    );
  }

  const initialFiles = buildInitialFiles();
  initialFiles[SETUP_MARKER_PATH] = JSON.stringify(
    {
      setup_complete: true,
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      branch: GITHUB_BRANCH,
      initialized_at: new Date().toISOString(),
      mode: "minimal-modern",
    },
    null,
    2,
  );

  const commitResult = await commitFilesToGithub({
    filesToCommit: initialFiles,
    commitMessage: "chore: bootstrap minimal modern portfolio",
    env,
  });

  return json(
    {
      ok: true,
      setup: "completed",
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      branch: GITHUB_BRANCH,
      commitSha: commitResult.commitSha,
      commitUrl: commitResult.commitUrl,
      files: Object.keys(initialFiles),
    },
    200,
    env,
  );
}

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new AppError("Invalid JSON body.", 400);
  }

  const prompt = sanitizePrompt(
    body?.prompt,
    Number(env.MAX_PROMPT_CHARS || DEFAULT_MAX_PROMPT_CHARS),
  );

  const generated = await callLlmForContent(prompt, env);
  const commitMessage =
    generated.commitMessage ||
    `chore: AI content update ${new Date().toISOString()}`;

  const commitResult = await commitFilesToGithub({
    filesToCommit: {
      "content.json": generated.contentJson,
    },
    commitMessage,
    env,
  });

  return json(
    {
      ok: true,
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      branch: GITHUB_BRANCH,
      commitSha: commitResult.commitSha,
      commitUrl: commitResult.commitUrl,
      files: ["content.json"],
    },
    200,
    env,
  );
}

function buildInitialFiles() {
  return {
    "index.html": `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>AI Consulting Portfolio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="./styles.css" />
    <script defer src="./script.js"></script>
  </head>
  <body>
    <main class="portfolio-shell">
      <section class="hero deco-card">
        <h1 id="heroStatement" class="hero-title"></h1>
        <p id="aboutMe" class="hero-about"></p>
        <p id="workPhilosophy" class="hero-philosophy"></p>
        <ul id="coreValues" class="core-values" aria-label="Core values"></ul>
      </section>

      <section class="services deco-card">
        <div class="section-head"><h2>Services</h2></div>
        <div id="servicesList" class="card-grid"></div>
      </section>

      <section class="demos deco-card">
        <div class="section-head"><h2>Portfolio Demos</h2></div>
        <div id="demosList" class="card-grid"></div>
      </section>

      <section class="proof deco-card">
        <div class="section-head"><h2>Social Proof</h2></div>
        <div id="reviewsList" class="card-grid"></div>
      </section>

      <section class="connect deco-card">
        <div class="section-head"><h2>Connect</h2></div>
        <div id="connectLinks" class="links"></div>
        <a id="bookConsultationBtn" class="book-btn" href="#" role="button">Book a Consultation</a>
      </section>

      <footer class="site-footer deco-card">
        <p class="ai-tagline">This site is autonomously maintained by an AI Assistant. Change happens in seconds, not days.</p>
      </footer>

      <p id="portfolioError" class="error-text hidden" role="alert"></p>
    </main>
  </body>
</html>`,
    "styles.css": `:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --text: #1a1a1a;
  --muted: #4b5563;
  --line: #e5e7eb;
  --link: #1d4ed8;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Helvetica,
    Arial,
    sans-serif;
}

.portfolio-shell {
  width: min(920px, 100% - 2.5rem);
  margin: 0 auto;
  padding: 2rem 0 3rem;
  display: grid;
  gap: 1.5rem;
}

.deco-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  padding: 1.35rem;
}

.section-head {
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--line);
}

h1,
h2,
h3 {
  margin: 0;
  font-family: Georgia, "Times New Roman", Times, serif;
  font-style: italic;
  font-weight: 600;
  color: var(--text);
}

h1 {
  font-size: clamp(1.8rem, 4vw, 2.35rem);
  line-height: 1.2;
}

h2 {
  font-size: clamp(1.2rem, 2.3vw, 1.45rem);
  line-height: 1.3;
}

h3 {
  font-size: 1.08rem;
  line-height: 1.35;
}

p,
li,
a {
  font-size: 1rem;
  line-height: 1.65;
}

.hero-about,
.hero-philosophy {
  margin: 0.75rem 0 0;
  color: var(--muted);
}

.core-values {
  margin: 1rem 0 0;
  padding-left: 1.2rem;
}

.core-values li {
  color: var(--text);
  margin-bottom: 0.2rem;
}

.card-grid {
  display: grid;
  gap: 0.85rem;
}

.card-item {
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  background: var(--surface);
  padding: 0.9rem 1rem;
}

.card-item h3 {
  margin-bottom: 0.4rem;
}

.card-item p {
  margin: 0.35rem 0;
  color: var(--muted);
}

.inline-links {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.55rem;
  flex-wrap: wrap;
}

a {
  color: var(--link);
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}

a:hover {
  text-decoration-thickness: 2px;
}

.links {
  display: grid;
  gap: 0.4rem;
}

.book-btn {
  display: inline-block;
  margin-top: 1rem;
  border: 1px solid var(--text);
  background: var(--text);
  color: #ffffff;
  border-radius: 0.45rem;
  padding: 0.62rem 0.98rem;
  font-weight: 600;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.book-btn:hover {
  background: #ffffff;
  color: var(--text);
  text-decoration: none;
}

.site-footer {
  border-top: 1px solid var(--line);
}

.ai-tagline {
  margin: 0;
  text-align: center;
  color: var(--text);
  font-weight: 500;
}

.error-text {
  color: #b91c1c;
  margin: 0;
}

.hidden {
  display: none;
}`,
    "script.js": `const byId = (id) => document.getElementById(id);

function text(el, value) {
  if (el) el.textContent = value || "";
}

function createCard(title, lines = [], links = []) {
  const article = document.createElement("article");
  article.className = "card-item";

  const heading = document.createElement("h3");
  heading.textContent = title || "";
  article.appendChild(heading);

  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    article.appendChild(p);
  }

  if (links.length) {
    const wrap = document.createElement("div");
    wrap.className = "inline-links";
    for (const item of links) {
      const anchor = document.createElement("a");
      anchor.href = item.href;
      anchor.textContent = item.label;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      wrap.appendChild(anchor);
    }
    article.appendChild(wrap);
  }

  return article;
}

function renderPortfolio(data) {
  text(byId("heroStatement"), data.personal_brand.hero_statement);
  text(byId("aboutMe"), data.personal_brand.about_me);
  text(byId("workPhilosophy"), data.personal_brand.work_philosophy);

  const coreValues = byId("coreValues");
  coreValues.innerHTML = "";
  for (const value of data.personal_brand.core_values) {
    const li = document.createElement("li");
    li.textContent = value;
    coreValues.appendChild(li);
  }

  const servicesList = byId("servicesList");
  servicesList.innerHTML = "";
  for (const service of data.services) {
    servicesList.appendChild(
      createCard(service.service_name, [service.description, service.client_value_add]),
    );
  }

  const demosList = byId("demosList");
  demosList.innerHTML = "";
  for (const demo of data.portfolio_demos) {
    demosList.appendChild(
      createCard(
        demo.project_title,
        [demo.problem_solved],
        [
          { label: "Demo", href: demo.demo_url },
          { label: "Repository", href: demo.repo_url },
        ],
      ),
    );
  }

  const reviewsList = byId("reviewsList");
  reviewsList.innerHTML = "";
  for (const review of data.social_proof.google_reviews) {
    reviewsList.appendChild(createCard(String(review.stars) + "★", [review.quote]));
  }

  const connectLinks = byId("connectLinks");
  connectLinks.innerHTML = "";
  const linkEntries = [
    ["LinkedIn", data.connect_links.linkedin],
    ["GitHub", data.connect_links.github],
    ["Facebook", data.connect_links.facebook],
    ["Instagram", data.connect_links.instagram],
  ];

  for (const [label, href] of linkEntries) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    connectLinks.appendChild(anchor);
  }

  const bookButton = byId("bookConsultationBtn");
  bookButton.setAttribute("href", data.connect_links.scheduling_url);
}

async function boot() {
  const errorEl = byId("portfolioError");
  try {
    const response = await fetch("./content.json", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error("Load failed (" + response.status + ")");

    const data = await response.json();
    renderPortfolio(data);
  } catch {
    errorEl.classList.remove("hidden");
    errorEl.textContent = "Unable to load portfolio content.";
  }
}

boot();`,
    "content.json": `{
  "personal_brand": {
    "hero_statement": "I don't maintain this website; my custom AI assistant does.",
    "about_me": "I architect practical AI systems for service businesses that value operational excellence.",
    "core_values": ["Efficiency", "Transparency", "Automation"],
    "work_philosophy": "Sophisticated systems should remove friction, clarify decisions, and create reliable outcomes without unnecessary complexity."
  },
  "services": [
    {
      "service_name": "AI Workflow Architecture",
      "description": "Designs reliable automations across lead capture, delivery operations, and reporting.",
      "client_value_add": "Reduces manual overhead while improving consistency and visibility."
    }
  ],
  "portfolio_demos": [
    {
      "project_title": "Pure Home Inspections",
      "problem_solved": "Manual lead follow-up and post-inspection communication caused inconsistent client response times.",
      "demo_url": "https://example.com/pure-home-inspections",
      "repo_url": "https://github.com/example/pure-home-inspections"
    },
    {
      "project_title": "NextGen Wallcovering",
      "problem_solved": "Scheduling and estimate workflows lacked transparency, creating delivery delays and status confusion.",
      "demo_url": "https://example.com/nextgen-wallcovering",
      "repo_url": "https://github.com/example/nextgen-wallcovering"
    },
    {
      "project_title": "AInspire",
      "problem_solved": "Content and campaign operations were fragmented, limiting repeatable growth execution.",
      "demo_url": "https://example.com/ainspire",
      "repo_url": "https://github.com/example/ainspire"
    }
  ],
  "social_proof": {
    "google_reviews": [
      {
        "quote": "Client Name — Andrew’s automation transformed our workflow from reactive handoffs to reliable execution in under two weeks.",
        "stars": 5
      },
      {
        "quote": "Client Name — We gained total transparency across delivery and communication, and our team finally stopped chasing status updates.",
        "stars": 5
      },
      {
        "quote": "Client Name — The system Andrew designed gave us measurable efficiency gains while preserving the premium client experience.",
        "stars": 5
      }
    ]
  },
  "connect_links": {
    "linkedin": "https://linkedin.com/in/andrew",
    "github": "https://github.com/andrew",
    "facebook": "https://facebook.com/andrew",
    "instagram": "https://instagram.com/andrew",
    "scheduling_url": "https://calendly.com/andrew/consultation"
  }
}`,
  };
}

async function callLlmForContent(userPrompt, env) {
  const llmUrl =
    env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = env.LLM_MODEL || "gpt-4.1-mini";
  const apiKey = required(env.LLM_API_KEY, "LLM_API_KEY");

  const systemPrompt = [
    "You are a Content Data Engineer.",
    "Return ONLY strict JSON (no prose, no markdown, no wrapper text).",
    "Allowed output: content updates for content.json schema only.",
    "Never output html/css/js.",
    "Keep brand pillars: Efficiency, Transparency, Automation.",
    "Required top-level keys:",
    "personal_brand, services, portfolio_demos, social_proof, connect_links",
    "Forbidden anywhere: price/pricing/tier/style keys.",
  ].join("\\n");

  let response;
  try {
    response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
  } catch (error) {
    throw new AppError(normalizeFetchFailure(error), 502);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message || `LLM request failed (${response.status})`;
    throw new AppError(message, 502);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new AppError("LLM returned an empty response.", 502);
  }

  return parseGeneratedPayload(content);
}

async function commitFilesToGithub({ filesToCommit, commitMessage, env }) {
  const token = required(env.GITHUB_PAT, "GITHUB_PAT");

  const refData = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
    { method: "GET" },
    token,
  );
  const headSha = refData.object.sha;

  const headCommit = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${headSha}`,
    { method: "GET" },
    token,
  );
  const baseTreeSha = headCommit.tree.sha;

  const treeEntries = [];
  for (const [path, content] of Object.entries(filesToCommit)) {
    const blob = await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({ content, encoding: "utf-8" }),
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
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
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
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
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
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
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
    commitUrl:
      newCommit.html_url ||
      `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${newCommit.sha}`,
  };
}

async function githubRequest(path, init, token, options = {}) {
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
    throw new AppError(normalizeFetchFailure(error), 502);
  }

  const payload = await response.json().catch(() => ({}));

  if (options.allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const mapped = mapGithubApiError(response.status, payload);
    throw new AppError(mapped.message, mapped.status);
  }

  return payload;
}

function parseGeneratedPayload(content) {
  const strictJson = enforceStrictJsonEnvelope(content);
  const parsed = safeParseJson(strictJson);
  if (!parsed) throw new AppError("Invalid LLM JSON output.", 422);

  if (parsed.html || parsed.css || parsed.js) {
    throw new AppError("LLM output must not contain html/css/js fields.", 422);
  }

  const candidate = resolveContentJsonCandidate(parsed);
  const normalized = normalizeContentJson(candidate);

  return {
    contentJson: normalized,
    commitMessage: parsed.commitMessage ? String(parsed.commitMessage) : "",
  };
}

function enforceStrictJsonEnvelope(content) {
  const normalized = String(content || "").trim();
  if (!normalized) throw new AppError("LLM output must be strict JSON.", 422);

  const fenced = normalized.match(/^```(?:json)?\\s*([\\s\\S]*?)\\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  if (normalized.startsWith("{") && normalized.endsWith("}")) return normalized;

  throw new AppError(
    "LLM output must be strict JSON without conversational text.",
    422,
  );
}

function resolveContentJsonCandidate(parsed) {
  if (parsed.contentJson !== undefined) return parsed.contentJson;
  if (parsed.content_json !== undefined) return parsed.content_json;
  if (looksLikeContentSchema(parsed.result)) return parsed.result;
  if (looksLikeContentSchema(parsed.data)) return parsed.data;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const value of Object.values(parsed)) {
      if (looksLikeContentSchema(value)) {
        return value;
      }
    }
  }

  if (looksLikeContentSchema(parsed)) return parsed;
  throw new AppError("LLM response missing contentJson field.", 422);
}

function looksLikeContentSchema(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const schemaKeys = [
    "personal_brand",
    "services",
    "portfolio_demos",
    "social_proof",
    "connect_links",
  ];
  return schemaKeys.every((key) => key in value);
}

function normalizeContentJson(contentJson) {
  let normalizedObject;

  if (typeof contentJson === "string") {
    const reparsed = safeParseJson(contentJson);
    if (!reparsed || typeof reparsed !== "object" || Array.isArray(reparsed)) {
      throw new AppError("contentJson must be a valid JSON object.", 422);
    }
    normalizedObject = reparsed;
  } else if (
    contentJson &&
    typeof contentJson === "object" &&
    !Array.isArray(contentJson)
  ) {
    normalizedObject = contentJson;
  } else {
    throw new AppError("contentJson must be a valid JSON object.", 422);
  }

  rejectForbiddenKeys(normalizedObject);
  const sanitized = sanitizeContentJson(normalizedObject);
  validateRequiredSchema(sanitized);
  return JSON.stringify(sanitized, null, 2);
}

function sanitizeContentJson(contentJson) {
  return {
    personal_brand: sanitizeObject(contentJson.personal_brand, [
      "hero_statement",
      "about_me",
      "core_values",
      "work_philosophy",
    ]),
    services: Array.isArray(contentJson.services)
      ? contentJson.services.map((service) =>
          sanitizeObject(service, [
            "service_name",
            "description",
            "client_value_add",
          ]),
        )
      : contentJson.services,
    portfolio_demos: Array.isArray(contentJson.portfolio_demos)
      ? contentJson.portfolio_demos.map((demo) =>
          sanitizeObject(demo, [
            "project_title",
            "problem_solved",
            "demo_url",
            "repo_url",
          ]),
        )
      : contentJson.portfolio_demos,
    social_proof: {
      google_reviews: Array.isArray(contentJson.social_proof?.google_reviews)
        ? contentJson.social_proof.google_reviews.map((review) =>
            sanitizeObject(review, ["quote", "stars"]),
          )
        : contentJson.social_proof?.google_reviews,
    },
    connect_links: sanitizeObject(contentJson.connect_links, [
      "linkedin",
      "github",
      "facebook",
      "instagram",
      "scheduling_url",
    ]),
  };
}

function sanitizeObject(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => allowedKeys.includes(key)),
  );
}

function validateRequiredSchema(contentJson) {
  requiredObject(contentJson, "contentJson");

  requiredObject(contentJson.personal_brand, "personal_brand");
  requireKeys(
    contentJson.personal_brand,
    ["hero_statement", "about_me", "core_values", "work_philosophy"],
    "personal_brand",
  );
  requiredString(
    contentJson.personal_brand.hero_statement,
    "personal_brand.hero_statement",
  );
  requiredString(
    contentJson.personal_brand.about_me,
    "personal_brand.about_me",
  );
  requiredString(
    contentJson.personal_brand.work_philosophy,
    "personal_brand.work_philosophy",
  );
  requiredStringArray(
    contentJson.personal_brand.core_values,
    "personal_brand.core_values",
  );

  const services = requiredArray(contentJson.services, "services");
  services.forEach((item, index) => {
    const path = `services[${index}]`;
    const service = requiredObject(item, path);
    requireKeys(
      service,
      ["service_name", "description", "client_value_add"],
      path,
    );
    requiredString(service.service_name, `${path}.service_name`);
    requiredString(service.description, `${path}.description`);
    requiredString(service.client_value_add, `${path}.client_value_add`);
  });

  const demos = requiredArray(contentJson.portfolio_demos, "portfolio_demos");
  demos.forEach((item, index) => {
    const path = `portfolio_demos[${index}]`;
    const demo = requiredObject(item, path);
    requireKeys(
      demo,
      ["project_title", "problem_solved", "demo_url", "repo_url"],
      path,
    );
    requiredString(demo.project_title, `${path}.project_title`);
    requiredString(demo.problem_solved, `${path}.problem_solved`);
    requiredString(demo.demo_url, `${path}.demo_url`);
    requiredString(demo.repo_url, `${path}.repo_url`);
  });

  const socialProof = requiredObject(contentJson.social_proof, "social_proof");
  requireKeys(socialProof, ["google_reviews"], "social_proof");
  const reviews = requiredArray(
    socialProof.google_reviews,
    "social_proof.google_reviews",
  );
  reviews.forEach((item, index) => {
    const path = `social_proof.google_reviews[${index}]`;
    const review = requiredObject(item, path);
    requireKeys(review, ["quote", "stars"], path);
    requiredString(review.quote, `${path}.quote`);
    requiredStars(review.stars, `${path}.stars`);
  });

  const connectLinks = requiredObject(
    contentJson.connect_links,
    "connect_links",
  );
  requireKeys(
    connectLinks,
    ["linkedin", "github", "facebook", "instagram", "scheduling_url"],
    "connect_links",
  );
  requiredString(connectLinks.linkedin, "connect_links.linkedin");
  requiredString(connectLinks.github, "connect_links.github");
  requiredString(connectLinks.facebook, "connect_links.facebook");
  requiredString(connectLinks.instagram, "connect_links.instagram");
  requiredString(connectLinks.scheduling_url, "connect_links.scheduling_url");
}

function rejectForbiddenKeys(value) {
  if (Array.isArray(value)) {
    value.forEach(rejectForbiddenKeys);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("price") ||
      lower.includes("pricing") ||
      lower.includes("tier") ||
      lower.includes("style")
    ) {
      throw new AppError(
        "Pricing or style/tier data is not allowed in this schema.",
        422,
      );
    }
    rejectForbiddenKeys(nested);
  }
}

function sanitizePrompt(value, maxChars = DEFAULT_MAX_PROMPT_CHARS) {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw new AppError("Missing prompt.", 400);
  if (trimmed.length > maxChars) {
    throw new AppError(`Prompt too long (max ${maxChars}).`, 400);
  }
  return trimmed;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapGithubApiError(status, payload) {
  const raw = String(payload?.message || "");
  const message = raw.toLowerCase();

  if (status === 401 || status === 403) {
    if (message.includes("rate limit")) {
      return {
        status: 429,
        message: "GitHub API rate limit reached. Please retry shortly.",
      };
    }
    return {
      status: 401,
      message: "GitHub authorization failed. Check your PAT permissions.",
    };
  }

  if (status === 409) {
    return {
      status: 409,
      message: "GitHub conflict on branch update. Please retry.",
    };
  }

  if (status === 408 || status === 504) {
    return { status: 504, message: "GitHub request timed out. Please retry." };
  }

  if (status === 429) {
    return {
      status: 429,
      message: "GitHub API rate limit reached. Please retry shortly.",
    };
  }

  return {
    status: status || 502,
    message: raw || `GitHub API error (${status}).`,
  };
}

function normalizeFetchFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("hang")
  ) {
    return "Upstream request timed out. Please retry.";
  }
  return String(error?.message || error || "Request failed.");
}

function required(value, key) {
  if (!value || !String(value).trim()) {
    throw new AppError(`Missing required secret: ${key}`, 500);
  }
  return value;
}

function requiredObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(`${path} must be an object.`, 422);
  }
  return value;
}

function requiredArray(value, path) {
  if (!Array.isArray(value))
    throw new AppError(`${path} must be an array.`, 422);
  return value;
}

function requiredString(value, path) {
  if (!String(value || "").trim()) {
    throw new AppError(`${path} must be a non-empty string.`, 422);
  }
}

function requiredStringArray(value, path) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !String(item || "").trim())
  ) {
    throw new AppError(`${path} must be an array of non-empty strings.`, 422);
  }
}

function requiredStars(value, path) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError(`${path} must be an integer between 1 and 5.`, 422);
  }
}

function requireKeys(value, keys, path) {
  for (const key of keys) {
    if (!(key in value)) {
      throw new AppError(`Missing required key: ${path}.${key}`, 422);
    }
  }
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Setup-Key",
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

function handleError(error, env) {
  if (error instanceof AppError) {
    return json({ error: error.message }, error.status, env);
  }
  return json({ error: "Internal worker error." }, 500, env);
}

class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}
// END WORKER
