# Phase 24: My Day Personal Dashboard - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Personal daily workspace replacing the home page after login. Displays today's tasks, overdue items, upcoming events, pipeline summary, recent activity, quick actions, email summary, feed preview, and notification digest. Fixed layout (no drag-and-drop — deferred to v1.3+). Route restructuring moves org dashboard to /analytics.

</domain>

<decisions>
## Implementation Decisions

### Page layout & hierarchy
- Dashboard grid layout with mixed-size cards (some full-width, some half-width) — responsive grid similar to Linear/Jira dashboard
- Greeting banner with quick actions is full-width at top
- Tasks widget is full-width hero below greeting
- Row 2: three half-width cards — Upcoming events, Pipeline summary, Email summary
- Row 3: three half-width cards — Feed preview, Notification digest, Recent records
- Quick actions row lives INSIDE the greeting banner (not a separate card)

### Greeting & personalization
- Time-based casual greeting: "Good morning, {FirstName}" / "Good afternoon, {FirstName}"
- Short friendly date format: "Thu, Feb 20"
- Key summary stats in greeting banner: tasks today count, overdue count, upcoming meetings count
- Subtle gradient background using orange brand color for the greeting banner — distinct hero section feel

### Urgency & overdue styling
- Overdue items: red left border or background tint with red "Overdue" badge showing days overdue (e.g. "3d overdue")
- Overdue vs today grouping: Claude's discretion (separate section or mixed-sorted-first)
- Tasks are completable inline with checkbox — marks activity as done directly from My Day with optimistic UI update

### Widget density & interactions
- Task/item count per widget: Claude's discretion (balance for the grid layout)
- Entity name clicks inside widgets open preview sidebar (consistent with feed behavior), Ctrl/Cmd+click navigates to detail page
- Empty widget states: friendly illustration + contextual message (e.g. "No tasks today — nice work!" or "No deals yet — create one")
- Pipeline summary visualization: Claude's discretion (bar chart, donut, or numbers — pick best fit for compact widget)

### Quick actions
- Quick actions open as slide-in side panels from the right (not MatDialog popups) — feels more integrated, user stays in dashboard context
- After action completes: real-time widget refresh AND brief highlight/pulse animation on the new item so user sees where the change landed
- Multi-step support: single-step form first, then optional follow-up step (e.g. "Link to company?" or "Schedule follow-up?") — user can skip or continue
- Panel width: Claude's discretion (match preview sidebar 480px or wider based on form content needs)

### Claude's Discretion
- Overdue items grouping strategy (separate section vs mixed-sorted-first)
- Task/item count limits per widget
- Pipeline summary visualization approach
- Slide-in panel width
- Upcoming events day grouping (day headers vs timeline)
- Loading skeleton design per widget
- Two-tier loading strategy details

</decisions>

<specifics>
## Specific Ideas

- User envisions quick actions as "powerhouses" — the slide-in panel should feel like a mini workspace, not just a simple form
- Pattern: create an entity via slide-in panel, see it immediately reflected across dashboard widgets with highlight animation — no page navigation needed
- Quick action flow example: team member creates and sends an offer through a wizard panel, data reflects on related CRM records automatically
- Greeting should feel warm and motivational — this is the first thing users see after login

</specifics>

<deferred>
## Deferred Ideas

- **"Create Offer" quick action** — Full quote/offer creation wizard as a quick action. Would need line-item management, PDF generation trigger, and email send. Too complex for Phase 24's quick action set — belongs in a future phase or as an extension to Phase 25
- **Configurable widget layout (drag-and-drop)** — Already deferred to v1.3+ (gridster-based)
- **Quick action side panel pattern for summary tabs** — Once slide-in panels are built for My Day, consider replacing MatDialog quick actions on summary tabs with the same slide-in pattern for consistency (future phase)

</deferred>

---

*Phase: 24-my-day-personal-dashboard*
*Context gathered: 2026-02-20*
