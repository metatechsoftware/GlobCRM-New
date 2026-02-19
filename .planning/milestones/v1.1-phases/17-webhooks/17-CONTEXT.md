# Phase 17: Webhooks - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure, reliable delivery of CRM entity events to external URLs via admin-managed webhook subscriptions. Includes subscription CRUD, HMAC-signed delivery with exponential retry, delivery logs, test sends, and SSRF prevention. No workflow triggers (Phase 19), no sequence enrollment (Phase 18).

</domain>

<decisions>
## Implementation Decisions

### Subscription Management
- Per entity + event type granularity — admin picks specific entity types AND event types (create, update, delete) individually
- One subscription supports multiple entity+event combinations — a single webhook URL can listen to Contact Created + Deal Updated + Company Deleted, etc.
- Start with core 5 entities (Contact, Company, Deal, Lead, Activity), designed so adding more entities is trivial
- Webhook secrets are auto-generated on creation, shown to admin once only (Stripe-style) — can regenerate but old secret is immediately invalidated
- Admin can manually enable/disable subscriptions and re-enable auto-disabled ones (preserves config and delivery history)

### Payload Shape
- Full entity snapshot + changed fields — payload includes complete entity data at time of event PLUS a "changes" object showing old/new values for update events
- Custom fields inclusion is opt-in per subscription — admin toggles whether custom fields are part of entity payloads
- Delete events and envelope metadata design at Claude's discretion

### Delivery Log UX
- Both global delivery log page (all webhooks across tenant) AND per-subscription filtered view
- Custom log layout with status badges and expandable rows — purpose-built for webhook logs, NOT DynamicTable
- Payload inspection detail level and log retention period at Claude's discretion

### Test & Retry Experience
- Test webhook: preview payload first, then option to send it to the real URL — inspect before firing
- Auto-disable notification: both email alert AND in-app notification when a subscription hits 50 consecutive failures
- Re-enable existing subscriptions after fixing issues — preserves config and history, no need to recreate
- Manual retry from delivery log at Claude's discretion

### Claude's Discretion
- Payload envelope structure (delivery ID, timestamp, event type, tenant ID, version)
- Delete event payload content (full entity before delete vs ID only)
- Delivery log payload inspection depth (full request/response vs summary)
- Log retention period
- Manual retry of failed deliveries from log

</decisions>

<specifics>
## Specific Ideas

- Secret handling should feel like Stripe's webhook secret experience — auto-generated, revealed once, with a "regenerate" option that invalidates the old one
- Delivery log should feel like a purpose-built observability tool with status badges (green/red/amber), not a generic data table

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-webhooks*
*Context gathered: 2026-02-19*
