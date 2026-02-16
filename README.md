# Autonomous, Zero-Maintenance Consulting Portfolio

An end-to-end portfolio system for the Efficiency Architect: bold public positioning, strict operational guardrails, and content updates that deploy in seconds without manual file editing.

## The Hook

This project is an Autonomous, Zero-Maintenance Consulting Portfolio built on three brand pillars:

- Efficiency
- Transparency
- Automation

The owner updates content from a private admin console using plain-language instructions. The system validates output, commits changes, and publishes the live site automatically.

## 100% GitHub-Native Architecture

### Hosting: GitHub Pages

- Public portfolio is hosted on GitHub Pages.
- Design direction: Minimal Modern / Brutalist-dark aesthetic with strong readability.
- Runtime cost for hosting: $0 on GitHub Pages free tier.

### Database: content.json as a Headless CMS

- content.json is the single source of truth for portfolio content.
- Frontend renders all core public sections from this file:
  - personal_brand
  - services
  - portfolio_demos
  - social_proof
  - connect_links

### Control Panel: admin.html

- admin.html is an unlisted owner console for dispatching content updates.
- Uses GitHub workflow_dispatch API calls.
- PAT is held in browser sessionStorage for the current tab session.
- No backend server required for dispatch.

### Engine: GitHub Actions (update-site.yml)

- update-site.yml is the AI Bouncer pipeline.
- It calls the LLM, enforces strict JSON-only output, rejects forbidden schema keys, validates required structure, then writes and commits content.json.
- If output fails validation, the workflow exits with a hard fail and prevents bad data from shipping.

## Update Workflow (Owner Instruction → Live Site)

1. Dispatch
   - Owner submits an instruction in admin.html.
   - Admin console triggers workflow_dispatch on update-site.yml.

2. AI Processing
   - Workflow sends the instruction (plus current content context) to the LLM.

3. Schema Validation (AI Bouncer)
   - Workflow enforces strict JSON envelope.
   - Validates required top-level schema and nested required fields.
   - Rejects forbidden keys such as pricing/tier/style variants.
   - Normalizes/sanitizes output before write.

4. Auto-Commit
   - Workflow updates content.json.
   - GitHub Actions bot commits and pushes to main.

5. Live Update
   - GitHub Pages serves the updated content on the public site.

## Fork & Setup Guide

To deploy your own version:

1. Fork this repository.

2. Configure repository secrets.
   - Add OPENAI_API_KEY (or LLM_API_KEY) in repository Secrets and variables → Actions.

3. Ensure workflow permissions are enabled.
   - Repository Settings → Actions → General.
   - Set Workflow permissions to Read and write permissions.

4. Enable GitHub Pages.
   - Repository Settings → Pages.
   - Deploy from branch: main, folder: root.

5. Use the admin console.
   - Open portfolio/admin.html on your GitHub Pages URL.
   - Enter a fine-grained PAT with Actions write access for your fork.
   - Submit content instructions; the workflow handles validation + publish.

## Why This Works in Production

- Data and design are decoupled: AI updates content only, not code.
- Guardrails are deterministic: invalid or malformed model output is blocked.
- Operations are simple: one repo, one workflow, one content source of truth.

## Credits

- Lead Architect: Andrew Gardner
