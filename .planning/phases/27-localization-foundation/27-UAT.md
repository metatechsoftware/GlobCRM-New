---
status: diagnosed
phase: 27-localization-foundation
source: [27-01-SUMMARY.md, 27-02-SUMMARY.md, 27-03-SUMMARY.md, 27-04-SUMMARY.md, 27-05-SUMMARY.md]
started: 2026-02-21T08:00:00Z
updated: 2026-02-21T08:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Language Switcher in Navbar
expected: Open the user dropdown menu (click avatar/name in top-right). You should see an EN/TR segmented toggle between the Security and Sign Out items. The label above it says "Language" (or "Dil" if already in Turkish).
result: pass

### 2. Switch to Turkish
expected: Click "TR" on the toggle. The entire UI should switch to Turkish instantly — nav items, menu labels, and page content change language without a page reload. The menu stays open after clicking.
result: issue
reported: "nav items, menu labels, and page content did not react immediatly or after refresh"
severity: major

### 3. Lang Badge Near Avatar
expected: After switching to TR, close the menu. A small pill/badge near the avatar in the navbar should show "TR". Switch back to EN — the badge should show "EN".
result: pass

### 4. Paginator Labels in Turkish
expected: While in Turkish, navigate to any list page with a paginator (e.g., Contacts). The paginator should show Turkish labels — "Sayfa basina" (items per page) and Turkish text for the range display and navigation tooltips.
result: issue
reported: "the date inside the list changes but not the paginator"
severity: major

### 5. Datepicker Month Names in Turkish
expected: While in Turkish, open any form with a datepicker (e.g., create/edit an Activity or Deal). The datepicker calendar should show Turkish month names (Ocak, Subat, Mart...) and day abbreviations (Pzt, Sal, Car...).
result: pass

### 6. Date Column Locale Formatting
expected: While in Turkish, navigate to any list page with date columns (e.g., Contacts or Deals). Date values should display in Turkish format (e.g., 21.02.2026 instead of 02/21/2026). Switch to English and dates should revert to English format.
result: pass

### 7. Language Settings Page
expected: Navigate to Settings. In the Organization section, you should see a "Language" card. Click it to open the Language Settings page. It should show a language selector where an admin can set the organization's default language.
result: issue
reported: "When I change it I get Http failure response for http://localhost:5233/api/organizations/settings/language: 404 Not Found"
severity: blocker

### 8. Organization Default Language
expected: On the Language Settings page, change the default language (e.g., from English to Turkish). The change should save immediately on selection (no separate Save button needed). A success indicator should confirm the save.
result: issue
reported: "I got Http failure response for http://localhost:5233/api/organizations/settings/language: 404 Not Found"
severity: blocker

### 9. Language Persists Across Login
expected: Switch to Turkish via the navbar toggle. Log out, then log back in. After login, the UI should automatically be in Turkish — the language preference was saved to your profile and restored on login.
result: pass

## Summary

total: 9
passed: 5
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "UI switches to Turkish instantly when TR is selected — nav items, menu labels, page content change language"
  status: failed
  reason: "User reported: nav items, menu labels, and page content did not react immediatly or after refresh"
  severity: major
  test: 2
  root_cause: "NavbarComponent navGroups is a static readonly array with hardcoded English strings — not reactive. TranslocoPipe is not imported in any component's imports array, so the transloco pipe cannot be used in templates. User menu items (My Profile, Security, Sign Out) are also hardcoded string literals in the template."
  artifacts:
    - path: "globcrm-web/src/app/shared/components/navbar/navbar.component.ts"
      issue: "navGroups is static readonly with hardcoded English strings (lines 67-115); TranslocoPipe not in imports array (lines 34-45)"
    - path: "globcrm-web/src/app/shared/components/navbar/navbar.component.html"
      issue: "User menu items hardcoded as string literals (lines 145-170)"
  missing:
    - "Import TranslocoPipe in NavbarComponent imports array"
    - "Convert navGroups to computed() signal using translocoService.translate() with currentLang() dependency"
    - "Replace hardcoded user menu strings with transloco pipe bindings"
  debug_session: ".planning/debug/transloco-lang-switch-no-rerender.md"

- truth: "Paginator labels display in Turkish when language is set to TR"
  status: failed
  reason: "User reported: the date inside the list changes but not the paginator"
  severity: major
  test: 4
  root_cause: "Race condition in TranslatedPaginatorIntl — subscribes to langChanges$ which fires synchronously before translation JSON is loaded via HTTP. translate() calls return English fallback because TR translations aren't in memory yet."
  artifacts:
    - path: "globcrm-web/src/app/core/i18n/transloco-paginator-intl.ts"
      issue: "Uses langChanges$ which fires before translation file is loaded (lines 22-42)"
  missing:
    - "Replace langChanges$ subscription with selectTranslateObject('common.paginator') which waits for translation file to load before emitting"
  debug_session: ".planning/debug/paginator-labels-stay-english.md"

- truth: "PUT /api/organizations/settings/language endpoint saves organization default language"
  status: failed
  reason: "User reported: When I change it I get Http failure response for http://localhost:5233/api/organizations/settings/language: 404 Not Found"
  severity: blocker
  test: 7
  root_cause: "Stale backend binary — endpoint correctly exists at OrganizationsController.cs line 240 [HttpPut('settings/language')] but the running dotnet process was never restarted after Phase 27-04 added the route. ASP.NET Core does not hot-reload controller route table changes."
  artifacts:
    - path: "src/GlobCRM.Api/Controllers/OrganizationsController.cs"
      issue: "Endpoint exists (line 240) but running process is stale — no code change needed"
  missing:
    - "Restart backend: cd src/GlobCRM.Api && dotnet run"
  debug_session: ".planning/debug/org-settings-language-404.md"

- truth: "Organization default language saves immediately on selection with success confirmation"
  status: failed
  reason: "User reported: I got Http failure response for http://localhost:5233/api/organizations/settings/language: 404 Not Found"
  severity: blocker
  test: 8
  root_cause: "Same as Test 7 — stale backend binary. No code change needed, only backend restart."
  artifacts: []
  missing:
    - "Restart backend: cd src/GlobCRM.Api && dotnet run"
  debug_session: ".planning/debug/org-settings-language-404.md"
