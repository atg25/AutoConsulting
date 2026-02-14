# Sprint 3 — GitHub Git API Commit Pipeline

## Goal
Guarantee deterministic, safe file commits through GitHub REST Git endpoints.

## Scope
- Implement pipeline sequence:
  1) get current ref SHA
  2) get base commit/tree
  3) create blobs
  4) create tree
  5) create commit
  6) update branch ref
- Add idempotency guard and error mapping.

## TDD Order (Write tests first)
1. Write failing unit tests for request builders and response normalizers.
2. Write failing integration tests with mocked GitHub endpoint chain.
3. Write failing E2E test for “prompt → commit success/failure” UX states.
4. Implement minimal logic to satisfy tests.

## Test Plan
### Unit Tests
- Positive:
  - tree entry builder outputs expected blob metadata.
  - commit payload includes parent SHA and commit message.
- Negative:
  - missing env vars trigger required-variable errors.
  - non-JSON GitHub error payload still maps to safe error.

### Integration Tests
- Positive:
  - full happy path executes all 6 Git operations in order.
- Negative:
  - GitHub 401/403 maps to auth error.
  - GitHub 409 conflict maps to branch-state error.
  - GitHub timeout maps to retryable upstream failure.

### E2E Tests
- Positive:
  - user prompt results in commit SHA and file list visible in chat UI.
- Negative:
  - simulated GitHub outage produces controlled “commit failed” state.

## Deliverables
- Fully tested commit pipeline module.
- Structured telemetry fields for operation stage failures.

## Definition of Done
- Sequence verified by integration test assertions.
- Error branches covered with negative tests.
- Sprint file moved to `/sprints/done/`.
