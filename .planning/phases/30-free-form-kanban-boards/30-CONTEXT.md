# Phase 30: Free-Form Kanban Boards - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create custom Kanban boards with free-form and entity-linked cards for organizing any type of work beyond the existing deal and activity pipelines. Includes board CRUD, column management, card management with drag-and-drop, entity linking, labels, checklists, comments, and card filtering. System boards (Deal Pipeline, Activity Board) appear alongside custom boards on a unified boards page.

</domain>

<decisions>
## Implementation Decisions

### Board & Column Layout
- Fixed-width columns (~280px) with horizontal scroll when columns exceed the viewport
- Columns are collapsible — collapse to a thin strip showing column name and card count, click to expand
- "Add new column" via a persistent "+" button after the last column, click opens inline name input
- Board header: Claude's discretion on layout (compact toolbar vs rich header)

### Card Face Design
- Compact density (Trello-style): title always visible, metadata as small icons along the bottom edge
- Labels appear as thin color bars across the top edge of the card; click to expand and see label names
- Entity-linked cards show a small entity type icon (contact, deal, etc.) with the entity name as a clickable badge/chip below the title
- Hover actions: small action icons (edit, archive, label) fade in on card hover for quick access
- Bottom metadata row: assignee avatar, due date (with urgency color), checklist progress icon

### Drag-and-Drop Feel
- Lifted card + shadow style: card lifts up with drop shadow and slight rotation while dragging
- Placeholder gap shows where the card will land
- Drop targets use both: column gets a subtle border glow/background tint AND specific insertion point shows a gap/line
- Columns are also draggable — reorder columns by dragging the column header (same lift-and-shadow style)
- WIP limit exceeded: allow the drop with a non-blocking warning — column header flashes warning color and shows "Over limit" badge

### Boards Page & Navigation
- Card grid with mini column previews: each board card shows name, color accent, column count, and a mini column preview thumbnail
- System boards (Deal Pipeline, Activity Board) in a separate "System Boards" section pinned at top of the page, then "My Boards" and "Team Boards" sections below
- Board creation via dialog: click "New Board" opens a dialog showing template options (Sprint, Content Calendar, Sales Follow-up) plus "Blank Board" — pick one, enter name, done
- Single "Boards" link in the sidebar navigation (no individual boards listed in the nav)
- Empty boards page shows create prompt with template suggestions (KANB-18)

### Claude's Discretion
- Board header layout (compact toolbar vs rich header — balance space with useful info)
- Card spacing and exact padding within columns
- Animation timing and easing for drag-and-drop
- Column collapse/expand animation
- Template preview content in the creation dialog
- Filter panel design for card filtering (label, assignee, due date)
- Card detail panel/dialog layout (for editing card description, checklists, comments)
- Checklist progress indicator style on card face
- Comment threading UI inside card detail

</decisions>

<specifics>
## Specific Ideas

- Card face should be compact like Trello — title prominent, metadata as small icons, not cluttered
- Color bars at top of cards for labels is the Trello "classic" look — thin strips, expandable
- Entity link badge on cards should feel clickable and open the existing CRM preview sidebar
- Drag feel should be physical — lifted card with shadow and slight rotation gives a tactile feel
- Board grid page with mini column previews helps users quickly identify which board is which
- System boards pinned at top creates a clear hierarchy: system stuff first, then your custom boards

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-free-form-kanban-boards*
*Context gathered: 2026-02-21*
