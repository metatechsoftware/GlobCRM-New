# Phase 27: Localization Foundation - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the i18n infrastructure (Transloco) so users can switch the CRM interface between English and Turkish at runtime, with locale-aware date/number/currency formatting and persistent language preference. Phase 28 handles full string extraction across all components.

</domain>

<decisions>
## Implementation Decisions

### Language Switcher Design
- Switcher lives **inside the user profile dropdown menu**, not as a standalone navbar element
- Display as a simple **EN / TR text abbreviation toggle** (segmented control or toggle within the menu)
- Switching is **instant** — no confirmation dialog
- A **small "EN" or "TR" text badge** appears near the user avatar/menu button so the current language is visible without opening the menu

### Locale Formatting Rules
- **Currency is a per-tenant setting**, not tied to language — locale only controls number/date formatting, not currency symbol
- **Time format follows locale convention**: Turkish uses 24-hour (14:30), English uses 12-hour (2:30 PM)
- **First day of week follows locale convention**: Turkish starts Monday, English starts Sunday
- **Date formats**: Turkish: 20.02.2026, English: 02/20/2026
- **Number grouping**: Turkish: 1.234,56 (dot thousand, comma decimal), English: 1,234.56 (comma thousand, dot decimal)

### Default Language & Detection
- **First visit**: Detect language from browser settings — if Turkish, show Turkish; otherwise default to English
- **Persistence**: Backend user profile is source of truth, localStorage caches the preference for instant load before auth
- **Login page**: Uses localStorage cache if available (returning user gets their last language); otherwise falls back to browser detection
- **HTML accessibility**: Update `<html lang="tr">` or `<html lang="en">` attribute on language switch for screen readers

### Claude's Discretion
- **API localization approach**: Claude decides whether backend returns localized messages or frontend handles all translation (pragmatic choice for this phase)
- **Translation scope granularity**: Claude decides the lazy-loading scope structure (per-feature, shared+feature, etc.)
- **Foundation phase translation coverage**: Claude decides how many strings to translate in Phase 27 vs deferring to Phase 28 — enough to prove the system works end-to-end
- **Translation key format**: Claude decides between nested JSON or flat dot-notation keys (follow Transloco conventions)

</decisions>

<specifics>
## Specific Ideas

- Two-language system (EN + TR) is sufficient — no need to over-engineer for N languages right now
- The toggle should feel lightweight — it's a setting, not a primary action
- Currency being per-tenant is important because the same Turkish-speaking user might work with EUR or USD deals

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-localization-foundation*
*Context gathered: 2026-02-21*
