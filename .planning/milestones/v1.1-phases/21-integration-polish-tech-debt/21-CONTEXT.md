# Phase 21: Integration Polish & Tech Debt Closure - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all integration gaps and tech debt from the v1.1 milestone audit: fix ReportCsvExportJob DI registration, replace workflow builder free-text UUID inputs with proper dropdown pickers, clean up duplicate DI registrations, and fix DuplicatesController field naming. No new features — hardening only.

</domain>

<decisions>
## Implementation Decisions

### Action Config Pickers (Workflow Builder)
- Replace free-text UUID inputs for "Send Email" and "Enroll in Sequence" actions with `mat-select` dropdowns
- Template picker shows name + subject line preview per option
- Sequence picker shows name + step count or summary
- Both pickers include a search input at the top for filtering as the list grows
- Template picker shows all templates but visually highlights ones matching the workflow's trigger entity type (not filtered — user can still pick any template)
- Sequence picker: Claude's discretion on whether to show status badge or filter to active-only

### Stale Reference Handling
- **At execution time:** If a workflow references a deleted template or sequence, skip that action and log a warning in the execution log — do not fail the entire workflow run
- **In builder (on open):** Show an amber banner warning if any referenced template/sequence no longer exists
- **In builder (on save):** Validate references — block save with a clear error pointing to the broken action node
- **In picker display:** Claude's discretion on whether to show stale reference as "(Deleted)" greyed-out option or clear to empty
- **On template/sequence deletion:** Show a "Used by N workflows" warning with workflow names before confirming deletion

### Backend Fixes (Claude's Discretion)
- ReportCsvExportJob: Add explicit DI registration in ReportingServiceExtensions
- Duplicate DI cleanup: Remove redundant AddDomainEventServices() and AddEmailTemplateServices() calls from Program.cs (already called via AddInfrastructure)
- DuplicatesController: Fix field naming — use Website for companies, Email for contacts

</decisions>

<specifics>
## Specific Ideas

- Pickers should feel like native Angular Material selects — consistent with the rest of the app's form controls
- The "used by" warning on deletion is a safety net — user should clearly understand consequences before deleting a template/sequence that's wired into automation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-integration-polish-tech-debt*
*Context gathered: 2026-02-19*
