# Sprint 4 — Mobile UI State and Resilience

## Goal
Deliver iPhone-first UX reliability with explicit stage feedback and robust failure handling.

## Scope
- Harden status indicator polling and stale-state handling.
- Ensure loading states: “Thinking/Generating Code” and “Committing to GitHub”.
- Improve accessibility and safe area behavior.

## TDD Order (Write tests first)
1. Write failing unit tests for UI state reducer/transitions.
2. Write failing integration tests for frontend↔worker health/chat interactions.
3. Write failing E2E tests in mobile viewport for success and failure journeys.
4. Implement minimal UI logic and styles to pass.

## Test Plan
### Unit Tests
- Positive:
  - state transition idle→generating→committing→success.
  - theme mode resolver respects stored preference and system fallback.
- Negative:
  - failed request transitions to error without deadlocking UI.
  - polling errors keep app interactive and update status indicator.

### Integration Tests
- Positive:
  - health ping updates UI online state.
  - chat success returns commit metadata rendering.
- Negative:
  - health non-200 drives offline indicator.
  - chat 500 renders friendly error message.

### E2E Tests
- Positive:
  - iPhone-sized viewport: no input zoom, safe-area spacing preserved.
  - successful deployment flow shows commit summary.
- Negative:
  - backend offline path remains usable and informative.

## Deliverables
- Stable mobile UI state machine behavior.
- Accessibility checks for labels, live regions, and status messages.

## Definition of Done
- All UI test suites pass on mobile viewport profile.
- No uncaught runtime errors during negative-path tests.
- Sprint file moved to `/sprints/done/`.
