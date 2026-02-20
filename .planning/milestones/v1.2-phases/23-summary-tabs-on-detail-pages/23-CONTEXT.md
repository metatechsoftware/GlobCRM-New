# Phase 23: Summary Tabs on Detail Pages - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Aggregated summary tab as the default first tab on all 6 major entity detail pages (Company, Contact, Deal, Lead, Quote, Request). Each summary loads via a single batched backend endpoint. Summary tab data auto-refreshes when mutations happen on sibling tabs. QuickActionBarComponent provides inline actions. No new entity capabilities — this is a read-focused overview layer with quick action shortcuts.

</domain>

<decisions>
## Implementation Decisions

### Summary layout & density
- Card grid layout — distinct cards for each section (key properties, activities, associations, pipeline, etc.), arranged in a responsive grid with clear card separation
- Moderate detail density: 3-5 items per card with enough context to be useful without clicking into the full tab (activities: title + status + due date; notes: 2-3 line preview; associations: name + type)
- No "View all" links on cards — summary is standalone, users switch tabs manually to see full data

### Quick actions bar
- Horizontal action bar pinned at the top of the summary tab content, always visible as the first thing below the tab strip
- Quick actions open dialog/modal forms (consistent with existing form patterns in the app)
- After a quick action completes (note saved, activity logged), summary tab data auto-refreshes to reflect the change immediately

### Widget arrangement & priority
- Activities & timeline should get the most visual prominence — the summary is primarily about "what's happening with this entity"
- Reading order: key properties + stage indicator at top, then activities + associations below
- Grid flows: identity first (who/what), then dynamics (what's happening, who's connected)

### Entity-specific variations
- Company and Contact: dedicated deal pipeline mini-chart card showing deals by stage, total value, win rate — full visual bar or donut chart, not just numbers
- Deal and Lead: horizontal stage progress bar showing all pipeline stages with current stage highlighted — stepped progress indicator, not just a badge
- Contact: dedicated email engagement card showing last sent, last received, total emails exchanged, and sequence enrollment status
- Quote and Request: simpler summaries without pipeline or email cards — focus on properties, activities, and associations

### Claude's Discretion
- Key properties card: Claude picks the right 4-8 fields per entity type based on typical usage patterns
- Association count presentation: chips vs badges, whether clicking navigates or shows inline preview
- Activities card structure: whether to split recent/upcoming into separate cards or combine into one card with two sections
- Quick action set per entity type: core set (Add Note, Log Activity) on all entities, plus entity-specific actions where they make sense (Send Email on Contact/Lead, etc.)
- Shared template vs per-entity layouts: Claude decides based on how different the entity summaries actually need to be

</decisions>

<specifics>
## Specific Ideas

- Activities as the hero content — user wants the summary to answer "what's happening with this entity" at a glance
- Pipeline mini-chart should be a real visualization (bar or donut), not just numbers in a row
- Stage progress bar for Deal/Lead should feel like a stepped pipeline indicator showing progression through stages
- Email card for Contact should give full engagement context (not hidden in a stats row)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-summary-tabs-on-detail-pages*
*Context gathered: 2026-02-20*
