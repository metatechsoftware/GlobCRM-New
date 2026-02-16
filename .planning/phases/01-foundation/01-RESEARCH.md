# Phase 1: Foundation - Research

**Researched:** 2026-02-16
**Domain:** Multi-tenant authentication infrastructure (ASP.NET Core Identity + PostgreSQL RLS + Angular 19)
**Confidence:** HIGH

## Summary

Phase 1 delivers the foundational infrastructure for GlobCRM: multi-tenant data isolation, user authentication (signup, login, password reset, 2FA, logout), subdomain-based tenant resolution, and admin user invitations. This is a greenfield .NET 10 + Angular 19 + PostgreSQL 17 project with no existing code.

The recommended approach uses **ASP.NET Core Identity API endpoints** (introduced in .NET 8, available in .NET 10) for authentication, which provides built-in endpoints for register, login, refresh tokens, password reset, email confirmation, and 2FA management -- eliminating the need for a separate OAuth server like OpenIddict or Duende IdentityServer for this phase. JWT bearer tokens authenticate the Angular SPA. Multi-tenancy uses a **triple-layer defense**: tenant resolution middleware (subdomain), EF Core global query filters (TenantId), and PostgreSQL Row-Level Security policies. Finbuckle.MultiTenant provides the middleware infrastructure. Transactional emails (verification, password reset, invitations) use SendGrid or a similar provider via the `IEmailSender` interface.

**Primary recommendation:** Use ASP.NET Core Identity with `MapIdentityApi` for authentication endpoints, Finbuckle.MultiTenant with `WithHostStrategy()` for subdomain resolution, PostgreSQL RLS for database-level tenant isolation, and TOTP-based 2FA via the built-in Identity 2FA management endpoint. Skip OpenIddict/Duende for Phase 1 -- the built-in Identity API endpoints provide everything needed for email+password auth with JWT tokens.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Signup & onboarding
- Two distinct flows on signup page: "Create organization" and "Join organization"
- Create org collects business details: org name, industry, company size, plus admin email/password
- User chooses their subdomain during org creation (with availability check)
- After org creation, guided setup wizard: invite team, configure basics, import data -- skippable
- Join org works via email invitation link or org invite code shared by admin

#### Login & sessions
- 30-minute session by default, "Remember me" checkbox extends to 30 days
- JWT-based authentication that persists across browser refresh
- Multiple simultaneous device sessions allowed (laptop, phone, tablet)
- Password reset via email link only -- no security questions
- Login page branding: Claude's discretion (see below)

#### Tenant provisioning
- Subdomain chosen by user during org creation (e.g., acme.globcrm.com) with availability check
- New organizations come with seed data: sample contacts, demo deal, default pipeline -- helps users explore
- Soft user limit per org (e.g., 10 users) with admin ability to request more -- billing/plans come later
- Admin can deactivate (freeze) org but not permanently delete -- data preserved, reactivation possible

#### Invitations & roles
- Two default roles at org creation: Admin (full access) and Member (standard access)
- Custom roles deferred to Phase 2 RBAC
- Invite email is branded: includes org name, inviter name, role assigned, and join link
- Invitations expire after 7 days -- admin can resend
- Admin can bulk-invite by pasting or typing multiple email addresses at once

### Claude's Discretion
- Login page branding per tenant (org logo/colors on subdomain vs uniform GlobCRM branding)
- Setup wizard step content and flow details
- Email template design and styling
- Verification email flow specifics
- 2FA implementation approach (TOTP app vs SMS)
- Seed data content and structure
- Soft limit exact number and "request more" mechanism

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Discretion Recommendations

Areas where Claude has discretion, with researched recommendations:

### Login page branding per tenant
**Recommendation:** Uniform GlobCRM branding for Phase 1. Tenant-specific branding (logo, colors) adds complexity to the login flow (must resolve tenant from subdomain before rendering, then fetch branding assets). Defer per-tenant branding to Phase 2 when the settings/admin infrastructure exists. The subdomain still resolves the tenant for data isolation, but the login UI is uniform.
**Confidence:** HIGH -- standard SaaS pattern; most platforms (HubSpot, Pipedrive) start with uniform branding.

### Setup wizard step content and flow
**Recommendation:** Three-step wizard after org creation: (1) Invite team members (email input, skip option), (2) Configure basics (timezone, currency -- minimal settings), (3) Explore seed data (brief tour of sample contacts/deals). Each step is skippable. Wizard state stored in the Organization record (`setup_completed: boolean`). Show wizard on first login only.
**Confidence:** MEDIUM -- flow details can be refined during implementation.

### Email template design and styling
**Recommendation:** Use a simple, responsive HTML email template with GlobCRM branding (logo, brand colors). Use a single base template with slots for: header, body content, CTA button, footer. Templates: verification email, password reset, invitation. Use inline CSS for email client compatibility. Template rendering on the server side using Razor or a templating engine.
**Confidence:** HIGH -- standard approach.

### Verification email flow specifics
**Recommendation:** After registration, send a verification email with a link containing `userId` and `code` parameters. User must verify email before first login (`RequireConfirmedEmail = true`). Link expires based on `DataProtectionTokenProviderOptions.TokenLifespan` (set to 24 hours). Resend option available on the "check your email" page. ASP.NET Core Identity provides this flow via `/confirmEmail` and `/resendConfirmationEmail` endpoints built into `MapIdentityApi`.
**Confidence:** HIGH -- built into ASP.NET Core Identity.

### 2FA implementation approach
**Recommendation:** TOTP app-based 2FA (Google Authenticator, Authy, Microsoft Authenticator). TOTP is the industry-recommended approach and is preferred over SMS 2FA (which is vulnerable to SIM swapping). ASP.NET Core Identity has built-in TOTP support via the `/manage/2fa` endpoint. QR code generation on the frontend using `qrcode.js`. Recovery codes (10 codes) generated when 2FA is enabled. No SMS -- TOTP only.
**Confidence:** HIGH -- Microsoft officially recommends TOTP over SMS. Built into Identity.

### Seed data content and structure
**Recommendation:** Create seed data during org provisioning:
- 5 sample contacts (mix of roles: CEO, Sales Manager, Developer, etc.)
- 2 sample companies (linked to contacts)
- 1 demo deal (in "Proposal" stage, linked to a contact and company)
- 1 default pipeline with 5 stages: Lead, Qualified, Proposal, Negotiation, Closed Won/Lost
- Seed data marked with `is_seed_data: true` flag so users can bulk-delete it later
**Confidence:** MEDIUM -- exact content can be adjusted; the mechanism is standard.

### Soft limit exact number and "request more" mechanism
**Recommendation:** Default soft limit: 10 users per organization. When limit is reached, invitation form shows a message "You've reached the user limit for your plan. Contact us to increase your limit." with a "Request More" button that sends an email to a GlobCRM admin email address (configurable). Store the limit in the Organization record (`user_limit: int, default 10`). No hard enforcement -- admin can still invite beyond the limit with a warning. Full enforcement deferred to billing/plans phase.
**Confidence:** MEDIUM -- exact number is arbitrary; the soft-limit pattern is standard.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ASP.NET Core Identity | 10.0 | User management, password hashing, 2FA, tokens | Built-in, battle-tested, OWASP-compliant password hashing (PBKDF2) |
| `MapIdentityApi<TUser>` | 10.0 | REST endpoints for register, login, refresh, 2FA, password reset | Built-in since .NET 8, eliminates need for custom auth controllers |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 10.0 | JWT bearer token validation | Official Microsoft package for SPA auth |
| Finbuckle.MultiTenant | 10.0.3 | Tenant resolution middleware, EF Core integration | Most popular .NET multi-tenancy library, Apache 2.0, .NET Foundation member |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.x | EF Core PostgreSQL provider | Official PostgreSQL provider for EF Core |
| FluentValidation.AspNetCore | 11.x | Request validation | Cleaner than data annotations, supports complex conditional logic |
| Serilog.AspNetCore | 8.x | Structured logging | Industry standard for .NET structured logging |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SendGrid | 9.x | Transactional email delivery | Verification, password reset, invitation emails |
| MailKit | 4.x | SMTP email sending (alternative to SendGrid) | If self-hosting SMTP or using non-SendGrid provider |
| FluentEmail | latest | Email templating with Razor | Simplifies email template rendering |
| Angular Material | 19.x | UI components for auth pages | Login, signup, wizard forms |
| `@angular/cdk` | 19.x | Low-level UI primitives | Form layouts, overlays |
| NgRx SignalStore | 19.x | Auth state management | Store auth state, user info, tenant context |
| `date-fns` | 4.x | Date handling | Token expiration, invitation expiry calculations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `MapIdentityApi` (built-in) | OpenIddict 5.x | OpenIddict adds full OAuth2/OIDC server capabilities; overkill for Phase 1 email+password auth. Can migrate to OpenIddict in later phases if SSO/OIDC is needed. |
| `MapIdentityApi` (built-in) | Duende IdentityServer 7.x | Commercial license required ($$$). Same rationale as OpenIddict -- unnecessary for Phase 1. |
| Finbuckle.MultiTenant | Custom middleware | More control but significantly more code. Finbuckle handles edge cases (missing tenant, multiple strategies) that custom code would need to handle. |
| SendGrid | Amazon SES | SES is cheaper at volume but harder to set up. SendGrid has better developer experience and free tier (100 emails/day). |
| FluentValidation | Data Annotations | Data annotations are simpler but less powerful for cross-field validation and custom business rules. |

**Installation (Backend):**
```bash
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Finbuckle.MultiTenant
dotnet add package Finbuckle.MultiTenant.AspNetCore
dotnet add package Finbuckle.MultiTenant.EntityFrameworkCore
dotnet add package FluentValidation.AspNetCore
dotnet add package Serilog.AspNetCore
dotnet add package SendGrid
```

**Installation (Frontend):**
```bash
ng new globcrm-web --style=scss --routing
ng add @angular/material
npm install @ngrx/signals date-fns
```

## Architecture Patterns

### Recommended Solution Structure (.NET Backend)

```
GlobCRM/
├── src/
│   ├── GlobCRM.Domain/                 # Entities, value objects, interfaces (no dependencies)
│   │   ├── Entities/
│   │   │   ├── Organization.cs         # Tenant entity
│   │   │   ├── ApplicationUser.cs      # Extends IdentityUser
│   │   │   ├── Invitation.cs
│   │   │   └── UserRole.cs             # Simple Admin/Member enum for Phase 1
│   │   ├── Interfaces/
│   │   │   ├── IOrganizationRepository.cs
│   │   │   └── ITenantProvider.cs
│   │   └── Events/
│   │       ├── OrganizationCreated.cs
│   │       └── UserInvited.cs
│   │
│   ├── GlobCRM.Application/            # Use cases, DTOs, validators
│   │   ├── Organizations/
│   │   │   ├── CreateOrganizationCommand.cs
│   │   │   ├── CreateOrganizationValidator.cs
│   │   │   └── OrganizationDto.cs
│   │   ├── Invitations/
│   │   │   ├── SendInvitationCommand.cs
│   │   │   ├── AcceptInvitationCommand.cs
│   │   │   └── InvitationDto.cs
│   │   ├── Auth/
│   │   │   └── AuthDtos.cs
│   │   └── Common/
│   │       ├── IEmailService.cs
│   │       └── ITenantSeeder.cs
│   │
│   ├── GlobCRM.Infrastructure/          # EF Core, email, external services
│   │   ├── Persistence/
│   │   │   ├── ApplicationDbContext.cs  # Tenant-scoped DbContext
│   │   │   ├── TenantDbContext.cs       # Tenant catalog (not scoped)
│   │   │   ├── Configurations/          # EF Core entity configs
│   │   │   ├── Interceptors/
│   │   │   │   ├── TenantDbConnectionInterceptor.cs
│   │   │   │   └── AuditableEntityInterceptor.cs
│   │   │   └── Migrations/
│   │   ├── Identity/
│   │   │   └── ApplicationUser.cs       # Custom Identity user
│   │   ├── Email/
│   │   │   ├── SendGridEmailSender.cs
│   │   │   └── EmailTemplates/
│   │   ├── MultiTenancy/
│   │   │   ├── TenantProvider.cs
│   │   │   └── TenantSeeder.cs
│   │   └── DependencyInjection.cs
│   │
│   └── GlobCRM.Api/                     # Controllers, middleware, configuration
│       ├── Controllers/
│       │   ├── OrganizationsController.cs
│       │   ├── InvitationsController.cs
│       │   └── TenantsController.cs
│       ├── Middleware/
│       │   └── TenantResolutionMiddleware.cs  # Subdomain extraction
│       ├── Program.cs
│       ├── appsettings.json
│       └── appsettings.Development.json
│
├── tests/
│   ├── GlobCRM.UnitTests/
│   ├── GlobCRM.IntegrationTests/
│   └── GlobCRM.E2E/
│
└── GlobCRM.sln
```

### Recommended Angular Structure

```
globcrm-web/
├── src/
│   ├── app/
│   │   ├── core/                        # Singleton services, guards, interceptors
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── auth.interceptor.ts
│   │   │   │   └── auth.store.ts        # NgRx SignalStore
│   │   │   ├── tenant/
│   │   │   │   ├── tenant.service.ts
│   │   │   │   └── tenant.store.ts
│   │   │   └── api/
│   │   │       └── api.service.ts       # Base HTTP service
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   └── login.component.ts
│   │   │   │   ├── signup/
│   │   │   │   │   ├── create-org/
│   │   │   │   │   │   └── create-org.component.ts
│   │   │   │   │   └── join-org/
│   │   │   │   │       └── join-org.component.ts
│   │   │   │   ├── forgot-password/
│   │   │   │   │   └── forgot-password.component.ts
│   │   │   │   ├── reset-password/
│   │   │   │   │   └── reset-password.component.ts
│   │   │   │   ├── verify-email/
│   │   │   │   │   └── verify-email.component.ts
│   │   │   │   ├── two-factor/
│   │   │   │   │   └── two-factor-setup.component.ts
│   │   │   │   └── auth.routes.ts
│   │   │   ├── onboarding/
│   │   │   │   ├── wizard/
│   │   │   │   │   ├── invite-team-step.component.ts
│   │   │   │   │   ├── configure-basics-step.component.ts
│   │   │   │   │   └── explore-data-step.component.ts
│   │   │   │   └── onboarding.routes.ts
│   │   │   └── dashboard/               # Placeholder landing page
│   │   │       └── dashboard.component.ts
│   │   ├── shared/                      # Shared components, pipes, directives
│   │   │   └── components/
│   │   └── app.routes.ts
│   ├── environments/
│   └── styles/
```

### Pattern 1: Triple-Layer Tenant Isolation

**What:** Three independent layers enforce tenant data isolation, so a bug in one layer cannot cause cross-tenant data leakage.
**When to use:** Every data access operation in the entire application.

**Layer 1 -- Middleware (Request Level):**
```csharp
// Source: Finbuckle.MultiTenant WithHostStrategy pattern
// Resolves tenant from subdomain: acme.globcrm.com -> tenant "acme"
builder.Services.AddMultiTenant<TenantInfo>()
    .WithHostStrategy("__tenant__.globcrm.com")  // Pattern for subdomain extraction
    .WithEFCoreStore<TenantDbContext, TenantInfo>();

app.UseMultiTenant();  // Must come before UseAuthentication
app.UseAuthentication();
app.UseAuthorization();
```

**Layer 2 -- EF Core Global Query Filter (ORM Level):**
```csharp
// Source: EF Core HasQueryFilter documentation
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // Every tenant-scoped entity gets automatic filtering
    modelBuilder.Entity<Contact>()
        .HasQueryFilter(c => c.TenantId == _tenantProvider.GetTenantId());
    modelBuilder.Entity<Invitation>()
        .HasQueryFilter(i => i.TenantId == _tenantProvider.GetTenantId());
    // Apply to ALL tenant-scoped entities
}
```

**Layer 3 -- PostgreSQL RLS (Database Level):**
```sql
-- Source: PostgreSQL documentation + Crunchy Data blog
-- Applied per table for defense-in-depth
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON contacts
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- Set session variable via EF Core interceptor on every connection
-- SELECT set_config('app.current_tenant', '{tenant_id}', false);
```

### Pattern 2: ASP.NET Core Identity API Endpoints

**What:** Built-in REST endpoints for authentication, eliminating custom auth controllers.
**When to use:** All authentication operations in Phase 1.

```csharp
// Source: Microsoft Learn - Identity API endpoints (.NET 10)
// Program.cs

// 1. Configure Identity with EF Core
builder.Services.AddIdentityApiEndpoints<ApplicationUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>();

// 2. Configure JWT bearer authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

// 3. Configure Identity options
builder.Services.Configure<IdentityOptions>(options =>
{
    options.SignIn.RequireConfirmedEmail = true;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
});

// 4. Configure token lifespans
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
{
    options.TokenLifespan = TimeSpan.FromHours(24); // Email confirmation, password reset
});

// 5. Map Identity endpoints
var app = builder.Build();
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>();

// Built-in endpoints provided:
// POST /api/auth/register
// POST /api/auth/login          (set useCookies=false for JWT)
// POST /api/auth/refresh
// GET  /api/auth/confirmEmail
// POST /api/auth/resendConfirmationEmail
// POST /api/auth/forgotPassword
// POST /api/auth/resetPassword
// POST /api/auth/manage/2fa
// GET  /api/auth/manage/info
// POST /api/auth/manage/info
```

### Pattern 3: Token Lifetime Configuration (30min / 30day)

**What:** Implements the locked decision of 30-minute default sessions with 30-day "Remember me" option.
**When to use:** Login endpoint customization.

```csharp
// Source: ASP.NET Core Bearer Token configuration
// The built-in Identity API uses BearerTokenOptions for token lifetimes

builder.Services.Configure<BearerTokenOptions>(IdentityConstants.BearerScheme, options =>
{
    options.BearerTokenExpiration = TimeSpan.FromMinutes(30);   // Default session
    options.RefreshTokenExpiration = TimeSpan.FromDays(30);     // Max with "Remember me"
});

// Custom login endpoint to handle "Remember me"
app.MapPost("/api/auth/login-extended", async (
    LoginRequest request,
    bool rememberMe,
    SignInManager<ApplicationUser> signInManager,
    UserManager<ApplicationUser> userManager) =>
{
    // Validate credentials, then issue tokens with appropriate expiration
    // If rememberMe, use the full 30-day refresh token
    // If not rememberMe, refresh token also expires at 30 minutes
});
```

### Pattern 4: Angular Functional Interceptor for JWT

**What:** Automatically attaches JWT tokens to all API requests and handles token refresh.
**When to use:** Every HTTP request from the Angular app.

```typescript
// Source: Angular.dev - Intercepting requests and responses
// auth.interceptor.ts

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req);
};

// app.config.ts - Register with provideHttpClient
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes)
  ]
};
```

### Pattern 5: PostgreSQL RLS with EF Core Interceptor

**What:** Sets the tenant context on every database connection so RLS policies can filter data.
**When to use:** Every database operation.

```csharp
// Source: bytefish.de/blog/aspnetcore_multitenancy + PostgreSQL docs
public class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ITenantProvider _tenantProvider;

    public TenantDbConnectionInterceptor(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId != null)
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT set_config('app.current_tenant', @tenantId, false)";
            var param = cmd.CreateParameter();
            param.ParameterName = "tenantId";
            param.Value = tenantId.ToString();
            cmd.Parameters.Add(param);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }
}
```

### Anti-Patterns to Avoid

- **Rolling your own JWT generation instead of using Identity API endpoints:** The built-in `MapIdentityApi` handles token creation, refresh, and validation correctly. Custom JWT generation is error-prone (weak keys, missing claims, no refresh flow).
- **Setting tenant context in application code instead of middleware/interceptor:** If any code path skips the tenant filter, data leaks. Use middleware + interceptor for automatic enforcement.
- **Storing JWT in localStorage:** Vulnerable to XSS. For this SPA, the built-in Identity bearer token approach stores tokens in memory. Use `httpOnly` cookies for refresh tokens where possible, or store access tokens in memory and refresh tokens in `localStorage` with proper XSS mitigations (Angular's built-in sanitization helps).
- **Using database owner role for application connections:** Bypasses RLS. Create a dedicated application database role with RLS enforced.
- **Single-layer tenant isolation:** Never rely on only application-level filtering. The EF Core query filter can be bypassed with `IgnoreQueryFilters()`. RLS is the safety net.
- **Hardcoding roles as strings:** Use constants or enums for "Admin" and "Member" role names to avoid typos and enable refactoring.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hashing (MD5, SHA256, bcrypt) | ASP.NET Core Identity (PBKDF2 with 600K iterations) | OWASP-compliant, auto-upgraded hashing, handles salt generation |
| JWT token generation | Custom JWT creation + validation | `MapIdentityApi` with `AddJwtBearer` | Handles token creation, refresh, expiration, revocation correctly |
| Email verification tokens | Custom token generation | Identity `GenerateEmailConfirmationTokenAsync` | Cryptographically secure, time-limited, tamper-proof |
| Password reset tokens | Custom reset links | Identity `GeneratePasswordResetTokenAsync` | Same security guarantees as email tokens |
| TOTP 2FA | Custom OTP implementation | Identity `POST /manage/2fa` endpoint | RFC 6238 compliant, handles shared key, recovery codes |
| Tenant resolution | Custom subdomain parsing | Finbuckle `WithHostStrategy()` | Handles edge cases (missing tenant, fallback, multiple strategies) |
| Multi-tenant EF Core | Custom query filter per entity | Finbuckle `MultiTenantDbContext` | Automatic filter application, tested with EF Core, handles `IgnoreQueryFilters` |
| Rate limiting | Custom middleware | ASP.NET Core built-in `AddRateLimiter()` | Built-in since .NET 7, supports fixed window, sliding window, token bucket, concurrency |
| Input sanitization | Custom regex filters | FluentValidation + Angular built-in sanitization | Tested, composable, handles edge cases |

**Key insight:** Authentication and multi-tenancy are security-critical domains where hand-rolled solutions almost always have vulnerabilities. The standard libraries have been security-audited and handle edge cases (timing attacks, token replay, session fixation) that custom code misses.

## Common Pitfalls

### Pitfall 1: Tenant Data Leakage Through Missing TenantId
**What goes wrong:** A developer writes a query without tenant context, exposing all tenants' data.
**Why it happens:** New entities added without global query filter. Background jobs running without tenant context. Direct SQL queries bypassing EF Core.
**How to avoid:** Triple-layer defense (middleware + EF Core filter + RLS). Integration tests that assert cross-tenant isolation. Code review checklist item: "Does this entity have a TenantId and query filter?"
**Warning signs:** Any `DbSet<T>` query that doesn't filter by TenantId. Any `IgnoreQueryFilters()` call without explicit justification. Background jobs that don't set tenant context.

### Pitfall 2: JWT Token Stored Insecurely in Browser
**What goes wrong:** Access token in localStorage is stolen via XSS, granting full API access.
**Why it happens:** Developer follows outdated tutorials that recommend localStorage.
**How to avoid:** Store access token in memory (JavaScript variable). Use short-lived access tokens (30 min). Implement token refresh via refresh token (stored in httpOnly cookie or localStorage with XSS mitigations). Angular's built-in sanitization protects against most XSS vectors.
**Warning signs:** `localStorage.setItem('token', ...)` in codebase. Access tokens with long expiration (> 1 hour). No refresh token mechanism.

### Pitfall 3: Subdomain Tenant Resolution Fails in Development
**What goes wrong:** `acme.localhost` doesn't resolve in development, breaking the tenant resolution flow.
**Why it happens:** `localhost` doesn't support subdomains without hosts file entries or a local DNS server.
**How to avoid:** Use `*.localhost` entries in hosts file, or use a development domain like `*.globcrm.local`. In development, also support header-based tenant resolution (`X-Tenant-Id` header) as a fallback. Finbuckle supports multiple strategies chained together.
**Warning signs:** Tests pass but app fails when accessed via subdomain. Developer testing only works with hardcoded tenant.

### Pitfall 4: Email Delivery Fails Silently
**What goes wrong:** Verification and password reset emails never arrive, users can't complete registration.
**Why it happens:** SMTP configuration wrong, SendGrid API key invalid, emails going to spam, no error handling on email send.
**How to avoid:** Implement `IEmailSender` with proper error handling and logging. Use a reputable email provider (SendGrid free tier: 100/day). Log email send attempts with success/failure status. In development, use Mailpit or similar local email testing tool. Set up SPF/DKIM/DMARC for the sending domain.
**Warning signs:** Users reporting "never received email." No email send logs in application logs. High bounce rates in SendGrid dashboard.

### Pitfall 5: Organization Creation Not Idempotent
**What goes wrong:** Network timeout during org creation results in half-created org (user exists, org doesn't, or vice versa).
**Why it happens:** Org creation involves multiple steps (create org, create user, assign role, seed data, send email) without transaction management.
**How to avoid:** Wrap the entire org creation flow in a database transaction. Use an idempotency key to prevent duplicate submissions. Create the org and user in a single transaction, then send the email asynchronously. If email fails, the org still exists -- user can request email resend.
**Warning signs:** Orphaned users without organizations. Duplicate organizations with similar names. Users who registered but can't log in.

### Pitfall 6: Invitation Links Expose Sensitive Information
**What goes wrong:** Invitation URL contains raw org ID or user email, enabling enumeration attacks.
**Why it happens:** Developer uses predictable token format or includes sensitive data in URL.
**How to avoid:** Use cryptographically random invitation tokens (GUID or Identity token generators). Store invitation details in database, look up by token. Validate token hasn't expired (7-day expiry per locked decision). Invalidate token after use. Rate-limit invitation acceptance endpoint.
**Warning signs:** Invitation URLs containing email addresses, sequential IDs, or base64-encoded data that can be decoded.

### Pitfall 7: RLS Policy Not Applied to Application Database Role
**What goes wrong:** Application connects as database superuser, bypassing all RLS policies.
**Why it happens:** Development uses the postgres superuser, and this configuration is carried to production.
**How to avoid:** Create a dedicated application database role (`globcrm_app`) that is NOT a superuser. Grant this role appropriate permissions (SELECT, INSERT, UPDATE, DELETE) on application tables. RLS policies are automatically enforced for non-superuser roles. Test with the application role in development.
**Warning signs:** Connection string uses `postgres` user. `SELECT current_user` returns `postgres` in application logs.

## Code Examples

Verified patterns from official sources:

### Database Schema for Phase 1

```sql
-- Source: PostgreSQL documentation + project requirements
-- Tenant catalog (not scoped by RLS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) NOT NULL UNIQUE,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    user_limit INT NOT NULL DEFAULT 10,
    setup_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_subdomain ON organizations(subdomain);

-- ASP.NET Core Identity tables (auto-generated by EF Core migrations)
-- AspNetUsers, AspNetRoles, AspNetUserRoles, etc.
-- Extended with TenantId (organization_id) column

-- Invitations (tenant-scoped)
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Member',
    invited_by_user_id UUID NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on tenant-scoped tables
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invitations
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- Application database role (non-superuser)
CREATE ROLE globcrm_app LOGIN PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO globcrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO globcrm_app;
```

### Custom ApplicationUser Entity

```csharp
// Source: ASP.NET Core Identity documentation
public class ApplicationUser : IdentityUser<Guid>
{
    public Guid OrganizationId { get; set; }
    public Organization Organization { get; set; } = null!;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}
```

### Organization Creation Flow

```csharp
// Source: Custom implementation following ASP.NET Core patterns
public class CreateOrganizationCommandHandler
{
    private readonly TenantDbContext _tenantDb;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;
    private readonly ITenantSeeder _seeder;

    public async Task<OrganizationDto> Handle(CreateOrganizationCommand command)
    {
        // 1. Validate subdomain availability
        var exists = await _tenantDb.Organizations
            .AnyAsync(o => o.Subdomain == command.Subdomain.ToLowerInvariant());
        if (exists) throw new ConflictException("Subdomain already taken");

        // 2. Create organization in transaction
        await using var transaction = await _tenantDb.Database.BeginTransactionAsync();

        var org = new Organization
        {
            Name = command.OrgName,
            Subdomain = command.Subdomain.ToLowerInvariant(),
            Industry = command.Industry,
            CompanySize = command.CompanySize
        };
        _tenantDb.Organizations.Add(org);
        await _tenantDb.SaveChangesAsync();

        // 3. Create admin user
        var user = new ApplicationUser
        {
            UserName = command.Email,
            Email = command.Email,
            OrganizationId = org.Id,
            FirstName = command.FirstName,
            LastName = command.LastName
        };

        var result = await _userManager.CreateAsync(user, command.Password);
        if (!result.Succeeded)
        {
            await transaction.RollbackAsync();
            throw new ValidationException(result.Errors);
        }

        await _userManager.AddToRoleAsync(user, "Admin");
        await transaction.CommitAsync();

        // 4. Seed data (async, non-blocking)
        await _seeder.SeedOrganizationDataAsync(org.Id);

        // 5. Send verification email (async, non-blocking)
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        await _emailService.SendVerificationEmailAsync(user.Email, token, org.Subdomain);

        return new OrganizationDto(org);
    }
}
```

### Invitation Flow

```csharp
// Source: Custom implementation
public class SendInvitationCommandHandler
{
    public async Task Handle(SendInvitationCommand command)
    {
        var org = await _tenantProvider.GetCurrentOrganizationAsync();

        // Check user limit (soft)
        var currentUserCount = await _userManager.Users
            .CountAsync(u => u.OrganizationId == org.Id && u.IsActive);

        if (currentUserCount >= org.UserLimit)
        {
            // Soft limit: warn but don't block
            // Log and notify admin
        }

        foreach (var email in command.Emails)
        {
            var invitation = new Invitation
            {
                TenantId = org.Id,
                Email = email.Trim().ToLowerInvariant(),
                Role = command.Role ?? "Member",
                InvitedByUserId = _currentUser.Id,
                Token = Guid.NewGuid().ToString("N"),
                ExpiresAt = DateTime.UtcNow.AddDays(7) // 7-day expiry per decision
            };

            _db.Invitations.Add(invitation);
            await _db.SaveChangesAsync();

            await _emailService.SendInvitationEmailAsync(
                email: invitation.Email,
                orgName: org.Name,
                inviterName: _currentUser.FullName,
                role: invitation.Role,
                joinUrl: $"https://{org.Subdomain}.globcrm.com/join/{invitation.Token}"
            );
        }
    }
}
```

### Angular Auth Service with Token Management

```typescript
// Source: Angular.dev + ASP.NET Core Identity API patterns
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface LoginResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken = signal<string | null>(null);
  private refreshToken = signal<string | null>(null);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isAuthenticated = computed(() => !!this.accessToken());

  constructor(private http: HttpClient, private router: Router) {
    // Restore refresh token from localStorage on app init
    const stored = localStorage.getItem('refreshToken');
    if (stored) {
      this.refreshToken.set(stored);
      this.attemptTokenRefresh();
    }
  }

  async login(email: string, password: string, rememberMe: boolean): Promise<void> {
    const response = await this.http.post<LoginResponse>(
      '/api/auth/login?useCookies=false',
      { email, password }
    ).toPromise();

    this.setTokens(response!, rememberMe);
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  async logout(): Promise<void> {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    localStorage.removeItem('refreshToken');
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.router.navigate(['/login']);
  }

  private setTokens(response: LoginResponse, persist: boolean): void {
    this.accessToken.set(response.accessToken);
    this.refreshToken.set(response.refreshToken);

    if (persist) {
      localStorage.setItem('refreshToken', response.refreshToken);
    }

    // Schedule refresh before expiration (refresh at 80% of lifetime)
    const refreshIn = response.expiresIn * 0.8 * 1000;
    this.refreshTimer = setTimeout(() => this.attemptTokenRefresh(), refreshIn);
  }

  private async attemptTokenRefresh(): Promise<void> {
    const token = this.refreshToken();
    if (!token) return;

    try {
      const response = await this.http.post<LoginResponse>(
        '/api/auth/refresh',
        { refreshToken: token }
      ).toPromise();

      this.setTokens(response!, true);
    } catch {
      // Refresh failed, force logout
      await this.logout();
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom auth controllers with manual JWT creation | `MapIdentityApi` with built-in endpoints | .NET 8 (Nov 2023) | Eliminates 200+ lines of custom auth code; standardized endpoints |
| Class-based Angular interceptors | Functional interceptors with `withInterceptors()` | Angular 15+ (Nov 2022) | Simpler, better tree-shaking, no module boilerplate |
| IdentityServer4 (free) | OpenIddict (free) or Duende (paid) | 2022 | IdentityServer4 deprecated; OpenIddict recommended for free option |
| Karma/Jasmine for Angular tests | Jest + Testing Library | Angular 16+ (2023) | 3x faster, better DX, snapshot testing |
| NgModule-based Angular apps | Standalone components with `provideRouter` | Angular 14+ (2022), default in 17+ | Less boilerplate, simpler lazy loading |
| `HttpModule` / class-based services | `provideHttpClient()` with functional features | Angular 15+ | More composable, better tree-shaking |
| Custom tenant resolution | Finbuckle.MultiTenant 10.x | Ongoing | v10 supports .NET 10, latest patterns |

**Deprecated/outdated:**
- **IdentityServer4:** Deprecated in 2022. Use OpenIddict (free) or Duende IdentityServer (commercial).
- **Angular `NgModule`:** Still works but standalone components are the default in Angular 17+. New projects should use standalone.
- **`HttpInterceptor` interface (class-based):** Still works but functional interceptors are recommended.
- **Karma test runner:** Deprecated in Angular 16+. Use Jest.
- **`SmtpClient` in .NET:** Deprecated. Use MailKit.
- **`Protractor` for E2E testing:** Deprecated. Use Playwright.

## Open Questions

1. **Custom JWT claims for tenant context**
   - What we know: `MapIdentityApi` generates proprietary tokens (not standard JWT). We need `organizationId` (tenantId) in the token claims for API authorization.
   - What's unclear: Whether `MapIdentityApi` allows adding custom claims, or if we need to wrap/extend the login endpoint to add `organizationId` to the token.
   - Recommendation: Create a custom `/api/auth/login-extended` endpoint that calls into Identity's `SignInManager`, validates credentials, and issues a JWT with custom claims including `organizationId`. Use the standard `MapIdentityApi` for other endpoints (register, forgot-password, 2fa).

2. **Finbuckle + ASP.NET Core Identity integration**
   - What we know: Finbuckle has `Finbuckle.MultiTenant.EntityFrameworkCore` that integrates with EF Core. ASP.NET Core Identity uses its own `IdentityDbContext`.
   - What's unclear: How to make Identity tables tenant-scoped. Identity's built-in tables (AspNetUsers, etc.) need TenantId. Finbuckle may handle this, or we may need to extend `IdentityDbContext`.
   - Recommendation: Extend `IdentityDbContext` with Finbuckle's `IMultiTenantDbContext`. Add `TenantId` to `ApplicationUser`. Test that Identity operations (login, register) are properly tenant-scoped. The `organizations` table itself should NOT be tenant-scoped (it's the tenant catalog).

3. **Subdomain availability check -- real-time or on submit?**
   - What we know: User chooses subdomain during org creation with availability check.
   - What's unclear: Whether to check availability in real-time (as user types) or only on form submit.
   - Recommendation: Debounced real-time check (300ms delay after typing stops) via a dedicated `GET /api/subdomains/check?name=acme` endpoint. Show green checkmark or red X. Also validate on submit for race conditions.

4. **Development environment subdomain handling**
   - What we know: Subdomains like `acme.localhost:4200` won't work in standard development setup.
   - What's unclear: Best approach for local development.
   - Recommendation: Use dual tenant resolution strategy in development: subdomain primary, `X-Tenant-Id` header fallback. In development, configure hosts file entries or use `nip.io` (e.g., `acme.127.0.0.1.nip.io`). Finbuckle supports chained strategies.

## Sources

### Primary (HIGH confidence)
- [Microsoft Learn: Configure JWT bearer authentication in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0) - JWT configuration patterns, token validation, .NET 10
- [Microsoft Learn: Use Identity to secure a Web API for SPAs](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-api-authorization?view=aspnetcore-10.0) - `MapIdentityApi` endpoints, bearer token auth, 2FA API
- [Microsoft Learn: Enable QR code generation for TOTP authenticator apps](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-enable-qrcodes?view=aspnetcore-10.0) - TOTP setup, QR code generation
- [Microsoft Learn: Multi-factor authentication in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/mfa?view=aspnetcore-10.0) - 2FA best practices
- [Finbuckle.MultiTenant Documentation](https://www.finbuckle.com/multitenant) - v10.0.3, subdomain strategy, EF Core integration
- [NuGet: Finbuckle.MultiTenant.AspNetCore 10.0.3](https://www.nuget.org/packages/Finbuckle.MultiTenant.AspNetCore/) - Latest version verification
- [Angular.dev: Intercepting requests and responses](https://angular.dev/guide/http/interceptors) - Functional interceptors, `withInterceptors()`
- [Angular.dev: Setting up HttpClient](https://angular.dev/guide/http/setup) - `provideHttpClient` configuration
- [PostgreSQL Documentation: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) - RLS syntax, policy types

### Secondary (MEDIUM confidence)
- [bytefish.de: Providing Multitenancy with ASP.NET Core and PostgreSQL RLS](https://www.bytefish.de/blog/aspnetcore_multitenancy.html) - Full implementation pattern with interceptor, middleware, AsyncLocal
- [Crunchy Data: Row Level Security for Tenants in Postgres](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) - RLS best practices, set_config patterns
- [techbuddies.io: How to Implement PostgreSQL RLS for Multi-Tenant SaaS](https://www.techbuddies.io/2026/01/01/how-to-implement-postgresql-row-level-security-for-multi-tenant-saas/) - Recent (Jan 2026) implementation guide
- [Medium: Building Multi-Tenant .NET 9 Applications with RLS and Event Isolation](https://medium.com/@vahidbakhtiaryinfo/building-multi-tenant-net-9-applications-with-row-level-security-and-event-isolation-78cea5f60233) - .NET 9 patterns (applicable to .NET 10)
- [Code Maze: Password Reset with ASP.NET Core Identity](https://code-maze.com/password-reset-aspnet-core-identity/) - Token generation, password reset flow
- [dev-academy.com: Angular JWT Authorization with Refresh Token](https://dev-academy.com/angular-jwt/) - Token refresh patterns
- [SendGrid: Dynamic Transactional Email Templates](https://sendgrid.com/en-us/solutions/email-api/dynamic-email-templates) - Email template configuration

### Tertiary (LOW confidence, needs validation)
- FluentEmail integration with Razor templates for email rendering -- verify compatibility with .NET 10
- QRCode.js library for frontend QR code generation -- verify latest version and Angular compatibility
- Exact behavior of `MapIdentityApi` with custom `ApplicationUser` that has additional properties -- validate during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are production-proven, officially supported, with current documentation for .NET 10
- Architecture: HIGH - Triple-layer tenant isolation is a well-documented pattern with multiple verified implementations
- Authentication: HIGH - ASP.NET Core Identity API endpoints are official Microsoft recommendation for SPA backends since .NET 8
- Multi-tenancy: HIGH - Finbuckle 10.0.3 is actively maintained, widely adopted, .NET Foundation member
- Pitfalls: HIGH - Based on established patterns from PostgreSQL docs, OWASP guidelines, and documented SaaS multi-tenancy failures
- 2FA/TOTP: HIGH - Built into ASP.NET Core Identity, officially documented
- Email: MEDIUM - SendGrid integration is standard but template rendering approach (Razor vs FluentEmail) needs validation

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stack is stable, no fast-moving dependencies)
