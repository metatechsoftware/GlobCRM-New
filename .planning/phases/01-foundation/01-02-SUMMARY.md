---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [angular-19, angular-material, ngrx-signals, jwt, interceptor, guard, tenant]

# Dependency graph
requires: []
provides:
  - "Angular 19 standalone app with Material UI and custom GlobCRM theme"
  - "AuthService with full API: login, register, createOrg, joinOrg, confirmEmail, forgotPassword, resetPassword, refreshToken, 2FA"
  - "AuthStore (NgRx SignalStore) with auth state management"
  - "Functional auth interceptor (HttpInterceptorFn) with Bearer token and 401 retry"
  - "Functional auth guard (CanActivateFn) with returnUrl redirect and silent refresh"
  - "TenantService for subdomain extraction"
  - "TenantStore for tenant/organization state"
  - "ApiService wrapping HttpClient with base URL"
  - "Lazy-loaded routing: /auth/*, /onboarding/*, /dashboard"
  - "Auth TypeScript models (LoginRequest, LoginResponse, UserInfo, etc.)"
  - "Environment configs for production and development"
affects: [auth-pages, onboarding, dashboard, api-integration]

# Tech tracking
tech-stack:
  added: ["@angular/core@19", "@angular/material@19", "@ngrx/signals@19", "@angular/animations@19"]
  patterns: ["standalone-components", "functional-interceptors", "functional-guards", "signal-store", "lazy-loading"]

key-files:
  created:
    - "globcrm-web/src/app/core/auth/auth.service.ts"
    - "globcrm-web/src/app/core/auth/auth.store.ts"
    - "globcrm-web/src/app/core/auth/auth.interceptor.ts"
    - "globcrm-web/src/app/core/auth/auth.guard.ts"
    - "globcrm-web/src/app/core/auth/auth.models.ts"
    - "globcrm-web/src/app/core/tenant/tenant.service.ts"
    - "globcrm-web/src/app/core/tenant/tenant.store.ts"
    - "globcrm-web/src/app/core/api/api.service.ts"
    - "globcrm-web/src/app/app.config.ts"
    - "globcrm-web/src/app/app.routes.ts"
    - "globcrm-web/src/environments/environment.ts"
    - "globcrm-web/src/environments/environment.development.ts"
  modified:
    - "globcrm-web/angular.json"
    - "globcrm-web/src/styles.scss"

key-decisions:
  - "Used @ngrx/signals v19 (matching Angular 19 peer dependency)"
  - "Installed @angular/animations@19 separately (missing from Material add)"
  - "Uniform GlobCRM branding for Phase 1 (not per-tenant on login page)"
  - "Access token in memory (signal), refresh token in localStorage only with rememberMe"
  - "Token refresh at 80% of expiry (e.g., 24 min for 30-min token)"

patterns-established:
  - "Functional interceptors: HttpInterceptorFn with inject() for DI"
  - "Functional guards: CanActivateFn with inject() for DI"
  - "NgRx SignalStore: withState + withComputed + withMethods pattern"
  - "Lazy-loaded feature routes: loadChildren/loadComponent pattern"
  - "ApiService: centralized HTTP wrapper with environment.apiUrl"
  - "Core services in /core/ directory (auth, tenant, api)"
  - "Feature modules in /features/ directory (auth, dashboard, onboarding)"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 1 Plan 02: Angular Frontend Scaffold & Auth Services Summary

**Angular 19 app with Material UI, NgRx SignalStore auth state, functional interceptor with 401 retry, auth guard with silent refresh, and tenant subdomain extraction**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-16T12:06:11Z
- **Completed:** 2026-02-16T12:12:55Z
- **Tasks:** 2
- **Files modified:** 42

## Accomplishments
- Scaffolded Angular 19 standalone app with Angular Material custom theme (deep blue/teal GlobCRM branding)
- Implemented complete AuthService with all API methods: login, register, createOrg, joinOrg, confirmEmail, resendConfirmation, forgotPassword, resetPassword, refreshToken, 2FA (get/enable/disable), getUserInfo, checkSubdomain, logout
- Built NgRx SignalStore for auth state with computed properties (userName, userRole, organizationName)
- Created functional HTTP interceptor that attaches Bearer tokens and handles 401 with refresh token retry
- Created functional route guard that redirects unauthenticated users and attempts silent refresh from localStorage
- Implemented TenantService for subdomain extraction with development-mode localStorage override
- Set up lazy-loaded routing structure for auth, onboarding, and dashboard feature modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Angular 19 app with Material and project configuration** - `c479827` (feat)
2. **Task 2: Implement core auth services, store, interceptor, guard, and tenant service** - `a0e3b41` (feat)

## Files Created/Modified
- `globcrm-web/src/app/core/auth/auth.service.ts` - Full auth API service with token management and refresh scheduling
- `globcrm-web/src/app/core/auth/auth.store.ts` - NgRx SignalStore with auth state, computed properties, and methods
- `globcrm-web/src/app/core/auth/auth.interceptor.ts` - Functional HTTP interceptor with Bearer token and 401 retry
- `globcrm-web/src/app/core/auth/auth.guard.ts` - Functional route guard with returnUrl and silent refresh
- `globcrm-web/src/app/core/auth/auth.models.ts` - TypeScript interfaces for all auth request/response types
- `globcrm-web/src/app/core/tenant/tenant.service.ts` - Subdomain extraction with dev-mode override
- `globcrm-web/src/app/core/tenant/tenant.store.ts` - NgRx SignalStore for tenant/organization state
- `globcrm-web/src/app/core/api/api.service.ts` - Base HTTP service wrapping HttpClient with error handling
- `globcrm-web/src/app/app.config.ts` - App providers: router, HTTP client with interceptor, animations
- `globcrm-web/src/app/app.routes.ts` - Lazy-loaded routes: /auth/*, /onboarding/*, /dashboard
- `globcrm-web/src/app/features/auth/auth.routes.ts` - Auth sub-routes: login, signup, verify, forgot-password, reset-password, 2fa
- `globcrm-web/src/environments/environment.ts` - Production config (api.globcrm.com)
- `globcrm-web/src/environments/environment.development.ts` - Development config (localhost:5000)
- `globcrm-web/src/styles.scss` - Custom Material theme with GlobCRM brand colors and utility classes

## Decisions Made
- Used @ngrx/signals v19 to match Angular 19 peer dependency (latest v21 requires Angular 21)
- Installed @angular/animations@19 separately as it was not included by `ng add @angular/material`
- Chose uniform GlobCRM branding for Phase 1 login pages (not per-tenant) per context discretion
- Stored access token in memory (signal in AuthStore), refresh token in localStorage only when rememberMe=true, per locked decision
- Scheduled token refresh at 80% of access token expiry time (e.g., 24 min for 30-min token)
- Auth endpoints excluded from Bearer token attachment to prevent circular auth calls
- Used `--skip-git` flag for `ng new` to avoid nested git repo

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @angular/animations@19 separately**
- **Found during:** Task 1 (Angular Material setup)
- **Issue:** `ng add @angular/material` did not install @angular/animations, causing build failure: "Could not resolve @angular/animations/browser"
- **Fix:** Installed `@angular/animations@19` explicitly via npm
- **Files modified:** package.json, package-lock.json
- **Verification:** `ng build` succeeds after installation
- **Committed in:** c479827 (Task 1 commit)

**2. [Rule 3 - Blocking] Created placeholder feature components for lazy-loaded routes**
- **Found during:** Task 1 (Routing setup)
- **Issue:** Lazy-loaded routes reference components that don't exist yet (login, signup, etc.), which would fail at runtime
- **Fix:** Created minimal placeholder components for all lazy-loaded routes so the app compiles and routes resolve
- **Files modified:** 8 placeholder component files in features/auth, features/dashboard, features/onboarding
- **Verification:** `ng build` succeeds with all lazy chunks generated
- **Committed in:** c479827 (Task 1 commit)

**3. [Rule 3 - Blocking] Used --skip-git for ng new**
- **Found during:** Task 1 (Angular scaffold)
- **Issue:** Running `ng new` inside an existing git repo would create a nested `.git` directory
- **Fix:** Added `--skip-git` flag to `ng new` command
- **Files modified:** None (prevented issue)
- **Verification:** No nested .git in globcrm-web/
- **Committed in:** c479827 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for the app to compile and function. No scope creep.

## Issues Encountered
None beyond the deviations noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Angular frontend scaffold complete with all core auth infrastructure
- Auth service layer ready for auth pages (Plan 06) to build login, signup, and password reset forms
- Interceptor and guard ready for all protected routes
- Tenant service ready for subdomain-based multi-tenancy resolution
- Routing structure supports future lazy-loaded feature modules

## Self-Check: PASSED

All 13 key files verified present on disk. Both task commits (c479827, a0e3b41) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
