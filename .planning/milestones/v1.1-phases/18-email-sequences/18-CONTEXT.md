# Phase 18: Email Sequences - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated multi-step email drip campaigns. Users create sequences of templated emails with configurable delays, enroll contacts (individually or in bulk), track per-step and sequence-level performance metrics, and contacts are auto-unenrolled on reply. Depends on Phase 14 (Hangfire for scheduling, Email Templates for step content) and Phase 7 (Gmail sync for reply detection).

</domain>

<decisions>
## Implementation Decisions

### Sequence Builder UX
- Vertical step list layout (not visual timeline) — clean list with drag-to-reorder, each step shows template name, delay, and collapse/expand for details (HubSpot-style)
- Delays configured as days + preferred time of day (e.g., "Wait 2 days, send at 9:00 AM")
- Each step selects from saved email templates with a rendered preview shown inline; quick "edit template" link opens template editor in new tab
- Optional subject line override per step — defaults to template subject but allows per-step override for sequence-specific messaging

### Enrollment Experience
- Single enrollment available from BOTH contact detail page (actions menu) AND sequence detail page ("Add Contacts" button with contact picker/search dialog)
- Bulk enrollment from contacts list via multi-select; confirmation dialog shows count and skips already-enrolled contacts with a note ("3 already enrolled, will be skipped")
- Pause/resume via row-level toggle on each enrollment PLUS multi-select checkboxes for bulk pause/resume from the enrollment list
- A contact can be enrolled in multiple sequences simultaneously; enrollment dialog warns if already in other sequences but doesn't block

### Reply Detection & Unenroll
- Reply detection via custom email headers (In-Reply-To, References, or custom X-Sequence-Id header) to identify replies to sequence emails — more precise than thread-based matching
- On auto-unenroll: in-app notification ("John Smith replied to Step 2 of Onboarding Sequence and was unenrolled") PLUS a "Replied" status badge on the enrollment row
- Re-enrollment allowed from any step — user can choose to start from beginning, where they left off, or a specific step
- Built-in open/click tracking: tracking pixel for opens, link-wrapped URLs for clicks, handled transparently when sequence emails are sent

### Analytics & Tracking Display
- Sequence detail page: summary metric cards (Total Enrolled, Active, Completed, Replied, Bounced) PLUS a visual funnel chart showing drop-off from step 1 through completion
- Funnel visualization shows where contacts fall off across the sequence steps

### Claude's Discretion
- Bounce handling strategy (auto-unenroll on hard bounce vs. flag and continue)
- Per-step metrics display approach (inline vs. expandable detail panel)
- Sequence list page metric density (key columns vs. minimal)
- Loading skeleton and empty state designs
- Exact tracking pixel and link wrapping implementation details
- Step reorder animation and drag handle design

</decisions>

<specifics>
## Specific Ideas

- Vertical step list inspired by HubSpot sequences — clean, scannable, not overly visual
- Funnel chart on sequence detail page to visualize contact progression and identify drop-off points
- Bulk enrollment skip logic: transparently handle already-enrolled contacts without blocking the entire operation
- Re-enrollment step picker: let users resume from any point in the sequence, not just restart

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-email-sequences*
*Context gathered: 2026-02-19*
