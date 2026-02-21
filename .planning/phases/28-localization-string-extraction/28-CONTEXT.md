# Phase 28: Localization String Extraction - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract all ~415+ hardcoded English strings across all ~80+ component templates into Transloco translation JSON files (EN + TR), and add CI enforcement to prevent regressions. Phase 27 established the Transloco infrastructure, language switcher, locale formatting, and two feature scopes (contacts, settings). This phase completes full coverage.

</domain>

<decisions>
## Implementation Decisions

### Turkish Translation Approach
- Claude produces all Turkish translations — no user review step required
- Formal / business Turkish tone — professional CRM vocabulary (e.g., "Kisi" for Contact, "Anlasma" for Deal, "Gorev" for Task)
- Claude's Discretion: "siz" (formal) vs "sen" (informal) for user-facing text — pick based on CRM industry conventions
- Common English loanwords stay in English: "Pipeline", "Dashboard", "Lead", "CRM", etc. — do not translate terms widely used in Turkish B2B SaaS

### Translation Scope Organization
- **One scope per feature** — each of the 18+ feature areas gets its own translation scope folder (e.g., `assets/i18n/deals/`, `assets/i18n/companies/`, `assets/i18n/tasks/`, etc.)
- **Shared component strings go in the global file** (`en.json` / `tr.json` root) — DynamicTable, FilterPanel, RelatedEntityTabs, EntityTimeline, and other shared components use global keys
- **Common labels deduplicated to global** — strings like "Name", "Email", "Status", "Actions", "Save", "Cancel", "Delete" that appear in multiple features live in the global file under a `common` section
- Claude's Discretion: Where validation error messages live (global vs per-feature) — decide based on how validation is currently implemented
- Claude's Discretion: Where snackbar/toast messages live (global vs per-feature) — decide based on how similar messages are across features

### Key Naming Convention
- **Nested JSON structure** — matching Phase 27 patterns (e.g., `{ "list": { "title": "...", "addButton": "..." } }`)
- Claude's Discretion: Grouping within feature scopes — by page section (list/detail/form/dialog) vs by string type (labels/buttons/messages) — pick what's most maintainable
- Claude's Discretion: Key casing (camelCase vs kebab-case) — follow Phase 27 precedent

### CI Enforcement
- CI script validates three things:
  1. **Key parity** — EN and TR translation JSON files have identical key sets (no missing translations)
  2. **Hardcoded string detection** — scan .html templates for text content not wrapped in transloco pipe (catches regressions)
  3. **Unused key detection** — cross-reference JSON keys against template usage to keep files clean
- Claude's Discretion: Strictness level (hard fail vs warning) — pick what's appropriate
- Claude's Discretion: Script location (npm script vs Angular builder) — pick the simplest approach

</decisions>

<specifics>
## Specific Ideas

- Phase 27 established patterns: use `transloco` pipe for OnPush components, `selectTranslateObject()` for services — follow these consistently
- Existing scopes (contacts, settings) are already done and serve as the reference implementation
- Global file already has `nav`, `common.paginator`, `userMenu`, `auth`, `validation`, `table` sections from Phase 27

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-localization-string-extraction*
*Context gathered: 2026-02-21*
