# Phase 22: Shared Foundation + Entity Preview Sidebar - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can peek at any entity from the feed without losing context. Clicking an entity name opens a slide-in preview sidebar with key details, associations, and recent activity. Also includes cross-cutting infrastructure: EntityTypeRegistry, tab index refactor (index-based to label-based across all 6 detail pages), and entity_name denormalization on feed_items.

</domain>

<decisions>
## Implementation Decisions

### Sidebar visual design
- Width: ~480px (medium — comfortable for field labels + values side by side)
- Layout mode: Push content (feed compresses to make room, both visible side by side)
- Animation: Smooth ease ~350ms slide-in from right
- Header layout: Claude's discretion (see below)

### Entity field selection
- Field density: Claude decides per entity type based on what's most useful (varying 4-10 fields)
- Custom fields: Show pinned custom fields only (requires a `show_in_preview` boolean flag on custom field definitions)
- Pipeline stage display: Mini stage progress bar for Deals and Leads (horizontal bar showing all stages with current highlighted)
- Owner display: Avatar + name shown for entity owner

### Association & activity display
- Association chips: Claude decides format (counts-only vs named chips) based on sidebar space
- Chip click behavior: Opens nested preview of that entity (replaces sidebar content with back button to return)
- Recent activities: Mini vertical timeline with dots/lines connecting the last 3 activities (type icon, title, time)
- Activity section footer: "View all activities" link navigates to entity's full detail page activities tab

### Feed interaction pattern
- Entity name affordance: Styled as links with underline on hover
- Click behavior: Single click opens preview sidebar; Ctrl/Cmd+click navigates to full detail page
- Multi-click: Clicking a different entity replaces sidebar content with back navigation (breadcrumb/back button to return to previous preview)
- Hover tooltip: Small lightweight tooltip showing entity type icon + name (no API call, uses data already in the feed item)

### Preview navigation model
- Sidebar maintains a navigation stack (from feed clicks and association chip clicks)
- Back button returns to previous preview in the stack
- "Open full record" navigates to the full detail page and closes sidebar
- Escape key and clicking outside close the sidebar entirely (clears stack)

### Claude's Discretion
- Sidebar header layout (icon + name + badge vs full header card — pick what fits best)
- Field selection per entity type (which key properties and how many)
- Association chip format (counts vs named — pick based on available space)
- Loading skeleton design
- Exact spacing, typography, and section ordering within the preview
- Error state handling (deleted/not found entities)
- Tooltip implementation details

</decisions>

<specifics>
## Specific Ideas

- Push-content layout: feed and preview should feel like a split view, not a modal interruption
- Mini stage progress bar for deals/leads gives "where in the pipeline" at a glance — similar to progress indicators in project management tools
- Navigation stack in the sidebar enables drill-down without losing context (association chip → nested preview → back)
- Hover tooltip is client-side only (entity type icon + name from feed data), no API call on hover

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-shared-foundation-entity-preview-sidebar*
*Context gathered: 2026-02-20*
