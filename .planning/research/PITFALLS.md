# Domain Pitfalls

**Domain:** v1.1 Automation & Intelligence features for multi-tenant SaaS CRM
**Researched:** 2026-02-18
**Scope:** Workflow automation, email templates/sequences, formula fields, duplicate detection & merge, webhooks, advanced reporting builder -- all integrated with existing triple-layer multi-tenancy (Finbuckle + EF Core filters + PostgreSQL RLS) and RBAC permission system.

---

## Critical Pitfalls

Mistakes that cause data loss, security breaches, system outages, or architectural rewrites.

---

### Pitfall 1: Workflow Automation Infinite Loops

**What goes wrong:** A workflow triggers an entity update (e.g., "when deal stage changes, update custom field"), which itself triggers another workflow (e.g., "when custom field changes, update deal stage"), creating an infinite recursive loop. The system burns CPU, fills the database with audit records, floods SignalR with notifications, and may crash the process or exhaust database connections. In a multi-tenant system, one tenant's runaway workflow takes down the entire system for all tenants.

**Why it happens:** Workflow engines that fire entity-change events without tracking execution context. The system cannot distinguish between a "user-initiated change" and a "workflow-initiated change" because both go through the same save path.

**Consequences:**
- CPU exhaustion and process crash (noisy neighbor for all tenants)
- Database connection pool exhaustion from rapid-fire queries
- SignalR broadcast storm: thousands of notifications per second to connected clients
- Audit log / feed_items table explosion (millions of rows in seconds)
- `AuditableEntityInterceptor` fires on every save, creating cascading timestamp updates

**Prevention:**
1. **Execution context tracking:** Every workflow execution must carry a `WorkflowExecutionContext` with a unique `executionId`, `depth` counter, and `triggeredByWorkflowId`. Pass this context through all entity-update code paths.
2. **Hard depth limit:** Enforce a maximum recursion depth of 5 (configurable per tenant). When depth exceeds the limit, halt execution, log a warning, and mark the workflow as "circuit-broken."
3. **Per-execution visited set:** Track which (entityId, workflowId) pairs have already been processed in the current execution chain. Skip duplicates.
4. **Per-tenant execution rate limit:** Cap the number of workflow executions per tenant per minute (e.g., 100/min for standard tier). Use .NET 10's partitioned rate limiting with `PartitionedRateLimiter<string>` keyed by tenant ID.
5. **Background execution with queue:** Never execute workflows synchronously in the HTTP request pipeline. Use a queue (in-process `Channel<T>` or Hangfire) so the original API call returns immediately and workflow processing happens asynchronously.
6. **Separate "workflow-initiated" save path:** Create a distinct method like `UpdateEntityFromWorkflow(entity, context)` that explicitly skips workflow trigger evaluation when depth > 0, or that only allows re-triggering with incremented depth.

**Detection:**
- Monitor `workflow_executions` table for chains with depth > 3
- Alert on workflow execution rate exceeding 50/min for any single tenant
- Log workflow execution chain as structured data: `{executionId, depth, parentWorkflowId, triggeredBy}`
- Dashboard widget showing "workflow executions per hour by tenant"

**Feature:** Workflow Automation
**Phase to address:** First -- must be designed into the workflow engine from the start, not bolted on later.

---

### Pitfall 2: Tenant Context Loss in Background Jobs

**What goes wrong:** Workflows, email sequences, webhook deliveries, and report generation all run as background jobs. These jobs execute outside an HTTP request, so Finbuckle's middleware (Layer 1 of triple-layer defense) never runs. The `TenantDbConnectionInterceptor` requires `ITenantProvider.GetTenantId()` to set `app.current_tenant` on the PostgreSQL session, but `ITenantProvider` resolves from HttpContext. Background jobs have no HttpContext, so:
- EF Core global query filters use a null tenant ID, potentially returning all tenants' data or no data
- PostgreSQL RLS policies receive a null `app.current_tenant`, blocking all queries (rows invisible)
- Worse: if a previous request's connection is reused from the pool, the *wrong* tenant's session variable may still be set

**Why it happens:** The v1.0 architecture correctly resolves tenant from HTTP requests via `TenantProvider` which reads from Finbuckle. Background jobs bypass this entirely. The existing `NotificationDispatcher.DispatchAsync(request, tenantId)` overload shows awareness of this problem for notifications, but a systematic solution is needed for all v1.1 background processing.

**Consequences:**
- Workflow actions execute against wrong tenant's data (catastrophic data leak)
- Email sequences send emails to wrong tenant's contacts
- Webhook payloads contain cross-tenant data
- Report queries return data from other tenants
- RLS may silently return zero rows, causing workflows to fail silently with no error

**Prevention:**
1. **Explicit tenant context wrapper for all background jobs:** Create a `TenantScope` class that, given a tenant ID:
   - Creates a new DI scope via `IServiceScopeFactory`
   - Resolves a `TenantProvider` and sets the tenant ID explicitly
   - Ensures the `ApplicationDbContext` in that scope gets the correct tenant
   - The `TenantDbConnectionInterceptor` then sets `app.current_tenant` correctly
2. **Store tenant ID in every job payload:** All background job records (workflow executions, email sequence steps, webhook deliveries) must persist `TenantId` as a non-nullable column. Never rely on ambient context.
3. **Validate tenant context before processing:** At the start of every background job handler, assert that `ITenantProvider.GetTenantId()` returns the expected value. Fail loudly if it does not match.
4. **Connection pool isolation:** Ensure background job connections do not reuse pooled connections from a different tenant without re-setting `app.current_tenant`. The `TenantDbConnectionInterceptor` already handles this on `ConnectionOpened`, but verify with integration tests.
5. **Integration test:** Write a test that enqueues a background job for Tenant A, then immediately processes a job for Tenant B, and verifies no data leakage occurs.

**Detection:**
- Audit log entries where `TenantId` on the action result differs from the `TenantId` on the triggering record
- Background job failures with "No rows returned" when rows definitely exist (RLS blocking due to wrong tenant)
- Structured logging: every background job log line must include `TenantId`

**Feature:** All features (workflow, email sequences, webhooks, reports)
**Phase to address:** First -- build the `TenantScope` infrastructure before implementing any background processing features.

---

### Pitfall 3: Report Query Builder Tenant Data Leakage

**What goes wrong:** The advanced reporting builder lets users construct custom queries (choose entity, filters, groupings, aggregations). If the query builder generates raw SQL or uses `FromSqlRaw`/`FromSqlInterpolated`, EF Core global query filters are bypassed. Even if LINQ is used, a bug in the dynamic query construction could accidentally call `IgnoreQueryFilters()` or construct a query that joins to an unfiltered table. One tenant's admin could craft a report that returns another tenant's data.

**Why it happens:** Dynamic query construction is inherently risky because the query shape is user-controlled. Unlike normal CRUD endpoints where the code path is fixed and reviewed, the report builder constructs queries programmatically based on user input. The combinatorial explosion of possible query shapes makes it nearly impossible to review every path.

**Consequences:**
- Cross-tenant data exposure (security breach, regulatory violation)
- SQL injection if user input is interpolated into raw SQL
- N+1 queries from naive query construction (e.g., loading related entities in a loop)
- Query timeout from unoptimized joins across large tables

**Prevention:**
1. **Never use raw SQL in the report builder.** Build all report queries using LINQ and the EF Core query pipeline so global query filters always apply. If raw SQL is absolutely needed, manually add `WHERE tenant_id = @tenantId` to every table reference -- but prefer LINQ.
2. **Whitelist-based query construction:** The report builder should only allow selecting from a predefined set of entity types and fields. Map user selections to strongly-typed LINQ expressions, never to string-based SQL fragments. Example: user selects "Contact.Email" --> map to `query.Select(c => c.Email)`, not `$"SELECT {userInput} FROM contacts"`.
3. **Rely on PostgreSQL RLS as the safety net:** Since `TenantDbConnectionInterceptor` sets `app.current_tenant` on every connection, RLS will catch any query filter bypass. But do not rely on this as the primary defense -- it is the last line.
4. **Query complexity limits:** Cap the number of joins (max 5), result rows (max 10,000 with pagination), and execution time (30-second timeout). Use `SET statement_timeout = '30s'` for report queries.
5. **Never expose `IgnoreQueryFilters()` in any code path reachable from the report builder.** Grep the codebase for `IgnoreQueryFilters` and ensure none of those paths are accessible from dynamic query construction.
6. **Parameterize all user inputs:** Even in LINQ, ensure filter values are parameterized (EF Core does this by default, but verify when building dynamic `Expression<Func<T, bool>>`).

**Detection:**
- Integration tests that create data for two tenants, run every report type, and verify zero cross-tenant rows
- Query logging: log the generated SQL for every report execution, with structured fields for tenant ID and user ID
- Periodic audit: automated scan for `IgnoreQueryFilters` calls in the codebase

**Feature:** Advanced Reporting Builder
**Phase to address:** Reporting Builder phase -- but design the query builder architecture with these constraints from the start.

---

### Pitfall 4: Duplicate Merge Data Loss and Broken References

**What goes wrong:** When merging two duplicate contacts (or companies), the "losing" record is deleted after its data is transferred to the "winner." But the system has many FK relationships: `DealContact.ContactId`, `Activity.ContactId`, `EmailMessage` linked to contacts, `Note` linked to contacts, `QuoteLineItem` linked via deals, custom field `Relation` type fields pointing to the merged entity, feed items referencing the entity, notifications, webhook subscription filters, workflow trigger conditions, and potentially the new email sequence enrollments. Missing even one FK update means:
- Orphaned records with dangling FK references (if FK constraints are nullable)
- Constraint violation errors (if FK constraints are NOT NULL)
- Activities, emails, and notes disappear from the merged entity's timeline
- Workflows that reference the deleted entity's ID break silently
- Reports show incorrect counts (entity referenced in old records but deleted)

**Why it happens:** The CRM entity graph is deeply interconnected. v1.0 has 50+ entity types with numerous relationships. Developers enumerate the "obvious" FKs (deals, activities, notes) but miss less obvious ones (feed_items.EntityId, notifications.EntityId, saved_view filters referencing specific entity IDs, custom field Relation values stored in JSONB).

**Consequences:**
- Permanent data loss (activities, emails, notes disconnected from the contact)
- Broken timelines (the timeline endpoint assembles events from multiple sources; missing links = missing events)
- Workflow/email sequence failures when they reference the deleted entity
- Incorrect reporting data (merged entity's history is incomplete)
- User frustration: "Where did my emails go after the merge?"

**Prevention:**
1. **Build a comprehensive FK reference map:** Before implementing merge, enumerate every table/column that can reference a Contact or Company ID. Include:
   - Direct FKs: `deal_contacts`, `activities`, `notes`, `attachments`, `quotes`, `email_messages`
   - Polymorphic references: `feed_items.entity_id`, `notifications.entity_id` (where `entity_type = 'Contact'`)
   - JSONB references: Custom field values of type `Relation` that point to the entity
   - New v1.1 tables: `workflow_trigger_conditions`, `email_sequence_enrollments`, `webhook_subscriptions`
2. **Merge operation as a transaction:** Wrap the entire merge in a single database transaction. Update all FKs, then soft-delete the losing record (do not hard-delete). Keep the losing record marked as `MergedIntoId = winnerId` for audit trail and potential undo.
3. **Soft-delete with redirect:** When any code path resolves an entity by ID and gets a soft-deleted merged record, follow the `MergedIntoId` redirect to the winner. This prevents broken links from code that cached the old ID.
4. **Merge preview endpoint:** Before executing, return a summary: "This will reassign 12 deals, 45 activities, 23 emails, 8 notes to the surviving record." Let the user confirm.
5. **Conflict resolution UI:** When both records have different values for the same field (e.g., different phone numbers), let the user choose which value to keep per field, not just "keep winner's values."
6. **Custom field JSONB merge:** For Relation-type custom fields pointing to the losing entity, update the JSONB value. Use PostgreSQL's `jsonb_set` function in a single UPDATE to avoid loading all entities into memory.

**Detection:**
- After merge, query all FK reference points and verify zero references to the deleted entity ID remain
- Integration test: create two contacts with full relationship graph, merge them, verify all relationships point to the winner
- Monitor for 404 errors on entity detail pages (user bookmarked the old URL)

**Feature:** Duplicate Detection & Merge
**Phase to address:** Duplicate Detection & Merge phase -- but the soft-delete/redirect pattern should be designed early since it affects entity resolution across the entire system.

---

### Pitfall 5: Webhook SSRF (Server-Side Request Forgery)

**What goes wrong:** The webhook feature allows tenant admins to register arbitrary URLs that the system will call (POST with event payload) when entity events occur. An attacker registers a webhook URL pointing to `http://169.254.169.254/latest/meta-data/` (AWS metadata endpoint), `http://localhost:5233/api/admin/...` (internal API), or `http://10.0.0.1/internal-service`. The server dutifully makes the HTTP request from its own network, bypassing firewalls and accessing internal resources the attacker should not reach.

**Why it happens:** Webhook implementations accept user-provided URLs and make server-side HTTP requests to them. Without URL validation, the server becomes a proxy for the attacker.

**Consequences:**
- Exposure of cloud provider credentials (AWS/Azure metadata endpoints)
- Access to internal services not exposed to the internet
- Port scanning of internal networks
- Potential for further exploitation via SSRF chains

**Prevention:**
1. **URL validation on registration:**
   - Allow only `https://` scheme (block `http://`, `file://`, `ftp://`, `gopher://`)
   - Resolve the hostname to an IP address and reject RFC1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and multicast ranges
   - Re-resolve DNS on every webhook delivery (not just registration) to prevent DNS rebinding attacks
   - Reject URLs with IP addresses (require hostnames)
2. **Network isolation:** Run webhook delivery workers in a separate network segment / container with no access to internal services. Egress-only to the public internet.
3. **Response handling:** Do not return the response body from webhook calls to the user (prevent data exfiltration). Only return status code, latency, and success/failure.
4. **Redirect limits:** Follow a maximum of 3 redirects. On each redirect, re-validate the target URL against the same rules. Block redirects to private IPs.
5. **Timeout:** Set a short HTTP timeout (10 seconds) to prevent connection to slow/hanging internal services.

**Detection:**
- Log all webhook delivery URLs with resolved IP addresses
- Alert on webhook registrations to private IP ranges (should be blocked, but alert if validation is bypassed)
- Monitor webhook delivery latency spikes (may indicate slow internal service scanning)

**Feature:** Webhooks
**Phase to address:** Webhooks phase -- URL validation must be in the first implementation, not added later.

---

### Pitfall 6: Formula Field Circular Dependencies and Evaluation Storms

**What goes wrong:** Formula/computed custom fields reference other fields, including other formula fields. Field A's formula references Field B, and Field B's formula references Field A (direct cycle). Or: Field A -> Field B -> Field C -> Field A (indirect cycle). When the system attempts to evaluate any field in the cycle, it enters infinite recursion. Even without cycles, deeply nested formula chains (A -> B -> C -> D -> E -> F) create evaluation storms when the root field changes, requiring re-computation of the entire chain for every record.

**Why it happens:** Users define formula fields one at a time and do not visualize the dependency graph. The system does not validate the graph at definition time, only discovering cycles at evaluation time (or worse, hitting a stack overflow).

**Consequences:**
- Stack overflow / infinite recursion during field evaluation
- CPU exhaustion when a bulk update touches a field referenced by deep formula chains
- Stale computed values if evaluation errors are silently swallowed
- Incorrect reports and dashboards showing stale or partially-evaluated formula values

**Prevention:**
1. **Build a dependency graph at definition time:** When a formula field is created or updated, parse the formula to extract all field references. Build a directed graph of field dependencies. Use topological sort to detect cycles. Reject formulas that create cycles with a clear error message: "This formula creates a circular dependency: Field A -> Field B -> Field A."
2. **Maximum dependency depth:** Limit formula chains to 5 levels deep. A formula field cannot reference another formula field that is already at depth 4.
3. **Topological evaluation order:** When a field value changes, use the dependency graph to determine which formula fields need re-evaluation and in what order. Evaluate in topological order (leaf dependencies first, then fields that depend on them).
4. **Lazy evaluation with caching:** Store computed values in the entity's `CustomFields` JSONB alongside raw values, marked with a `_computed` suffix or in a separate JSONB column. Re-evaluate only when a dependency changes, not on every read.
5. **Evaluation timeout:** Cap formula evaluation at 100ms per field per record. If evaluation exceeds this, mark the field as "error" and log the issue.
6. **Restrict formula language:** Use a safe expression evaluator (not `eval()` or Roslyn compilation). Allow only arithmetic, string operations, field references, and simple conditionals. No loops, no function definitions, no external calls. Consider `NCalc` or a custom parser.
7. **Bulk update performance:** When a bulk import updates 10,000 records, do not evaluate formula fields row-by-row. Batch the evaluation: collect all changed fields, determine affected formula fields, then evaluate in bulk using set-based operations where possible.

**Detection:**
- Validate dependency graph on every formula field save (reject cycles immediately)
- Monitor formula evaluation time per tenant
- Alert on formula evaluation errors (stale values are worse than errors)

**Feature:** Formula/Computed Custom Fields
**Phase to address:** Formula Fields phase -- dependency graph validation must be the first thing built, before the evaluation engine.

---

## Moderate Pitfalls

Mistakes that cause significant bugs, performance issues, or difficult debugging, but are recoverable without rewrites.

---

### Pitfall 7: Email Sequence Timing and Deliverability

**What goes wrong:** Email sequences send automated follow-up emails on a schedule (e.g., Day 1: Welcome, Day 3: Follow-up, Day 7: Check-in). Multiple issues arise:
- **Timing drift:** If the sequence scheduler runs every 5 minutes, emails may send up to 5 minutes late. Over a 7-day sequence, this is acceptable. But if sequences are per-minute, the scheduler's polling interval matters.
- **Deliverability collapse:** All tenants' sequences fire at the same time (e.g., all "Day 3" emails at midnight UTC). The shared SendGrid account gets rate-limited or flagged for bulk sending, causing all emails to bounce or be delayed.
- **Contact unsubscribe ignored:** A contact unsubscribes (or is merged/deleted) while an email sequence is in progress. The next scheduled email still sends.
- **Duplicate enrollment:** A contact is enrolled in the same sequence twice (e.g., workflow fires twice due to a bug), receiving duplicate emails.

**Prevention:**
1. **Jittered send times:** When enrolling a contact in a sequence, add a random jitter of +/- 30 minutes to each step's scheduled time. This spreads load across time and avoids bulk-sending spikes.
2. **Per-tenant sending rate limits:** Cap each tenant's email sends to a reasonable rate (e.g., 100/hour). Queue excess emails and drain gradually.
3. **Pre-send validation:** Before sending each sequence step, verify:
   - Contact still exists and is not soft-deleted or merged
   - Contact has not unsubscribed
   - Contact's email is still valid (not bounced in a previous send)
   - The sequence enrollment is still active (not paused or cancelled)
4. **Idempotent enrollment:** Use a unique constraint on `(sequence_id, contact_id)` to prevent duplicate enrollments. If a workflow tries to enroll an already-active contact, skip or update the existing enrollment.
5. **Sequence step deduplication:** Each step execution should have an idempotency key. If the scheduler processes the same step twice (due to retry), the second execution is a no-op.
6. **SendGrid/email provider integration:** Use the existing `IEmailService` abstraction, but add rate-limiting middleware. Track bounce rates per tenant and auto-pause sequences if bounce rate exceeds 5%.

**Detection:**
- Monitor email send rate per tenant per hour
- Alert on bounce rate exceeding 3% for any tenant
- Dashboard showing sequence completion rates (enrollments vs. completions vs. drops)
- Log every sequence step execution with contact ID, sequence ID, step number, and result

**Feature:** Email Templates & Sequences
**Phase to address:** Email Templates & Sequences phase.

---

### Pitfall 8: Workflow Actions Bypassing RBAC Permission Checks

**What goes wrong:** A workflow executes an action (e.g., "update deal stage to Won" or "create a follow-up activity") using the system's service account, not the user who triggered the workflow. The action succeeds even though the user who triggered it does not have permission to update deals or create activities. This violates the RBAC model and allows privilege escalation.

**Why it happens:** Workflow actions are executed by a background service that has full system access. The `PermissionAuthorizationHandler` checks permissions based on `ClaimsPrincipal` from the HTTP context, but background jobs have no HTTP context and no user claims.

**Consequences:**
- Users can create workflows that perform actions they are not authorized to do directly
- Audit trails show "system" as the actor instead of the triggering user
- Tenant admins cannot control what workflows are allowed to do through the existing permission model

**Prevention:**
1. **Workflow permission model:** Define which actions a workflow can perform as part of its configuration. Only Admin users should be able to create/edit workflows (controlled by a new `Workflow:Manage` permission).
2. **Option: Execute as triggering user vs. execute as system:**
   - "Execute as triggering user": Evaluate the triggering user's permissions before each action. If the user lacks `Deal:Edit` permission, the "update deal" action fails and is logged.
   - "Execute as system": The workflow runs with full tenant-scoped access (still isolated by tenant, but no RBAC check). This is simpler but requires that only admins can create workflows.
   - **Recommendation:** Start with "execute as system" + admin-only workflow management. It is simpler and matches what most CRM platforms do (Salesforce, HubSpot). Document the security model clearly.
3. **Audit trail:** Every workflow-initiated action must record both the `triggeredByUserId` (the user whose action fired the trigger) and the `executedBySystem: true` flag. The existing `AuditableEntityInterceptor` sets `CreatedAt`/`UpdatedAt` but not `CreatedBy`/`UpdatedBy` -- ensure workflow actions also set these to the triggering user for traceability.
4. **Scope restriction:** Even "execute as system" must respect tenant isolation. The background job must use the `TenantScope` wrapper (see Pitfall 2) so all actions are scoped to the correct tenant.

**Detection:**
- Audit log review: filter for actions where `executedBy = system` and verify the triggering workflow is authorized
- Permission change alerts: when a user's permissions are downgraded, check if they have active workflows performing actions they can no longer do

**Feature:** Workflow Automation
**Phase to address:** Workflow Automation phase -- must be decided during workflow engine design.

---

### Pitfall 9: Webhook Delivery Retry Storms

**What goes wrong:** A tenant registers a webhook endpoint that is temporarily down (returns 500 or times out). The system retries with exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s... But if the endpoint is down for hours, and the tenant has many active entities generating events, the retry queue grows unboundedly. When the endpoint comes back up, the system fires all queued deliveries at once, overwhelming the endpoint (and the system's outbound HTTP connection pool). Meanwhile, if 100 tenants have webhooks and 5 are down, the retry queue consumes memory/storage and the delivery worker spends most of its time on failing requests.

**Prevention:**
1. **Exponential backoff with jitter:** Use `delay = min(base * 2^attempt + random_jitter, max_delay)` where max_delay = 1 hour. Jitter prevents synchronized retries.
2. **Maximum retry count:** Stop retrying after 5 attempts (spans approximately 1 hour total). Move the delivery to a dead-letter queue (DLQ). Provide a UI for tenants to view failed deliveries and manually retry.
3. **Circuit breaker per endpoint:** After 3 consecutive failures to the same endpoint URL, mark it as "circuit-broken." Stop sending new events to that endpoint. Periodically (every 15 minutes) send a health-check probe. When the probe succeeds, resume delivery. Notify the tenant via in-app notification that their webhook endpoint is failing.
4. **Outbound connection pool limits:** Use a named `HttpClient` via `IHttpClientFactory` with connection pooling. Set `MaxConnectionsPerServer = 5` to prevent overwhelming any single endpoint.
5. **Queue depth limits:** Cap the delivery queue at 1,000 pending deliveries per endpoint. If the queue is full, drop new events for that endpoint (with logging) rather than growing the queue indefinitely.
6. **Delivery status tracking:** Persist every delivery attempt with timestamp, HTTP status code, response time, and any error message. Expose this in the UI so tenants can debug their webhook endpoints.

**Detection:**
- Monitor retry queue depth per endpoint and per tenant
- Alert on endpoints in circuit-broken state for more than 1 hour
- Dashboard showing webhook delivery success rate, p95 latency, and retry rate

**Feature:** Webhooks
**Phase to address:** Webhooks phase.

---

### Pitfall 10: SignalR Broadcast Storm from Workflow/Automation Events

**What goes wrong:** v1.0 sends SignalR events for entity changes (`FeedUpdate`, `ReceiveNotification`). When workflows execute, a single user action can cascade into dozens of entity updates (workflow updates 5 deals, creates 3 activities, sends 2 emails). Each update triggers a SignalR broadcast to the tenant group. The connected Angular clients receive 10+ events in rapid succession, each triggering a store update and UI re-render. The UI flickers, the browser becomes sluggish, and the SignalR connection may back up.

**Prevention:**
1. **Batch/debounce workflow events:** When a workflow execution produces multiple entity changes, collect all changes into a single batched event. Send one SignalR message with the list of changes, rather than one message per change.
2. **Throttle per tenant:** Rate-limit SignalR messages to a maximum of 10 per second per tenant group. Buffer excess messages and flush at the next interval.
3. **Payload minimization:** Workflow-generated events should send minimal payloads (`{entityType, entityId, action}`) rather than full entity DTOs. Let the client fetch updated data if it is currently viewing that entity.
4. **Client-side debounce:** In the Angular `SignalRService`, debounce incoming events by entity type. If 5 `FeedUpdate` events arrive within 500ms, process only the last one (or a merged set).
5. **Suppress non-visible updates:** If a workflow updates an entity that no connected user is currently viewing, the client can skip the re-fetch. Use the Angular store's knowledge of "currently viewed entity" to decide whether to act on an event.

**Detection:**
- Monitor SignalR message rate per tenant group
- Client-side logging: count SignalR events received per second and warn if > 20
- Server-side: log workflow execution event counts per batch

**Feature:** Workflow Automation (with SignalR integration)
**Phase to address:** Workflow Automation phase -- design the event batching from the start.

---

### Pitfall 11: Report Builder N+1 Queries and Performance

**What goes wrong:** The report builder constructs LINQ queries dynamically. A user builds a report: "All deals with their primary contact email and company name." The naive implementation loads deals, then for each deal loads the contact (N+1), then for each contact loads the company (N+1 again). For 1,000 deals, this generates 2,001 database queries. With PostgreSQL RLS adding overhead to every query, this becomes extremely slow.

**Prevention:**
1. **Eager loading by default:** All report queries must use `.Include()` for related entities referenced in the report columns. Build the include chain dynamically based on which columns the user selected.
2. **Projection-only queries:** Reports should never load full entity graphs. Use `.Select()` to project only the columns needed for the report. This generates a single SQL query with joins, not multiple queries.
3. **Query plan analysis:** Log the generated SQL for every report execution. Periodically review with `EXPLAIN ANALYZE`. Set up automated detection for queries with > 10 joins or execution time > 5 seconds.
4. **Materialized aggregations:** For aggregate reports (sum of deal values by stage, count of contacts by company), pre-compute aggregations in a background job and store in a `report_cache` table. Serve from cache if the data is less than 15 minutes old.
5. **Result set limits:** Cap report results at 10,000 rows with mandatory pagination. For export (CSV), stream results using EF Core's `AsAsyncEnumerable()` to avoid loading everything into memory.
6. **Timeout enforcement:** Set `CommandTimeout = 30` on the `DbCommand` for report queries. If a report query takes more than 30 seconds, cancel it and return an error to the user.
7. **Custom fields in reports:** JSONB field access (`custom_fields->>'field_name'`) does not benefit from standard B-tree indexes unless a specific expression index exists. For frequently-reported custom fields, consider creating expression indexes. For ad-hoc custom field queries, accept the performance trade-off and document it.

**Detection:**
- EF Core query logging: flag any query batch with > 5 queries (indicates N+1)
- Slow query log: PostgreSQL's `log_min_duration_statement = 5000` to catch queries over 5 seconds
- Per-report execution timing in structured logs

**Feature:** Advanced Reporting Builder
**Phase to address:** Reporting Builder phase.

---

### Pitfall 12: Duplicate Detection False Positives Blocking Legitimate Records

**What goes wrong:** Overly aggressive duplicate detection rules (e.g., "same first name and last name = duplicate") flag too many false positives. When duplicate detection runs on record creation, it blocks users from creating legitimate contacts ("John Smith at Company A" is flagged as duplicate of "John Smith at Company B"). Users get frustrated and either stop using the CRM or find workarounds (misspelling names to avoid detection). Alternatively, overly relaxed rules miss real duplicates, defeating the feature's purpose.

**Prevention:**
1. **Confidence scoring, not binary matching:** Instead of "duplicate: yes/no," return a confidence score (0-100%). Use weighted criteria:
   - Email match: +40 points (emails are near-unique)
   - Phone match: +25 points
   - Name + company match: +20 points
   - Name only match: +10 points (high false positive rate)
   - Address match: +15 points
2. **Threshold-based actions:**
   - Score >= 90%: Auto-flag as likely duplicate, suggest merge in UI
   - Score 60-89%: Show warning on create/edit, let user proceed
   - Score < 60%: No action (save normally)
3. **Never auto-merge without confirmation:** Always present duplicates to the user with a comparison view. Auto-merge is too risky for data loss.
4. **Configurable rules per tenant:** Let admins customize which fields participate in duplicate detection and their weights. Different industries have different duplicate patterns.
5. **Performance:** Duplicate detection queries against the entire contact/company table. For large tenants (100k+ contacts), use PostgreSQL trigram indexes (`pg_trgm` extension) for fuzzy matching, or pre-compute phonetic codes (Soundex/Metaphone) in a separate column for name matching.
6. **Exclude from detection:** Allow users to explicitly mark two records as "not duplicates" so they are not re-flagged.

**Detection:**
- Track false positive rate: how often users dismiss duplicate warnings
- Monitor duplicate detection query performance per tenant
- A/B test detection rules: compare detection rates with different weight configurations

**Feature:** Duplicate Detection & Merge
**Phase to address:** Duplicate Detection & Merge phase.

---

## Minor Pitfalls

Issues that cause friction, minor bugs, or suboptimal UX but are straightforward to fix.

---

### Pitfall 13: Email Template Variable Injection / XSS

**What goes wrong:** Email templates use variable placeholders like `{{contact.firstName}}`, `{{deal.name}}`. When the template is rendered, the placeholder is replaced with the actual value. If a contact's name contains `<script>alert('XSS')</script>` or the template is rendered as HTML in the CRM's preview UI without escaping, it creates an XSS vulnerability. Additionally, if a user crafts a template with `{{contact.email}}` and sends it in a sequence, the recipient sees the raw email address (a privacy concern if the template is forwarded).

**Prevention:**
1. **HTML-escape all variable values** when rendering templates for email send and UI preview. Use a template engine that escapes by default (e.g., Handlebars with HTML escaping enabled, Scriban with HTML encoding).
2. **Restrict available variables:** Only expose a whitelisted set of variables per entity type. Do not expose internal fields (IDs, tenant IDs, system fields).
3. **Sanitize template HTML:** When admins save an email template, sanitize the HTML to remove `<script>`, `onclick`, and other dangerous attributes. Use a library like HtmlSanitizer for .NET.
4. **Preview rendering:** When showing a template preview in the Angular app, render using `[innerHTML]` with Angular's built-in sanitization, or better, render server-side and return safe HTML.

**Feature:** Email Templates & Sequences
**Phase to address:** Email Templates & Sequences phase.

---

### Pitfall 14: Webhook Payload Leaking Sensitive Data

**What goes wrong:** When a webhook fires for a "contact created" event, the payload includes the full entity DTO, which may contain sensitive fields that the webhook consumer should not see (e.g., internal notes, custom fields with financial data, field-level permission-restricted fields). The webhook consumer is an external system with no concept of the CRM's RBAC field-level permissions.

**Prevention:**
1. **Webhook payload schema configuration:** When registering a webhook, let the admin choose which fields to include in the payload (whitelist approach), or at minimum, respect field-level permissions of the "Webhook" role.
2. **Default to minimal payload:** By default, send only `{entityType, entityId, action, timestamp}`. Let the consumer call back to the API with an API key to fetch full details (with proper auth).
3. **Never include:** tenant IDs, internal user IDs, RBAC role information, or audit metadata in webhook payloads.
4. **HMAC signing:** Sign every webhook payload with a per-subscription secret so the consumer can verify authenticity. Include a timestamp to prevent replay attacks.

**Feature:** Webhooks
**Phase to address:** Webhooks phase.

---

### Pitfall 15: Formula Fields Referencing Deleted Custom Field Definitions

**What goes wrong:** A formula field references custom field `X` in its formula expression. An admin later deletes custom field `X`. The formula field's evaluation fails at runtime because the referenced field no longer exists. If the error is silently swallowed, the computed value becomes stale or null without explanation.

**Prevention:**
1. **Reference validation on field deletion:** When deleting a custom field definition, check if any formula fields reference it. If so, block deletion with an error: "Cannot delete field 'X' because it is referenced by formula field 'Y'." Or force the admin to update the formula first.
2. **On-save validation:** When saving a formula, validate that all referenced fields exist and are of compatible types.
3. **Graceful degradation:** If a referenced field is somehow deleted (e.g., database manipulation), the formula evaluator should return `#REF!` error value (similar to Excel) rather than crashing or returning null silently.
4. **Cascade warnings:** When deleting a field, show the admin a list of all dependent formula fields that will break.

**Feature:** Formula/Computed Custom Fields
**Phase to address:** Formula Fields phase.

---

### Pitfall 16: Report Builder Allowing Unbounded Cross-Entity Joins

**What goes wrong:** A user builds a report joining Contacts -> Deals -> Activities -> Notes -> Attachments (5-level deep join). For a tenant with 50k contacts, 100k deals, 500k activities, this generates a query with millions of intermediate rows. PostgreSQL spends minutes on the join, consuming CPU and I/O. Other tenants' queries are delayed (noisy neighbor). The query may also exceed PostgreSQL's `work_mem` and spill to disk.

**Prevention:**
1. **Limit join depth:** Maximum 3 levels of entity joins in a single report (e.g., Contact -> Deal -> Activity is OK, but Contact -> Deal -> Activity -> Note is the limit).
2. **Cardinality warnings:** When a user adds a join, estimate the result set size and warn if it exceeds 100k rows: "This report may be slow due to large data volume. Consider adding filters."
3. **Statement timeout:** Set `SET statement_timeout = '30s'` on report query connections. Cancel queries that exceed the limit.
4. **Per-tenant query concurrency:** Allow only 2 concurrent report queries per tenant. Queue additional requests.
5. **Explain-before-execute:** For reports with > 2 joins, run `EXPLAIN` first, check the estimated row count, and reject if > 500k estimated rows.

**Feature:** Advanced Reporting Builder
**Phase to address:** Reporting Builder phase.

---

### Pitfall 17: Workflow Trigger Conditions on JSONB Custom Fields -- Performance

**What goes wrong:** A workflow trigger condition says "when custom field 'Priority Score' > 80, send email." This translates to a query like `WHERE (custom_fields->>'priority_score')::numeric > 80` on every entity update. If the table has 100k rows and the JSONB path is not indexed, this full-table scan runs on every single entity update to evaluate whether the trigger condition is met.

**Prevention:**
1. **Event-driven evaluation, not poll-driven:** Do not query the database to find matching entities. Instead, evaluate trigger conditions against the specific entity that was just updated. The workflow engine receives the changed entity and evaluates conditions in memory.
2. **Pre-compiled condition evaluators:** Parse trigger conditions at workflow save time into compiled expressions (`Expression<Func<Entity, bool>>`). At runtime, invoke the compiled delegate against the entity DTO, not the database.
3. **Indexing for batch operations:** If batch evaluation is needed (e.g., "find all contacts where custom field X changed today"), create expression indexes on frequently-used JSONB paths: `CREATE INDEX idx_contacts_priority ON contacts ((custom_fields->>'priority_score'))`.
4. **Limit trigger conditions per workflow:** Maximum 5 conditions per trigger. Complex conditions increase evaluation time and make debugging difficult.

**Feature:** Workflow Automation
**Phase to address:** Workflow Automation phase.

---

### Pitfall 18: New Entity Tables Missing RLS Policies

**What goes wrong:** v1.1 introduces new database tables: `workflow_definitions`, `workflow_executions`, `workflow_actions`, `email_templates`, `email_sequences`, `email_sequence_enrollments`, `email_sequence_steps`, `formula_field_definitions`, `duplicate_detection_rules`, `merge_audit_logs`, `webhook_subscriptions`, `webhook_deliveries`, `report_definitions`, `report_executions`. Each of these is tenant-scoped and needs:
1. EF Core global query filter (`HasQueryFilter(e => e.TenantId == tenantId)`)
2. PostgreSQL RLS policy in `scripts/rls-setup.sql`

If any table is missed, that table has no tenant isolation at the database level. The EF Core filter provides Layer 2 protection, but a raw SQL query or a bug bypassing the filter would expose all tenants' data.

**Prevention:**
1. **Checklist for every new entity:**
   - [ ] Entity has `TenantId` property (Guid, non-nullable)
   - [ ] `ApplicationDbContext.OnModelCreating` adds `HasQueryFilter(e => e.TenantId == _tenantId)`
   - [ ] `scripts/rls-setup.sql` has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`
   - [ ] Migration sets `tenant_id` column as NOT NULL with no default
   - [ ] Integration test verifies tenant isolation
2. **Automated verification:** Add a startup check or integration test that queries `pg_catalog.pg_policies` and verifies every tenant-scoped table has an RLS policy. Fail the test if any table is missing.
3. **Child table analysis:** Determine which new tables are "child tables" (accessed only via FK join from a tenant-filtered parent) and which are "root tables" (queried directly). Root tables need RLS; child tables may not if they are always accessed through a filtered parent. Document the decision for each table.

**Detection:**
- CI/CD check: compare the list of tables with `tenant_id` column against the list of tables with RLS policies. Any mismatch fails the build.
- Code review checklist: every PR adding a new entity must include both the EF Core filter and the RLS policy update.

**Feature:** All features
**Phase to address:** Every phase that introduces new entities -- verify as part of each phase's implementation.

---

### Pitfall 19: Workflow and Email Sequence State Management Across Deployments

**What goes wrong:** A deployment restarts the application while:
- A workflow execution chain is mid-flight (3 of 5 actions completed)
- An email sequence has 500 contacts waiting for their "Day 3" email to send
- A webhook delivery retry is queued for the 3rd attempt

If these are stored only in memory (in-process queues, `Channel<T>`, or in-memory state), they are lost on deployment. If they are in a database but without proper status tracking, they may be replayed from the beginning (sending duplicate emails, executing duplicate workflow actions).

**Prevention:**
1. **Persist all execution state to the database:**
   - Workflow executions: each action has a `status` (pending, running, completed, failed) persisted to the database. On restart, resume from the last incomplete action.
   - Email sequence enrollments: each step has a `scheduledAt`, `sentAt`, `status`. On restart, the scheduler picks up steps where `status = 'pending' AND scheduledAt <= now`.
   - Webhook deliveries: each delivery attempt is persisted with `attemptNumber`, `status`, `nextRetryAt`. On restart, retry failed deliveries where `nextRetryAt <= now`.
2. **Idempotent execution:** Every action must be safe to execute twice (in case the process crashes after executing but before marking as "completed"). Use idempotency keys (e.g., `{workflowExecutionId}_{actionIndex}`) to deduplicate.
3. **Graceful shutdown:** On `IHostApplicationLifetime.ApplicationStopping`, drain the in-process queue. Wait up to 30 seconds for running jobs to complete. Mark incomplete jobs as "interrupted" for restart pickup.
4. **Do not use in-memory-only queues for critical work:** Use a persistent queue (database table, Redis, or Hangfire storage). `Channel<T>` is acceptable only for non-critical, fire-and-forget work (like SignalR event buffering).

**Feature:** Workflow Automation, Email Sequences, Webhooks
**Phase to address:** Each feature's phase -- but design the persistence pattern once and reuse it.

---

### Pitfall 20: Angular Frontend Performance with Complex Workflow/Report Builders

**What goes wrong:** The workflow builder UI (drag-and-drop trigger/action configuration) and the report builder UI (entity picker, field selector, filter builder, preview) are complex interactive components. Common Angular-specific issues:
- **Change detection storms:** The workflow builder renders a visual graph with many nodes. Each node is a component. A single workflow change triggers change detection on every node component, causing jank.
- **Memory leaks:** The report preview subscribes to data streams. If the user navigates away without the subscription being cleaned up, the subscription continues running, accumulating memory.
- **Signal Store bloat:** Putting the entire workflow definition (with potentially 50+ actions) into a Signal Store causes excessive signal emissions on any change, since Angular signals emit on every mutation.

**Prevention:**
1. **OnPush everywhere** (already the convention -- maintain it for all new components).
2. **Isolate builder state:** Use local component state for the builder's transient UI state (drag positions, hover states). Use the Signal Store only for the persisted workflow/report definition.
3. **Immutable updates:** When updating a workflow action, create a new array reference (not mutate in place) so Angular's change detection can quickly determine what changed.
4. **Debounce auto-save:** If the builder auto-saves on change, debounce by 2 seconds to avoid rapid API calls during drag-and-drop.
5. **Virtual scrolling for report results:** Use `CdkVirtualScrollViewport` for report result tables with 10,000+ rows. Do not render all rows to the DOM.
6. **Cleanup:** Use `DestroyRef` and `takeUntilDestroyed()` for all subscriptions in builder components. For `effect()`, Angular handles cleanup automatically, but verify with the component's `OnDestroy`.

**Feature:** Workflow Automation, Advanced Reporting Builder
**Phase to address:** Each feature's frontend implementation phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Email Templates & Sequences | Timing drift, deliverability collapse from bulk sends, sending to deleted/merged contacts | Jittered send times, per-tenant rate limits, pre-send validation checks (Pitfalls 7, 13) |
| Formula/Computed Fields | Circular dependencies crash the system, stale values in reports, deletion of referenced fields | Dependency graph with cycle detection at save time, topological evaluation order (Pitfalls 6, 15) |
| Workflow Automation | Infinite loops exhaust system resources, bypass RBAC, SignalR broadcast storm | Execution context tracking with depth limits, admin-only management, event batching (Pitfalls 1, 8, 10, 17) |
| Duplicate Detection & Merge | Data loss from broken FK references, false positives frustrate users | Comprehensive FK map, soft-delete with redirect, confidence scoring (Pitfalls 4, 12) |
| Webhooks | SSRF attacks, retry storms overwhelm system, sensitive data leakage | URL validation with IP filtering, circuit breakers, minimal payload defaults (Pitfalls 5, 9, 14) |
| Advanced Reporting Builder | Tenant data leakage through query filter bypass, N+1 queries, unbounded joins | LINQ-only construction, query complexity limits, statement timeouts (Pitfalls 3, 11, 16) |
| All Features (cross-cutting) | Tenant context loss in background jobs, missing RLS on new tables, state loss on deployment | TenantScope wrapper, RLS checklist, persistent execution state (Pitfalls 2, 18, 19) |

---

## Integration Pitfalls with Existing Architecture

### Integration 1: New Features Must Integrate with Existing NotificationDispatcher

All v1.1 features should dispatch notifications through the existing `NotificationDispatcher` (DB + SignalR + optional email). But workflow actions that create many entities in a loop will call `DispatchAsync` many times, hitting the database on each call. Batch notification creation or defer notifications to after the workflow execution completes.

### Integration 2: New Features Must Set Correct Feed Items

v1.0 creates `FeedItem` records for entity changes. Workflow-initiated changes should create feed items attributed to the workflow (not the system), with a note like "Updated by workflow 'Deal Close Automation'." Without this, the news feed becomes confusing ("System updated 50 records" with no context).

### Integration 3: Custom Field Validator Must Handle Formula Fields

The existing `CustomFieldValidator` validates user-provided custom field values against definitions. Formula/computed fields should be excluded from input validation (users do not provide values for them) but included in output serialization. The validator needs a new `IsComputed` check to skip validation for formula fields.

### Integration 4: Saved Views Must Support New Entity Types

If workflows, email templates, or reports become listable entities with their own list pages (likely for admin management), the `SavedView` system needs to support these new entity types for column configuration, filtering, and sorting.

### Integration 5: EF Core Migration Ordering

v1.1 will add many new tables. Migrations must be ordered carefully to avoid FK reference errors. Create base tables (workflow_definitions) before dependent tables (workflow_executions, workflow_actions). Run migrations against both `ApplicationDbContext` and potentially `TenantDbContext` if any new tables are organization-level (like webhook rate limit configurations).

---

## Sources

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Hookdeck: Webhooks at Scale](https://hookdeck.com/blog/webhooks-at-scale)
- [Insycle: Data Retention When Merging Duplicates](https://blog.insycle.com/data-retention-merging-duplicates)
- [Inngest: Fixing Multi-Tenant Queueing Problems](https://www.inngest.com/blog/fixing-multi-tenant-queueing-concurrency-problems)
- [Microsoft: EF Core Multi-tenancy](https://learn.microsoft.com/en-us/ef/core/miscellaneous/multitenancy)
- [Microsoft: EF Core Global Query Filters](https://learn.microsoft.com/en-us/ef/core/querying/filters)
- [Microsoft: SignalR Performance](https://learn.microsoft.com/en-us/aspnet/signalr/overview/performance/signalr-performance)
- [Microsoft: DbContext Lifetime and Configuration](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/)
- [elmah.io: .NET 10 Multi-Tenant Rate Limiting](https://blog.elmah.io/new-in-net-10-and-c-14-multi-tenant-rate-limiting/)
- [Dynamics 365: Calculated Fields and Circular Dependencies](https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/customize/define-calculated-fields)
- [RT Dynamic: CRM Deduplication Guide 2025](https://www.rtdynamic.com/blog/crm-deduplication-guide-2025/)
- [Inogic: Duplicate Detection and Merge in Dynamics 365](https://www.inogic.com/blog/2025/10/step-by-step-guide-to-duplicate-detection-and-merge-rules-in-dynamics-365-crm/)
- [Hangfire Discussion: Multi-Tenant Architecture](https://discuss.hangfire.io/t/hangfire-multi-tenant-architecture-per-tenant-recurring-jobs-vs-dynamic-enqueueing-at-scale/11400)
- [Code Maze: Prevent SQL Injection with EF Core](https://code-maze.com/prevent-sql-injection-with-ef-core-dapper-and-ado-net/)
- Existing GlobCRM v1.0 codebase: `TenantDbConnectionInterceptor.cs`, `PermissionService.cs`, `CrmHub.cs`, `NotificationDispatcher.cs`, `CustomFieldValidator.cs`, `rls-setup.sql`
