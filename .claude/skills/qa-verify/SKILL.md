---
name: qa-verify
description: Manual command: create a concise smoke/functional/edge-case verification checklist for a feature or phase.
disable-model-invocation: true
---
Generate a verification checklist.

ARGUMENTS: $ARGUMENTS

Produce:
- **Smoke tests (10 max)**: the “if these fail, stop the release” list.
- **Functional tests**: happy paths per feature.
- **Edge cases**: empty states, long text, large attachments, invalid inputs, offline/slow network.
- **Cross-page regressions**: search/pagination consistency, shared components reuse, notification behavior.

Keep it concise and actionable, like something a human tester can run in 20–40 minutes.
