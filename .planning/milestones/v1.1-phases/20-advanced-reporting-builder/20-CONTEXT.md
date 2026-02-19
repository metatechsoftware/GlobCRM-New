# Phase 20: Advanced Reporting Builder - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Dynamic report builder where users select entity sources, fields (including formula fields and related entity fields one level deep), filters with AND/OR logic, groupings with aggregations, and chart visualizations — then save, share, and export. Drill-down from chart to underlying records. Seed starter reports for demo experience.

</domain>

<decisions>
## Implementation Decisions

### Builder Experience
- Single-page builder layout: all configuration panels visible at once (collapsible sections) with entity/fields/filters/grouping in a left sidebar and results preview on the right
- Field selection approach: Claude's discretion (checkbox list or drag-drop — whatever fits existing UI patterns)
- Manual "Run Report" button to execute — no auto-preview on config changes
- Filter conditions use AND/OR group builder with nestable condition groups (Notion/Airtable-style)

### Charts & Drill-Down
- Chart types: Bar, Line, Pie, and Funnel (funnel for pipeline/conversion reporting)
- Chart style: Rich & polished — subtle gradients, smooth animations, hover tooltips with detail (Mixpanel/HubSpot feel)
- View mode: Chart on top, data table below — both visible simultaneously
- Drill-down behavior: Claude's discretion (click chart segment → filtered table or dialog)

### Report Gallery & Sharing
- Organization: Folders or categories for grouping reports (e.g., "Sales Reports", "Pipeline Analysis")
- Sharing model: Claude's discretion — fit it to the existing RBAC system
- Starter reports: Seed 4-6 prebuilt reports (e.g., "Deals by Stage", "Contacts by Source", "Revenue by Month", "Activities This Week") — users can clone and customize
- Gallery style: Card grid with mini chart thumbnails, title, entity type badge, and last-run date (consistent with workflow/template card grids)

### Data Table & Export
- Large dataset handling: Server-side pagination (e.g., 50 rows per page)
- CSV export: Full dataset export via background Hangfire job — download link when ready
- Row click: Navigate to entity detail page (contact, deal, etc.)
- Aggregation display: Claude's discretion (footer totals row or summary KPI cards)

### Claude's Discretion
- Field selection UI pattern (checkbox list vs drag-drop)
- Drill-down interaction (inline table filter vs dialog)
- Sharing model granularity (fits existing RBAC)
- Aggregation display format (footer row vs summary cards)
- Chart library choice
- Related entity field picker UX
- Exact sidebar panel layout and collapse behavior

</decisions>

<specifics>
## Specific Ideas

- Card grid gallery should feel consistent with existing workflow and template card grids in GlobCRM
- Chart feel should be rich and polished — think Mixpanel or HubSpot dashboards, not bare/minimal
- Funnel chart is specifically for pipeline/conversion CRM reporting use cases
- Starter reports should demonstrate the range of what the builder can do (different entity types, chart types, groupings)
- CSV export runs as background job for large reports — user gets download link when complete

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-advanced-reporting-builder*
*Context gathered: 2026-02-19*
