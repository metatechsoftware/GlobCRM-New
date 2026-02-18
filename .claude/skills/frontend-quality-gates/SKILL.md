---
name: frontend-quality-gates
description: Reviews frontend work against FrontendConfig quality bar (accessibility, testing, and performance hygiene) and outputs a prioritized report with concrete fixes and test scaffolding.
argument-hint: "[what to review]"
---

# Frontend Quality Gates

## Input
- Code snippets, file paths, or "review the current diff"
- FrontendConfig (required)

If FrontendConfig is missing:
- Ask minimal intake questions and output config first.

## Output contract (strict)

### Quality Report

**Accessibility**
- Issues (severity: high/med/low)
- Fix recommendations
- If helpful: patch-style suggestions (diff-like)

**Testing**
- Suggested unit tests (and e2e if configured)
- What to test and why
- Concrete test code if requested

**Performance hygiene**
- Re-render risks
- Image/lazy-loading hints (if relevant)
- Bundle/dependency notes (if new deps appear)

### Release checklist
- [ ] Keyboard navigation verified
- [ ] Focus visible and predictable
- [ ] Loading/empty/error states handled
- [ ] Responsive behavior verified at breakpoints
- [ ] Tests added (per config)
- [ ] No raw colors/spacing (token usage)

## Review strictness
If `quality.accessibilityTarget = wcag-aa`, be stricter:
- Labels and names for all controls
- Focus order and focus trapping
- Contrast notes when colors are specified
- Reduced-motion support if motion is used

## Arguments
If invoked with `/frontend-quality-gates ...`, interpret:
- Review focus: $ARGUMENTS
