# FrontendConfig Schema Notes

This file is a reference for the `FrontendConfig` produced by `/frontend-intake`.

## Minimal fields needed to start implementation
- `stack.framework` + `stack.metaFramework`
- `stack.language`
- `stack.styling`
- `stack.uiPrimitives`
- `design.vibe` + `design.themeMode`
- `quality.accessibilityTarget`

## Default recommendation (if user says “pick for me”)
- framework/meta: Next.js
- language: TypeScript
- styling: Tailwind
- uiPrimitives: Radix
- icons: Lucide
- state: local (upgrade to Zustand if you feel pain)
- dataFetching: TanStack Query (if the UI is data-heavy)
- forms: React Hook Form (if forms are common)
- themeMode: light-dark
- accessibility: wcag-aa
- unit tests: Vitest
- e2e: Playwright
- storybook: true

## Interpretation tips
- `design.vibe` is the “visual vibe” knob. Keep it stable across the app.
- `responsive.strategy` should match your product reality:
  - CRM → usually mobile-first but optimized for desktop density.
- If you need to override a decision for a specific feature, note it in `notes.assumptions`.
