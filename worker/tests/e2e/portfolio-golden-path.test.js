// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";

const portfolioIndexPath = path.resolve(
  process.cwd(),
  "../portfolio/index.html",
);
const portfolioScriptPath = path.resolve(
  process.cwd(),
  "../portfolio/script.js",
);

const portfolioFixture = {
  personal_brand: {
    hero_statement:
      "I don't maintain this website; my custom AI assistant does.",
    about_me: "I design practical AI systems for growing service businesses.",
    core_values: ["Efficiency", "Transparency", "Automation"],
    work_philosophy:
      "Elegant systems should remove operational friction and improve decision quality.",
  },
  services: [
    {
      service_name: "AI Workflow Architecture",
      description:
        "Designs reliable automations across sales, delivery, and reporting.",
      client_value_add: "Reduces manual overhead while improving consistency.",
    },
  ],
  portfolio_demos: [
    {
      project_title: "Pure Home Inspections",
      problem_solved: "Manual lead follow-up was inconsistent and slow.",
      demo_url: "https://example.com/pure-home-inspections",
      repo_url: "https://github.com/example/pure-home-inspections",
    },
    {
      project_title: "NextGen Wallcovering",
      problem_solved:
        "Scheduling and estimate communication lacked visibility.",
      demo_url: "https://example.com/nextgen-wallcovering",
      repo_url: "https://github.com/example/nextgen-wallcovering",
    },
    {
      project_title: "AInspire",
      problem_solved:
        "Content operations were fragmented and difficult to scale.",
      demo_url: "https://example.com/ainspire",
      repo_url: "https://github.com/example/ainspire",
    },
  ],
  social_proof: {
    google_reviews: [
      {
        quote:
          "Client Name — Andrew’s automation transformed our workflow from reactive chaos to predictable delivery.",
        stars: 5,
      },
      {
        quote:
          "Client Name — We cut administrative overhead and gained clear, transparent process visibility.",
        stars: 5,
      },
      {
        quote:
          "Client Name — The automation stack gave us measurable efficiency without sacrificing quality.",
        stars: 5,
      },
    ],
  },
  connect_links: {
    linkedin: "https://linkedin.com/in/andrew",
    github: "https://github.com/andrew",
    facebook: "https://facebook.com/andrew",
    instagram: "https://instagram.com/andrew",
    scheduling_url: "https://calendly.com/andrew/consultation",
  },
};

async function loadPortfolio(fetchImpl) {
  const html = await fs.readFile(portfolioIndexPath, "utf8");
  const script = await fs.readFile(portfolioScriptPath, "utf8");

  document.documentElement.innerHTML = html;
  const mockedFetch = vi.fn(fetchImpl);
  global.fetch = mockedFetch;
  Object.defineProperty(window, "fetch", {
    configurable: true,
    writable: true,
    value: mockedFetch,
  });

  window.eval(script);
  await Promise.resolve();
  await Promise.resolve();

  return { mockedFetch };
}

async function waitUntil(assertion, timeoutMs = 1200, intervalMs = 20) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start >= timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("portfolio golden path", () => {
  it("lands on site and renders fetched JSON content", async () => {
    const { mockedFetch } = await loadPortfolio(
      async () =>
        new Response(JSON.stringify(portfolioFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    expect(mockedFetch).toHaveBeenCalled();

    await waitUntil(() => {
      const rootText = document.body.textContent || "";
      expect(rootText).toMatch(/pure home inspections/i);
      expect(rootText).toMatch(/nextgen wallcovering/i);
      expect(rootText).toMatch(/ainspire/i);
      expect(rootText).toMatch(/efficiency/i);
      expect(rootText).toMatch(/transparency/i);
      expect(rootText).toMatch(/automation/i);
      expect(rootText).toMatch(
        /this site is autonomously maintained by an ai assistant\.\s*change\s+happens in seconds, not days\./i,
      );

      const reviewCards = document.querySelectorAll("#reviewsList .card-item");
      expect(reviewCards.length).toBe(3);
    });
  });

  it("routes to Calendly when user clicks Book a Consultation", async () => {
    const { mockedFetch } = await loadPortfolio(
      async () =>
        new Response(JSON.stringify(portfolioFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    expect(mockedFetch).toHaveBeenCalled();

    await waitUntil(() => {
      const cta = document.getElementById("bookConsultationBtn");
      expect(cta.getAttribute("href")).toBe(
        "https://calendly.com/andrew/consultation",
      );
    });
  });
});
