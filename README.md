🏛️ The AI Deployment Assistant & Consulting Portfolio

An Autonomous, Zero-Maintenance Architecture for the Efficiency Architect.
📋 Overview

This project is a high-end, self-maintaining digital presence designed for the modern AI Consultant. It consists of two primary components:

    The Control App: A private, mobile-first chat interface (Art Deco style) that allows the owner to update the website content via natural language.

    The Public Portfolio: A headless, high-performance static site that dynamically renders content from a version-controlled JSON database.

🏗️ Architecture: The "Zero-Cost" Stack

The system is built on a strictly free-tier, enterprise-grade serverless stack to ensure $0/month overhead.
Component Technology Purpose
Frontend UI Cloudflare Pages Hosts the private Chat Control App.
Logic Layer Cloudflare Workers The "Guardrail" that validates AI output and handles GitHub commits.
Database GitHub (JSON) Stores the content.json file as the single source of truth.
Public Site GitHub Pages Renders the Art Deco portfolio for the world to see.
🛠️ The Development Process (TDD Sprints)

This project was built using a Test-Driven Development (TDD) approach across 6 organized sprints. No code was implemented until a failing test proved the need for it.

    Sprint 1: Foundation. Initialized the testing harness and serverless environment.

    Sprint 2: The Contract. Defined the content.json schema to prevent the AI from breaking the site.

    Sprint 3: The Pipeline. Built the Git REST API sequence to push updates autonomously.

    Sprint 4: The Interface. Developed the "Minimal Art Deco Chic" mobile UI with resilience for network failures.

    Sprint 5: The Guardrails. Hardened the LLM system prompt to reject "prose fluff" and enforce brand values.

    Sprint 6: The Launch. Built the headless public portfolio and integrated the dynamic demo projects.

🛡️ Safety & Guardrails: Why it Won't Break

Unlike typical "AI-generated" sites, this architecture is decoupled.

    Data vs. Code: The AI is only permitted to edit a single JSON file. It has no access to the HTML, CSS, or Javascript files.

    Schema Policing: The Cloudflare Worker acts as a filter. If the AI tries to inject invalid data or styling, the Worker rejects the update before it ever touches GitHub.

    Tone Control: The system is primed with the "Efficiency Architect" brand pillars: Efficiency, Transparency, and Automation.

🚀 How to Use

    Open the Control App: Access your private Cloudflare Pages URL on your iPhone.

    Check the Status: Ensure the status dot is Green (indicating the Cloudflare Worker is online).

    Chat to Update: Simply type: "Add a new Google Review from John Doe saying the automation was life-changing" or "Update my Work Philosophy to mention my new project."

    Verify: Watch the status move from Thinking to Pushed. Your public site updates in seconds.

👤 Credits

    Lead Architect: Andrew Gardner
