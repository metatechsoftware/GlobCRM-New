---
phase: 18-email-sequences
plan: 02
subsystem: sequences
tags: [hangfire, email-tracking, reply-detection, gmail, mimekit, background-jobs, mime-headers]

# Dependency graph
requires:
  - phase: 18-01
    provides: EmailSequence, EmailSequenceStep, SequenceEnrollment, SequenceTrackingEvent entities with repositories
  - phase: 14-foundation-infrastructure-email-templates
    provides: TemplateRenderService, MergeFieldService, Hangfire infrastructure, IEmailService
  - phase: 17-webhooks
    provides: WebhookDeliveryService Hangfire job pattern with TenantScope, queue naming
provides:
  - SequenceExecutionService advancing enrollments through steps via Hangfire scheduled jobs with delay calculation
  - SequenceEmailSender sending via Gmail with custom MIME headers (X-Sequence-Id, X-Sequence-Step-Id, X-Enrollment-Id) or SendGrid fallback
  - EmailTrackingService injecting tracking pixel and rewriting links with base64url token encoding
  - SequenceReplyDetector auto-unenrolling contacts on reply via GmailThreadId matching
  - TrackingController serving unauthenticated open pixel and click redirect endpoints
  - SequenceServiceExtensions DI registration for all sequence execution services
affects: [18-03-api-endpoints, 18-04-frontend, 18-05-tracking-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [hangfire-per-step-scheduling, custom-mime-headers-for-reply-detection, base64url-tracking-tokens, unauthenticated-tracking-endpoints]

key-files:
  created:
    - src/GlobCRM.Infrastructure/Sequences/SequenceExecutionService.cs
    - src/GlobCRM.Infrastructure/Sequences/SequenceEmailSender.cs
    - src/GlobCRM.Infrastructure/Sequences/EmailTrackingService.cs
    - src/GlobCRM.Infrastructure/Sequences/SequenceReplyDetector.cs
    - src/GlobCRM.Infrastructure/Sequences/SequenceServiceExtensions.cs
    - src/GlobCRM.Api/Controllers/TrackingController.cs
  modified:
    - src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs
    - src/GlobCRM.Domain/Enums/NotificationType.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs

key-decisions:
  - "SequenceEmailSender attempts Gmail first (supports custom headers for reply detection), falls back to SendGrid (no custom headers, reply detection disabled)"
  - "EmailTrackingService uses base64url encoding of enrollmentId:stepNumber for tracking tokens (not crypto-secure by design -- tracking is best-effort)"
  - "Open tracking deduplicated per enrollment+step (unique opens only), click tracking allows multiples (each click is valuable)"
  - "Reply detection uses GmailThreadId matching against sent SequenceTrackingEvents rather than custom header parsing on inbound messages"
  - "TrackingController gracefully degrades: returns pixel/redirect even if token decode or event recording fails"

patterns-established:
  - "Per-step Hangfire job scheduling: each step execution schedules the next step with computed delay (not polling)"
  - "Custom MIME headers via MimeKit for cross-email metadata propagation (X-Sequence-Id, X-Sequence-Step-Id, X-Enrollment-Id)"
  - "Tracking pixel injection before </body> tag with link URL rewriting via regex"
  - "Unauthenticated tracking endpoints with graceful failure handling (never break email rendering)"
  - "Reply detection hook in GmailSyncService wrapped in try/catch (never breaks email sync)"

requirements-completed: [ESEQ-04, ESEQ-05]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 18 Plan 02: Sequence Execution Engine Summary

**Hangfire per-step execution engine with Gmail custom MIME header injection for reply detection, open/click tracking via pixel and link rewriting, and GmailSyncService reply detection hook with auto-unenrollment**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T12:44:25Z
- **Completed:** 2026-02-19T12:49:31Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- SequenceExecutionService advances enrollments through steps via Hangfire on the "emails" queue, with enrollment status guard, template rendering with merge data, tracking injection, and automatic next-step scheduling with delay calculation
- SequenceEmailSender sends via Gmail API with custom X-Sequence-Id/X-Sequence-Step-Id/X-Enrollment-Id MIME headers for reply detection, falling back to SendGrid when no Gmail account is connected
- EmailTrackingService injects 1x1 transparent tracking pixel before </body> tag and rewrites href links for click tracking, with base64url token encoding and deduplication for opens
- TrackingController provides unauthenticated /api/t/o/{token} (open pixel) and /api/t/c/{token}?u={url} (click redirect) endpoints with graceful failure handling
- SequenceReplyDetector matches inbound GmailThreadId against sent sequence tracking events, auto-unenrolls contacts with status=Replied, cancels pending Hangfire jobs, and dispatches in-app notifications
- GmailSyncService integration calls reply detector on every inbound message with try/catch isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Sequence execution engine, email sender, and tracking service** - `f456ff1` (feat)
2. **Task 2: Tracking controller, reply detector, and DI registration** - `c5eb50f` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Sequences/SequenceExecutionService.cs` - Hangfire job service executing sequence steps with enrollment guard, template rendering, tracking injection, email sending, and next-step scheduling
- `src/GlobCRM.Infrastructure/Sequences/SequenceEmailSender.cs` - Gmail send with custom MIME headers for reply detection, SendGrid fallback, and sent tracking event creation
- `src/GlobCRM.Infrastructure/Sequences/EmailTrackingService.cs` - Tracking pixel injection, link wrapping via regex, base64url token encode/decode, and open/click event recording
- `src/GlobCRM.Infrastructure/Sequences/SequenceReplyDetector.cs` - GmailThreadId-based reply detection, auto-unenroll with Replied status, Hangfire job cancellation, notification dispatch
- `src/GlobCRM.Infrastructure/Sequences/SequenceServiceExtensions.cs` - DI registration for all 4 sequence services as scoped
- `src/GlobCRM.Api/Controllers/TrackingController.cs` - Unauthenticated /api/t/o/{token} and /api/t/c/{token} endpoints with graceful failure
- `src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs` - Added SequenceReplyDetector injection and inbound message reply detection hook
- `src/GlobCRM.Domain/Enums/NotificationType.cs` - Added SequenceReply enum value
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added AddSequenceServices() call

## Decisions Made
- SequenceEmailSender uses a fallback pattern: attempt Gmail first (which supports custom MIME headers), fall back to SendGrid on failure (reply detection won't work for SendGrid-sent emails since custom headers aren't available via SendGrid basic API)
- EmailTrackingService token encoding uses base64url of "enrollmentId:stepNumber" which is intentionally not crypto-secure -- tracking is best-effort and not security-critical per research
- Open tracking events are deduplicated (one per enrollment+step) while click events allow multiples since each click provides unique value
- Reply detection matches GmailThreadId (secondary strategy per research) rather than parsing custom headers from inbound messages, because inbound messages may not preserve custom headers through email forwarding
- TrackingController always returns the pixel or redirect even when tracking fails (graceful degradation) to ensure email rendering is never broken

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Execution engine ready for API endpoints (18-03) to enroll contacts and trigger first step scheduling
- Tracking infrastructure ready for analytics queries (18-05) to aggregate open/click rates per step
- Reply detection active for all future inbound Gmail syncs matching sequence thread IDs
- All services registered in DI container and ready for controller injection

## Self-Check: PASSED

All 6 created files verified present. Both task commits (f456ff1, c5eb50f) verified in git log. Build succeeds with 0 errors.

---
*Phase: 18-email-sequences*
*Plan: 02*
*Completed: 2026-02-19*
