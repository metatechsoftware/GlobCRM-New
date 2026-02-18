# Feature Landscape: v1.1 Automation & Intelligence

**Domain:** CRM Automation, Email Sequences, Computed Fields, Data Quality, Webhooks, Advanced Reporting
**Researched:** 2026-02-18
**Confidence:** HIGH (multi-source verification across HubSpot, Pipedrive, Zoho, Salesforce Dynamics 365, Freshsales)
**Milestone:** v1.1 -- building on shipped v1.0 MVP (~124,200 LOC)

---

## Table Stakes

Features users expect when a CRM advertises "automation" and "intelligence." Missing any of these makes the feature set feel half-built.

### 1. Workflow Automation

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Record-event triggers (created, updated, deleted) | Every CRM automation starts with "when X happens" | MEDIUM | All entity controllers (hook into save paths) | Triggers must fire on Contact, Company, Deal, Activity, Quote, Request. Must detect which fields changed, not just "record updated." |
| Field-change triggers ("deal value > 10000", "stage moved to Won") | Users need conditional logic beyond "any update" | MEDIUM | Entity change tracking (EF Core ChangeTracker) | Compare old vs new values. Support operators: equals, not equals, greater than, less than, contains, is empty, is not empty, changed to, changed from. |
| Date-based triggers ("3 days before close date", "30 days since last activity") | Time-based automation is core to follow-up workflows | HIGH | Background job scheduler (needs recurring evaluation) | Requires a scheduled evaluator that runs periodically (e.g., every 15 min) and checks date conditions against records. This is architecturally different from event triggers. |
| Field update action | Auto-set fields when conditions met (e.g., set owner, change status) | LOW | Entity repositories | Most common action. Must respect field-level RBAC -- system actions bypass user permissions but log as "Workflow" actor. |
| Send notification action | Alert a user or team when condition triggers | LOW | Existing NotificationDispatcher | Reuse existing notification infrastructure. Add "Workflow" as a NotificationType. |
| Create activity/task action | Auto-create follow-up tasks (e.g., "call new lead within 24h") | MEDIUM | Activity entity, user assignment | Must allow template-based activity creation: type, title, description, due date offset, assignee (owner, specific user, round-robin). |
| Send email action (from template) | Automation without email is just field updates | MEDIUM | Email template system (new, see below) | Merge entity fields into template. Send via SendGrid (transactional) not Gmail (user mailbox). |
| Workflow execution log | Users need visibility into what ran and why | MEDIUM | New WorkflowLog entity | Log trigger event, matched conditions, actions taken, success/failure. Essential for debugging. Without it, users cannot trust automation. |
| Enable/disable toggle | Users must be able to pause workflows without deleting | LOW | Boolean flag on workflow entity | Also needed: "last triggered" timestamp for monitoring. |
| Multi-action workflows | A single trigger fires multiple actions in sequence | MEDIUM | Action ordering, sequential execution | Example: "When deal moves to Won: (1) update status field, (2) create follow-up task, (3) send congratulations email, (4) fire webhook." |

### 2. Email Templates

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Rich text template editor | Users design branded email content | MEDIUM | Existing ngx-quill editor (reuse) | HTML email with WYSIWYG editing. Support bold, italic, links, images, headers. |
| Merge fields / placeholders | "Hello {{contact.firstName}}" personalization | MEDIUM | Entity field registry | Support all core fields + custom fields. Syntax: `{{entity.fieldName}}`. Must handle missing values gracefully (empty string or configurable fallback). |
| Template categories/folders | Organize templates by purpose | LOW | New entity | Categories: Sales, Support, Follow-up, Onboarding, Custom. |
| Template preview with sample data | See what email looks like before sending | LOW | Merge field resolver | Pick a real contact/deal to preview merged template. |
| Clone/duplicate template | Copy existing template as starting point | LOW | CRUD operation | Standard convenience feature. |

### 3. Email Sequences (Drip Campaigns)

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Multi-step sequence builder | Define ordered series of emails with delays | HIGH | Email templates, background scheduler | Each step: template + delay (days/hours) + optional conditions. Visual step list (not drag-drop flowchart -- see Anti-Features). |
| Delay between steps (days/hours) | Control timing of follow-ups | LOW | Step configuration | "Wait 2 days, then send step 2." Delays calculated from enrollment or previous step completion. |
| Enrollment (manual + workflow-triggered) | Add contacts to sequences | MEDIUM | Contact entity, Workflow actions | Manual: select contacts from list. Automatic: workflow action "enroll in sequence." Bulk enrollment from dynamic table selection. |
| Auto-unenroll on reply | Stop sequence when contact responds | HIGH | Gmail sync integration, reply detection | Match incoming email address against active sequence enrollments. This is the most critical behavioral trigger. Without it, sequences feel robotic. |
| Per-step open/click tracking | Measure engagement at each step | HIGH | Email tracking pixels, link wrapping | Open tracking via 1x1 pixel. Click tracking via redirect URLs. Privacy note: some email clients block pixels, so open rates are approximate. |
| Sequence-level analytics | Overall performance: enrolled, completed, replied, bounced | MEDIUM | Aggregation over enrollment records | Dashboard showing funnel: Enrolled -> Opened -> Clicked -> Replied. Per-step breakdown. |
| Pause/resume individual enrollments | Handle exceptions without removing from sequence | LOW | Enrollment status field | Statuses: Active, Paused, Completed, Unenrolled, Bounced. |
| Business hours / send window | Send emails during business hours only | MEDIUM | Timezone handling, send scheduling | "Send between 9am-5pm recipient local time." Requires timezone on contact or default to tenant timezone. |

### 4. Formula / Computed Custom Fields

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Arithmetic formulas (+, -, *, /, %) | Calculate values from other fields | MEDIUM | Custom field system (extend CustomFieldType enum) | Reference other number/currency fields: `#Deal Value * 0.15` for commission. Must handle null inputs (return null or 0). |
| Field references in formulas | Point to core and custom fields | MEDIUM | Field registry per entity type | Syntax: `#fieldName` for core fields, `#cf_custom_field_name` for custom fields. Only same-entity references (no cross-entity in v1.1). |
| Date difference calculations | Days between dates (e.g., deal age) | MEDIUM | Date arithmetic | `DATEDIFF(#createdAt, NOW(), "days")` -- common for "days in pipeline", "time since last contact." |
| Conditional logic (IF/THEN) | Business rules in formulas | HIGH | Expression parser | `IF(#deal_value > 10000, "Enterprise", "SMB")`. Keep simple -- not a full programming language. |
| String concatenation | Combine text fields | LOW | Expression parser | `CONCAT(#firstName, " ", #lastName)`. Useful for display names, full addresses. |
| Real-time recalculation | Values update when source fields change | HIGH | Interceptor or computed column strategy | Two options: (A) Recompute on read (virtual, no storage), (B) Recompute on write (stored, faster reads). Recommend B: store computed values in JSONB on save. Trigger recalculation when dependency fields change. |
| Formula validation on save | Catch errors before saving definition | MEDIUM | Expression parser with validation mode | Check: field references exist, types compatible, no circular references, syntax valid. Show clear error messages. |

### 5. Duplicate Detection & Merge

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| On-demand duplicate scan | "Find duplicates" button on contacts/companies list | MEDIUM | Matching algorithms, new UI page | Scan all records, return clusters of potential duplicates with confidence scores. Runs as background job for large datasets. |
| Real-time duplicate warning | Alert when creating/editing a record that matches existing | MEDIUM | Matching service called from create/update endpoints | "A contact with this email already exists" -- shown before save, not blocking. User can proceed or navigate to existing record. |
| Configurable match rules | Admin defines which fields to match on | MEDIUM | Admin settings UI, match rule entity | Default rules: Contact (email exact, name fuzzy), Company (name fuzzy, domain exact). Admin can add/remove rules and set thresholds. |
| Fuzzy name matching | Catch "John Smith" vs "Jon Smyth" | MEDIUM | Levenshtein distance, Jaro-Winkler, or trigram similarity | PostgreSQL `pg_trgm` extension provides `similarity()` function with GIN/GiST indexes. Use this over application-level algorithms for performance. Threshold: 0.6-0.8 depending on field. |
| Side-by-side merge UI | Compare two records and choose which values to keep | HIGH | New merge page component | Show both records side by side. For each field, user picks "keep left", "keep right", or "keep both" (for multi-value fields). Preview merged result before confirming. |
| Relationship transfer on merge | Losing record's deals, activities, notes transfer to winner | HIGH | All FK references must be updated | Update all foreign keys pointing to the merged-away record. This includes: deals, activities, notes, quotes, attachments, email links, feed items, sequence enrollments. Must be transactional. |
| Merge audit trail | Record what was merged and when | LOW | MergeHistory entity | Store: winner ID, loser ID, merged-by user, timestamp, field-level decisions. Enable "undo" is anti-feature (too complex), but audit is table stakes. |
| Bulk duplicate review | Review and resolve multiple duplicate clusters | MEDIUM | Paginated duplicate review list | Show clusters ranked by confidence. "Merge", "Not Duplicate" (dismiss), "Skip" actions per cluster. |

### 6. Webhooks (Outgoing)

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Webhook subscription management | Admin registers URLs for specific events | MEDIUM | New WebhookSubscription entity, Admin UI | CRUD for subscriptions: URL, events to subscribe to, active/inactive toggle, secret key for signing. |
| Event selection per subscription | Choose which entity events fire the webhook | LOW | Event type enum | Events: `contact.created`, `contact.updated`, `contact.deleted`, `deal.created`, `deal.stage_changed`, etc. Granular per entity + action. |
| HMAC-SHA256 payload signing | Receiver can verify payload authenticity | LOW | Crypto library (built-in .NET) | Sign payload with shared secret. Include signature in `X-Webhook-Signature` header. Industry standard (Stripe, GitHub pattern). |
| JSON payload with entity data | Webhook body contains the changed entity | LOW | DTO serialization | Payload: `{ event, timestamp, data: { entity } }`. Use existing DTOs. Include `previous_data` for updates so receiver knows what changed. |
| Retry with exponential backoff | Handle temporary receiver failures | HIGH | Background job queue, retry tracking | Retry schedule: 1m, 5m, 30m, 2h, 8h (5 attempts). Track each attempt. After exhaustion, mark as failed. Auto-disable subscription after N consecutive failures (e.g., 50). |
| Delivery log | Admin sees webhook delivery history | MEDIUM | WebhookDeliveryLog entity | Log: event, URL, HTTP status, response time, attempt count, payload (truncated), timestamp. Retention: 30 days. |
| Manual retry / redeliver | Resend a failed webhook delivery | LOW | Delivery log + retry mechanism | "Retry" button on failed deliveries. Useful for debugging receiver issues. |
| Test webhook (ping) | Verify URL is reachable before enabling | LOW | HTTP client call | Send a `ping` event with sample payload. Show success/failure immediately. |

### 7. Advanced Reporting Builder

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Entity source selection | Pick which entity to report on | LOW | Entity type registry | Sources: Contacts, Companies, Deals, Activities, Quotes, Requests. Single entity per report (joins handled via related entity fields). |
| Field selection (columns) | Choose which fields appear in report | LOW | Core + custom field registry | Include computed/formula fields. Group by entity sections. |
| Filter builder | WHERE clause equivalent -- filter report data | MEDIUM | Reuse FilterPanel patterns from dynamic tables | Same filter operators as dynamic tables: equals, contains, greater than, date range, is empty, etc. Compound AND/OR logic. |
| Grouping and aggregation | GROUP BY with SUM, COUNT, AVG, MIN, MAX | HIGH | Query builder that generates SQL/EF queries | Group by any field (including custom fields). Aggregate numeric/currency fields. This is the core reporting capability that goes beyond dashboards. |
| Related entity fields | Include company name on contact report, deal value on activity report | HIGH | Entity relationship mapping | Allow one level of relation traversal: Contact report can include Company.Name, Company.Industry. Deal report can include Contact.Email. Not unlimited joins. |
| Chart visualization | Bar, line, pie, table views of report data | MEDIUM | Chart.js (already in project for dashboards) | Reuse dashboard chart components. Report output toggles between table view and chart view. |
| Save and share reports | Named reports accessible by team | LOW | SavedReport entity | Owner, name, description, entity type, configuration JSON (fields, filters, groups). Share with team or keep personal. |
| Export report results | Download as CSV or Excel | LOW | CsvHelper (already in project for imports) | Export the rendered report data. Include headers matching selected columns. |
| Date range parameter | Reports filtered by time period | LOW | Date range picker (reuse from dashboards) | Preset ranges: Today, This Week, This Month, This Quarter, This Year, Custom. |
| Scheduled report delivery | Auto-send report via email on schedule | HIGH | Background scheduler, PDF/CSV generation, email | Daily/weekly/monthly email with report as attachment. Defer to v1.2 if needed -- nice to have but not table stakes. |

---

## Differentiators

Features that set GlobCRM apart from competitors. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Workflow-triggered email sequences | Workflows can enroll contacts in sequences -- connected automation | MEDIUM | Workflow engine + Sequence system | Most mid-tier CRMs treat workflows and sequences as separate features. Connecting them ("When deal moves to Negotiation, enroll primary contact in pricing sequence") is a significant UX win. |
| Computed fields in reports and filters | Formula fields are usable in report builder and dynamic table filters | MEDIUM | Computed field evaluation in queries | Pipedrive limits formula fields to display-only. Allowing them in filters and report aggregations makes custom fields genuinely powerful. |
| Webhook + workflow integration | Workflows can fire webhooks as actions | LOW | Webhook delivery from workflow action context | Enables "When contact created in CRM, POST to Slack/Zapier/custom system" without requiring separate webhook subscriptions for every event. |
| Cross-entity workflow triggers | "When a deal's company gets updated" triggers on the deal | HIGH | Entity relationship tracking, cross-entity change detection | Example: company industry changes -> all related deals get a field update. Defer to v1.2 -- powerful but complex. |
| Duplicate detection on import enhancement | Upgrade existing import duplicate detection with the new fuzzy matching engine | LOW | Duplicate detection service, existing import flow | Import already has basic duplicate detection (exact match on email). Plug in the new fuzzy matching to give import better detection without building separate code. |
| Sequence A/B testing | Test two email variants in a sequence step | HIGH | Variant assignment, statistical tracking | Send version A to 50%, version B to 50%. Track open/click/reply rates per variant. Powerful but complex -- defer to v1.2 unless implementation is clean. |
| Workflow templates (prebuilt) | Ship 5-10 common workflow templates users can activate | LOW | Seed data for workflow definitions | Templates: "New lead follow-up", "Deal won celebration", "Stale deal reminder", "Welcome sequence for new contacts", "Activity overdue escalation." Dramatically reduces time-to-value. |
| Report drill-down to records | Click a bar in a chart to see the underlying records | MEDIUM | Dynamic table filtered by report criteria | When user clicks "Deals Won in March" bar, open deals list filtered to won deals in March. Reuse existing dynamic table infrastructure. |
| Bulk merge from duplicate review | Select multiple duplicate clusters and merge in batch | HIGH | Merge service, batch processing | Review list with "merge all" button for high-confidence matches. Requires careful UX to avoid accidental data loss. |

---

## Anti-Features

Features to explicitly NOT build. Commonly requested, but problematic for this project scope.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Visual flowchart workflow builder (drag-and-drop nodes) | Enormous frontend complexity (need a canvas library like ReactFlow/JointJS), debugging is harder with visual spaghetti, most users create simple linear workflows anyway | Linear trigger -> conditions -> actions form. Covers 90% of use cases with 20% of the complexity. HubSpot's most-used workflows are linear, not branching. |
| Branching/conditional workflow paths | "If email opened, do X; if not, do Y" creates exponential complexity in both builder and execution engine | Keep workflows linear with conditions on the trigger. Use separate workflows for different conditions. Email sequences handle the branching case (send next step only if not replied). |
| Full SQL query builder for reports | Non-technical users cannot write SQL; SQL injection risk; maintenance burden | Structured query builder with dropdowns for fields, operators, and values. Translates to EF Core queries server-side. No raw SQL exposure. |
| Real-time formula evaluation in browser | Computing formulas client-side duplicates logic, creates inconsistency, and exposes business rules | Compute on the server during save. Return computed values in DTOs. Client displays them as read-only. |
| Unlimited webhook retry (forever) | Endless retries waste resources and mask dead endpoints | 5 retries over ~16 hours with exponential backoff. Auto-disable subscription after 50 consecutive failures. Admin can manually re-enable. |
| Cross-entity formula fields | Formula on Contact that references related Deal fields | Requires join queries, dependency tracking across entities, cache invalidation nightmares | Allow same-entity references only in v1.1. A Contact formula can reference Contact fields. A Deal formula can reference Deal fields. Cross-entity is v2+. |
| Undo merge | Reversing a merge after related records have been reassigned | Requires storing complete pre-merge state of both records plus all relationship changes. Enormous storage and complexity for a rarely-used feature. | Provide merge audit trail and pre-merge preview. If wrong, admin manually separates by creating a new record and reassigning relationships. |
| Workflow execution debugging with step-through | Pause workflow mid-execution and inspect state | Unnecessary complexity for a CRM. Users need logs, not a debugger. | Detailed execution logs showing trigger event, condition evaluation results (true/false with values), and action outcomes. |
| Scheduled email sequences (time-of-day targeting) with per-contact timezone | Sending at "9am in the contact's local timezone" | Requires timezone data on every contact (rarely populated), complex scheduling queue, DST handling | Send during tenant's business hours as default. Optional: simple send window (9am-5pm tenant timezone). Per-contact timezone is v2+. |
| Report builder with unlimited joins | Joining Contacts -> Companies -> Deals -> Activities -> Quotes in one report | Query performance degrades, UI becomes confusing, result sets are unpredictable | One level of related entity inclusion (e.g., Contact report with Company.Name). For complex analysis, export to Excel/BI tools. |

---

## Feature Dependencies (v1.1 Internal)

```
Formula / Computed Custom Fields (no dependencies on other v1.1 features)
    └── extends: CustomFieldDefinition entity (add Formula type)
    └── extends: Custom field evaluation in dynamic tables
    └── extends: Custom field rendering (read-only display)

Email Templates (no dependencies on other v1.1 features)
    └── uses: Existing ngx-quill rich text editor
    └── uses: Existing SendGrid email infrastructure
    └── extends: Entity field registry (for merge fields)

Email Sequences
    └── REQUIRES: Email Templates (sequences use templates for each step)
    └── uses: Existing Gmail sync (for reply detection / auto-unenroll)
    └── uses: Background job scheduler (for delayed step execution)

Duplicate Detection & Merge
    └── uses: pg_trgm PostgreSQL extension (for fuzzy matching)
    └── extends: Existing import duplicate detection (upgrade matching)
    └── touches: ALL entity FK relationships (for merge relationship transfer)

Webhook System (no dependencies on other v1.1 features)
    └── uses: Existing entity event patterns (create/update/delete in controllers)
    └── uses: Background job queue (for retry with backoff)

Workflow Automation Engine
    └── REQUIRES: Email Templates (for "send email" action)
    └── INTEGRATES WITH: Email Sequences (for "enroll in sequence" action)
    └── INTEGRATES WITH: Webhook System (for "fire webhook" action)
    └── uses: Existing NotificationDispatcher (for "send notification" action)
    └── uses: Entity change tracking (for field-change triggers)
    └── uses: Background scheduler (for date-based triggers)

Advanced Reporting Builder
    └── BENEFITS FROM: Formula/Computed Fields (use in report columns/filters)
    └── uses: Existing Chart.js + dashboard chart components
    └── uses: Existing CsvHelper (for CSV export)
    └── uses: Existing dynamic table filter patterns
```

### Dependency Summary -- Build Order Implications

1. **No dependencies:** Formula Fields, Email Templates, Duplicate Detection, Webhooks -- can start in parallel
2. **Depends on Email Templates:** Email Sequences (needs templates for step content)
3. **Depends on multiple v1.1 features:** Workflow Engine (needs templates for email action, benefits from sequences and webhooks for actions)
4. **Benefits from Formula Fields:** Reporting Builder (computed fields in report columns)

**Recommended build order:**
1. Formula Fields + Email Templates + Duplicate Detection + Webhooks (parallel, foundational)
2. Email Sequences (needs templates)
3. Workflow Automation Engine (orchestrates templates, sequences, webhooks, notifications)
4. Advanced Reporting Builder (can use computed fields, stands alone otherwise)

---

## Existing Infrastructure Leverage

These v1.0 systems are directly reused by v1.1 features:

| Existing System | Used By (v1.1) | How |
|----------------|----------------|-----|
| `NotificationDispatcher` | Workflow Engine | "Send notification" action reuses existing dispatch pipeline (DB + SignalR + email) |
| `IEmailService` (SendGrid) | Email Templates, Sequences | Transactional email sending for templates and sequence steps |
| Gmail Sync Service | Email Sequences | Reply detection for auto-unenroll (match inbound email address against active enrollments) |
| `CustomFieldDefinition` entity | Formula Fields | Add `Formula` to `CustomFieldType` enum; store formula expression in new column |
| `CustomFieldValidation` | Formula Fields | Extend validation to include formula-specific rules (expression syntax, field references) |
| Dynamic Table filter operators | Reporting Builder | Reuse filter operator logic (equals, contains, greater than, date range) |
| Chart.js + dashboard widgets | Reporting Builder | Reuse chart rendering components for report visualizations |
| CsvHelper | Reporting Builder | CSV export of report results |
| Import duplicate detection | Duplicate Detection | Upgrade import's basic email-matching with new fuzzy matching service |
| `FeedItem` system | Workflow Engine | Workflow actions can create feed items for audit trail visibility |
| SignalR Hub | Webhooks, Workflows | Real-time delivery status updates; workflow execution notifications |
| Entity change tracking (EF Core) | Workflows | Detect field changes for trigger evaluation via `ChangeTracker.Entries()` |
| RBAC Permission system | All features | Workflow management (Admin only), report sharing, webhook management permissions |
| Background job (import uses background execution) | Sequences, Webhooks, Workflows, Duplicate Detection | Extend existing background job pattern for scheduled/queued work |

---

## Complexity Assessment

| Feature Area | Backend Complexity | Frontend Complexity | Overall | Risk Areas |
|-------------|-------------------|--------------------|---------|-----------|
| Formula Fields | HIGH (expression parser, recalculation) | MEDIUM (formula editor, read-only display) | HIGH | Expression parser correctness, circular reference detection, performance of recalculation on save |
| Email Templates | LOW (CRUD + merge field resolution) | MEDIUM (template editor with merge field picker) | MEDIUM | HTML email rendering consistency across email clients |
| Email Sequences | HIGH (step scheduler, tracking, unenroll) | HIGH (sequence builder, enrollment management, analytics) | HIGH | Reliable step scheduling, reply detection accuracy, tracking pixel delivery |
| Duplicate Detection | HIGH (fuzzy matching algorithms, merge logic) | HIGH (side-by-side merge UI, duplicate review list) | HIGH | Performance of fuzzy scan on large datasets, merge relationship integrity |
| Webhooks | MEDIUM (delivery queue, retry, signing) | LOW (subscription CRUD, delivery log viewer) | MEDIUM | Retry reliability, dead endpoint handling, payload size limits |
| Workflow Engine | HIGH (trigger evaluation, action execution, scheduling) | HIGH (workflow builder form, execution log viewer) | HIGH | Date-based trigger evaluation performance, action failure handling, execution ordering |
| Reporting Builder | HIGH (dynamic query generation, aggregation) | HIGH (query builder UI, chart rendering, export) | HIGH | Query performance with grouping + custom fields in JSONB, preventing slow queries |

---

## MVP Recommendation for v1.1

### Must Ship (Table Stakes for "Automation & Intelligence")

1. **Workflow Automation** -- Core feature. Without it, v1.1 has no automation story.
   - Event triggers (record created/updated/deleted, field changed)
   - Date-based triggers (basic: X days after/before date field)
   - Actions: field update, create task, send notification, send email (from template), fire webhook, enroll in sequence
   - Execution log
   - Enable/disable

2. **Email Templates** -- Required by both workflows and sequences.
   - Rich text editor with merge fields
   - Template CRUD with categories
   - Preview with sample data

3. **Email Sequences** -- Primary use case for sales automation.
   - Multi-step builder with delays
   - Manual + workflow-triggered enrollment
   - Auto-unenroll on reply
   - Per-step tracking (open, click)
   - Sequence analytics

4. **Formula / Computed Fields** -- Completes the custom field story.
   - Arithmetic formulas with field references
   - Date difference calculations
   - String concatenation
   - Real-time recalculation on save
   - Formula validation

5. **Duplicate Detection & Merge** -- Data quality is expected alongside automation.
   - On-demand duplicate scan for contacts and companies
   - Real-time duplicate warning on create/edit
   - Configurable match rules (admin)
   - Fuzzy matching (pg_trgm)
   - Side-by-side merge with relationship transfer

6. **Webhooks** -- Enables external integration story.
   - Subscription management (Admin)
   - Event selection per subscription
   - HMAC-SHA256 signing
   - Retry with exponential backoff
   - Delivery log

7. **Advanced Reporting Builder** -- Goes beyond fixed dashboards.
   - Entity source + field selection
   - Filter builder (reuse dynamic table patterns)
   - Grouping and aggregation (COUNT, SUM, AVG)
   - Related entity fields (one level)
   - Chart + table visualization
   - Save, share, export

### Defer to v1.2

- Scheduled report delivery (email on schedule)
- Sequence A/B testing
- Cross-entity workflow triggers
- Cross-entity formula fields
- Bulk merge from duplicate review
- Per-contact timezone for sequence send windows

---

## Sources

### Workflow Automation
- [Zoho CRM Workflow Rules](https://help.zoho.com/portal/en/kb/crm/automate-business-processes/workflow-management/articles/configuring-workflow-rules) -- trigger types, instant vs scheduled actions
- [HubSpot Workflows Guide](https://knowledge.hubspot.com/workflows/create-workflows) -- enrollment triggers, action types, conditions
- [HubSpot Workflow Actions](https://knowledge.hubspot.com/workflows/choose-your-workflow-actions) -- comprehensive action catalog
- [CRM Automation Rules 2025](https://isitdev.com/crm-automation-rules-workflow-examples-2025/) -- 21 proven workflow patterns
- [SuiteCRM Workflows Documentation](https://docs.suitecrm.com/user/advanced-modules/workflow/) -- open-source CRM workflow reference
- [Freshsales Workflow Configuration](https://crmsupport.freshworks.com/support/solutions/articles/50000002143-how-to-configure-a-workflow-) -- trigger and action patterns

### Email Templates & Sequences
- [HubSpot Sequences](https://knowledge.hubspot.com/sequences/create-and-edit-sequences) -- sequence creation, enrollment, tracking
- [FluentCRM Email Sequences](https://fluentcrm.com/docs/email-sequence/) -- step delays, conditions, analytics
- [Pipeliner CRM Sequences](https://help.pipelinersales.com/en/articles/5694513-using-email-sequences-in-pipeliner) -- CRM-native sequence patterns
- [HubSpot Drip Campaign Guide](https://blog.hubspot.com/sales/drip-emails-opens) -- best practices for drip campaigns
- [Nimble CRM Email Sequences](https://www.nimble.com/blog/nimbles-new-email-sequences/) -- enrollment and tracking patterns

### Formula Fields
- [Pipedrive Formula Fields](https://support.pipedrive.com/en/article/custom-fields-formula-fields) -- formula syntax, operators, limitations
- [Pipedrive Formula Field Blog](https://www.pipedrive.com/en/blog/formula-custom-field) -- use cases and examples
- [Microsoft Dynamics 365 Calculated Fields](https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/customize/define-calculated-fields?view=op-9-1) -- condition/action formula model
- [Freshsales Formula Fields](https://crmsupport.freshworks.com/support/solutions/articles/50000002577-what-are-formula-fields-how-to-use-formula-fields-) -- function library and field references
- [Microsoft Dataverse Formula Columns](https://www.forvismazars.us/forsights/2025/05/how-to-use-formula-columns-in-microsoft-dataverse) -- Power Fx transition

### Duplicate Detection & Merge
- [CRM Deduplication Guide 2025](https://www.rtdynamic.com/blog/crm-deduplication-guide-2025/) -- algorithms, thresholds, best practices
- [Dynamics 365 Duplicate Detection](https://www.inogic.com/blog/2025/10/step-by-step-guide-to-duplicate-detection-and-merge-rules-in-dynamics-365-crm/) -- rule configuration and merge flow
- [Dynamics 365 Fuzzy Matching](https://www.inogic.com/blog/2025/08/make-your-crm-ai-ready-clean-duplicate-data-in-dynamics-365-crm-with-fuzzy-matching/) -- Levenshtein, Jaro-Winkler, Soundex
- [HubSpot Deduplication](https://knowledge.hubspot.com/records/deduplication-of-records) -- automatic and manual dedup
- [CRM Deduplication Guide (Databar)](https://databar.ai/blog/article/crm-deduplication-complete-guide-to-finding-merging-duplicate-records) -- algorithm comparison and threshold tuning

### Webhooks
- [Webhook Architecture Design](https://beeceptor.com/docs/webhook-feature-design/) -- subscription, delivery, retry patterns
- [Event-Driven Webhooks (CodeOpinion)](https://codeopinion.com/building-a-webhooks-system-with-event-driven-architecture/) -- decoupled architecture
- [Webhook System Design Guide](https://grokkingthesystemdesign.com/guides/webhook-system-design/) -- step-by-step design
- [.NET Webhook System](https://www.c-sharpcorner.com/article/creating-a-net-webhook-receiver-and-sender-system-architecture-implementation/) -- .NET-specific implementation
- [Webhook Best Practices](https://www.integrate.io/blog/apply-webhook-best-practices/) -- HMAC, retry, idempotency

### Reporting
- [DevExpress SQL Query Builder](https://docs.devexpress.com/XtraReports/17308/visual-studio-report-designer/sql-query-builder) -- query builder UX patterns
- [Dynamics 365 Cross-Entity Reports](https://meganvwalker.com/creating-dynamics-365-reports-with-multiple-entities/) -- entity join patterns
- [Agile CRM Reporting](https://www.agilecrm.com/crm-reporting) -- CRM-specific report builder features
- [Ad Hoc Reporting Tools 2026](https://www.cubesoftware.com/blog/best-ad-hoc-reporting-software-tools) -- modern reporting tool landscape

---
*Feature research for: v1.1 Automation & Intelligence*
*Researched: 2026-02-18*
*Previous: v1.0 MVP feature research (2026-02-16)*
