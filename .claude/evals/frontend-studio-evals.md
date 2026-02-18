# Frontend Studio Evals (Manual / Regression)

Run each prompt in a fresh session (or after `/compact`). A run **passes** if it:
1) Does not output full implementation code until a **FrontendConfig** exists (unless the prompt explicitly says “assume defaults”).
2) Asks only missing design/stack questions (multiple choice + defaults).
3) Outputs **FrontendConfig YAML** before big deliverables.
4) Respects the config (framework, styling, primitives, icons, theme, tests).
5) For code: includes file paths + integration notes + self-check (a11y, responsive, states).

---

## Test 1: Vague request triggers intake
Prompt:
“Build a reusable Button component.”

Pass:
- Intake questions appear
- FrontendConfig YAML output
- Then blueprint + offer code

Fail:
- Jumps straight into code

---

## Test 2: “Use defaults” fast path
Prompt:
“Build a pricing page. Use defaults.”

Pass:
- States defaults clearly
- Outputs FrontendConfig
- Produces blueprint, then offers code

---

## Test 3: Provided config means no repeated questions
Prompt:
(Provide config YAML in chat)
Then:
“Implement a modal dialog.”

Pass:
- No stack questions repeated
- Uses config styling + primitives
- A11y included (Escape, focus, aria)

---

## Test 4: Partial config triggers only missing questions
Prompt:
(Provide partial config)
Then:
“Create a searchable Contacts table for my CRM.”

Pass:
- Asks only missing items (theme, a11y target, tests, primitives)
- Blueprint includes loading/empty/error + pagination/filtering

---

## Test 5: Styling mismatch regression
Prompt:
“Use CSS Modules. Build a ProfileCard component.”

Pass:
- Output includes `*.module.css`, not Tailwind

---

## Test 6: Token generation
Prompt:
“Generate design tokens for a retro-futuristic vibe with light/dark mode.”

Pass:
- Asks only missing brand choices
- Outputs token files + usage rules

---

## Test 7: Blueprint-first request
Prompt:
“Design a CRM Deals pipeline view (kanban) with filters and empty states. No code yet.”

Pass:
- Blueprint only (no implementation code)

---

## Test 8: Quality gates on pasted code
Prompt:
“Run frontend quality gates on this component and propose fixes + tests:”
(paste code with missing labels/div buttons)

Pass:
- Prioritized a11y issues
- Test plan aligned with config

---

## Test 9: Audit plan (forked)
Prompt:
“/crm-design-audit Focus on buttons and forms.”

Pass:
- Returns a consolidated audit + migration steps
- Suggests next command

---

## Test 10: “No new libraries” check
Prompt:
“Our config says uiPrimitives: none. Build a tooltip.”

Pass:
- Doesn’t import Radix/Headless UI
- Implements minimal accessible tooltip or asks permission to add a lib
