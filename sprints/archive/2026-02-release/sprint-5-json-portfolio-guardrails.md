# Sprint 5 — JSON Portfolio Guardrails (content.json Only)

## Goal
Enforce the non-negotiable rule: LLM can only mutate `content.json` for portfolio updates.

## Scope
- Add worker guardrails preventing edits outside approved path list.
- Add schema validation for `content.json` before commit.
- Add reject/rollback behavior for invalid generated content.

## TDD Order (Write tests first)
1. Write failing unit tests for path allowlist and JSON schema validator.
2. Write failing integration tests ensuring disallowed files are blocked.
3. Write failing E2E tests for valid/invalid JSON update prompts.
4. Implement minimal enforcement logic to pass.

## Test Plan
### Unit Tests
- Positive:
  - allowlist accepts `content.json`.
  - schema validator accepts valid consulting portfolio JSON structure.
- Negative:
  - allowlist rejects `index.html`, `styles.css`, and arbitrary paths.
  - schema validator rejects missing required sections or wrong data types.

### Integration Tests
- Positive:
  - `/chat` pipeline commits only `content.json` when output is valid.
- Negative:
  - LLM attempt to edit non-JSON files is rejected with explicit error.
  - malformed `content.json` blocks commit.

### E2E Tests
- Positive:
  - user requests portfolio content update and sees successful JSON commit summary.
- Negative:
  - user request resulting in invalid JSON returns actionable failure message.

## Deliverables
- Enforced `content.json`-only mutation policy.
- JSON schema and fixture library for portfolio data.

## Definition of Done
- All guardrail tests pass and block policy violations.
- No commit proceeds on invalid/disallowed output.
- Sprint file moved to `/sprints/done/`.
