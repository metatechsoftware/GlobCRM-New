---
phase: 01-foundation
plan: 05
subsystem: api, auth
tags: [invitation, bulk-invite, user-onboarding, logout, fluent-validation, identity, jwt]

# Dependency graph
requires:
  - phase: 01-03
    provides: "Multi-tenancy infrastructure, Identity with JWT, ApplicationDbContext with Invitation entity, TenantProvider"
  - phase: 01-04
    provides: "IEmailService with SendInvitationEmailAsync, IOrganizationRepository, EmailServiceExtensions, OrganizationServiceExtensions"
provides:
  - "IInvitationRepository with cross-tenant token lookup (IgnoreQueryFilters)"
  - "SendInvitationCommandHandler with bulk invite, deduplication, and soft user limit warning"
  - "AcceptInvitationCommandHandler with user account creation (EmailConfirmed=true) and role assignment"
  - "ResendInvitationCommandHandler with new token generation and 7-day expiry reset"
  - "InvitationsController with 6 REST endpoints (send, accept, resend, list, info, revoke)"
  - "LogoutEndpoint with audit logging at POST /api/auth/logout"
  - "All 20 Phase 1 backend endpoints wired: 10 auth + 4 organization + 6 invitation"
  - "Program.cs registers all subsystem DI services (email, organizations, invitations)"
affects: [01-06, 01-07, 01-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-tenant query via IgnoreQueryFilters() for invitation token lookup (accepting user has no tenant context)"
    - "Separate DI extension methods per subsystem (InvitationServiceExtensions) following Plan 04 pattern"
    - "UserManager.FindByEmailAsync for cross-org user lookup to avoid EF Core dependency in Application layer"
    - "Synchronous IQueryable.Count() from System.Linq to avoid EF Core async extensions in Application layer"

key-files:
  created:
    - "src/GlobCRM.Domain/Interfaces/IInvitationRepository.cs"
    - "src/GlobCRM.Application/Invitations/InvitationDto.cs"
    - "src/GlobCRM.Application/Invitations/SendInvitationCommand.cs"
    - "src/GlobCRM.Application/Invitations/SendInvitationValidator.cs"
    - "src/GlobCRM.Application/Invitations/AcceptInvitationCommand.cs"
    - "src/GlobCRM.Application/Invitations/ResendInvitationCommand.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Repositories/InvitationRepository.cs"
    - "src/GlobCRM.Infrastructure/Invitations/InvitationServiceExtensions.cs"
    - "src/GlobCRM.Api/Controllers/InvitationsController.cs"
    - "src/GlobCRM.Api/Auth/LogoutEndpoint.cs"
  modified:
    - "src/GlobCRM.Api/Program.cs"

key-decisions:
  - "Used IgnoreQueryFilters() for invitation token lookup since accepting user has no tenant context yet"
  - "Moved LogoutEndpoint to Api project (not Application) because it needs HttpContext and IResult types"
  - "Used FindByEmailAsync + org check instead of EF Core FirstOrDefaultAsync to keep Application layer free of EF Core dependency"
  - "InvitationRepository uses explicit org filtering (not tenant query filter) for reliable cross-tenant operations"

patterns-established:
  - "InvitationServiceExtensions.AddInvitationServices() for DI registration following per-subsystem pattern"
  - "Cross-tenant repository operations use IgnoreQueryFilters() with explicit filtering"
  - "Anonymous endpoints (accept, info) use AllowAnonymous and bypass tenant requirements"
  - "Command result pattern with Success/Errors used consistently across all invitation operations"

# Metrics
duration: 7min
completed: 2026-02-16
---

# Phase 1 Plan 5: Invitation System & Logout Endpoint Summary

**Bulk invitation system with 7-day expiry, branded emails, soft user limit warning, acceptance with account creation, and logout endpoint completing all 20 Phase 1 backend API endpoints**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-16T13:17:10Z
- **Completed:** 2026-02-16T13:24:40Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Implemented complete invitation system: bulk send (up to 50 emails), deduplication (skip existing users and pending invitations), soft user limit warning at 10 users, 7-day token expiry, branded email delivery
- Built invitation acceptance flow that creates user accounts with EmailConfirmed=true (invitation IS the email verification) and assigns role from invitation
- Added resend capability that generates new token (invalidates old link) and resets 7-day expiry
- Created LogoutEndpoint with audit logging, replacing the inline placeholder in Program.cs
- Registered all subsystem DI services in Program.cs (AddEmailServices, AddOrganizationServices, AddInvitationServices) -- fixing the DI gap from Plan 04
- All 20 Phase 1 backend endpoints verified and mapped: 10 auth, 4 organization, 6 invitation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement invitation system with bulk invite, expiry, and acceptance** - `199e5f7` (feat)
2. **Task 2: Add logout endpoint and register all subsystem DI services** - `8e3d748` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Interfaces/IInvitationRepository.cs` - Repository interface with cross-tenant token lookup
- `src/GlobCRM.Application/Invitations/InvitationDto.cs` - DTO with computed status (Pending/Accepted/Expired) and public InvitationInfoDto
- `src/GlobCRM.Application/Invitations/SendInvitationCommand.cs` - Bulk invite command with deduplication and soft limit check
- `src/GlobCRM.Application/Invitations/SendInvitationValidator.cs` - FluentValidation: 1-50 emails, valid email format, Admin/Member role
- `src/GlobCRM.Application/Invitations/AcceptInvitationCommand.cs` - Acceptance flow: validate token, create user, assign role, mark accepted
- `src/GlobCRM.Application/Invitations/ResendInvitationCommand.cs` - New token generation, expiry reset, re-send branded email
- `src/GlobCRM.Infrastructure/Persistence/Repositories/InvitationRepository.cs` - EF Core repository with IgnoreQueryFilters for cross-tenant ops
- `src/GlobCRM.Infrastructure/Invitations/InvitationServiceExtensions.cs` - DI registration for invitation repository, handlers, validators
- `src/GlobCRM.Api/Controllers/InvitationsController.cs` - 6 REST endpoints: send, accept, resend, list, info, revoke
- `src/GlobCRM.Api/Auth/LogoutEndpoint.cs` - Logout with audit logging for POST /api/auth/logout
- `src/GlobCRM.Api/Program.cs` - Added DI calls for email, organization, and invitation services; wired LogoutEndpoint

## Decisions Made
- Used `IgnoreQueryFilters()` in InvitationRepository for cross-tenant token lookup because the accepting user has no tenant context (they are joining for the first time)
- Placed LogoutEndpoint in the Api project (not Application) because it needs `HttpContext` and `IResult` types from ASP.NET Core, which the Application class library doesn't reference
- Avoided EF Core dependency in Application layer by using `UserManager.FindByEmailAsync` instead of `FirstOrDefaultAsync`, and synchronous `IQueryable.Count()` instead of `CountAsync`
- Used explicit org filtering in repository methods (`Where(i => i.TenantId == orgId)`) rather than relying on tenant query filters, for reliability in admin operations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LogoutEndpoint moved from Application to Api project**
- **Found during:** Task 2 (LogoutEndpoint compilation)
- **Issue:** Plan specified `src/GlobCRM.Application/Auth/LogoutEndpoint.cs` but Application is a class library without ASP.NET Core FrameworkReference -- `HttpContext`, `IResult`, and `Results` types are unavailable
- **Fix:** Created LogoutEndpoint in `src/GlobCRM.Api/Auth/LogoutEndpoint.cs` instead, where ASP.NET Core types are available
- **Files modified:** src/GlobCRM.Api/Auth/LogoutEndpoint.cs (created), src/GlobCRM.Application/Auth/LogoutEndpoint.cs (removed)
- **Verification:** Build compiles with 0 errors
- **Committed in:** 8e3d748 (Task 2 commit)

**2. [Rule 1 - Bug] Removed EF Core dependency from Application layer**
- **Found during:** Task 1 (SendInvitationCommand compilation)
- **Issue:** SendInvitationCommand used `CountAsync` and `FirstOrDefaultAsync` from `Microsoft.EntityFrameworkCore`, but Application project has no EF Core package reference and adding one would violate clean architecture layering
- **Fix:** Replaced `CountAsync` with synchronous `IQueryable.Count()` from System.Linq, replaced `FirstOrDefaultAsync` with `UserManager.FindByEmailAsync` + org membership check
- **Files modified:** src/GlobCRM.Application/Invitations/SendInvitationCommand.cs
- **Verification:** Build compiles with 0 errors; behavior identical
- **Committed in:** 199e5f7 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added IInvitationRepository interface to Domain layer**
- **Found during:** Task 1 (InvitationRepository implementation)
- **Issue:** Plan specified InvitationRepository but no corresponding interface existed in the Domain/Application layer for dependency injection
- **Fix:** Created `IInvitationRepository` in `src/GlobCRM.Domain/Interfaces/` with all required methods (GetByTokenAsync, GetByOrganizationAsync, GetPendingByEmailAsync, GetByIdAsync, CreateAsync, UpdateAsync, DeleteAsync)
- **Files modified:** src/GlobCRM.Domain/Interfaces/IInvitationRepository.cs
- **Verification:** Clean DI pattern matches IOrganizationRepository
- **Committed in:** 199e5f7 (Task 1 commit)

**4. [Rule 2 - Missing Critical] Added IOrganizationRepository to InvitationsController for invitation info endpoint**
- **Found during:** Task 1 (GetInvitationInfo endpoint -- anonymous endpoint with no tenant context)
- **Issue:** The `/api/invitations/{token}/info` endpoint is anonymous (no auth/tenant context) but needs to display the organization name. ITenantProvider.GetCurrentOrganizationAsync() returns null without tenant context.
- **Fix:** Injected IOrganizationRepository directly and queried by invitation.TenantId instead of relying on tenant context
- **Files modified:** src/GlobCRM.Api/Controllers/InvitationsController.cs
- **Verification:** Endpoint correctly resolves org name for anonymous callers
- **Committed in:** 199e5f7 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 1 blocking, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for compilation and correct behavior. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no new external service configuration required for this plan. SendGrid configuration from Plan 04 is sufficient for invitation emails.

## Next Phase Readiness
- Complete invitation system ready for Angular frontend integration (Plan 06 auth pages, Plan 07 invitation UI)
- All 20 Phase 1 backend endpoints mapped and compilable
- All subsystem DI services registered in Program.cs (email, organizations, invitations)
- Logout endpoint ready for frontend integration (Plan 07 navbar/logout)
- Backend ready for end-to-end verification checkpoint (Plan 08)

## Self-Check: PASSED

- All 11 key files verified present on disk
- Both task commits verified (199e5f7, 8e3d748)
- Solution builds with 0 errors
- All 6 InvitationsController endpoints verified
- LogoutEndpoint correctly wired in Program.cs

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
