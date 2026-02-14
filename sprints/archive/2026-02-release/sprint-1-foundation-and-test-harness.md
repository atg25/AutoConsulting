# Sprint 1 — Foundation and Test Harness

## Goal
Establish strict TDD foundation, test infrastructure, and CI gate so no feature can merge without passing tests.

## Scope
- Standardize repository layout for frontend, worker, tests, and fixtures.
- Add test runners and baseline configs for unit, integration, and E2E.
- Add mock/stub utilities for LLM and GitHub API calls.
- Add CI workflow with fail-fast behavior.

## TDD Order (Write tests first)
1. Write failing baseline tests for health endpoint contract and UI render contract.
2. Add failing integration tests for worker request/response behavior.
3. Add failing E2E smoke test for opening mobile UI and seeing online/offline status handling.
4. Implement minimal code/config to pass tests.

## Test Plan
### Unit Tests
- Positive:
  - health response schema validator accepts `{ ok, service, now }`.
  - prompt input sanitizer trims and preserves valid content.
- Negative:
  - schema validator rejects malformed health payload.
  - sanitizer rejects empty/whitespace-only prompt.

### Integration Tests
- Positive:
  - `GET /health` returns 200 with expected JSON shape.
  - `POST /chat` with stubbed providers returns success envelope.
- Negative:
  - unsupported route returns 404.
  - malformed request body returns 400.

### E2E Tests
- Positive:
  - mobile viewport loads, status indicator renders, composer accepts input.
- Negative:
  - backend offline state shows red indicator and non-crashing UI behavior.

## Deliverables
- Testing framework config committed.
- Initial mocks/fixtures committed.
- CI workflow enforcing tests on push and PR.

## Definition of Done
- All sprint tests pass in local and CI.
- Test structure documented.
- Sprint file moved to `/sprints/done/` after pass criteria are met.
