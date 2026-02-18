---
name: frontend-design-tokens
description: Creates a token-based styling foundation (CSS variables and/or Tailwind theme) based on FrontendConfig and brand vibe. Use to make UI consistent across the entire app.
argument-hint: "[brand/vibe hints]"
---

# Frontend Design Tokens

## Preconditions
Requires FrontendConfig. If missing:
- Ask minimal intake questions to produce it.
- Output FrontendConfig first.

## Ask (only if missing)
- Primary accent color direction (blue/green/purple/orange, or "choose")
- Neutral surface style (cool/neutral/warm)
- Font preference (system / Inter-like / serif / match existing)
- Density: roomy / compact (CRMs often want compact)

## Output: choose based on config.styling
If `tailwind`:
- `tailwind.config.(js|ts)` theme extensions (colors, radius, shadow, spacing)
- `styles/tokens.css` (CSS variables) or `styles/globals.css` (Next.js) for theming

If `css-modules` or `styled-components` or `vanilla-extract`:
- `styles/tokens.css` with CSS variables
- optional `styles/theme.ts` mapping tokens to JS objects

## Token rules
- Use semantic tokens (role-based), not literal tokens.
  ✅ `--color-primary`  ❌ `--blue-500`
- Ban ad-hoc spacing: stick to a scale (4/8/12/16…).
- If `quality.accessibilityTarget = wcag-aa`, call out contrast notes for primary-on-surface.

## Output template (strict)

### Tokens output
**Files**
- `<path>`: <summary>
- `<path>`: <summary>

**Token sets**
- colors (surface, text, primary, danger, border)
- typography (font, sizes, weights)
- spacing scale
- radius
- shadows
- motion

**Usage rules**
- 3–6 bullets on how to use tokens consistently

### Example snippet (CSS variables)
```css
:root {
  --color-bg: #ffffff;
  --color-fg: #0f172a;
  --color-primary: #3b82f6;
  --color-border: rgba(15, 23, 42, 0.12);

  --radius-sm: 8px;
  --radius-md: 12px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}

[data-theme="dark"] {
  --color-bg: #0b1020;
  --color-fg: #e6edf7;
  --color-border: rgba(230, 237, 247, 0.14);
}
```
