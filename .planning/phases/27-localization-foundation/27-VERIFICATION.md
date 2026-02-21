---
phase: 27-localization-foundation
verified: 2026-02-21T08:30:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "User's selected language persists across browser sessions (saved to user profile, restored on login)"
    status: failed
    reason: "syncFromProfile() method exists in LanguageService but is never called from the auth flow. Backend language preference cannot be restored on login — only localStorage is used. The persistence chain to backend (via profileService.updatePreferences) fires on switch, but no path reads it back on login."
    artifacts:
      - path: "globcrm-web/src/app/core/i18n/language.service.ts"
        issue: "syncFromProfile() defined at line 50 but has zero callers outside its own file"
      - path: "globcrm-web/src/app/core/auth/auth.service.ts"
        issue: "handleLoginSuccess() (line 218) does not inject or call LanguageService.syncFromProfile()"
    missing:
      - "Call languageService.syncFromProfile(user.language) inside AuthService.handleLoginSuccess() after user info is decoded from JWT, OR after loadUserInfo() returns — wherever the user's language preference is available"
      - "Ensure user.language or preferences.language is included in the JWT claims or fetched post-login so syncFromProfile receives the actual profile language"
human_verification:
  - test: "Open app in English, switch to Turkish (should save to profile via fire-and-forget). Log out. Log back in. Verify Turkish is restored."
    expected: "App loads in Turkish after re-login because syncFromProfile reads backend preference"
    why_human: "Requires a live auth round-trip; cannot verify localStorage vs backend restoration programmatically without running the app"
  - test: "Navigate to /contacts and open browser network tab. Verify contacts/en.json (or contacts/tr.json) loads as a separate HTTP request distinct from the global en.json."
    expected: "Separate network request to assets/i18n/contacts/en.json when visiting contacts page for the first time"
    why_human: "Lazy-loading behavior requires runtime network inspection"
  - test: "Navigate to any paginated list page. Switch language to Turkish. Verify paginator shows 'Sayfa basina oge' instead of 'Items per page'."
    expected: "Paginator labels update instantly in Turkish without page reload"
    why_human: "Requires visual verification of Angular Material component label update"
  - test: "Admin navigates to /settings/language, changes default to Turkish. Invite a new user (or simulate first login). Verify the new user's UI loads in Turkish."
    expected: "New user with no personal preference inherits org default language"
    why_human: "Requires invitation flow and new user login — cannot verify programmatically. Also depends on the syncFromProfile gap being closed."
---

# Phase 27: Localization Foundation Verification Report

**Phase Goal:** Users can switch the CRM interface between English and Turkish at runtime, with locale-aware formatting and persistent language preference
**Verified:** 2026-02-21T08:30:00Z
**Status:** gaps_found — 1 gap blocking full goal achievement
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | User can click language selector in navbar and entire UI switches between EN/TR without page reload | VERIFIED | `navbar.component.html` lines 154-165: EN/TR segmented toggle with `(click)="switchLanguage('en'/'tr')"`. `reRenderOnLangChange: true` in app.config.ts. |
| 2 | User's selected language persists across browser sessions (saved to user profile, restored on login) | FAILED | `updatePreferences()` fires on switch (write side works). But `syncFromProfile()` is **never called** from auth flow — backend language is never read back on login. localStorage fallback only. |
| 3 | Date, number, and currency values render in locale-appropriate format (TR: 20.02.2026, 1.234,56; EN: 02/20/2026, 1,234.56) | VERIFIED | `dynamic-table.component.ts` line 504: `Intl.DateTimeFormat(locale, ...)` with `getActiveLang() === 'tr' ? 'tr-TR' : 'en-US'`. `DateAdapter.setLocale()` called in `switchLanguage()`. |
| 4 | Angular Material components (paginator "of", sort headers, date picker) display labels in selected language | VERIFIED | `transloco-paginator-intl.ts`: full `TranslatedPaginatorIntl` extending `MatPaginatorIntl`, subscribed to `langChanges$`, registered at root via `{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }` in `app.config.ts`. `provideNativeDateAdapter()` at root. |
| 5 | Translation files lazy-load per feature scope (navigating to contacts loads only contact translations), and missing keys fall back to English | VERIFIED | `contacts.routes.ts` line 8: `provideTranslocoScope('contacts')`. `settings.routes.ts` line 8: `provideTranslocoScope('settings')`. `missingHandler: { useFallbackTranslation: true }` in app.config.ts. Translation files exist at `assets/i18n/contacts/{en,tr}.json` and `assets/i18n/settings/{en,tr}.json`. |

**Score:** 4/5 success criteria verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Status | Evidence |
|---|---|---|
| `globcrm-web/src/app/core/i18n/transloco-loader.ts` | VERIFIED | Exists, 12 lines, `TranslocoHttpLoader` implements `TranslocoLoader`, calls `http.get<Translation>(`./assets/i18n/${lang}.json`)` |
| `globcrm-web/src/app/core/i18n/language.service.ts` | VERIFIED | Exists, 104 lines, `LanguageService` with `switchLanguage`, `detectLanguage`, `initLanguage`, `syncFromProfile`. Injected and called in `app.component.ts` constructor. |
| `globcrm-web/src/assets/i18n/en.json` | VERIFIED | Exists, contains `common`, `common.paginator`, `nav`, `auth`, `userMenu`, `common.validation`, `common.table` keys. Valid JSON. |
| `globcrm-web/src/assets/i18n/tr.json` | VERIFIED | Exists, contains all matching Turkish keys with proper Turkish characters. Valid JSON. |

### Plan 02 Artifacts

| Artifact | Status | Evidence |
|---|---|---|
| `globcrm-web/src/app/shared/components/navbar/navbar.component.html` | VERIFIED | Lines 59, 94: lang badges on desktop and mobile. Lines 154-165: EN/TR segmented toggle in user menu with `switchLanguage` calls. |
| `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` | VERIFIED | Line 56: `inject(LanguageService)`. Line 57: `readonly currentLang = this.languageService.currentLang`. Lines 145-147: `switchLanguage()` delegates to `languageService.switchLanguage()`. |

### Plan 03 Artifacts

| Artifact | Status | Evidence |
|---|---|---|
| `globcrm-web/src/app/core/i18n/transloco-paginator-intl.ts` | VERIFIED | Exists, 44 lines, `TranslatedPaginatorIntl extends MatPaginatorIntl`, subscribes to `langChanges$` with `takeUntilDestroyed`, calls `this.changes.next()`. |
| `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts` | VERIFIED | Line 101: `inject(TranslocoService)`. Line 504: `getActiveLang() === 'tr' ? 'tr-TR' : 'en-US'` — locale-aware `Intl.DateTimeFormat`. No hardcoded `en-US` outside the conditional mapping. |

### Plan 04 Artifacts

| Artifact | Status | Evidence |
|---|---|---|
| `globcrm-web/src/assets/i18n/contacts/en.json` | VERIFIED | Exists, contains `list`, `detail`, `form` keys as required. |
| `globcrm-web/src/assets/i18n/contacts/tr.json` | VERIFIED | Exists, valid JSON, Turkish translations for list/detail/form. |
| `globcrm-web/src/assets/i18n/settings/en.json` | VERIFIED | Exists, contains `language` key section. |
| `globcrm-web/src/assets/i18n/settings/tr.json` | VERIFIED | Exists, valid JSON, Turkish translations including `language` section. |
| `src/GlobCRM.Domain/Entities/Organization.cs` | VERIFIED | Line 51: `public string DefaultLanguage { get; set; } = "en";` with XML doc comment. |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|---|---|---|---|---|
| `app.config.ts` | `transloco-loader.ts` | `provideTransloco({ loader: TranslocoHttpLoader })` | WIRED | `app.config.ts` line 45: `loader: TranslocoHttpLoader` |
| `app.component.ts` | `language.service.ts` | `inject LanguageService`, call `initLanguage()` | WIRED | `app.component.ts` lines 110, 113: `inject(LanguageService)` + `this.languageService.initLanguage()` in constructor |
| `navbar.component.ts` | `language.service.ts` | `inject LanguageService`, call `switchLanguage()` | WIRED | `navbar.component.ts` line 56, 146: injection + delegation confirmed |
| `language.service.ts` | `profile.service.ts` | `updatePreferences({ language })` fire-and-forget | WIRED | `language.service.ts` line 34: `this.profileService.updatePreferences({ language: lang }).subscribe(...)` |
| `language.service.ts` | `profile.service.ts` | `syncFromProfile()` called on login | NOT WIRED | `syncFromProfile()` is defined (line 50) but has **zero callers** in the codebase. `auth.service.ts` `handleLoginSuccess()` does not call it. |
| `app.config.ts` | `transloco-paginator-intl.ts` | `{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }` | WIRED | `app.config.ts` line 31 confirmed |
| `app.config.ts` | `@angular/material/core` | `provideNativeDateAdapter()` | WIRED | `app.config.ts` line 30 confirmed |
| `contacts.routes.ts` | `assets/i18n/contacts/` | `provideTranslocoScope('contacts')` | WIRED | `contacts.routes.ts` line 2, 8: import + provider confirmed |
| `settings.routes.ts` | `assets/i18n/settings/` | `provideTranslocoScope('settings')` | WIRED | `settings.routes.ts` line 2, 8: import + provider confirmed |
| `OrganizationsController.cs` | `Organization.cs` | `GET/PUT DefaultLanguage endpoint` | WIRED | Lines 221-233 (`GetDefaultLanguage`), 240-268 (`UpdateDefaultLanguage`) both read/write `organization.DefaultLanguage` |
| `language.service.ts` | `api/organizations/default-language` | `syncFromProfile()` org default fallback | PARTIAL | Code path exists at lines 62-83, but is unreachable because `syncFromProfile()` is never invoked |

---

## Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|---|---|---|---|---|
| LOCL-01 | 27-02 | User can switch UI language between EN/TR at runtime without page reload | SATISFIED | Navbar toggle wired to `LanguageService.switchLanguage()`. Transloco `reRenderOnLangChange: true`. |
| LOCL-02 | 27-02 | User's language preference persists across sessions (saved to profile) | PARTIAL | Write side works (backend `updatePreferences` called on switch). Read side broken: `syncFromProfile()` never called on login. On reload, localStorage is used (not backend profile). |
| LOCL-04 | 27-03 | Date, number, currency values format per locale | SATISFIED | DynamicTable uses `Intl.DateTimeFormat` with active locale. `DateAdapter.setLocale()` called on switch. |
| LOCL-05 | 27-04 | Translation files lazy-load per feature scope | SATISFIED | `provideTranslocoScope('contacts')` and `provideTranslocoScope('settings')` in route providers. Scope files exist at `assets/i18n/{scope}/{lang}.json`. |
| LOCL-06 | 27-01 | Missing translations fall back to English without showing broken keys | SATISFIED | `missingHandler: { useFallbackTranslation: true, logMissingKey: true }` in `app.config.ts`. |
| LOCL-07 | 27-04 | Admin can set org default language; new users inherit it | PARTIAL | Admin UI and backend endpoints exist and are wired. But new-user inheritance depends on `syncFromProfile()` being called on login — which is not wired. |
| LOCL-08 | 27-03 | Angular Material components display labels in selected language | SATISFIED | `TranslatedPaginatorIntl` reactive labels + root `provideNativeDateAdapter()` with `DateAdapter.setLocale()` on switch. |

**Orphaned requirements check:** REQUIREMENTS.md lists LOCL-03, LOCL-09, LOCL-10 as Phase 28 — correct, none are claimed by Phase 27 plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts` | 548-553 | `getPageRangeSummary()` returns hardcoded English strings ("No records", "Showing X-Y of Z") | Warning | Page range summary in footer is not localized — shows English regardless of active language |
| `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` | 67-115 | All `navGroups` labels (CRM, Work, Connect, Admin, item labels) are hardcoded English strings | Info | Nav labels are not translated through Transloco — expected in Phase 28, not a blocker for Phase 27 goals |

No blockers from anti-patterns. The hardcoded nav labels are expected scope for Phase 28 (LOCL-10).

---

## Human Verification Required

### 1. Backend language persistence on login

**Test:** Switch to Turkish. Log out. Log back in. Check which language loads.
**Expected:** If `syncFromProfile()` were wired, Turkish would restore from backend profile. Currently, only localStorage provides this — meaning it works on the same browser but not after clearing storage or logging in on a new device.
**Why human:** Requires a live auth round-trip and storage inspection.

### 2. Feature scope lazy-loading in network tab

**Test:** Open browser DevTools Network tab, filter by `i18n`. Navigate to `/contacts` for the first time.
**Expected:** A separate HTTP GET request to `assets/i18n/contacts/en.json` (not just the global `en.json`).
**Why human:** Network request behavior requires runtime browser inspection.

### 3. Paginator label update on language switch

**Test:** Navigate to any entity list page (e.g., contacts). Open user menu. Switch language to Turkish. Observe the paginator at the bottom of the table.
**Expected:** Paginator updates to "Sayfa basina oge" for "Items per page" without page reload.
**Why human:** Requires visual verification of reactive Angular Material component label update.

### 4. New user org default inheritance

**Test:** Admin sets org default to Turkish at `/settings/language`. Invite a new user. New user accepts invite and logs in for the first time (no personal language preference set).
**Expected:** New user's UI loads in Turkish (inherits org default).
**Why human:** Requires full invitation flow + new user login. Also currently blocked by the `syncFromProfile()` gap.

---

## Gaps Summary

**One gap blocks full goal achievement:**

The persistence chain has a broken read path. `LanguageService.syncFromProfile()` was built to restore the user's backend language preference after login, and to apply the organization's default language for new users (LOCL-07). The method is fully implemented at lines 50-84 of `language.service.ts`, including the org-default API call fallback. However, **it is never invoked**. The `auth.service.ts` `handleLoginSuccess()` method (line 218) does not inject or call `LanguageService`, and no other component or service calls `syncFromProfile()` anywhere in the codebase.

**Impact:**
- LOCL-02 is partial: Language saves to backend (write works), but on next login the backend preference is ignored and localStorage takes precedence. On a new device or after clearing storage, the user starts in English regardless of their backend preference.
- LOCL-07 is partial: Org default language setting works at the admin level (backend + UI), but new users never receive the org default because `syncFromProfile()` is not called during the login flow.

**Fix is small:** Inject `LanguageService` into `AuthService` and call `this.languageService.syncFromProfile(userInfo?.language)` inside `handleLoginSuccess()` after the user info is decoded from JWT. Alternatively, call it from `AuthStore` when user state changes, or from `app.component.ts` in an auth effect.

---

*Verified: 2026-02-21T08:30:00Z*
*Verifier: Claude (gsd-verifier)*
