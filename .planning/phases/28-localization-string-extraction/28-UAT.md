---
status: diagnosed
phase: 28-localization-string-extraction
source: 28-01-SUMMARY.md, 28-02-SUMMARY.md, 28-03-SUMMARY.md, 28-04-SUMMARY.md, 28-05-SUMMARY.md, 28-06-SUMMARY.md, 28-07-SUMMARY.md, 28-08-SUMMARY.md, 28-09-SUMMARY.md, 28-10-SUMMARY.md
started: 2026-02-21T17:00:00Z
updated: 2026-02-21T18:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Angular Build Compiles
expected: Run `cd globcrm-web && npx ng build --configuration development`. The build completes with 0 errors. Warnings are acceptable.
result: pass

### 2. CI Translation Validation Passes
expected: Run `cd globcrm-web && npm run check:i18n`. The script reports 0 errors for key parity and hardcoded strings. The baseline should show only 2 false-positive entries. Unused key warnings are acceptable.
result: pass

### 3. Language Switcher to Turkish
expected: Navigate to Settings > Language (or the language switcher in the app). Switch from English to Turkish. The UI should respond immediately — page labels, buttons, and navigation items change to Turkish text. No page reload required.
result: issue
reported: "The language switcher under profile works immediately but Settings > Language doesnt respond immediately but gives successfully updated db"
severity: minor

### 4. Shared Components in Turkish
expected: With Turkish active, open any entity list page (e.g., Contacts). The DynamicTable should show Turkish text for: search placeholder, column headers tooltip, empty state message, pagination summary (e.g., "Sayfa X / Y"), and action buttons. The filter panel should show Turkish labels. "Clear all" in filter chips should be Turkish.
result: issue
reported: "column headers dont but the rest works"
severity: major

### 5. Contacts Pages in Turkish
expected: With Turkish active, navigate to Contacts. The list page title, column headers, and action buttons should be in Turkish. Open a contact detail — tabs, section headers, field labels (E-posta, Telefon, etc.) should be Turkish. Open the contact form — all field labels, placeholders, and buttons should be in Turkish.
result: issue
reported: "page title is list.title and the form is similar and the column headers dont work"
severity: major

### 6. Deals Pages in Turkish
expected: With Turkish active, navigate to Deals. List page shows Turkish labels. Switch to Kanban view — column headers and card labels should be Turkish. Open a deal detail — all tabs and field labels in Turkish. Open deal form — all labels, placeholders, and buttons in Turkish.
result: issue
reported: "same issue, raw keys showing and column headers not translating"
severity: major

### 7. Dashboard Widgets in Turkish
expected: With Turkish active, navigate to Dashboard. Widget titles (KPI cards, leaderboard, charts, target progress) should display in Turkish. Date range filter labels should be Turkish. Widget configuration dialog (if opened) should show Turkish labels.
result: issue
reported: "widgets have plain english"
severity: major

### 8. Settings Hub in Turkish
expected: With Turkish active, navigate to Settings. The settings hub page should show Turkish titles and descriptions for each settings category (Roles, Teams, Pipelines, Custom Fields, Webhooks, etc.). The search bar placeholder should be Turkish. Click into any sub-page (e.g., Roles) — all labels, buttons, and table headers should be Turkish.
result: issue
reported: "raw key on duplicates, webhooks, language"
severity: major

### 9. Auth Pages in Turkish
expected: With Turkish active (or after switching language on the login page if available), view the Login page. Form labels ("E-posta", "Parola"), buttons ("Giris Yap"), and links should be in Turkish. The Signup page should similarly show Turkish labels and validation messages.
result: pass

### 10. Notifications & Global Search in Turkish
expected: With Turkish active, open the Notification Center. Labels like "Notifications", "Mark all as read", and empty state text should be Turkish. Open Global Search (Ctrl+K or search icon) — the placeholder and section labels ("Recent", "No results") should be Turkish.
result: issue
reported: "category names english with big i"
severity: minor

### 11. Confirm Delete Dialog in Turkish
expected: With Turkish active, trigger a delete action on any entity (e.g., action menu on a contact). The confirmation dialog should show Turkish text for the title, message, and Cancel/Delete buttons.
result: pass

### 12. Entity Preview Sidebar in Turkish
expected: With Turkish active, click on an entity row to open the preview sidebar. Field labels (E-posta, Telefon, Sehir, etc.) should be in Turkish. The "Related" section label, "Recent Activities" label, and "No activities yet" / "No notes yet" empty states should be Turkish.
result: skipped
reason: User deferred remaining tests to fix issues first

### 13. Switch Back to English
expected: Switch the language back to English. All pages should revert to English text. No Turkish text remnants should remain. Navigation, buttons, and labels should all be English again.
result: skipped
reason: User deferred remaining tests to fix issues first

## Summary

total: 13
passed: 4
issues: 7
pending: 0
skipped: 2

## Gaps

- truth: "Settings > Language switcher should respond immediately like profile switcher"
  status: failed
  reason: "User reported: The language switcher under profile works immediately but Settings > Language doesnt respond immediately but gives successfully updated db"
  severity: minor
  test: 3
  root_cause: "Settings language page only persists preference to DB but does not call LanguageService.setActiveLang() to trigger immediate Transloco language switch"
  artifacts:
    - path: "globcrm-web/src/app/features/settings/language/language-settings.component.ts"
      issue: "Save handler updates DB but does not call LanguageService.setActiveLang() for immediate UI switch"
  missing:
    - "After successful DB save, call LanguageService.setActiveLang(selectedLang) to trigger immediate Transloco language switch"
  debug_session: ""

- truth: "DynamicTable column headers should display in Turkish when language is switched"
  status: failed
  reason: "User reported: column headers dont but the rest works"
  severity: major
  test: 4
  root_cause: "Column definitions use hardcoded English label strings in TS (label: 'Name'), and DynamicTable renders them via getColumnLabel() without transloco pipe"
  artifacts:
    - path: "globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts"
      issue: "getColumnLabel() returns raw label string without translation"
    - path: "globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.html"
      issue: "{{ getColumnLabel(col.fieldId) }} rendered without transloco pipe"
    - path: "globcrm-web/src/app/shared/components/dynamic-table/column-picker.component.ts"
      issue: "{{ col.label }} rendered without transloco pipe"
    - path: "globcrm-web/src/app/features/contacts/contact-list/contact-list.component.ts"
      issue: "coreColumnDefs uses hardcoded English labels: label: 'Name', label: 'Email'"
  missing:
    - "Convert column label strings to translation keys in all entity list components"
    - "Update DynamicTable getColumnLabel() to translate keys via TranslocoService"
    - "Update column-picker to translate column labels"
    - "Add column label translation keys to each feature scope JSON"
  debug_session: ""

- truth: "Feature-scoped translation keys (list.title, form labels) should resolve to translated values, not show raw keys"
  status: failed
  reason: "User reported: page title is list.title and the form is similar and the column headers dont work"
  severity: major
  test: 5
  root_cause: "TranslocoHttpLoader only implements getTranslation(lang) for root files — missing scope parameter handling, so scoped JSON files (contacts/en.json, deals/en.json) are never loaded"
  artifacts:
    - path: "globcrm-web/src/app/core/i18n/transloco-loader.ts"
      issue: "getTranslation(lang) only loads ./assets/i18n/${lang}.json — does not handle scope parameter for ./assets/i18n/{scope}/{lang}.json"
  missing:
    - "Update TranslocoHttpLoader.getTranslation() to accept scope parameter and load scoped files from ./assets/i18n/{scope}/{lang}.json"
  debug_session: ""

- truth: "Deals pages should display Turkish translations for all labels, not raw keys"
  status: failed
  reason: "User reported: same issue, raw keys showing and column headers not translating"
  severity: major
  test: 6
  root_cause: "Same as Test 5 — TranslocoHttpLoader missing scope support, deals/en.json never loaded"
  artifacts:
    - path: "globcrm-web/src/app/core/i18n/transloco-loader.ts"
      issue: "Missing scope parameter handling in getTranslation()"
  missing:
    - "Fix TranslocoHttpLoader scope support (same fix as Test 5)"
  debug_session: ""

- truth: "Dashboard widgets should display in Turkish when language is switched"
  status: failed
  reason: "User reported: widgets have plain english"
  severity: major
  test: 7
  root_cause: "Same as Test 5 — TranslocoHttpLoader missing scope support, dashboard/en.json never loaded. Widget components correctly use TranslocoPipe but scoped files not fetched."
  artifacts:
    - path: "globcrm-web/src/app/core/i18n/transloco-loader.ts"
      issue: "Missing scope parameter handling in getTranslation()"
  missing:
    - "Fix TranslocoHttpLoader scope support (same fix as Test 5)"
  debug_session: ""

- truth: "Settings sub-pages (duplicates, webhooks, language) should show Turkish translations, not raw keys"
  status: failed
  reason: "User reported: raw key on duplicates, webhooks, language"
  severity: major
  test: 8
  root_cause: "Key prefix mismatch — templates use 'webhooks.list.title' but JSON keys are under settings scope requiring 'settings.webhooks.list.title'. Three components omit the 'settings.' prefix in template pipe references."
  artifacts:
    - path: "globcrm-web/src/app/features/settings/webhooks/webhook-list.component.ts"
      issue: "Template uses 'webhooks.X' keys instead of 'settings.webhooks.X'"
    - path: "globcrm-web/src/app/features/settings/language/language-settings.component.ts"
      issue: "Template uses 'language.X' keys instead of 'settings.language.X'"
    - path: "globcrm-web/src/app/features/settings/duplicate-rules/duplicate-rules.component.ts"
      issue: "Template uses 'duplicateRules.X' keys instead of 'settings.duplicateRules.X'"
  missing:
    - "Add 'settings.' prefix to all template transloco pipe keys in webhook-list, language-settings, and duplicate-rules components"
  debug_session: ""

- truth: "Notification category names should display in Turkish with correct casing"
  status: failed
  reason: "User reported: category names english with big i"
  severity: minor
  test: 10
  root_cause: "Notification type labels are hardcoded English strings with toUpperCase() fallback that breaks Turkish locale I/i rules. Translation keys in my-day scope don't match actual NotificationType enum values."
  artifacts:
    - path: "globcrm-web/src/app/features/my-day/widgets/notification-digest-widget/notification-digest-widget.component.ts"
      issue: "typeLabel() uses toUpperCase() without locale awareness, and translation keys don't match enum values"
    - path: "globcrm-web/src/app/features/settings/notification-preferences/notification-preferences.component.ts"
      issue: "NOTIFICATION_TYPE_LABELS and NOTIFICATION_TYPE_DESCRIPTIONS are hardcoded English strings"
    - path: "globcrm-web/src/assets/i18n/my-day/en.json"
      issue: "Notification type keys (assignment, mention) don't match enum values (ActivityAssigned, Mention)"
  missing:
    - "Add translation keys matching actual NotificationType enum values to my-day and settings scope JSON files"
    - "Replace hardcoded NOTIFICATION_TYPE_LABELS/DESCRIPTIONS with TranslocoService.translate() calls"
    - "Replace toUpperCase() with toLocaleUpperCase() or use translation keys directly"
  debug_session: ""
