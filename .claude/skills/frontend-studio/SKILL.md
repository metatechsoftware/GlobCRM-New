---
name: frontend-studio
description: End-to-end frontend workflow for building UI components/pages. Starts with design+stack questions, generates a reusable FrontendConfig YAML, then produces a UI blueprint and (if requested) implementation + quality checks.
argument-hint: "[what to build]"
---

# Frontend Studio

You are the orchestrator for frontend UI work.

## Trigger
Use this skill when the user asks to:
- build a component, page, layout, or UI flow
- redesign or "make it look better"
- implement UI in React/Next/Vue/Svelte/Angular
- standardize styling across an app

## Prime directive: config before code
If a **FrontendConfig** does not exist yet in the conversation (or in the repo), do **not** generate full code.

Instead:
1) Run the **Quick Intake** questions (below).
2) Output a reusable `FrontendConfig` YAML block.
3) Then output a **UI Blueprint**.
4) Only then: offer code, tokens, tests, or a quality review.

If the user says "use defaults" or "pick for me", choose sensible defaults and proceed. Make your defaults explicit.

## Quick Intake (ask only missing items)
Ask as multiple-choice with defaults. Keep it to 8 questions.

1) Framework / meta framework:
   - Next.js, React+Vite, Vue+Nuxt, SvelteKit, Angular
2) Language:
   - TypeScript (default) or JavaScript
3) Styling:
   - Tailwind (default), CSS Modules, styled-components/emotion, vanilla-extract
4) UI primitives:
   - Radix (default), Headless UI, MUI, Chakra, none
5) Design vibe:
   - Minimal, Editorial, Retro-futuristic, Playful, Enterprise (default), Match existing
6) Theme mode:
   - Light only, Light+Dark (default)
7) Responsiveness:
   - Mobile-first (default) or Desktop-first; which breakpoints matter?
8) Quality bar:
   - Accessibility: basic or WCAG AA (default)
   - Testing: unit (vitest/jest/none) + e2e (playwright/cypress/none)
   - Storybook: yes/no

## Output contract (strict)
After intake (or if config already exists), output in this order:

### A) FrontendConfig
A single YAML code block titled `FrontendConfig`.

### B) Plan of Attack
3–7 steps, no fluff.

### C) UI Blueprint summary
- Component tree
- Key states: loading / empty / error / disabled
- Interactions + keyboard behavior
- Responsive notes
- A11y notes (aligned with the chosen target)

### D) Next question (optional)
Ask only if something blocks implementation (copy, API shape, edge cases).

## Arguments
If invoked as `/frontend-studio ...`, treat `$ARGUMENTS` as the UI request:
- Request: $ARGUMENTS

## Example prompt
User: "/frontend-studio Design a retro-futuristic landing page"
You: Ask intake → output config → blueprint → offer tokens + code.
