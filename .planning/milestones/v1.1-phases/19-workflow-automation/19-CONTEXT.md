# Phase 19: Workflow Automation - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can automate CRM operations by creating trigger-based workflows that execute actions (field updates, notifications, tasks, emails, webhooks, sequence enrollment) when entity events or conditions are met. Includes visual flow builder, execution logs, prebuilt templates, and enable/disable controls. Workflow engine enforces execution depth limits and loop prevention.

</domain>

<decisions>
## Implementation Decisions

### Workflow Builder UX
- Visual flow canvas with drag-and-drop nodes and connections (not structured form)
- Workflow list page uses card grid with miniaturized flow diagram thumbnails, name, status badge, and last run info
- New workflow starts with empty canvas and a centered "+ Add trigger to start" button (no pre-placed nodes)

### Trigger & Condition Design
- A single workflow supports multiple triggers (OR logic) — any one trigger fires the workflow
- Conditions use AND/OR grouping (like existing filter panel pattern), not simple AND-only rows
- Field-change triggers support both directional ("changed from X to Y") and target-only ("changed to Y") — "from" value is optional

### Action Composition
- Per-action "Continue on error" toggle — each action node controls whether failure halts or skips
- "Update field" action supports both static values and dynamic mapping from trigger entity fields (merge-field-style picker, like email templates)
- "Create activity/task" action supports dynamic assignment: record owner, deal owner, or a specific user from dropdown

### Templates & Onboarding
- New workflow opens blank canvas; "Use template" button in sidebar opens template gallery (templates are optional, not the default entry point)
- Template categories: sales-focused (deal won, lead qualified, deal idle), engagement-focused (welcome email, follow-up task), and operational (high-value deal notify, new company enrich)
- Applying a template creates a full copy — user edits freely, no link to original template
- Users can save their own workflows as tenant-scoped reusable templates, shown alongside system templates with a "Custom" badge

### Claude's Discretion
- Whether to support if/else branching or keep workflows linear — choose based on complexity tradeoffs
- Date trigger timing configuration (relative offset only vs. offset + specific execution time)
- Whether to support configurable delays between actions (wait nodes) — choose based on Hangfire capabilities
- Loading skeleton and error state designs
- Exact node shapes, colors, and connection line styles on the canvas
- Canvas interaction patterns (zoom, pan, minimap)

</decisions>

<specifics>
## Specific Ideas

- Card grid on list page should show a miniaturized version of the flow diagram as a thumbnail — gives quick visual recognition of workflow complexity
- Merge-field-style picker for dynamic field mapping in actions — reuse the pattern from email template merge fields (Phase 14)
- Dynamic assignment options for task creation should include "Record Owner" and "Deal Owner" as first-class options alongside specific user selection

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-workflow-automation*
*Context gathered: 2026-02-19*
