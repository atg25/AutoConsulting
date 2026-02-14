# Maintenance Mode

Status: Active (post-launch)

## Production Components

- Cloudflare Worker: `worker/src/index.js`
- Control UI (operator): `frontend/`
- Public Portfolio: `portfolio/`

## Operational Checklist

1. Monitor Worker health (`/health`) and chat failures (`/chat`).
2. Rotate secrets periodically:
   - `GITHUB_PAT`
   - `LLM_API_KEY`
3. Validate `content.json` commits only (guardrail policy).
4. Run regression suite before any changes:
   - `cd worker && npm test`

## Incident Response

- If chat deploy fails with conflict/timeout, retry from UI and inspect Worker logs.
- If schema validation fails, rephrase request to target only allowed `content.json` fields.

## Change Policy

- No direct edits to generated portfolio structure during maintenance unless emergency fix.
- Content updates should flow through the control app so audit trail remains in GitHub commits.
