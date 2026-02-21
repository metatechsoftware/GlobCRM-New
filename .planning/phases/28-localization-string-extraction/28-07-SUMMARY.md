---
phase: 28-localization-string-extraction
plan: 07
status: complete
started: 2026-02-21
completed: 2026-02-21
---

## What Was Built

Created a CI translation validation script that enforces three checks: key parity between EN/TR files, hardcoded string detection in templates, and unused key detection. Established a baseline for known exceptions to prevent regression.

## Key Results

- **CI script** at `globcrm-web/scripts/check-translations.js` (540 lines)
- **npm script**: `npm run check:i18n` added to package.json
- **Three validation checks**: key parity (hard fail), hardcoded strings (hard fail), unused keys (warning)
- **Baseline mechanism**: `scripts/i18n-baseline.json` tracks 347 known exceptions
- **Key parity**: PASS across all 18+ scopes — EN and TR files have identical key sets
- **Hardcoded strings**: 0 new errors (347 baselined exceptions, mostly aria-labels and settings sub-pages)
- **Unused keys**: 319 warnings (keys created proactively for future template wiring)

## Key Files

### Created
- `globcrm-web/scripts/check-translations.js` — CI validation script
- `globcrm-web/scripts/i18n-baseline.json` — Known exception baseline

### Modified
- `globcrm-web/package.json` — Added `check:i18n` npm script

## Patterns Established

- Baseline approach for hardcoded string detection: `--update-baseline` flag captures current state
- Fingerprint-based comparison (`file::text`) ignores line number changes
- Brand allowlist (GlobCRM, CRM, API, etc.) prevents false positives on non-translatable terms
- Inline template extraction via regex for TS files with `template: \`...\``
- mat-icon content automatically skipped (lowercase identifiers)

## Self-Check: PASSED
