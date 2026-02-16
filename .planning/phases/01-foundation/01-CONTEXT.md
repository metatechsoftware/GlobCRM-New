# Phase 1: Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure, isolated multi-tenant infrastructure with user authentication. Delivers signup (create org / join org), login with JWT, password reset, 2FA, logout, subdomain-based tenant resolution, data isolation per organization, and admin user invitations. RBAC with custom roles is Phase 2 — this phase uses simple Admin + Member roles.

</domain>

<decisions>
## Implementation Decisions

### Signup & onboarding
- Two distinct flows on signup page: "Create organization" and "Join organization"
- Create org collects business details: org name, industry, company size, plus admin email/password
- User chooses their subdomain during org creation (with availability check)
- After org creation, guided setup wizard: invite team, configure basics, import data — skippable
- Join org works via email invitation link or org invite code shared by admin

### Login & sessions
- 30-minute session by default, "Remember me" checkbox extends to 30 days
- JWT-based authentication that persists across browser refresh
- Multiple simultaneous device sessions allowed (laptop, phone, tablet)
- Password reset via email link only — no security questions
- Login page branding: Claude's discretion (see below)

### Tenant provisioning
- Subdomain chosen by user during org creation (e.g., acme.globcrm.com) with availability check
- New organizations come with seed data: sample contacts, demo deal, default pipeline — helps users explore
- Soft user limit per org (e.g., 10 users) with admin ability to request more — billing/plans come later
- Admin can deactivate (freeze) org but not permanently delete — data preserved, reactivation possible

### Invitations & roles
- Two default roles at org creation: Admin (full access) and Member (standard access)
- Custom roles deferred to Phase 2 RBAC
- Invite email is branded: includes org name, inviter name, role assigned, and join link
- Invitations expire after 7 days — admin can resend
- Admin can bulk-invite by pasting or typing multiple email addresses at once

### Claude's Discretion
- Login page branding per tenant (org logo/colors on subdomain vs uniform GlobCRM branding)
- Setup wizard step content and flow details
- Email template design and styling
- Verification email flow specifics
- 2FA implementation approach (TOTP app vs SMS)
- Seed data content and structure
- Soft limit exact number and "request more" mechanism

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-16*
