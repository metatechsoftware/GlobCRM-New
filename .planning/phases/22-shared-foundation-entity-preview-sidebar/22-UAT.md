---
status: complete
phase: 22-shared-foundation-entity-preview-sidebar
source: 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md, 22-04-SUMMARY.md
started: 2026-02-20T12:00:00Z
updated: 2026-02-20T13:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Feed Entity Link Opens Preview Sidebar
expected: Go to the Feed page. Find a feed item that references an entity (e.g., "Created contact John Doe"). Click the entity name link. A preview sidebar should slide in from the right side, pushing the feed content to the left. The feed should NOT navigate away.
result: issue
reported: "When I click a link I get [Error] Failed to load resource: the server responded with a status of 404 (Not Found) (default-avatar.svg, line 0) so no sidebar opens"
severity: major

### 2. Preview Shows Entity Details
expected: With the preview sidebar open, it should display the entity's name in the header with a colored entity-type icon. Below that, key fields appropriate to the entity type should appear (e.g., for a Contact: Email, Phone, Job Title, Company, City). Owner info and any pinned custom fields should also be visible.
result: pass

### 3. Preview Association Chips
expected: In the preview sidebar, below the key fields, association chips should appear showing related entities (e.g., a Company preview shows associated Contacts and Deals as Material chips with counts). If 3 or fewer, individual names are shown. If more than 3, an aggregate count chip appears.
result: issue
reported: "related fields on hover dont show up as if clickable it should be obvious to the user"
severity: minor

### 4. Preview Pipeline Stage Bar (Deal or Lead)
expected: Open a preview for a Deal or Lead entity (click a deal/lead name in the feed). A mini pipeline stage bar should appear showing all stages as horizontal segments, with the current stage highlighted (past stages in one color, current in another, future stages grayed out).
result: pass

### 5. Preview Recent Activities Timeline
expected: In the preview sidebar, a "Recent Activities" section should display the last 3 activities in a vertical mini-timeline with dots, activity subjects, and relative time labels (e.g., "2h ago", "3d ago").
result: pass

### 6. Close Preview Sidebar
expected: With the preview sidebar open, press the Escape key. The sidebar should close and the feed content should return to full width. Alternatively, clicking the X button in the sidebar header should also close it.
result: issue
reported: "the sidebar should start with respect to topbar since header is invisible right now"
severity: minor

### 7. Open Full Record from Preview
expected: With the preview sidebar open, click the "Open full record" link/button in the sidebar header. The app should navigate to the entity's full detail page (e.g., /contacts/{id}).
result: skipped
reason: Can't test - sidebar header hidden under topbar (blocked by test 6 issue)

### 8. Ctrl/Cmd+Click Direct Navigation
expected: On the Feed page, hold Ctrl (or Cmd on Mac) and click an entity name link. Instead of opening the preview sidebar, the app should navigate directly to the entity's detail page.
result: pass

### 9. Entity Hover Tooltip
expected: On the Feed page, hover over an entity name link and wait ~300ms. A tooltip should appear showing the entity type label and name (e.g., "Contact - John Doe") with no visible delay or loading spinner.
result: pass

### 10. Preview Loading Skeleton
expected: Click an entity link in the feed to open the preview sidebar. During the brief moment while data loads, an animated skeleton placeholder (pulsing gray bars) should be visible before the actual content appears.
result: skipped
reason: Data loads instantly on localhost - skeleton not observable

### 11. Detail Page Tabs Still Work
expected: Navigate to any entity detail page (e.g., a Contact). Click through the tabs (Activities, Quotes, Requests, Emails, Notes). Each tab should switch content correctly. The tab refactor from index-based to label-based should be invisible to the user -- everything works as before.
result: pass

## Summary

total: 11
passed: 6
issues: 3
pending: 0
skipped: 2

## Gaps

- truth: "Clicking entity name in feed opens preview sidebar sliding in from the right"
  status: failed
  reason: "User reported: When I click a link I get [Error] Failed to load resource: the server responded with a status of 404 (Not Found) (default-avatar.svg, line 0) so no sidebar opens"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Association chips show hover state indicating they are clickable"
  status: failed
  reason: "User reported: related fields on hover dont show up as if clickable it should be obvious to the user"
  severity: minor
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Preview sidebar starts below the topbar, not overlapping it"
  status: failed
  reason: "User reported: the sidebar should start with respect to topbar since header is invisible right now"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
