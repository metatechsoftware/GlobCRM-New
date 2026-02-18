# Requirements: GlobCRM v1.1

**Defined:** 2026-02-18
**Core Value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.

## v1.1 Requirements

Requirements for v1.1 Automation & Intelligence release. Each maps to roadmap phases.

### Workflow Automation

- [ ] **WFLOW-01**: User can create a workflow with event triggers (record created/updated/deleted)
- [ ] **WFLOW-02**: User can add field-change triggers with conditions (equals, greater than, changed to, etc.)
- [ ] **WFLOW-03**: User can add date-based triggers (X days before/after a date field)
- [ ] **WFLOW-04**: User can add "update field" action to set field values automatically
- [ ] **WFLOW-05**: User can add "send notification" action to alert users/teams
- [ ] **WFLOW-06**: User can add "create activity/task" action with template-based configuration
- [ ] **WFLOW-07**: User can add "send email" action using an email template with merge fields
- [ ] **WFLOW-08**: User can add "fire webhook" action to trigger external integrations
- [ ] **WFLOW-09**: User can add "enroll in sequence" action to start email sequences
- [ ] **WFLOW-10**: User can chain multiple actions in a single workflow (multi-action)
- [ ] **WFLOW-11**: User can view workflow execution logs showing trigger, conditions, and action results
- [ ] **WFLOW-12**: User can enable/disable workflows without deleting them
- [ ] **WFLOW-13**: Admin can select from pre-built workflow templates as starting points

### Email Templates

- [ ] **ETMPL-01**: User can create rich text email templates with a WYSIWYG editor
- [ ] **ETMPL-02**: User can insert merge fields (contact, deal, company fields) into templates
- [ ] **ETMPL-03**: User can organize templates into categories (Sales, Support, Follow-up, etc.)
- [ ] **ETMPL-04**: User can preview a template with real entity data before sending
- [ ] **ETMPL-05**: User can clone/duplicate an existing template

### Email Sequences

- [ ] **ESEQ-01**: User can create a multi-step email sequence with configurable delays between steps
- [ ] **ESEQ-02**: User can manually enroll contacts into a sequence
- [ ] **ESEQ-03**: User can bulk-enroll contacts from a list view multi-select
- [ ] **ESEQ-04**: Contacts are automatically unenrolled when they reply to a sequence email
- [ ] **ESEQ-05**: User can view per-step tracking (open rate, click rate) for each sequence
- [ ] **ESEQ-06**: User can view sequence-level analytics (enrolled, completed, replied, bounced)
- [ ] **ESEQ-07**: User can pause/resume individual enrollments

### Formula / Computed Custom Fields

- [ ] **FORM-01**: Admin can create formula custom fields with arithmetic expressions and field references
- [ ] **FORM-02**: Formula fields support date difference calculations (days between dates)
- [ ] **FORM-03**: Formula fields support string concatenation and conditional logic (IF)
- [ ] **FORM-04**: Formula values are computed on-read and displayed as read-only in all views
- [ ] **FORM-05**: Admin receives validation feedback when creating invalid formulas (syntax errors, circular references)

### Duplicate Detection & Merge

- [ ] **DUP-01**: System warns user of potential duplicates when creating a contact or company
- [ ] **DUP-02**: User can run an on-demand duplicate scan for contacts and companies
- [ ] **DUP-03**: Admin can configure matching rules and similarity thresholds
- [ ] **DUP-04**: System uses fuzzy matching (handles typos, name variations) for duplicate detection
- [ ] **DUP-05**: User can view a side-by-side comparison of duplicate records
- [ ] **DUP-06**: User can merge duplicate contacts with relationship transfer to the surviving record
- [ ] **DUP-07**: User can merge duplicate companies with relationship transfer to the surviving record

### Webhooks

- [ ] **WHOOK-01**: Admin can create webhook subscriptions with event type selection
- [ ] **WHOOK-02**: Webhook payloads are signed with HMAC-SHA256 for verification
- [ ] **WHOOK-03**: Failed webhook deliveries are retried with exponential backoff (up to 7 attempts)
- [ ] **WHOOK-04**: Admin can view webhook delivery logs with success/failure status
- [ ] **WHOOK-05**: Admin can test a webhook subscription with a sample payload
- [ ] **WHOOK-06**: Subscriptions auto-disable after 50 consecutive failures

### Advanced Reporting Builder

- [ ] **RPT-01**: User can select an entity source and choose fields/columns for a report
- [ ] **RPT-02**: User can add filters with multiple conditions (AND/OR) to narrow report data
- [ ] **RPT-03**: User can group results and apply aggregations (count, sum, average, min, max)
- [ ] **RPT-04**: User can visualize report results as charts (bar, line, pie) or tables
- [ ] **RPT-05**: User can save reports and share them with team members
- [ ] **RPT-06**: User can export report results to CSV
- [ ] **RPT-07**: User can include related entity fields in reports (one level, e.g., Contact's Company name)
- [ ] **RPT-08**: User can drill down from a chart data point to view the underlying records

### Leads

- [x] **LEAD-01**: User can create, view, edit, and delete leads with standard CRM fields (name, email, phone, company, source, status)
- [x] **LEAD-02**: User can view leads in a dynamic table with configurable columns, sorting, filtering, and saved Views
- [x] **LEAD-03**: User can track lead source and status through configurable stages (New, Contacted, Qualified, Unqualified, Converted)
- [x] **LEAD-04**: User can convert a qualified lead into a contact + company + deal in one action
- [x] **LEAD-05**: Leads support custom fields (same JSONB system as other entities)
- [x] **LEAD-06**: Lead activities and notes appear in an entity timeline

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Email Enhancements

- **ESEQ-F01**: Scheduled report delivery (email on schedule)
- **ESEQ-F02**: Sequence A/B testing
- **ESEQ-F03**: Per-contact timezone for sequence send windows

### Workflow Enhancements

- **WFLOW-F01**: Cross-entity workflow triggers
- **WFLOW-F02**: Visual flowchart builder with branching paths
- **WFLOW-F03**: Workflow versioning and rollback

### Duplicate Enhancements

- **DUP-F01**: Bulk merge from duplicate review list
- **DUP-F02**: Cross-entity duplicate detection (not just contacts/companies)

### Reporting Enhancements

- **RPT-F01**: Scheduled report delivery via email
- **RPT-F02**: Cross-entity formula fields in reports

### Lead Enhancements

- **LEAD-F01**: Lead scoring based on configurable rules
- **LEAD-F02**: Web form integration for lead capture

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Visual flowchart workflow builder (drag-and-drop nodes) | Enormous frontend complexity; linear trigger->conditions->actions covers 90% of use cases |
| Branching/conditional workflow paths | Exponential complexity in both builder and execution engine |
| Full SQL query builder for reports | SQL injection risk; non-technical users cannot write SQL |
| Real-time formula evaluation in browser | Creates inconsistency with server; compute on-read server-side |
| Cross-entity formula fields | Requires join queries and cross-entity cache invalidation; v1.1 is same-entity only |
| Undo merge | Enormous storage and complexity for rarely-used feature; provide audit trail instead |
| Unlimited webhook retry | Wastes resources; 7 attempts with auto-disable after 50 failures |
| Per-contact timezone sequences | Requires timezone data on every contact; use tenant timezone for v1.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEAD-01 | Phase 13 | Complete |
| LEAD-02 | Phase 13 | Complete |
| LEAD-03 | Phase 13 | Complete |
| LEAD-04 | Phase 13 | Complete |
| LEAD-05 | Phase 13 | Complete |
| LEAD-06 | Phase 13 | Complete |
| ETMPL-01 | Phase 14 | Pending |
| ETMPL-02 | Phase 14 | Pending |
| ETMPL-03 | Phase 14 | Pending |
| ETMPL-04 | Phase 14 | Pending |
| ETMPL-05 | Phase 14 | Pending |
| FORM-01 | Phase 15 | Pending |
| FORM-02 | Phase 15 | Pending |
| FORM-03 | Phase 15 | Pending |
| FORM-04 | Phase 15 | Pending |
| FORM-05 | Phase 15 | Pending |
| DUP-01 | Phase 16 | Pending |
| DUP-02 | Phase 16 | Pending |
| DUP-03 | Phase 16 | Pending |
| DUP-04 | Phase 16 | Pending |
| DUP-05 | Phase 16 | Pending |
| DUP-06 | Phase 16 | Pending |
| DUP-07 | Phase 16 | Pending |
| WHOOK-01 | Phase 17 | Pending |
| WHOOK-02 | Phase 17 | Pending |
| WHOOK-03 | Phase 17 | Pending |
| WHOOK-04 | Phase 17 | Pending |
| WHOOK-05 | Phase 17 | Pending |
| WHOOK-06 | Phase 17 | Pending |
| ESEQ-01 | Phase 18 | Pending |
| ESEQ-02 | Phase 18 | Pending |
| ESEQ-03 | Phase 18 | Pending |
| ESEQ-04 | Phase 18 | Pending |
| ESEQ-05 | Phase 18 | Pending |
| ESEQ-06 | Phase 18 | Pending |
| ESEQ-07 | Phase 18 | Pending |
| WFLOW-01 | Phase 19 | Pending |
| WFLOW-02 | Phase 19 | Pending |
| WFLOW-03 | Phase 19 | Pending |
| WFLOW-04 | Phase 19 | Pending |
| WFLOW-05 | Phase 19 | Pending |
| WFLOW-06 | Phase 19 | Pending |
| WFLOW-07 | Phase 19 | Pending |
| WFLOW-08 | Phase 19 | Pending |
| WFLOW-09 | Phase 19 | Pending |
| WFLOW-10 | Phase 19 | Pending |
| WFLOW-11 | Phase 19 | Pending |
| WFLOW-12 | Phase 19 | Pending |
| WFLOW-13 | Phase 19 | Pending |
| RPT-01 | Phase 20 | Pending |
| RPT-02 | Phase 20 | Pending |
| RPT-03 | Phase 20 | Pending |
| RPT-04 | Phase 20 | Pending |
| RPT-05 | Phase 20 | Pending |
| RPT-06 | Phase 20 | Pending |
| RPT-07 | Phase 20 | Pending |
| RPT-08 | Phase 20 | Pending |

**Coverage:**
- v1.1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
