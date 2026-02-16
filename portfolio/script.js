const byId = (id) => document.getElementById(id);

const THEME_STORAGE_KEY = "portfolioTheme";

function getPreferredTheme() {
  const stored = String(localStorage.getItem(THEME_STORAGE_KEY) || "").trim();
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  const toggle = byId("themeToggle");
  if (toggle) {
    toggle.textContent = nextTheme === "dark" ? "Dark" : "Light";
    toggle.setAttribute(
      "aria-label",
      `Toggle color theme (currently ${nextTheme})`,
    );
  }
}

function initThemeToggle() {
  applyTheme(getPreferredTheme());
  const toggle = byId("themeToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  });
}

function text(el, value) {
  if (el) {
    el.textContent = value || "";
  }
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
      createCard(service.service_name, [
        service.description,
        service.client_value_add,
      ]),
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
    reviewsList.appendChild(createCard(`${review.stars}★`, [review.quote]));
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
    initThemeToggle();

    const response = await fetch("./content.json", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Load failed (${response.status})`);
    }

    const data = await response.json();
    renderPortfolio(data);
  } catch {
    errorEl.classList.remove("hidden");
    errorEl.textContent = "Unable to load portfolio content.";
  }
}

boot();
