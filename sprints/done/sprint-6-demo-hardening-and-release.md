# Sprint 6 — Demo Hardening and Release

## Goal

Ship a fully working demo with deterministic behavior, observability, and operator-ready documentation.

## Scope

- Add production-like staging checks and smoke test scripts.
- Validate environment/secrets completeness and startup diagnostics.
- Finalize runbooks for deployment, rollback, and incident response.

## TDD Order (Write tests first)

1. Write failing unit tests for config validation and diagnostics formatters.
2. Write failing integration tests for startup checks and dependency health.
3. Write failing E2E test suite for full happy path and major outage paths.
4. Implement minimal hardening and docs to pass.

## Test Plan

### Unit Tests

- Positive:
  - config validator passes when all required vars/secrets exist.
- Negative:
  - config validator fails with missing or malformed env values.

### Integration Tests

- Positive:
  - worker startup diagnostics expose readiness info without leaking secrets.
- Negative:
  - partial dependency failure yields clear degraded status.

### E2E Tests

- Positive:
  - complete path: mobile prompt → LLM generation → GitHub commit → success summary.
- Negative:
  - simulated LLM timeout and GitHub timeout produce clear, non-crashing recovery states.

## Deliverables

- Release checklist for demo day.
- Final architecture and troubleshooting documentation.

## Definition of Done

- Full test matrix green (unit/integration/E2E, positive/negative).
- Demo runbook validated by dry run.
- Sprint file moved to `/sprints/done/`.
