# Phase 27: Localization Foundation - Research

**Researched:** 2026-02-21
**Domain:** Angular i18n (Transloco), locale-aware formatting, runtime language switching
**Confidence:** HIGH

## Summary

Phase 27 establishes the i18n infrastructure for GlobCRM, enabling users to switch between English and Turkish at runtime with locale-aware date/number formatting. The standard approach uses **@jsverse/transloco** (v8.x) for translation management and **@jsverse/transloco-locale** for locale-aware formatting pipes, both of which are the current ecosystem standard for runtime i18n in Angular.

The codebase already has the backend plumbing in place: `ApplicationUser.Language` (defaults to `"en"`), `UserPreferencesData.Language`, and `PUT /api/profile/preferences` endpoint that accepts a `language` field. The Organization entity needs a `DefaultLanguage` field added for LOCL-07. The frontend currently uses Angular's built-in `DatePipe`, `CurrencyPipe`, and `Intl.DateTimeFormat` for formatting, all hardcoded to `en-US`. These must be replaced with Transloco locale pipes or wired to respect the active locale.

**Primary recommendation:** Install `@jsverse/transloco` + `@jsverse/transloco-locale`, configure with `provideTransloco()` in app config, set up scoped lazy loading via `provideTranslocoScope()` in feature routes, create a `LanguageService` that syncs Transloco's active language with the user profile backend, and build a language switcher in the user dropdown menu.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Switcher lives **inside the user profile dropdown menu**, not as a standalone navbar element
- Display as a simple **EN / TR text abbreviation toggle** (segmented control or toggle within the menu)
- Switching is **instant** -- no confirmation dialog
- A **small "EN" or "TR" text badge** appears near the user avatar/menu button so the current language is visible without opening the menu
- **Currency is a per-tenant setting**, not tied to language -- locale only controls number/date formatting, not currency symbol
- **Time format follows locale convention**: Turkish uses 24-hour (14:30), English uses 12-hour (2:30 PM)
- **First day of week follows locale convention**: Turkish starts Monday, English starts Sunday
- **Date formats**: Turkish: 20.02.2026, English: 02/20/2026
- **Number grouping**: Turkish: 1.234,56 (dot thousand, comma decimal), English: 1,234.56 (comma thousand, dot decimal)
- **First visit**: Detect language from browser settings -- if Turkish, show Turkish; otherwise default to English
- **Persistence**: Backend user profile is source of truth, localStorage caches the preference for instant load before auth
- **Login page**: Uses localStorage cache if available (returning user gets their last language); otherwise falls back to browser detection
- **HTML accessibility**: Update `<html lang="tr">` or `<html lang="en">` attribute on language switch for screen readers

### Claude's Discretion
- **API localization approach**: Claude decides whether backend returns localized messages or frontend handles all translation (pragmatic choice for this phase)
- **Translation scope granularity**: Claude decides the lazy-loading scope structure (per-feature, shared+feature, etc.)
- **Foundation phase translation coverage**: Claude decides how many strings to translate in Phase 27 vs deferring to Phase 28 -- enough to prove the system works end-to-end
- **Translation key format**: Claude decides between nested JSON or flat dot-notation keys (follow Transloco conventions)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOCL-01 | User can switch UI language between English and Turkish at runtime without page reload | Transloco `setActiveLang()` + `reRenderOnLangChange: true` config handles instant switching. Language switcher in user dropdown menu (locked decision). |
| LOCL-02 | User's language preference persists across sessions (saved to profile) | Backend already has `UserPreferencesData.Language` field + `PUT /api/profile/preferences` endpoint. Frontend needs `LanguageService` to sync Transloco active lang with backend + localStorage cache. |
| LOCL-04 | Date, number, and currency values format according to selected locale | `@jsverse/transloco-locale` provides `translocoDate`, `translocoDecimal`, `translocoCurrency` pipes using native `Intl` APIs. `langToLocaleMapping: { en: 'en-US', tr: 'tr-TR' }` handles locale routing. |
| LOCL-05 | Translation files lazy-load per feature scope | `provideTranslocoScope('contacts')` in feature route providers loads `i18n/contacts/en.json` only when navigating to contacts. Inline loaders also supported. |
| LOCL-06 | Missing translations fall back to English without showing broken keys | Transloco config: `fallbackLang: 'en'`, `missingHandler: { useFallbackTranslation: true, logMissingKey: true }`. Missing keys display fallback English text, not raw keys. |
| LOCL-07 | Admin can set a default language for the organization (new users inherit it) | Requires adding `DefaultLanguage` field to `Organization` entity + migration + settings endpoint. Frontend settings hub gets new "Language" card. New users inherit org default. |
| LOCL-08 | Angular Material components display labels in selected language | Custom `MatPaginatorIntl` class subscribing to `TranslocoService.langChanges$`. `DateAdapter.setLocale()` called on language switch. Sort header labels handled via translation keys. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @jsverse/transloco | ^8.2.1 | Runtime i18n: translation loading, switching, template pipe/directive | De facto Angular i18n library for runtime switching. Signal-based API, standalone support, lazy loading. Replaces deprecated @ngneat/transloco. |
| @jsverse/transloco-locale | ^8.x | Locale-aware date/number/currency formatting pipes | Official companion plugin. Uses native `Intl` APIs. Auto-syncs with Transloco active language. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | Angular Material i18n | Custom `MatPaginatorIntl` + `DateAdapter.setLocale()` are built-in patterns, no extra library. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @jsverse/transloco | Angular built-in i18n (@angular/localize) | Angular's built-in i18n is compile-time only -- requires separate build per language, cannot switch at runtime. Not viable for LOCL-01. |
| @jsverse/transloco | ngx-translate | Deprecated/unmaintained. No signal API. No official Angular 19 support. |
| @jsverse/transloco-locale | Angular built-in pipes (DatePipe, CurrencyPipe) | Built-in pipes require `LOCALE_ID` which is a compile-time token. Transloco-locale auto-syncs with active language, supports runtime switching. |

**Installation:**
```bash
cd globcrm-web && npm install @jsverse/transloco @jsverse/transloco-locale
```

## Architecture Patterns

### Recommended Translation File Structure
```
globcrm-web/src/assets/i18n/
├── en.json                    # Shared/global translations (navbar, common labels, auth)
├── tr.json                    # Shared/global translations (Turkish)
├── contacts/
│   ├── en.json                # Contact feature translations
│   └── tr.json
├── companies/
│   ├── en.json
│   └── tr.json
├── deals/
│   ├── en.json
│   └── tr.json
├── settings/
│   ├── en.json
│   └── tr.json
└── ... (one folder per feature scope)
```

### Discretion Decision: Translation Scope Granularity
**Recommendation: shared + per-feature scopes.**
- **Global scope** (`en.json` / `tr.json`): Navbar labels, common buttons (Save, Cancel, Delete, Search), validation messages, auth screens, shared components (DynamicTable, FilterPanel, Timeline), error messages.
- **Feature scopes**: One per lazy-loaded feature route. Each contains only strings specific to that feature (column headers, detail page labels, form labels, empty states).

This matches the codebase's existing lazy-loaded route architecture (each feature has its own `feature.routes.ts`). The global file stays small (300-500 keys), and each feature scope adds 50-150 keys loaded on demand.

### Discretion Decision: Translation Key Format
**Recommendation: Nested JSON keys with dot-notation access.**
```json
{
  "contacts": {
    "list": {
      "title": "Contacts",
      "empty": "No contacts found"
    },
    "detail": {
      "title": "Contact Details",
      "tabs": {
        "summary": "Summary",
        "timeline": "Timeline"
      }
    }
  }
}
```
Access: `t('contacts.list.title')` in templates. This is the Transloco default convention, keeps keys organized, and scales well.

### Discretion Decision: API Localization Approach
**Recommendation: Frontend handles ALL translation in Phase 27.** Backend returns English-only messages. Rationale:
- Backend validation errors are already English strings -- translating them requires significant backend refactoring.
- Most user-facing text is in the frontend (labels, buttons, headings).
- Backend error messages can be mapped to translation keys in a future phase if needed.
- This keeps Phase 27 focused and avoids backend i18n complexity.

### Discretion Decision: Foundation Phase Translation Coverage
**Recommendation: Translate the following scopes in Phase 27 to prove end-to-end:**
1. **Global scope** (navbar, common buttons, auth pages) -- ~100-150 keys EN+TR
2. **One full feature** (contacts) -- ~80-100 keys EN+TR to prove the scoped lazy-loading pattern
3. **Settings hub** -- to support LOCL-07 admin language setting

Phase 28 handles full string extraction across all remaining features.

### Pattern 1: Transloco Provider Setup in app.config.ts
**What:** Register Transloco at the application root with language config
**When to use:** App bootstrap
```typescript
// Source: Transloco official docs (jsverse.gitbook.io/transloco)
import { isDevMode } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { provideTranslocoLocale } from '@jsverse/transloco-locale';
import { TranslocoHttpLoader } from './transloco-loader';

// In appConfig providers:
provideTransloco({
  config: {
    availableLangs: ['en', 'tr'],
    defaultLang: 'en',
    fallbackLang: 'en',
    reRenderOnLangChange: true,
    prodMode: !isDevMode(),
    missingHandler: {
      useFallbackTranslation: true,
      logMissingKey: true,
    },
  },
  loader: TranslocoHttpLoader,
}),
provideTranslocoLocale({
  langToLocaleMapping: {
    en: 'en-US',
    tr: 'tr-TR',
  },
}),
```

### Pattern 2: Scoped Translation Loading in Feature Routes
**What:** Lazy-load feature-specific translations when route activates
**When to use:** Every feature route file
```typescript
// Source: Transloco scope configuration docs
import { provideTranslocoScope } from '@jsverse/transloco';

export const CONTACT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('contacts')],
    children: [
      // existing routes...
    ],
  },
];
```

### Pattern 3: Template Translation with Structural Directive
**What:** Translate strings in templates using the `*transloco` structural directive (recommended over pipe for DRY)
**When to use:** All component templates
```html
<!-- Source: Transloco template docs -->
<ng-container *transloco="let t">
  <h1>{{ t('contacts.list.title') }}</h1>
  <button mat-button>{{ t('common.save') }}</button>
</ng-container>
```

For standalone components, import `TranslocoDirective`:
```typescript
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  standalone: true,
  imports: [TranslocoDirective],
  // ...
})
```

### Pattern 4: Locale-Aware Formatting Pipes
**What:** Replace Angular built-in date/number/currency pipes with Transloco locale pipes
**When to use:** All date/number/currency display in templates
```html
<!-- Source: Transloco locale plugin docs -->
<!-- Date: auto-formats per locale (en-US: 02/20/2026, tr-TR: 20.02.2026) -->
{{ someDate | translocoDate: { dateStyle: 'medium' } }}

<!-- Number: auto-formats per locale (en-US: 1,234.56, tr-TR: 1.234,56) -->
{{ someNumber | translocoDecimal }}

<!-- Currency: uses tenant currency code, formatted per locale -->
{{ amount | translocoCurrency: 'symbol': { currency: tenantCurrency } }}
```

### Pattern 5: LanguageService Orchestrator
**What:** Central service that coordinates language changes across all subsystems
**When to use:** Injected at root level, called from language switcher and on app init
```typescript
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translocoService = inject(TranslocoService);
  private readonly localeService = inject(TranslocoLocaleService);
  private readonly profileService = inject(ProfileService);
  private readonly dateAdapter = inject(DateAdapter);
  private readonly document = inject(DOCUMENT);

  /** Switch language: update Transloco, locale, DateAdapter, HTML lang, persist */
  switchLanguage(lang: 'en' | 'tr'): void {
    // 1. Set Transloco active language (triggers re-render)
    this.translocoService.setActiveLang(lang);

    // 2. Update Angular Material DateAdapter locale
    this.dateAdapter.setLocale(lang === 'tr' ? 'tr-TR' : 'en-US');

    // 3. Update <html lang="..."> attribute
    this.document.documentElement.lang = lang;

    // 4. Cache in localStorage for instant load
    localStorage.setItem('globcrm_language', lang);

    // 5. Persist to backend (fire-and-forget)
    this.profileService.updatePreferences({ language: lang }).subscribe();
  }

  /** Detect initial language on app load */
  detectLanguage(): 'en' | 'tr' {
    // 1. Check localStorage cache (returning user)
    const cached = localStorage.getItem('globcrm_language');
    if (cached === 'en' || cached === 'tr') return cached;

    // 2. Check browser language
    const browserLang = navigator.language?.substring(0, 2);
    if (browserLang === 'tr') return 'tr';

    // 3. Default to English
    return 'en';
  }
}
```

### Pattern 6: Custom MatPaginatorIntl for Translated Paginator Labels
**What:** Override paginator labels to use Transloco translations
**When to use:** Provided at root level so all paginators get translated
```typescript
// Source: Angular Material docs + Transloco community pattern
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translocoService = inject(TranslocoService);

  constructor() {
    super();
    this.translocoService.langChanges$.subscribe(() => {
      this.itemsPerPageLabel = this.translocoService.translate('common.paginator.itemsPerPage');
      this.nextPageLabel = this.translocoService.translate('common.paginator.nextPage');
      this.previousPageLabel = this.translocoService.translate('common.paginator.previousPage');
      this.firstPageLabel = this.translocoService.translate('common.paginator.firstPage');
      this.lastPageLabel = this.translocoService.translate('common.paginator.lastPage');
      this.getRangeLabel = (page, pageSize, length) => {
        const of = this.translocoService.translate('common.paginator.of');
        if (length === 0 || pageSize === 0) return `0 ${of} ${length}`;
        const startIndex = page * pageSize;
        const endIndex = Math.min(startIndex + pageSize, length);
        return `${startIndex + 1} - ${endIndex} ${of} ${length}`;
      };
      this.changes.next();
    });
  }
}
```

### Anti-Patterns to Avoid
- **Hardcoding locale in pipes:** Never use `| date:'mediumDate':'':'en-US'` -- always let Transloco locale handle it via `| translocoDate`.
- **Using `LOCALE_ID` provider:** This is a compile-time token, not reactive. Transloco manages locale at runtime.
- **Importing TranslocoModule:** Use `TranslocoDirective` (standalone) or `provideTransloco()` -- the module approach is legacy.
- **Translating in the backend for Phase 27:** Keep all translation in the frontend to avoid complexity. Backend returns English strings/codes.
- **Mixing pipe and structural directive:** Choose one per component. The structural directive (`*transloco="let t"`) is preferred for DRY (one subscription per template).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation file loading | Custom HTTP loader with caching | `TranslocoHttpLoader` (from Transloco schematics) | Handles caching, retries, scope merging automatically |
| Locale-aware date formatting | Custom `Intl.DateTimeFormat` wrapper service | `translocoDate` pipe from `@jsverse/transloco-locale` | Auto-syncs with active language, handles edge cases, configurable |
| Locale-aware number formatting | Custom `Intl.NumberFormat` wrapper | `translocoDecimal` / `translocoCurrency` pipes | Same auto-sync benefits, handles currency code independently |
| Translation key fallback | Custom missing key handler | Transloco `missingHandler.useFallbackTranslation: true` | Built-in, tested, logs warnings in dev |
| Language detection | Custom navigator.language parser | `LanguageService.detectLanguage()` (simple helper) | Only 2 languages, keep it simple -- no need for a library |

**Key insight:** Transloco + transloco-locale provide the complete i18n + l10n stack. The only custom code needed is the `LanguageService` orchestrator (to sync Transloco with the backend profile API and Angular Material), the `MatPaginatorIntl` override, and the language switcher UI component.

## Common Pitfalls

### Pitfall 1: DateAdapter Instance Scoping
**What goes wrong:** `DateAdapter.setLocale()` is called at root, but lazy-loaded modules create their own DateAdapter instances. Datepickers in lazy modules ignore the locale change.
**Why it happens:** Each component using `provideNativeDateAdapter()` in its providers gets its own DateAdapter instance.
**How to avoid:** Provide `provideNativeDateAdapter()` at the root level (in `app.config.ts`) instead of per-component. Remove the 7 per-component `provideNativeDateAdapter()` calls currently in the codebase. Then `DateAdapter.setLocale()` at root affects all datepickers.
**Warning signs:** Datepicker shows English month names after switching to Turkish.

### Pitfall 2: Currency vs Locale Confusion
**What goes wrong:** Switching to Turkish locale also changes currency display to TRY (Turkish Lira) when it should stay as the tenant's configured currency.
**Why it happens:** `translocoCurrency` pipe defaults to the locale's native currency if no currency code is provided.
**How to avoid:** Always pass the tenant's currency code explicitly: `{{ amount | translocoCurrency: 'symbol': { currency: tenantCurrency } }}`. Never rely on locale-default currency.
**Warning signs:** Deal values showing as "TRY" after switching to Turkish.

### Pitfall 3: Flash of Untranslated Content (FOUC)
**What goes wrong:** On page load, English keys briefly flash before translations load.
**Why it happens:** Translation files are loaded asynchronously. If the component renders before the file arrives, raw keys appear.
**How to avoid:** Transloco's structural directive (`*transloco="let t"`) handles this -- it waits for the translation to load before rendering content. If using the pipe directly, ensure the translation scope is loaded in the route provider (Transloco pre-loads when scope is registered in route providers).
**Warning signs:** Brief flash of "contacts.list.title" text before "Contacts" appears.

### Pitfall 4: localStorage Stale After Backend Profile Update
**What goes wrong:** User switches language on device A, but device B still shows the old cached language from localStorage.
**Why it happens:** localStorage cache is per-device. Backend is source of truth, but cached value loads first.
**How to avoid:** On login success (after auth response), always fetch the user profile/preferences and override the localStorage cache with the backend value. The LanguageService should sync from backend after authentication.
**Warning signs:** User sees wrong language after logging in on a different device.

### Pitfall 5: DynamicTable formatDate() Not Using Locale
**What goes wrong:** The `DynamicTableComponent.formatDate()` method uses `new Intl.DateTimeFormat('en-US', ...)` hardcoded. Switching language doesn't change table date formatting.
**Why it happens:** The method doesn't use Transloco locale -- it's a manual `Intl.DateTimeFormat` call.
**How to avoid:** Either replace the `formatDate()` method to use `TranslocoLocaleService.localizeDate()`, or switch the table template to use `| translocoDate` pipe directly.
**Warning signs:** Table dates always show "Feb 19, 2026" format regardless of language setting.

### Pitfall 6: Missing Angular Locale Data for Turkish
**What goes wrong:** Angular's built-in pipes and the NativeDateAdapter need locale data registered to format Turkish correctly.
**Why it happens:** Angular only bundles `en-US` locale data by default. Turkish (`tr`) must be explicitly registered.
**How to avoid:** Import and register Turkish locale data in `app.config.ts`:
```typescript
import localeTr from '@angular/common/locales/tr';
import { registerLocaleData } from '@angular/common';
registerLocaleData(localeTr);
```
Since we're using Transloco-locale pipes (which use `Intl` APIs and don't need Angular locale data), this is only needed for Angular Material's `NativeDateAdapter`.
**Warning signs:** DatePicker shows English month names/day names when locale is set to Turkish.

## Code Examples

### TranslocoHttpLoader (translation file loader)
```typescript
// Source: Transloco official docs
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`./assets/i18n/${lang}.json`);
  }
}
```

### Language Switcher UI in Navbar User Menu
```html
<!-- Inside the shared user menu (mat-menu) in navbar.component.html -->
<mat-menu #userMenu="matMenu" xPosition="before" class="sidebar-user-menu">
  <!-- ... existing user info header ... -->
  <mat-divider></mat-divider>

  <!-- Language Toggle -->
  <div class="sidebar-user-menu__lang-toggle" (click)="$event.stopPropagation()">
    <mat-icon>language</mat-icon>
    <span class="sidebar-user-menu__lang-label">Language</span>
    <div class="lang-segmented">
      <button [class.active]="currentLang() === 'en'" (click)="switchLanguage('en')">EN</button>
      <button [class.active]="currentLang() === 'tr'" (click)="switchLanguage('tr')">TR</button>
    </div>
  </div>

  <mat-divider></mat-divider>
  <!-- ... existing menu items ... -->
</mat-menu>

<!-- Language badge near avatar (visible without opening menu) -->
<span class="content-header__lang-badge">{{ currentLang() | uppercase }}</span>
```

### Sample Global Translation File (en.json)
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "loading": "Loading...",
    "noResults": "No results found",
    "confirm": "Confirm",
    "close": "Close",
    "back": "Back",
    "actions": "Actions",
    "paginator": {
      "itemsPerPage": "Items per page",
      "nextPage": "Next page",
      "previousPage": "Previous page",
      "firstPage": "First page",
      "lastPage": "Last page",
      "of": "of"
    }
  },
  "nav": {
    "myDay": "My Day",
    "analytics": "Analytics",
    "reports": "Reports",
    "companies": "Companies",
    "contacts": "Contacts",
    "leads": "Leads",
    "products": "Products",
    "deals": "Deals",
    "activities": "Activities",
    "quotes": "Quotes",
    "requests": "Requests",
    "notes": "Notes",
    "emails": "Emails",
    "templates": "Templates",
    "sequences": "Sequences",
    "workflows": "Workflows",
    "feed": "Feed",
    "calendar": "Calendar",
    "duplicates": "Duplicates",
    "import": "Import",
    "team": "Team",
    "settings": "Settings"
  },
  "auth": {
    "login": "Sign In",
    "logout": "Sign Out",
    "register": "Create Account"
  },
  "userMenu": {
    "myProfile": "My Profile",
    "security": "Security",
    "language": "Language",
    "signOut": "Sign Out"
  }
}
```

### Sample Turkish Translation File (tr.json)
```json
{
  "common": {
    "save": "Kaydet",
    "cancel": "Iptal",
    "delete": "Sil",
    "edit": "Duzenle",
    "search": "Ara",
    "loading": "Yukleniyor...",
    "noResults": "Sonuc bulunamadi",
    "confirm": "Onayla",
    "close": "Kapat",
    "back": "Geri",
    "actions": "Islemler",
    "paginator": {
      "itemsPerPage": "Sayfa basina ogeler",
      "nextPage": "Sonraki sayfa",
      "previousPage": "Onceki sayfa",
      "firstPage": "Ilk sayfa",
      "lastPage": "Son sayfa",
      "of": "/"
    }
  },
  "nav": {
    "myDay": "Gunum",
    "analytics": "Analitik",
    "reports": "Raporlar",
    "companies": "Sirketler",
    "contacts": "Kisiler",
    "leads": "Adaylar",
    "products": "Urunler",
    "deals": "Firsatlar",
    "activities": "Aktiviteler",
    "quotes": "Teklifler",
    "requests": "Talepler",
    "notes": "Notlar",
    "emails": "E-postalar",
    "templates": "Sablonlar",
    "sequences": "Diziler",
    "workflows": "Is Akislari",
    "feed": "Akis",
    "calendar": "Takvim",
    "duplicates": "Tekrarlar",
    "import": "Iceri Aktar",
    "team": "Ekip",
    "settings": "Ayarlar"
  },
  "auth": {
    "login": "Giris Yap",
    "logout": "Cikis Yap",
    "register": "Hesap Olustur"
  },
  "userMenu": {
    "myProfile": "Profilim",
    "security": "Guvenlik",
    "language": "Dil",
    "signOut": "Cikis Yap"
  }
}
```

## Codebase Integration Points

### Files That Need Modification

**Frontend (Angular):**

| File | Change | Why |
|------|--------|-----|
| `globcrm-web/package.json` | Add `@jsverse/transloco`, `@jsverse/transloco-locale` | Install i18n libraries |
| `globcrm-web/angular.json` | Add `src/assets/i18n` to assets glob | Serve translation JSON files |
| `globcrm-web/src/app/app.config.ts` | Add `provideTransloco()`, `provideTranslocoLocale()`, `provideNativeDateAdapter()` | Root-level i18n config |
| `globcrm-web/src/app/app.component.ts` | Init LanguageService on app bootstrap | Set initial language |
| `globcrm-web/src/index.html` | Keep `lang="en"` (updated dynamically by LanguageService) | Accessibility |
| `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` | Add language switcher in user menu, lang badge near avatar | LOCL-01 UI |
| `globcrm-web/src/app/shared/components/navbar/navbar.component.html` | Add lang toggle UI to mat-menu, lang badge | LOCL-01 UI |
| `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts` | Replace `formatDate()` to use locale-aware formatting | LOCL-04 |
| `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.html` | Replace `{{ formatDate(...) }}` with `translocoDate` pipe where applicable | LOCL-04 |
| 7 components with `provideNativeDateAdapter()` | Remove per-component providers (moved to root) | Fix DateAdapter scoping for LOCL-08 |
| Feature route files (`contacts.routes.ts`, etc.) | Add `provideTranslocoScope('featureName')` | LOCL-05 lazy loading |
| All templates using `\| date:`, `\| currency:`, `\| number:` | Replace with `translocoDate`, `translocoCurrency`, `translocoDecimal` | LOCL-04 |

**Backend (.NET):**

| File | Change | Why |
|------|--------|-----|
| `Organization.cs` | Add `DefaultLanguage` property (string, default "en") | LOCL-07 |
| `OrganizationsController.cs` | Add settings endpoint for default language | LOCL-07 |
| EF Migration | Add `default_language` column to organizations table | LOCL-07 |

**New Files to Create:**

| File | Purpose |
|------|---------|
| `globcrm-web/src/app/core/i18n/language.service.ts` | Central language orchestrator |
| `globcrm-web/src/app/core/i18n/transloco-loader.ts` | HTTP translation file loader |
| `globcrm-web/src/app/core/i18n/transloco-paginator-intl.ts` | Custom MatPaginatorIntl |
| `globcrm-web/src/assets/i18n/en.json` | Global English translations |
| `globcrm-web/src/assets/i18n/tr.json` | Global Turkish translations |
| `globcrm-web/src/assets/i18n/contacts/en.json` | Contacts feature English (proof of scoping) |
| `globcrm-web/src/assets/i18n/contacts/tr.json` | Contacts feature Turkish |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@ngneat/transloco` | `@jsverse/transloco` | 2024 | Package moved to jsverse scope. Old package is deprecated. |
| `TranslocoModule` imports | `provideTransloco()` + standalone | Transloco v5+ | Standalone-first API. Use `TranslocoDirective` in imports. |
| `LOCALE_ID` for runtime locale | `TranslocoLocaleService` | N/A (different approach) | LOCALE_ID is compile-time. Transloco locale is runtime. |
| NgModule-based feature scoping | `provideTranslocoScope()` in route providers | Angular 14+ | Works with standalone routes, no NgModules needed. |
| Custom Intl wrappers | `@jsverse/transloco-locale` pipes | Transloco-locale plugin | Pipes auto-sync with active language, no manual subscription. |

**Deprecated/outdated:**
- `@ngneat/transloco`: Deprecated, no longer receives updates. Use `@jsverse/transloco`.
- `TranslocoModule`: Legacy NgModule approach. Use `provideTransloco()` and standalone imports.
- `ngx-translate`: Essentially unmaintained. Transloco is the modern replacement.

## Open Questions

1. **FullCalendar locale integration**
   - What we know: FullCalendar supports locale via its `locale` option. The codebase uses `@fullcalendar/angular`.
   - What's unclear: Whether FullCalendar's locale needs to be manually synced when Transloco language changes, or if it can be wired reactively.
   - Recommendation: Wire FullCalendar's `locale` input to the LanguageService's active language signal. Map 'en' to 'en' and 'tr' to 'tr'. Low risk, can be handled during implementation.

2. **Quill editor (ngx-quill) locale**
   - What we know: The codebase uses ngx-quill for rich text editing. Quill has some UI chrome (toolbar tooltips).
   - What's unclear: Whether Quill toolbar labels need translation and how that integrates with Transloco.
   - Recommendation: Defer Quill i18n to Phase 28 (string extraction). Toolbar tooltips are minor UX items.

3. **Email template editor locale**
   - What we know: The codebase uses `angular-email-editor` for email templates.
   - What's unclear: Whether this component supports i18n.
   - Recommendation: Out of scope for Phase 27. Investigate during Phase 28.

## Sources

### Primary (HIGH confidence)
- [Transloco Official Docs - Installation](https://jsverse.gitbook.io/transloco/getting-started/installation) - Setup, configuration, loader
- [Transloco Official Docs - Scope Configuration](https://jsverse.gitbook.io/transloco/advanced-features/lazy-load/scope-configuration) - Lazy loading scopes
- [Transloco Official Docs - Config Options](https://jsverse.gitbook.io/transloco/getting-started/config-options) - All config options including fallback, missingHandler
- [Transloco Official Docs - Language API](https://jsverse.gitbook.io/transloco/core-concepts/language-api) - setActiveLang, getActiveLang, langChanges$
- [Transloco Official Docs - Signals](https://jsverse.gitbook.io/transloco/core-concepts/signals) - translateSignal, translateObjectSignal
- [Transloco Official Docs - Locale L10n Plugin](https://jsverse.gitbook.io/transloco/plugins-and-extensions/locale-l10n) - translocoDate, translocoCurrency, translocoDecimal pipes
- [Transloco Official Docs - Angular Compatibility](https://jsverse.gitbook.io/transloco/getting-started/angular-compatibility) - Angular >=16 uses @jsverse/transloco v5-8
- [Transloco Official Docs - Inline Loaders](https://jsverse.gitbook.io/transloco/advanced-features/lazy-load/inline-loaders) - Inline loader pattern

### Secondary (MEDIUM confidence)
- [Transloco GitHub Discussion #656](https://github.com/jsverse/transloco/discussions/656) - MatPaginatorIntl with Transloco pattern
- [Angular Material DateAdapter docs](https://www.concretepage.com/angular-material/angular-material-datepicker-set-locale) - setLocale() for runtime switching
- [Angular Material GitHub Issue #12322](https://github.com/angular/components/issues/12322) - MatPaginator internationalization patterns

### Codebase Analysis (HIGH confidence)
- `src/GlobCRM.Domain/Entities/ApplicationUser.cs` - Language field exists (default "en")
- `src/GlobCRM.Domain/Entities/UserPreferencesData.cs` - Language in preferences (default "en")
- `src/GlobCRM.Api/Controllers/ProfileController.cs` - PUT preferences endpoint exists
- `src/GlobCRM.Domain/Entities/Organization.cs` - No DefaultLanguage field yet (needs adding)
- `globcrm-web/src/app/features/profile/profile.service.ts` - updatePreferences() exists
- `globcrm-web/src/app/shared/components/navbar/navbar.component.html` - User menu exists (insertion point)
- `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts` - formatDate() hardcoded to en-US
- 7 components use `provideNativeDateAdapter()` at component level (need consolidation)
- 72 occurrences of `| date:` pipe across 32 files (need replacement in Phase 28)
- 20+ occurrences of `| currency:` pipe (need replacement in Phase 28)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Transloco is the clear standard for Angular runtime i18n, verified via official docs and npm
- Architecture: HIGH - Patterns directly from Transloco official docs, adapted to match codebase conventions
- Pitfalls: HIGH - DateAdapter scoping confirmed by codebase analysis (7 per-component providers found), currency/locale confusion documented in Transloco issues
- Codebase integration: HIGH - All files examined, existing backend fields confirmed, modification points identified

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days -- Transloco is stable, Angular 19 is current)
