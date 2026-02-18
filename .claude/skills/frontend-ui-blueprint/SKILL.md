---
name: frontend-ui-blueprint
description: Converts a UI request into an implementable blueprint: component tree, states, interactions, data needs, accessibility, and responsive behavior. Requires FrontendConfig.
argument-hint: "[feature/component]"
---

# Frontend UI Blueprint

## Inputs
- UI request: $ARGUMENTS (or the most recent user request)
- FrontendConfig (required)

If FrontendConfig is missing:
- Ask the minimal intake questions needed to produce it (framework, language, styling, primitives, theme mode, a11y target).
- Output FrontendConfig first.
- Then produce the blueprint.

## Output template (strict)

### UI Blueprint
**Goal**
- <one sentence>

**User story**
- As a <user>, I want <action>, so that <value>.

**Component tree**
- Root
  - Child
  - Child

**States**
- Loading:
- Empty:
- Error:
- Disabled:
- Success:

**Interactions**
- Pointer: click/hover behaviors
- Keyboard: tab order, shortcuts, escape, arrows
- Focus management rules
- Validation rules (if forms)

**Data**
- Inputs (props)
- Outputs (events/callbacks)
- API needs (if any)
- Example data shape (short)

**Accessibility notes (match config target)**
- Semantics (buttons/links/headings)
- Labels / aria
- Focus visible + focus trap (if modal)
- Reduced motion handling (if motion != none)

**Responsive behavior**
- Mobile layout
- Tablet layout
- Desktop layout

**Open questions**
- Only what blocks implementation

## Blueprint defaults
If the user did not specify:
- Always include loading/empty/error states for data-driven UI.
- Prefer composable components over one giant component.
- Use consistent naming: PascalCase components, camelCase props.
