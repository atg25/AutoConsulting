# Sprint 2 — Worker Chat Contract and Validation

## Goal
Harden `POST /chat` input/output contracts and validation so malformed prompts or malformed model outputs are safely handled.

## Scope
- Define strict request/response schema for `/chat`.
- Add validation/error envelopes for predictable frontend handling.
- Add robust JSON extraction/parse fallback path for model responses.

## TDD Order (Write tests first)
1. Write failing unit tests for input validator and response parser.
2. Write failing integration tests for `/chat` error paths.
3. Write failing E2E tests for user-visible error messaging.
4. Implement minimal backend/frontend code to pass.

## Test Plan
### Unit Tests
- Positive:
  - parser accepts valid JSON payload with `html`, `css`, `js`, optional `commitMessage`.
  - validator accepts non-empty prompt within max length.
- Negative:
  - parser rejects malformed JSON / missing required fields.
  - validator rejects empty prompt and over-limit payload.

### Integration Tests
- Positive:
  - `/chat` returns normalized success contract when LLM returns valid payload.
- Negative:
  - `/chat` returns 400 on empty prompt.
  - `/chat` returns 500 with descriptive error on malformed LLM response.
  - `/chat` handles upstream timeout/error mapping.

### E2E Tests
- Positive:
  - user submits valid prompt and sees success summary card.
- Negative:
  - user submits blank prompt and receives inline rejection.
  - backend parser failure surfaces controlled error message, no UI crash.

## Deliverables
- Shared schema definitions and validators.
- Stable error code taxonomy for UI mapping.

## Definition of Done
- All positive and negative tests passing.
- `/chat` contract documented and versioned.
- Sprint file moved to `/sprints/done/`.
