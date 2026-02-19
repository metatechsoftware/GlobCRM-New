# Phase 14: Foundation Infrastructure & Email Templates - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two things:
1. **Shared infrastructure** — Hangfire background jobs with PostgreSQL storage, TenantScope wrapper for tenant-safe job execution, DomainEventInterceptor for entity lifecycle events (create/update/delete dispatching after SaveChangesAsync)
2. **Email templates** — Rich drag-and-drop email template builder with merge fields, categories, preview, and test send — used by downstream features (sequences, workflows)

Infrastructure is pure backend with no user-facing decisions. Email templates are the user-facing feature.

</domain>

<decisions>
## Implementation Decisions

### Template editor experience
- Use an existing open-source email builder library (e.g. Unlayer, GrapeJS, EmailBuilder.js) embedded in Angular — not a custom build
- Full HTML email builder with drag-and-drop blocks (header, columns, image, button, divider) — like Mailchimp's editor
- Merge field insertion via both: toolbar dropdown menu (browse fields grouped by entity) AND inline {{ typing with autocomplete (for power users)
- Merge fields render as styled chip/badge pills inside the editor (e.g. colored [Contact: First Name]) — visually distinct from regular text

### Merge field behavior
- Available merge field sources: core CRM entities — Contact, Company, Deal, Lead
- Custom fields (JSONB) are available as merge fields — any admin-defined custom field on Contact, Company, Deal, Lead can be used in templates
- Configurable fallback values per merge field — template author sets fallback (e.g. {{first_name | 'there'}}) so missing data renders gracefully
- Nested/related entity data: Claude's discretion — balance complexity vs usefulness

### Template organization
- Categories: predefined starter categories (Sales, Support, Marketing, General) plus user-created custom categories
- Seeded starter templates included out of the box — common scenarios (welcome email, follow-up, meeting request, deal won) that users can clone and customize
- Permissions follow existing RBAC system — new permission like 'EmailTemplate:Create/Edit/Delete' with scope control
- Personal vs shared visibility: Claude's discretion — pick based on existing permission patterns in the codebase

### Preview & testing
- Preview defaults to sample data for quick preview, with option to select a real CRM entity for accurate merge field resolution
- "Send test" button sends the rendered template to the user's own email address for inbox testing
- Desktop + mobile preview toggle — switch between desktop (600px+) and mobile (320px) widths to check responsiveness
- Template list page shows visual thumbnails/rendered previews of each email template for easy scanning

### Claude's Discretion
- Nested merge field depth (one level vs full dot notation) — balance complexity vs real-world usefulness
- Personal vs shared template visibility model — align with existing codebase permission patterns
- Specific email builder library choice — research Angular 19 compatibility and pick the best fit
- Infrastructure details: Hangfire queue configuration, DomainEventInterceptor ordering with AuditableEntityInterceptor, TenantScope implementation

</decisions>

<specifics>
## Specific Ideas

- Email builder should feel like Mailchimp's drag-and-drop editor — familiar to users who've used modern email marketing tools
- Merge field chips should be visually distinctive (colored pills) so they stand out clearly from surrounding text
- Starter templates should cover common CRM scenarios so users have something to clone immediately after onboarding

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-foundation-infrastructure-email-templates*
*Context gathered: 2026-02-19*
