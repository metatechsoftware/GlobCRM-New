---
name: frontend-component-builder
description: Implements frontend components/pages using FrontendConfig (framework, styling, primitives) with accessibility and responsive behavior. Outputs file paths + code blocks ready to paste into a repo.
argument-hint: "[component/page to implement]"
---

# Frontend Component Builder

## Preconditions
Requires FrontendConfig.
- If FrontendConfig is missing, ask the minimal intake questions and output config first.
- If a UI Blueprint is missing, create a minimal blueprint before writing code.

## Before coding: ask only missing details
- Component/page name
- Data shape (props) or where data comes from
- Required states (loading/empty/error/disabled)
- Copy tone (neutral/friendly/formal) if it affects UI text

If user says "reasonable assumptions", proceed and list assumptions.

## Implementation rules
- Respect config:
  - TypeScript if configured
  - Tailwind vs CSS Modules vs styled-components accordingly
  - Use configured uiPrimitives (Radix/MUI/etc) consistently
  - Use configured icons set
- Prefer semantic HTML first.
- Ensure keyboard and focus behavior for interactive UI.
- Do not introduce new libraries unless the user explicitly approves.

## Output contract (strict)
1) **Summary** (2–4 lines)
2) **Files** list with paths
3) Code blocks labeled with file paths
4) **Integration notes** (how to import/use)
5) **Self-check** list (a11y, responsive, states, edge cases)

## Arguments
If invoked as `/frontend-component-builder ...`, the target is:
- Build: $ARGUMENTS
