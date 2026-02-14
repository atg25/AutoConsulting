const DEFAULT_MAX_PROMPT_CHARS = 4000;

export function validateHealthPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return (
    payload.ok === true &&
    typeof payload.service === "string" &&
    typeof payload.now === "string" &&
    Number.isFinite(Date.parse(payload.now))
  );
}

export function sanitizePrompt(value, maxChars = DEFAULT_MAX_PROMPT_CHARS) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Missing prompt");
  }
  if (trimmed.length > maxChars) {
    throw new Error(`Prompt too long (max ${maxChars})`);
  }
  return trimmed;
}

export function extractJson(text) {
  const normalized = String(text || "");
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return normalized.slice(start, end + 1);
  }

  return normalized;
}

export function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseGeneratedPayload(content) {
  const strictJson = enforceStrictJsonEnvelope(content);
  const parsed = safeParseJson(strictJson);
  if (!parsed) {
    throw new Error("Invalid LLM JSON output");
  }

  if (parsed.html || parsed.css || parsed.js) {
    throw new Error("LLM output must not contain html/css/js fields");
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
  if (!normalized) {
    throw new Error("LLM output must be strict JSON");
  }

  const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    return normalized;
  }

  throw new Error("LLM output must be strict JSON without conversational text");
}

function resolveContentJsonCandidate(parsed) {
  if (parsed.contentJson !== undefined) {
    return parsed.contentJson;
  }

  if (looksLikeContentSchema(parsed)) {
    return parsed;
  }

  throw new Error("LLM response missing contentJson field");
}

function looksLikeContentSchema(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

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
      throw new Error("contentJson must be a valid JSON object or array");
    }
    normalizedObject = reparsed;
  } else if (
    contentJson &&
    typeof contentJson === "object" &&
    !Array.isArray(contentJson)
  ) {
    normalizedObject = contentJson;
  } else {
    throw new Error("contentJson must be a valid JSON object or array");
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

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
  const personalBrand = contentJson.personal_brand;
  requiredString(personalBrand.hero_statement, "personal_brand.hero_statement");
  requiredString(personalBrand.about_me, "personal_brand.about_me");
  requiredString(
    personalBrand.work_philosophy,
    "personal_brand.work_philosophy",
  );
  requiredStringArray(personalBrand.core_values, "personal_brand.core_values");

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

  const portfolioDemos = requiredArray(
    contentJson.portfolio_demos,
    "portfolio_demos",
  );
  portfolioDemos.forEach((item, index) => {
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

function requireKeys(value, requiredKeys, path) {
  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`Missing required key: ${path}.${key}`);
    }
  }
}

function requiredObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

function requiredArray(value, path) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

function requiredString(value, path) {
  if (!String(value || "").trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function requiredStringArray(value, path) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !String(item || "").trim())
  ) {
    throw new Error(`${path} must be an array of non-empty strings`);
  }
}

function requiredStars(value, path) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${path} must be an integer between 1 and 5`);
  }
}

function rejectForbiddenKeys(value) {
  if (Array.isArray(value)) {
    value.forEach((item) => rejectForbiddenKeys(item));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("price") ||
      lower.includes("pricing") ||
      lower.includes("tier") ||
      lower.includes("style")
    ) {
      throw new Error(
        "Pricing or style/tier data is not allowed in this schema",
      );
    }
    rejectForbiddenKeys(nested);
  }
}

export function mapGithubApiError(status, payload) {
  const rawMessage = String(payload?.message || "");
  const message = rawMessage.toLowerCase();

  if (status === 401 || status === 403) {
    if (message.includes("rate limit")) {
      return "GitHub API rate limit reached; retry later.";
    }
    return "GitHub authorization failed.";
  }

  if (status === 408 || status === 504) {
    return "GitHub API timeout; retry the operation.";
  }

  if (status === 429) {
    return "GitHub API rate limit reached; retry later.";
  }

  if (status === 409) {
    return "GitHub branch reference conflict; retry the operation.";
  }

  return rawMessage || `GitHub API error (${status})`;
}

export function normalizeGithubFetchFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("hang")
  ) {
    return "GitHub API timeout; retry the operation.";
  }

  return String(error?.message || error || "GitHub API request failed");
}
