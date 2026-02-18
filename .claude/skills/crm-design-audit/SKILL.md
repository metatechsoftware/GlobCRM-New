---
name: crm-design-audit
description: Audits a CRM/frontend codebase for inconsistent styling and proposes a token + component standardization plan. Runs in a forked ui-architect subagent for clean output.
argument-hint: "[optional focus area]"
context: fork
agent: ui-architect
allowed-tools: Read, Grep, Glob, Bash
disable-model-invocation: true
---

# CRM Design Audit (Forked)

Audit this repository's UI for consistency and propose a practical standardization plan.

FOCUS (optional): $ARGUMENTS

## What to look for
- Buttons: variants, sizes, radii, icon placement, disabled states
- Forms: input heights, label styles, errors, helper text, spacing
- Tables: header styles, row density, empty states, selection, pagination
- Layout: page headers, panels/cards, spacing scale drift
- Colors: raw hex usage, inconsistent semantic roles
- Typography: mixed font sizes/weights and heading hierarchy
- Motion: inconsistent transitions, missing reduced-motion handling

## Output (strict)

### 1) Inconsistencies found
Group by area (Buttons, Forms, Tables, Layout, Colors, Typography, Motion).
Include file paths when possible.

### 2) Proposed standards
- Token roles (colors, spacing, radius, shadow)
- Component source-of-truth list (what becomes canonical)

### 3) Migration plan (small PR-sized steps)
A sequence of 5–12 steps, each step shippable.

### 4) "Do not do" rules
3–8 bullets that prevent future drift.

### 5) Suggested next command
Recommend the next skill to run (e.g., /frontend-design-tokens, /frontend-component-builder, /frontend-quality-gates).
