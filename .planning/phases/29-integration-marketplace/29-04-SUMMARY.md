---
phase: 29-integration-marketplace
plan: 04
subsystem: ui
tags: [angular, signals, signalStore, mat-dialog, rbac, api-wiring]

# Dependency graph
requires:
  - phase: 29-02
    provides: IntegrationsController with 5 REST API endpoints
  - phase: 29-03
    provides: IntegrationCatalogItem/Connection models, INTEGRATION_CATALOG, marketplace component shell, card component
provides:
  - IntegrationService with 5 API methods (list, connect, disconnect, test, activity)
  - IntegrationStore (signalStore) managing connections state
  - IntegrationConnectDialogComponent with dynamic credential form fields
  - IntegrationDisconnectDialogComponent with name-aware confirmation
  - Full connect/disconnect/test lifecycle wired through marketplace component
affects: [29-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-page-signalStore-with-callback-pattern, dynamic-form-from-catalog-fields, dialog-result-to-store-action]

key-files:
  created:
    - globcrm-web/src/app/features/settings/integrations/integration.service.ts
    - globcrm-web/src/app/features/settings/integrations/integration.store.ts
    - globcrm-web/src/app/features/settings/integrations/integration-connect-dialog.component.ts
    - globcrm-web/src/app/features/settings/integrations/integration-disconnect-dialog.component.ts
  modified:
    - globcrm-web/src/app/features/settings/integrations/integration-marketplace.component.ts
    - globcrm-web/src/app/features/settings/integrations/integration-card.component.ts

key-decisions:
  - "IntegrationStore uses callback pattern (onSuccess/onError) consistent with WebhookStore for async result handling"
  - "Connect dialog builds FormGroup dynamically from CredentialFieldDef array with required validators per field definition"
  - "Card component uses MatMenu three-dot pattern for connected state actions (Test/Disconnect) to keep card clean"

patterns-established:
  - "Integration store callback pattern: connectIntegration(key, creds, onSuccess?, onError?) for post-action feedback"
  - "Dynamic credential form: FormGroup built at runtime from catalogItem.credentialFields, supports mixed text/password types"
  - "Three-dot action menu for connected cards: MatMenu with Test Connection and Disconnect options, admin-only"

requirements-completed: [INTG-04, INTG-05, INTG-09, INTG-12]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 29 Plan 04: Integration Marketplace Wiring Summary

**IntegrationService, SignalStore, and connect/disconnect dialogs wiring the marketplace to live API with dynamic credential forms and RBAC-controlled admin actions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T15:29:54Z
- **Completed:** 2026-02-21T15:32:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created IntegrationService with 5 API methods matching the backend IntegrationsController endpoints
- Built IntegrationStore (signalStore) with per-page provider pattern and callback-based async result handling
- IntegrationConnectDialogComponent dynamically renders credential fields from catalog definition with required validation
- IntegrationDisconnectDialogComponent provides name-aware confirmation with warn-colored disconnect button
- Marketplace component fully wired: loads connections on init, opens dialogs, calls store methods, shows snackbar feedback
- Card component upgraded with MatMenu three-dot menu for connected cards (Test Connection, Disconnect)
- RBAC enforcement: non-admin users see read-only status badges with no action buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IntegrationService, IntegrationStore, and connect/disconnect dialogs** - `3cb8ca1` (feat)
2. **Task 2: Wire marketplace component to store and dialogs with RBAC** - `fdcaf56` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/settings/integrations/integration.service.ts` - API service with 5 methods: getConnections, connect, disconnect, testConnection, getActivityLog
- `globcrm-web/src/app/features/settings/integrations/integration.store.ts` - SignalStore with connections state and load/connect/disconnect/test methods with callbacks
- `globcrm-web/src/app/features/settings/integrations/integration-connect-dialog.component.ts` - MatDialog with dynamic ReactiveForm built from CredentialFieldDef array
- `globcrm-web/src/app/features/settings/integrations/integration-disconnect-dialog.component.ts` - Confirmation dialog with integration name and warn-colored disconnect button
- `globcrm-web/src/app/features/settings/integrations/integration-marketplace.component.ts` - Updated: IntegrationStore in providers, loadConnections on init, dialog open/close handlers, snackbar feedback
- `globcrm-web/src/app/features/settings/integrations/integration-card.component.ts` - Updated: added disconnect/testConnection outputs, MatMenu three-dot menu for connected admin cards

## Decisions Made
- IntegrationStore uses callback pattern (onSuccess/onError params) consistent with the established WebhookStore pattern, rather than returning observables
- Connect dialog builds FormGroup dynamically at runtime from catalogItem.credentialFields, with each field getting Validators.required when field.required is true
- Card component uses MatMenu (three-dot icon button) for connected state actions to keep the card layout clean -- only visible to admins on connected cards

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full connect/disconnect/test lifecycle working through frontend UI
- Ready for Plan 05 to add routing, detail panel, and activity log display
- viewDetails handler has TODO comment for Plan 05 wiring

## Self-Check: PASSED

All 6 created/modified files verified present. Both task commits (3cb8ca1, fdcaf56) verified in git log. Angular build compiles cleanly with no new errors.

---
*Phase: 29-integration-marketplace*
*Completed: 2026-02-21*
