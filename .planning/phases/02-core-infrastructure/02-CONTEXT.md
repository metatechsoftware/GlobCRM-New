# Phase 2: Core Infrastructure - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Permission system (RBAC) with roles, teams, and field-level access controls. Custom fields architecture with JSONB storage supporting all field types. Dynamic table foundation with saved Views, column configuration, and filtering. User profile with preferences. No entity CRUD yet — that's Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Permission model & roles
- Predefined role templates (Admin, Manager, Sales Rep, Viewer) that admins can clone and customize
- Full granularity: CRUD per entity + ownership scope (own/team/all records) + field-level access (hidden/read-only/editable)
- Teams inherit a default role; users in the team get that role's permissions
- User can also have directly assigned roles
- Conflict resolution: most permissive wins (union of all permissions from direct + team-inherited roles)

### Custom field creation
- Dual creation path: Settings page for bulk management + inline "Add Field" on entity pages for quick creation
- Advanced validation: required, min/max length/value, regex patterns, unique constraints, conditional required
- Soft delete: deleted fields are hidden from UI but data preserved in JSONB; admin can restore
- Supported types: text, number, date, dropdown, checkbox, multi-select, currency, file, relation

### Table interaction & Views
- Filtering: quick search bar + filter chips for common fields + expandable advanced filter panel for complex queries
- No inline cell editing; quick edit icon per row opens compact edit form (row expand or side panel)
- Saved Views displayed in a left sidebar grouped by Personal / Team; click to load
- Column configuration: drag-and-drop reorder on headers, column picker dropdown to show/hide, resize by dragging column borders

### User profile & preferences
- Rich profile: name, email, avatar, phone, job title, department, timezone, language, bio, social links, work schedule, reporting manager, skills/tags
- Avatar: upload with crop dialog; auto-generated colored circle with initials as fallback
- Configurable preferences: theme (light/dark), language, timezone, date format + email notification toggles per event type
- Team directory: all users in the organization can view each other's profiles

### Claude's Discretion
- Custom field grouping into sections on entity detail pages (flat list vs admin-defined sections)
- Permission matrix UI layout and interaction patterns
- Exact filter panel component design
- Loading states and error handling patterns
- Table pagination strategy (page-based vs infinite scroll)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-core-infrastructure*
*Context gathered: 2026-02-16*
