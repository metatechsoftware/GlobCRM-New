# Phase 25: Preview Sidebar Polish + Cross-Feature Integration - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the preview sidebar a power-user tool: add quick actions inside it, integrate with global search (preview-first), add user profile previews from feed author names, and polish responsive mobile behavior. Scope is limited to PREVIEW-08 through PREVIEW-11 requirements.

</domain>

<decisions>
## Implementation Decisions

### Quick actions in preview sidebar
- Actions open via CDK Overlay slide-in panel (reuse Phase 24 infrastructure), not Material dialog
- After performing a quick action, sidebar stays open and refreshes its data to reflect the change (e.g., new note appears in mini-timeline)
- Action set per entity type and placement within the sidebar are Claude's discretion

### User profile preview
- Activity-aware: show avatar, name, role, email, phone PLUS recent activity stats (deals assigned, tasks completed today, last active)
- Clicking email in profile preview opens compose flow
- No other actions needed — view-only beyond email link
- Whether it opens in the same sidebar or a lighter popover, and which entry points trigger it (feed authors only vs also owner fields), are Claude's discretion

### Search-to-preview flow
- Preview-first defaults: click/Enter on a search result opens preview sidebar; Ctrl/Cmd+click navigates to detail page
- When search is focused with no query, show recently previewed entities for quick re-access
- Trigger mechanism (icon button vs keyboard) and search dropdown behavior when preview opens are Claude's discretion

### Mobile responsive behavior
- Full-width sidebar on mobile (< 768px) with swipe-right-to-close gesture plus X button fallback
- Mobile layout adaptation (content density), auto-close on route navigation, and transition animation are Claude's discretion

### Claude's Discretion
- Quick action button placement in sidebar (top vs bottom vs floating)
- Which quick actions appear per entity type (contextual filtering)
- User preview container: same sidebar panel vs lighter popover
- User preview trigger scope: feed authors only vs also owner/assignee fields
- Search-to-preview trigger UX (icon button, keyboard shortcut, or hover)
- Search dropdown open/close state when preview opens
- Mobile content density adjustments
- Auto-close behavior on route navigation
- Mobile transition animation style
- Performance index selection for preview/summary/my-day queries

</decisions>

<specifics>
## Specific Ideas

- User wants the slide-in panel from Phase 24 reused for quick actions — consistent interaction pattern across My Day and preview sidebar
- Preview-first search is a deliberate UX choice: the user imagines search as a quick-peek tool, not just navigation
- Recently previewed entities in empty search state gives power users fast re-access to entities they were just looking at
- Swipe-right-to-close on mobile matches native app patterns (iOS/Android navigation drawers)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-preview-sidebar-polish-cross-feature-integration*
*Context gathered: 2026-02-20*
