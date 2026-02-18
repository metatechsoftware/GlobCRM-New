# Phase 13: Leads - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Full lead management with CRUD, dynamic table, configurable pipeline stages (Kanban + table), temperature scoring, and lead-to-contact/company/deal conversion. Follows established v1.0 entity patterns for dynamic table, custom fields, activities, notes, and timeline.

</domain>

<decisions>
## Implementation Decisions

### Lead pipeline & stages
- Kanban board view AND standard dynamic table — users can switch between views (same pattern as deals pipeline)
- Stages are configurable per tenant — admin can add/rename/reorder stages, similar to deal pipeline customization
- Default stages seeded: New, Contacted, Qualified, Lost, Converted
- Two terminal stages: **Converted** (success) and **Lost** (failure) — leads exit the active pipeline either way
- Forward-only stage progression by default, with an explicit "reopen" action to move backward

### Lead-to-contact conversion
- Contact is always created during conversion; company and deal are optional toggles in the conversion dialog
- Editable preview dialog — lead data pre-fills the new record fields, user can review and edit before confirming
- If lead's company name matches an existing company, show a match warning: "Company 'X' already exists — link to existing or create new?" — user decides
- Same duplicate-aware suggestion for contact email matches

### Lead sources & capture
- Lead sources are configurable per tenant — admin manages the source list (seeded defaults: Website, Referral, LinkedIn, Cold Call, Trade Show, Email Campaign, Other)
- Simple hot/warm/cold temperature indicator on each lead — visual badge in table and Kanban, selectable on create/edit

### Lead detail page layout
- Horizontal stepper progress bar across the top showing all pipeline stages — current stage highlighted, clickable to advance (forward-only unless reopened)
- Prominent "Convert Lead" button in the header area — always visible when lead is in a convertible stage (not shown on Lost/Converted leads)
- Standard entity tabs (Activities, Notes, Attachments, Timeline) plus a "Conversion" tab showing conversion details and linked records after conversion
- Conversion tab only appears after lead has been converted

### Claude's Discretion
- Post-conversion lead behavior (mark as Converted + read-only vs soft-delete — pick whichever is most consistent with CRM patterns)
- Web form capture API endpoint — assess scope and decide if it fits this phase or should be deferred
- Lead assignment (AssignedTo user field) — pick based on CRM best practices and existing entity patterns
- Detail page header layout — balance stage/temperature prominence with contact info based on existing detail page patterns
- Loading skeletons, error states, empty states for all views

</decisions>

<specifics>
## Specific Ideas

- Kanban board should follow the same component pattern as the deals pipeline Kanban
- Temperature indicator should be a colored badge (e.g., red=hot, orange=warm, blue=cold) — visible at a glance in both table and Kanban
- Conversion dialog is a multi-step or sectioned form: Contact fields (required) → Company fields (optional toggle) → Deal fields (optional toggle)
- Stage stepper on detail page should be interactive — click a future stage to advance, with confirmation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-leads*
*Context gathered: 2026-02-18*
