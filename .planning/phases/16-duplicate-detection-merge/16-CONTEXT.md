# Phase 16: Duplicate Detection & Merge - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect duplicate contacts and companies via fuzzy matching, present side-by-side comparison, and merge with full relationship transfer. Covers real-time create warnings, on-demand scan, configurable matching rules, comparison UI, and merge execution with audit trail. Does NOT include: bulk auto-merge, third-party data enrichment, or cross-entity deduplication (e.g., leads vs contacts).

</domain>

<decisions>
## Implementation Decisions

### Matching Rules
- **Contact matching fields:** Name + Email (fuzzy name similarity AND exact/fuzzy email match)
- **Company matching fields:** Company name + domain (fuzzy name similarity AND website/email domain match)
- **Admin-configurable:** Admin settings page to toggle which fields participate in matching, set similarity threshold (e.g., 70%-90%), and enable/disable auto-detection per tenant
- **Scoring:** Confidence score + ranked list — show match percentage (e.g., 87% match) and sort results by confidence so users prioritize the highest-confidence duplicates first

### Duplicate Warnings UX
- **Warning style:** Inline banner inside the create form (yellow/amber) showing potential matches — non-blocking, user can dismiss and continue creating
- **Trigger timing:** On blur of key fields (name, email for contacts; company name for companies) — immediate feedback without slowing typing
- **Warning content:** Show matching record(s) with name, email, and match score. Include clickable link to view the existing record
- **Scope:** Create forms only — editing existing records does NOT trigger duplicate warnings

### Side-by-Side Comparison
- **Layout:** Two-column side-by-side on a full dedicated page (e.g., `/contacts/merge?ids=1,2`)
- **Difference highlighting:** Differing fields highlighted in amber/yellow. Matching fields shown in gray/muted
- **Field selection:** Radio buttons per field row — user clicks to pick which value survives on the merged record
- **Default primary:** Most recently updated record auto-selected as primary (surviving record). User can flip the default

### Merge Behavior
- **Custom field conflicts:** Per-field radio selection — custom fields appear in comparison UI just like standard fields, user picks which value to keep
- **Relationship transfer:** All relationships (deals, activities, notes, emails, attachments, feed items, notifications, sequence enrollments) transfer to the surviving record. Duplicate relationships are deduplicated automatically
- **Reversibility:** Soft-delete with MergedIntoId redirect on the merged record. Full audit log preserved. No undo button, but data is recoverable by admin
- **Confirmation:** Summary dialog before executing — shows what will happen (X deals transferred, Y activities moved, field values chosen) with a "Confirm Merge" button

### Claude's Discretion
- Exact fuzzy matching algorithm choice (pg_trgm, FuzzySharp, or combination)
- Duplicate scan page layout and pagination approach
- How to handle MergedIntoId redirects (e.g., if someone visits a merged record's URL)
- Loading states and error handling during merge operation
- Mobile responsiveness approach for the comparison page

</decisions>

<specifics>
## Specific Ideas

- Confidence scores should be prominently visible in scan results so users can quickly identify high-confidence vs borderline duplicates
- The comparison page should feel like a diff tool — clear visual distinction between matching and differing fields
- Merge confirmation summary should be explicit about counts (e.g., "3 deals, 5 activities, 12 notes will be transferred")

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-duplicate-detection-merge*
*Context gathered: 2026-02-19*
