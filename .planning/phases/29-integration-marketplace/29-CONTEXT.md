# Phase 29: Integration Marketplace - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can browse, connect, and manage third-party integrations from a dedicated marketplace settings page with secure credential storage. This phase delivers the marketplace UI, credential management (connect/disconnect/test), and activity logging. Actual integration functionality (sending messages via Slack, syncing contacts, etc.) is out of scope — this is the management layer only.

</domain>

<decisions>
## Implementation Decisions

### Marketplace layout & cards
- Responsive auto-fit grid: cards have a fixed width (~280px), grid reflows based on screen size (app store style)
- Connected integrations distinguished by status badge AND a subtle green left-border/outline accent on the card — scannable at a glance
- Connect button visible on each card for quick access (admins only), plus connect option inside the detail panel

### Connection flow & dialogs
- Each integration defines its own credential fields dynamically (e.g., API Key + Secret, or API Key + Webhook URL) — not a single generic field
- Connect button on cards opens a credential dialog directly; the same connect action is also available inside the detail panel
- Disconnect requires confirmation dialog before proceeding

### Detail panel
- Right-side drawer that overlays the grid (dims background) — like Gmail's side panel
- Masked credentials displayed as read-only fields showing `••••••XXXX` (last 4 chars), no reveal option
- Connect/Disconnect/Test actions available inside the panel for admins

### Integration catalog
- 12 curated integrations seeded: Slack, Gmail, Google Calendar, QuickBooks, Mailchimp, Dropbox, GitHub, Zapier, HubSpot, Twilio, WhatsApp, Instagram
- Popular badge on: Slack, Gmail, WhatsApp, Mailchimp, Google Calendar
- SVG brand icons from a free icon set (Simple Icons or similar) — consistent style with brand colors
- Categories: Communication (Slack, Gmail, WhatsApp, Twilio, Instagram), Accounting (QuickBooks), Marketing (Mailchimp, HubSpot), Storage (Dropbox), Calendar (Google Calendar), Developer Tools (GitHub, Zapier)

### Claude's Discretion
- Card content density (what info shows per card besides logo, name, status, and popular badge)
- Filter bar layout (search + category chips vs dropdown — based on available space and existing patterns)
- Test connection result display (inline in dialog vs toast)
- Whether test connection is required before saving or optional
- Detail panel section layout (linear flow vs tabs)
- Activity log style (simple list vs vertical timeline — based on existing patterns)
- Catalog data source (database seed data vs frontend static data)
- Exact spacing, typography, and animation details

</decisions>

<specifics>
## Specific Ideas

- User specifically requested WhatsApp and Instagram in addition to the standard CRM integrations
- Popular badges target the most CRM-relevant integrations across communication, marketing, and productivity
- Card grid should feel like an app store — responsive, scannable, visually distinguishable by connection state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-integration-marketplace*
*Context gathered: 2026-02-21*
