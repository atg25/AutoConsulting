const config = window.APP_CONFIG || {};
const workerBaseUrl = (config.workerBaseUrl || "").replace(/\/$/, "");

const chatForm = document.getElementById("chatForm");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const chatWrap = document.getElementById("chatWrap");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const progressPills = document.getElementById("progressPills");
const pillGenerating = document.getElementById("pillGenerating");
const pillCommitting = document.getElementById("pillCommitting");
const themeToggle = document.getElementById("themeToggle");

function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return workerBaseUrl ? `${workerBaseUrl}${normalized}` : normalized;
}

function appendMessage(role, text) {
  const article = document.createElement("article");
  article.className = `msg ${role}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.appendChild(paragraph);
  chatWrap.appendChild(article);
  chatWrap.scrollTop = chatWrap.scrollHeight;
}

function setBusy(isBusy) {
  sendBtn.disabled = isBusy;
  promptInput.disabled = isBusy;
  progressPills.classList.toggle("hidden", !isBusy);
}

function setProgress(stage) {
  pillGenerating.classList.toggle("active", stage === "generating");
  pillCommitting.classList.toggle("active", stage === "committing");
}

function toUserFacingError(status, rawMessage) {
  const normalized = String(rawMessage || "").toLowerCase();
  if (
    status === 409 ||
    normalized.includes("conflict") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return "Network conflict, please retry.";
  }

  if (status === 400) {
    return "Invalid request. Please update your prompt and retry.";
  }

  return "Request failed. Please retry.";
}

async function checkHealth() {
  try {
    const response = await fetch(apiUrl("/health"), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    statusDot.classList.remove("offline");
    statusDot.classList.add("online");
    statusText.textContent = "Worker online";
  } catch {
    statusDot.classList.remove("online");
    statusDot.classList.add("offline");
    statusText.textContent = "Worker offline";
  }
}

function resolveTheme() {
  const saved = localStorage.getItem("theme-preference");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || saved === "light") {
    return saved;
  }
  return systemDark ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function setupTheme() {
  applyTheme(resolveTheme());
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme-preference", next);
    applyTheme(next);
  });
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) {
    return;
  }

  appendMessage("user", prompt);
  setBusy(true);
  setProgress("generating");

  const progressTimer = setTimeout(() => {
    setProgress("committing");
  }, 15000);

  try {
    const response = await fetch(apiUrl("/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const safeMessage = toUserFacingError(response.status, payload.error);
      throw new Error(safeMessage);
    }

    const summary = [
      "Deployment committed.",
      `Branch: ${payload.branch || "main"}`,
      `Commit: ${payload.commitSha || "n/a"}`,
      `Files: ${(payload.files || []).join(", ") || "n/a"}`,
    ].join("\n");
    appendMessage("assistant", summary);
    promptInput.value = "";
  } catch (error) {
    appendMessage(
      "assistant",
      error.message || "Request failed. Please retry.",
    );
  } finally {
    clearTimeout(progressTimer);
    setBusy(false);
    setProgress("generating");
  }
});

setupTheme();
checkHealth();
setInterval(checkHealth, 30000);
