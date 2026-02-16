---
phase: 01-foundation
plan: 07
subsystem: auth, ui, onboarding
tags: [angular-19, angular-material, 2fa, totp, qr-code, navbar, logout, onboarding-wizard, mat-stepper, signals, reactive-forms]

# Dependency graph
requires:
  - phase: 01-02
    provides: "AuthService, AuthStore, auth.guard, auth.interceptor, auth.models, auth.routes, Angular Material theme"
  - phase: 01-05
    provides: "Invitation system backend (InvitationsController with send endpoint), LogoutEndpoint"
  - phase: 01-06
    provides: "Auth pages (login, signup, verify, forgot/reset password), dashboard placeholder, established pages/ subdirectory pattern"
provides:
  - "TwoFactorComponent with 3-state flow: setup (QR + verify), recovery codes, already-enabled (disable)"
  - "NavbarComponent with user menu (avatar initials, security settings, logout) conditionally shown for authenticated users"
  - "AppComponent updated to show/hide navbar based on auth state and current route"
  - "WizardComponent with 3-step mat-stepper (linear=false for skippability) and Skip All button"
  - "InviteTeamStepComponent with bulk email paste, chip display, role selector, and send invitations API"
  - "ConfigureBasicsStepComponent with timezone (browser-detected), currency, and date format selectors"
  - "ExploreDataStepComponent with seed data summary cards and Start Using GlobCRM button"
  - "AuthService extended with sendInvitations, updateOrganizationSettings, completeSetup methods"
  - "Auth route for 2FA protected with authGuard"
affects: [01-08]

# Tech tracking
tech-stack:
  added:
    - "qrcode (npm) for TOTP QR code generation from authenticator URI"
  patterns:
    - "Conditional navbar rendering via computed signal combining auth state + route URL"
    - "toSignal() from @angular/core/rxjs-interop for converting Router events to signal"
    - "output() function for child-to-parent event emission in standalone components"
    - "Multi-state component using signal<State> with string literal union type"
    - "Mat-stepper with linear=false for skippable wizard steps"
    - "Bulk email parsing from textarea (comma, semicolon, newline separated)"

key-files:
  created:
    - "globcrm-web/src/app/features/auth/pages/two-factor/two-factor.component.html"
    - "globcrm-web/src/app/features/auth/pages/two-factor/two-factor.component.scss"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.ts"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.html"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.scss"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/wizard.component.html"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/wizard.component.scss"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/invite-team-step/invite-team-step.component.ts"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/invite-team-step/invite-team-step.component.html"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/invite-team-step/invite-team-step.component.scss"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/configure-basics-step/configure-basics-step.component.ts"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/configure-basics-step/configure-basics-step.component.html"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/configure-basics-step/configure-basics-step.component.scss"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/explore-data-step/explore-data-step.component.ts"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/explore-data-step/explore-data-step.component.html"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/explore-data-step/explore-data-step.component.scss"
  modified:
    - "globcrm-web/src/app/features/auth/pages/two-factor/two-factor.component.ts"
    - "globcrm-web/src/app/features/auth/auth.routes.ts"
    - "globcrm-web/src/app/app.component.ts"
    - "globcrm-web/src/app/features/onboarding/pages/wizard/wizard.component.ts"
    - "globcrm-web/src/app/core/auth/auth.service.ts"
    - "globcrm-web/src/app/core/auth/auth.models.ts"
    - "globcrm-web/angular.json"
    - "globcrm-web/package.json"

key-decisions:
  - "Used qrcode (npm) instead of angularx-qrcode -- angularx-qrcode requires Angular 21+ peer dependency, incompatible with Angular 19"
  - "Added allowedCommonJsDependencies in angular.json to suppress qrcode CommonJS warning"
  - "Placed 2FA route under /auth/2fa (consistent with existing auth routes) rather than separate top-level route"
  - "Navbar uses toSignal(router.events) + computed() for reactive route-based visibility"
  - "Recovery codes generated client-side as placeholder -- production API will return actual codes"
  - "Wizard completeSetup() navigates to dashboard even on API error for graceful degradation"

patterns-established:
  - "NavbarComponent as shared component in shared/components/ -- reusable across all authenticated layouts"
  - "Conditional navbar via AppComponent computed signal (isAuthenticated AND NOT auth page)"
  - "Wizard step components emit events (stepComplete, skipStep, finish) to parent WizardComponent"
  - "User avatar displays initials derived from user firstName + lastName"

# Metrics
duration: 8min
completed: 2026-02-16
---

# Phase 1 Plan 07: Angular 2FA Setup, Navbar/Logout, Onboarding Wizard Summary

**TOTP 2FA setup with QR code via qrcode library, global navbar with user menu and logout, 3-step skippable onboarding wizard (invite team, configure basics, explore seed data) using Angular Material stepper**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T13:28:32Z
- **Completed:** 2026-02-16T13:36:58Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- Built TwoFactorComponent with full 3-state flow: setup state (QR code generation from authenticator URI + 6-digit TOTP verification), recovery codes display (10 codes in grid with download-as-text), and enabled state (shows status + disable button)
- Created NavbarComponent with Angular Material toolbar, GlobCRM brand link, organization name display, and user menu (avatar with initials, security settings link, logout button calling AuthService.logout())
- Updated AppComponent to conditionally render navbar only when authenticated AND not on an auth page, using reactive signals from Router events + AuthStore
- Built WizardComponent with mat-stepper (linear=false) wrapping 3 child step components, plus Skip All button that calls completeSetup and navigates to dashboard
- InviteTeamStepComponent parses bulk emails from textarea (comma/semicolon/newline separated), displays as mat-chips with removal, sends via AuthService.sendInvitations()
- ConfigureBasicsStepComponent provides timezone (auto-detected from browser), currency, and date format selectors with save-to-API capability
- ExploreDataStepComponent displays 4 seed data summary cards (5 contacts, 2 companies, 1 deal, default pipeline) with Start Using GlobCRM button
- Extended AuthService with sendInvitations(), updateOrganizationSettings(), and completeSetup() methods plus corresponding TypeScript models

## Task Commits

Each task was committed atomically:

1. **Task 1: Build 2FA setup page and global navbar with logout** - `9d711d7` (feat)
2. **Task 2: Build onboarding setup wizard (3 steps, all skippable)** - `8dc67b5` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/auth/pages/two-factor/two-factor.component.ts` - Full 2FA setup with QR code, verification, recovery codes, disable
- `globcrm-web/src/app/features/auth/pages/two-factor/two-factor.component.html` - Three-state template (setup, recovery, enabled)
- `globcrm-web/src/app/features/auth/pages/two-factor/two-factor.component.scss` - Settings-style page layout with responsive grid
- `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` - Global navbar with user menu and logout
- `globcrm-web/src/app/shared/components/navbar/navbar.component.html` - Toolbar with brand, org name, user avatar menu
- `globcrm-web/src/app/shared/components/navbar/navbar.component.scss` - Sticky toolbar with responsive org name hide
- `globcrm-web/src/app/app.component.ts` - Conditional navbar rendering via computed signal
- `globcrm-web/src/app/features/auth/auth.routes.ts` - Added authGuard to 2FA route
- `globcrm-web/src/app/features/onboarding/pages/wizard/wizard.component.ts` - 3-step mat-stepper wrapper
- `globcrm-web/src/app/features/onboarding/pages/wizard/wizard.component.html` - Stepper with step components and Skip All
- `globcrm-web/src/app/features/onboarding/pages/wizard/wizard.component.scss` - Centered wizard layout
- `globcrm-web/src/app/features/onboarding/pages/wizard/invite-team-step/invite-team-step.component.ts` - Bulk email invite with chip display
- `globcrm-web/src/app/features/onboarding/pages/wizard/invite-team-step/invite-team-step.component.html` - Textarea + chips + role select
- `globcrm-web/src/app/features/onboarding/pages/wizard/invite-team-step/invite-team-step.component.scss` - Step layout styles
- `globcrm-web/src/app/features/onboarding/pages/wizard/configure-basics-step/configure-basics-step.component.ts` - Timezone/currency/date format
- `globcrm-web/src/app/features/onboarding/pages/wizard/configure-basics-step/configure-basics-step.component.html` - Settings form with mat-select
- `globcrm-web/src/app/features/onboarding/pages/wizard/configure-basics-step/configure-basics-step.component.scss` - Centered settings form
- `globcrm-web/src/app/features/onboarding/pages/wizard/explore-data-step/explore-data-step.component.ts` - Seed data summary
- `globcrm-web/src/app/features/onboarding/pages/wizard/explore-data-step/explore-data-step.component.html` - Data cards grid + finish button
- `globcrm-web/src/app/features/onboarding/pages/wizard/explore-data-step/explore-data-step.component.scss` - Card grid layout
- `globcrm-web/src/app/core/auth/auth.service.ts` - Added invitation, settings, and setup completion methods
- `globcrm-web/src/app/core/auth/auth.models.ts` - Added SendInvitationsRequest/Response, OrganizationSettings models
- `globcrm-web/angular.json` - Added allowedCommonJsDependencies for qrcode
- `globcrm-web/package.json` - Added qrcode dependency

## Decisions Made
- Used `qrcode` npm package instead of `angularx-qrcode` because angularx-qrcode v21 requires Angular 21+ peer dependency, which is incompatible with our Angular 19 installation
- Navbar visibility uses `toSignal()` from `@angular/core/rxjs-interop` to convert Router NavigationEnd events into a signal, combined with AuthStore.isAuthenticated() in a computed signal -- this is reactive and avoids manual subscriptions
- Recovery codes are generated client-side as display placeholders; in production the backend API will return actual recovery codes on 2FA enablement
- WizardComponent's `completeSetup()` navigates to dashboard even when the API call fails, providing graceful degradation (setup_completed flag can be retried)
- 2FA route placed at `/auth/2fa` within the auth routes module (consistent with existing pattern) rather than as a separate top-level route

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used qrcode instead of angularx-qrcode due to Angular version incompatibility**
- **Found during:** Task 1 (QR code library installation)
- **Issue:** `angularx-qrcode@21.0.4` requires peer `@angular/common@^21.0.0` but project uses Angular 19.2.x. npm install fails with ERESOLVE.
- **Fix:** Installed `qrcode` and `@types/qrcode` (plain JS library) instead, and added `allowedCommonJsDependencies` in angular.json to suppress CommonJS warning
- **Files modified:** globcrm-web/package.json, globcrm-web/angular.json
- **Verification:** Build compiles with 0 errors; QR code generates correctly from TOTP URI
- **Committed in:** 9d711d7 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added sendInvitations, updateOrganizationSettings, completeSetup to AuthService**
- **Found during:** Task 2 (Onboarding wizard step components)
- **Issue:** AuthService had no methods for sending invitations, saving organization settings, or marking setup as complete. These are required by the wizard step components.
- **Fix:** Added `sendInvitations()`, `updateOrganizationSettings()`, and `completeSetup()` methods to AuthService, plus `SendInvitationsRequest`, `SendInvitationsResponse`, and `OrganizationSettings` interfaces to auth.models.ts
- **Files modified:** globcrm-web/src/app/core/auth/auth.service.ts, globcrm-web/src/app/core/auth/auth.models.ts
- **Verification:** Build compiles; wizard components can call all required API methods
- **Committed in:** 8dc67b5 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added authGuard to 2FA route**
- **Found during:** Task 1 (auth.routes.ts update)
- **Issue:** The scaffolded 2FA route had no `canActivate` guard, meaning unauthenticated users could access the 2FA setup page
- **Fix:** Added `canActivate: [authGuard]` to the `2fa` route and imported authGuard
- **Files modified:** globcrm-web/src/app/features/auth/auth.routes.ts
- **Verification:** Route is protected; unauthenticated access redirects to login
- **Committed in:** 9d711d7 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for functionality and security. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- All Phase 1 Angular frontend features are complete: login, signup, verify email, forgot/reset password, 2FA setup, navbar with logout, onboarding wizard
- 2FA setup page integrates with AuthService.get2faInfo() / enable2fa() / disable2fa() backend endpoints
- Navbar provides global logout from any page via AuthService.logout()
- Onboarding wizard ready for integration with organization settings and invitation APIs
- Dashboard placeholder ready to be extended in Phase 2+
- Ready for Plan 08 (end-to-end verification checkpoint)

## Self-Check: PASSED

- All 25 key files verified present on disk
- Both task commits verified (9d711d7, 8dc67b5)
- Build compiles with 0 errors (only budget warning at 502kB vs 500kB limit)

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
