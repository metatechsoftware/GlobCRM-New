---
name: frontend-intake
description: Asks short multiple-choice questions to lock down frontend stack and design choices, then outputs a reusable FrontendConfig YAML for consistent UI across the app.
argument-hint: "[project or feature context]"
---

# Frontend Intake

Your job is to gather missing design + technical decisions via questions and convert them into a reusable FrontendConfig.

If invoked with arguments, treat `$ARGUMENTS` as context about the project/feature:
- Context: $ARGUMENTS

## How to ask
- Ask only what is missing.
- Use multiple-choice questions with a default in parentheses.
- If user says "use defaults", pick a coherent set and proceed.

## Essential questions (ask if missing)
1) Framework / meta framework:
   - Next.js / React+Vite / Vue+Nuxt / SvelteKit / Angular
2) Language:
   - TypeScript (default) / JavaScript
3) Styling:
   - Tailwind (default) / CSS Modules / styled-components(emotion) / vanilla-extract
4) UI primitives:
   - Radix (default) / Headless UI / MUI / Chakra / none
5) Icons:
   - Lucide (default) / Heroicons / FontAwesome / none
6) App constraints:
   - SSR needed? i18n? auth? form-heavy? data-heavy tables?
7) Theme:
   - Light only / Light+Dark (default)
8) Quality bar:
   - Accessibility: basic / WCAG AA (default)
   - Testing: unit (vitest/jest/none) + e2e (playwright/cypress/none)
   - Storybook: yes/no

## Optional deep questions (only if needed)
- State management: local / zustand / redux / other
- Data fetching: fetch / axios / tanstack-query / swr / apollo
- Forms: react-hook-form / formik / none
- Browser support: evergreen / include-older-safari / custom

## Output template (strict)

### FrontendConfig (copy/paste)
```yaml
frontendConfigVersion: 1
stack:
  framework: ""            # nextjs|react|vue|svelte|angular
  metaFramework: ""        # nextjs|vite|nuxt|sveltekit|none
  language: ""             # typescript|javascript
  styling: ""              # tailwind|css-modules|styled-components|vanilla-extract
  uiPrimitives: ""         # radix|headless-ui|mui|chakra|none
  icons: ""                # lucide|heroicons|fontawesome|none
  state: ""                # local|zustand|redux|pinia|signals|none
  dataFetching: ""         # fetch|axios|tanstack-query|swr|apollo|none
  forms: ""                # react-hook-form|formik|none
quality:
  accessibilityTarget: ""  # basic|wcag-aa
  testing:
    unit: ""               # vitest|jest|none
    e2e: ""                # playwright|cypress|none
  storybook: false
design:
  vibe: ""                 # minimal|editorial|retro-futuristic|playful|enterprise|match-existing
  themeMode: ""            # light|light-dark
  radius: ""               # sharp|soft|mixed
  motion: ""               # none|subtle|expressive
responsive:
  strategy: ""             # mobile-first|desktop-first
  breakpoints:
    - name: sm
      minWidth: 640
    - name: md
      minWidth: 768
    - name: lg
      minWidth: 1024
content:
  tone: ""                 # neutral|friendly|formal|match-brand
  i18n: false
browserSupport:
  baseline: ""             # evergreen|include-older-safari|custom
notes:
  assumptions: []
  openQuestions: []
```

After the YAML, briefly state any assumptions you made.
