# PITFALLS.md
Research: Critical Mistakes in Multi-Tenant SaaS CRM Projects

## Document Purpose
Identify domain-specific pitfalls for GlobCRM to prevent costly mistakes during development. Each pitfall includes warning signs, prevention strategies, and phase mapping.

---

## 1. Multi-Tenancy & Data Isolation

### P1.1: Tenant Data Leakage Through Inadequate Isolation
**Description:** Failing to enforce tenant boundaries at every data access layer, leading to cross-tenant data exposure.

**Warning Signs:**
- Database queries without tenant_id filters
- Global search features that span tenants
- Cached data without tenant context
- Shared worker queues processing without tenant validation
- API endpoints that don't validate tenant ownership

**Prevention Strategy:**
- Implement tenant_id as mandatory filter in all queries (Row-Level Security in PostgreSQL)
- Create base repository pattern that automatically injects tenant context
- Use PostgreSQL policies to enforce tenant isolation at database level
- Add integration tests that attempt cross-tenant access
- Implement tenant context middleware that validates every request
- Never rely solely on application-level filtering

**Phase to Address:** Foundation (Phase 1) - must be architectural from day one

**Impact if Ignored:** Critical security breach, regulatory violations (GDPR, SOC 2), complete loss of customer trust

---

### P1.2: Shared Schema Performance Degradation
**Description:** Single shared schema becomes bottleneck as tenant count and data volume grow, especially with JSONB custom fields.

**Warning Signs:**
- Query performance degrades as tenant count increases
- Index bloat affecting all tenants
- Long-running queries from one tenant impacting others
- Table statistics becoming unreliable
- Vacuum operations taking excessive time

**Prevention Strategy:**
- Design partitioning strategy from start (partition by tenant_id or tenant ranges)
- Implement proper JSONB indexing (GIN/GiST indexes on custom field paths)
- Monitor query performance per tenant with pg_stat_statements
- Set up connection pooling with tenant-aware routing
- Establish per-tenant resource limits
- Plan for schema sharding when tenant count exceeds threshold (typically 1000+ active tenants)

**Phase to Address:** Foundation (Phase 1) for architecture, Early Expansion (Phase 2) for monitoring

**Impact if Ignored:** System-wide slowdowns, "noisy neighbor" problems, inability to scale

---

## 2. Custom Fields & Dynamic Schema

### P2.1: JSONB Query Performance Hell
**Description:** Treating JSONB as schemaless storage without proper indexing and query optimization leads to full table scans.

**Warning Signs:**
- Filter/search operations on custom fields are slow
- Reports with custom field criteria timeout
- Inability to use custom fields in complex queries
- Missing or incorrect index usage in EXPLAIN plans
- Users complaining about search performance

**Prevention Strategy:**
- Create GIN indexes on JSONB columns: `CREATE INDEX idx_contacts_custom ON contacts USING gin (custom_fields jsonb_path_ops);`
- Index frequently-queried paths: `CREATE INDEX idx_custom_email ON contacts USING btree ((custom_fields->>'email_verified'));`
- Limit custom field nesting depth (max 2-3 levels)
- Implement custom field type validation at application layer
- Cache custom field definitions and validation rules
- Consider materialized views for frequently-queried custom field combinations
- Document performance implications of custom field usage

**Phase to Address:** Foundation (Phase 1) for indexing strategy, Core CRM (Phase 2) for optimization

**Impact if Ignored:** Unusable custom fields, user frustration, inability to scale beyond small datasets

---

### P2.2: Uncontrolled Custom Field Proliferation
**Description:** Allowing unlimited custom fields without governance leads to schema chaos and maintenance nightmares.

**Warning Signs:**
- Hundreds of custom fields per entity
- Duplicate or abandoned custom fields
- Inconsistent data types across similar fields
- Performance degradation from JSONB document size
- Import/export operations failing due to field count

**Prevention Strategy:**
- Set reasonable limits per entity (e.g., 50-100 custom fields)
- Implement custom field lifecycle management (active/deprecated/archived)
- Require field naming conventions and descriptions
- Build custom field usage analytics
- Provide field deduplication detection
- Charge for custom fields beyond base limit (business constraint)
- Regular audit and cleanup processes

**Phase to Address:** Core CRM (Phase 2) for limits, Early Expansion (Phase 3) for governance

**Impact if Ignored:** Unmaintainable system, data quality issues, poor user experience

---

### P2.3: Type System Mismatch Between Custom Fields and Operations
**Description:** Treating all custom fields as strings instead of maintaining type fidelity breaks filtering, sorting, and business logic.

**Warning Signs:**
- Date custom fields sorted alphabetically
- Numeric calculations failing on custom number fields
- Boolean fields requiring string comparison
- Inability to use standard UI controls for typed fields
- Data validation happening too late (at query time vs entry time)

**Prevention Strategy:**
- Define explicit type system for custom fields (string, number, date, boolean, picklist, lookup, etc.)
- Store type metadata separately from field values
- Validate and coerce data at write time
- Generate appropriate UI controls based on field type
- Cast JSONB values properly in queries: `(custom_fields->>'age')::integer`
- Implement type-aware comparison operators

**Phase to Address:** Foundation (Phase 1) - core to custom field architecture

**Impact if Ignored:** Broken user workflows, unreliable data, poor reporting

---

## 3. RBAC & Security

### P3.1: Over-Simplified Permission Model
**Description:** Implementing only role-based access without field-level, record-level, or action-level granularity.

**Warning Signs:**
- All or nothing access to entities
- Cannot hide sensitive fields (salary, personal data) from some roles
- Cannot restrict access to specific records (territory-based, hierarchy-based)
- Permissions hardcoded in UI rather than enforced at API layer
- Workarounds like duplicate entities for different access levels

**Prevention Strategy:**
- Implement layered permission model:
  - Role-based (who can access what entities)
  - Field-level (hide/view/edit specific fields)
  - Record-level (ownership, territory, hierarchy rules)
  - Action-level (create, read, update, delete, share, export)
- Design permission evaluation engine that combines all layers
- Cache permission matrices per user session
- Enforce permissions at database view layer where possible
- Build permission inheritance model (roles → teams → individuals)
- Include permission context in all API responses

**Phase to Address:** Foundation (Phase 1) for architecture, Core CRM (Phase 2) for field-level

**Impact if Ignored:** Inflexible security model, cannot meet enterprise requirements, security gaps

---

### P3.2: Missing Audit Trail for Permission Changes
**Description:** Not tracking who changed permissions/roles and when, making security audits impossible.

**Warning Signs:**
- Cannot answer "who gave X access to Y?"
- No record of permission escalation events
- Compliance audit failures
- Inability to detect insider threats
- No rollback capability for permission changes

**Prevention Strategy:**
- Implement comprehensive audit logging for all permission operations
- Track: user, timestamp, action, before/after state, reason/justification
- Include permission changes in general audit trail system
- Create alerts for suspicious permission changes (admin role grants, bulk changes)
- Build audit trail UI for security admins
- Immutable audit log (append-only, separate database)
- Retain audit data according to compliance requirements

**Phase to Address:** Core CRM (Phase 2) for basic audit, Early Expansion (Phase 3) for advanced analytics

**Impact if Ignored:** Compliance failures, security breaches undetected, no accountability

---

### P3.3: Race Conditions in Permission Checks
**Description:** Permission evaluated at read time but changed before write time, creating security gaps in multi-user scenarios.

**Warning Signs:**
- Users reporting they "lost access" to records they're actively editing
- Permission checks passing in UI but failing at save
- Data corruption from concurrent permission changes
- Optimistic locking failures related to permission changes

**Prevention Strategy:**
- Implement permission tokens with short TTL
- Re-validate permissions at write time
- Use optimistic locking with permission version tracking
- Return permission context with data reads
- Handle permission denials gracefully with user feedback
- Implement WebSocket notifications for permission changes affecting active sessions

**Phase to Address:** Core CRM (Phase 2) - before multi-user workflows mature

**Impact if Ignored:** Security vulnerabilities, poor user experience, data integrity issues

---

## 4. Email Integration

### P4.1: Email Sync Data Volume Explosion
**Description:** Syncing entire email history for all users without filtering strategy overwhelms storage and processing.

**Warning Signs:**
- Database size growing exponentially
- Email sync taking hours per user
- Storage costs skyrocketing
- Search and filter operations timing out
- Users with large mailboxes (100k+ emails) breaking the system

**Prevention Strategy:**
- Implement smart sync policies:
  - Only sync emails from/to CRM contacts
  - Date range limits (e.g., last 6 months active, older archived)
  - Size limits per email
  - Selective folder sync (exclude trash, spam)
- Provide user controls for sync preferences
- Implement incremental sync with change detection
- Archive old emails to cold storage
- Set up email attachment storage with CDN
- Use separate database/schema for email data

**Phase to Address:** Early Expansion (Phase 3) - email sync is complex, don't rush it

**Impact if Ignored:** Unsustainable storage costs, system performance degradation, failed syncs

---

### P4.2: Email Threading and Deduplication Failures
**Description:** Poor email threading logic creates duplicate records and broken conversation views.

**Warning Signs:**
- Same email appearing multiple times
- Broken reply chains
- Unable to trace conversation history
- Multiple CRM records for single conversation
- Email associations to wrong contacts/deals

**Prevention Strategy:**
- Use proper email threading identifiers:
  - Message-ID header (unique identifier)
  - In-Reply-To header (parent message)
  - References header (entire thread)
  - Subject line normalization (Re:, Fwd: handling)
- Implement deduplication at sync time
- Build conversation reconstruction algorithm
- Store email relationships (replied_to, forwarded_from)
- Handle edge cases (multiple recipients, cross-thread replies)
- Test with real-world email data (Gmail threads, Outlook conversations)

**Phase to Address:** Early Expansion (Phase 3) - critical for email feature quality

**Impact if Ignored:** Confusing UX, duplicate data, lost context, poor adoption

---

### P4.3: OAuth Token Management and Refresh Failures
**Description:** Poor handling of OAuth token expiration and refresh leads to constant re-authentication requests.

**Warning Signs:**
- Users constantly asked to reconnect email
- Sync failures with "authentication required" errors
- Token refresh failing silently
- No notification when email connection breaks
- Security tokens stored insecurely

**Prevention Strategy:**
- Implement robust token refresh mechanism:
  - Proactive refresh before expiration
  - Retry logic with exponential backoff
  - Graceful degradation when refresh fails
- Encrypt tokens at rest (never plain text)
- Monitor token health per user
- Notify users of auth failures with clear re-auth flow
- Implement token revocation handling
- Test token edge cases (revoked access, password change, 2FA changes)
- Handle provider-specific quirks (Gmail vs Outlook token lifetimes)

**Phase to Address:** Early Expansion (Phase 3) - before email beta

**Impact if Ignored:** User frustration, broken email sync, support burden, security risks

---

### P4.4: Email Parsing and Sanitization Vulnerabilities
**Description:** Inadequate email content parsing and sanitization creates XSS vulnerabilities and rendering issues.

**Warning Signs:**
- Email HTML breaking CRM UI
- Script execution in email content
- Broken email formatting
- CSS from emails affecting application styles
- Email attachments with malicious content not detected

**Prevention Strategy:**
- Use battle-tested HTML sanitization library (DOMPurify, HtmlSanitizer)
- Strip/sandbox JavaScript completely
- Isolate email rendering in iframe sandbox
- Remove external CSS/images by default (user opt-in for privacy)
- Implement Content Security Policy for email viewer
- Scan attachments with anti-virus API before storage
- Limit email HTML features (no plugins, objects, forms)
- Test with known malicious email samples

**Phase to Address:** Early Expansion (Phase 3) - security critical before launch

**Impact if Ignored:** XSS attacks, security breaches, UI corruption, compliance violations

---

## 5. Real-Time Features (SignalR)

### P5.1: Connection State Management Chaos
**Description:** Poor handling of connection lifecycle (disconnects, reconnects, duplicate connections) breaks real-time features.

**Warning Signs:**
- Users receiving duplicate notifications
- Notifications not arriving after page refresh
- Memory leaks from abandoned connections
- Users stuck in "connecting" state
- Notification delivery inconsistent

**Prevention Strategy:**
- Implement connection state machine (connecting, connected, reconnecting, disconnected)
- Store connection mapping (user → connection IDs) with TTL
- Clean up stale connections automatically
- Implement connection groups by tenant for isolation
- Add client-side reconnection logic with exponential backoff
- Handle page visibility API (pause notifications when tab hidden)
- Test connection edge cases (network switch, sleep/wake, browser background)
- Implement heartbeat/keepalive mechanism

**Phase to Address:** Core CRM (Phase 2) for basic notifications, Early Expansion (Phase 3) for robustness

**Impact if Ignored:** Unreliable notifications, resource leaks, poor user experience

---

### P5.2: Real-Time Update Race Conditions
**Description:** Concurrent updates from multiple users create conflicting UI state and data corruption.

**Warning Signs:**
- Users overwriting each other's changes
- UI showing stale data after real-time update
- Optimistic UI updates not rolling back on failure
- Merge conflicts not detected or resolved
- "Lost update" problem in concurrent editing

**Prevention Strategy:**
- Implement optimistic concurrency control:
  - Version numbers or timestamps on all entities
  - Detect conflicts on save (version mismatch)
  - Provide merge conflict resolution UI
- Use operational transformation or CRDTs for collaborative editing
- Send full object version with real-time updates
- Implement client-side state reconciliation
- Show "user X is editing" indicators
- Add record locking for critical operations
- Test with multiple concurrent users

**Phase to Address:** Core CRM (Phase 2) - critical for data integrity

**Impact if Ignored:** Data loss, user frustration, data integrity issues

---

### P5.3: Real-Time Performance Degradation
**Description:** Broadcasting updates to all connected clients scales poorly, overwhelming servers and clients.

**Warning Signs:**
- SignalR server CPU spikes
- Client browsers freezing during high activity
- Notification delays increasing with user count
- Memory usage growing with active connections
- Message queues backing up

**Prevention Strategy:**
- Implement smart filtering at server side:
  - Only send updates user has permission to see
  - Filter by user's active view/context
  - Group notifications (batch updates every N seconds)
- Use SignalR groups/channels efficiently:
  - Tenant-level groups
  - Entity-level groups (contact_123_watchers)
  - Activity-level groups (deal_pipeline_viewers)
- Implement client-side throttling/debouncing
- Use binary protocols for large payloads
- Consider message queue (RabbitMQ, Redis) for high-volume scenarios
- Set up SignalR scale-out (Redis backplane) early
- Monitor message delivery latency

**Phase to Address:** Core CRM (Phase 2) for architecture, Early Expansion (Phase 3) for scale-out

**Impact if Ignored:** System slowdown under load, poor user experience, scaling limitations

---

## 6. Deal Pipeline & Workflow

### P6.1: Hardcoded Pipeline Stages
**Description:** Pipeline stages and rules hardcoded instead of configurable, preventing customization.

**Warning Signs:**
- Cannot add/remove/rename pipeline stages
- Stage transition rules in application code
- Different industries require different pipelines
- Validation rules hardcoded per stage
- Cannot have multiple pipelines

**Prevention Strategy:**
- Design pipeline configuration system from start:
  - Stages as data (name, order, color, rules)
  - Transition rules as data (allowed moves, required fields, automation triggers)
  - Multiple pipelines per tenant
  - Stage-specific field requirements
- Build pipeline designer UI
- Store pipeline configuration in database
- Implement validation engine that reads pipeline rules
- Support pipeline templates for common industries
- Version pipeline changes (don't break historical data)

**Phase to Address:** Core CRM (Phase 2) - core feature differentiator

**Impact if Ignored:** Inflexible product, cannot address diverse markets, competitive disadvantage

---

### P6.2: Lost Activity History During Pipeline Changes
**Description:** Reconfiguring pipelines corrupts historical data and reporting.

**Warning Signs:**
- Reports breaking after pipeline stage rename
- Historical deals showing deleted stage names
- Trend analysis impossible across pipeline changes
- Deal age calculations incorrect
- Stage transition history lost

**Prevention Strategy:**
- Separate current state from history:
  - Store stage history with timestamps (deal moved from A → B on date X)
  - Reference stage definitions by ID, not name
  - Keep deleted stages in database (soft delete)
  - Version pipeline configurations
- Build migration tools for pipeline changes
- Provide "effective date" for pipeline changes (don't retroactively apply)
- Historical reports use stage names as of that time period
- Warn admins about reporting impact of pipeline changes

**Phase to Address:** Core CRM (Phase 2) - before pipeline customization

**Impact if Ignored:** Lost historical data, broken reporting, compliance issues

---

### P6.3: Activity Workflow State Machine Bugs
**Description:** Incomplete state machine for activities (tasks, meetings, calls) allows invalid state transitions.

**Warning Signs:**
- Completed tasks being edited
- Deleted activities still appearing
- Status inconsistencies (completed but no completion date)
- Notification logic failing due to unexpected states
- Cannot track activity lifecycle properly

**Prevention Strategy:**
- Define explicit state machine for each activity type:
  - Valid states: planned, in_progress, completed, cancelled, deleted
  - Valid transitions: planned → in_progress → completed
  - Immutable transitions (completed cannot go back to planned)
  - Required fields per state (completed requires outcome, duration)
- Implement state transition validation at API layer
- Audit all state changes
- Use database constraints where possible: `CHECK (completed_at IS NOT NULL OR status != 'completed')`
- Build state machine visualization for developers
- Test all possible state transitions

**Phase to Address:** Core CRM (Phase 2) - before workflow features launch

**Impact if Ignored:** Data inconsistencies, broken business logic, poor reporting

---

## 7. Performance & Scalability

### P7.1: N+1 Query Problem with Custom Fields and Relationships
**Description:** Loading lists of records triggers hundreds of additional queries for custom fields, relationships, and permissions.

**Warning Signs:**
- Page load times increase linearly with record count
- Database connection pool exhaustion
- Hundreds of queries for single page load
- API response times over 1-2 seconds for list views
- Database CPU spikes during list loads

**Prevention Strategy:**
- Implement eager loading for relationships:
  - Use EF Core Include() for related entities
  - Batch load custom field definitions
  - Prefetch permissions for current user
- Use data loader pattern for GraphQL-style batching
- Implement query result caching (Redis)
- Build materialized views for common list queries
- Use pagination with proper cursor-based or offset pagination
- Monitor query patterns with Application Insights
- Set up query performance budgets (alerts if queries > threshold)

**Phase to Address:** Foundation (Phase 1) for architecture, Core CRM (Phase 2) for optimization

**Impact if Ignored:** Slow application, poor user experience, inability to scale

---

### P7.2: Missing Database Indexing Strategy
**Description:** Inadequate indexes on foreign keys, filter columns, and sort columns causing full table scans.

**Warning Signs:**
- Queries taking seconds instead of milliseconds
- Database CPU consistently high
- EXPLAIN plans showing Seq Scan
- Filters on common fields (status, owner, created_date) slow
- Search functionality unusable

**Prevention Strategy:**
- Index all foreign keys automatically: `tenant_id, created_by, owner_id, account_id, contact_id`
- Index all filter/search columns: `status, stage, type, category`
- Create composite indexes for common filter combinations: `(tenant_id, status, created_at)`
- Index JSONB paths for custom fields (covered in P2.1)
- Create partial indexes for filtered queries: `CREATE INDEX ON deals (tenant_id, amount) WHERE status = 'open';`
- Monitor unused indexes (remove to reduce write overhead)
- Set up pg_stat_statements for query analysis
- Regular VACUUM and ANALYZE maintenance
- Include covering indexes for common queries

**Phase to Address:** Foundation (Phase 1) for core indexes, ongoing optimization throughout

**Impact if Ignored:** Unusable application at scale, poor performance from day one

---

### P7.3: Unbounded Result Sets
**Description:** API endpoints returning unlimited records without pagination or result limits.

**Warning Signs:**
- Endpoints timing out with large datasets
- OOM exceptions on server
- Client browsers freezing rendering large lists
- Export operations failing
- Search returning thousands of results

**Prevention Strategy:**
- Enforce pagination on all list endpoints (default 50, max 200)
- Implement cursor-based pagination for real-time data
- Return total count separately (cheap count estimation for large sets)
- Implement "load more" / infinite scroll patterns
- Add result limits to all queries (safety net)
- Build async export for large datasets (email download link)
- Implement result set warnings ("showing 200 of 5000 results")
- Use streaming for large data operations

**Phase to Address:** Foundation (Phase 1) - API design principle

**Impact if Ignored:** Performance issues, scalability limits, poor UX

---

## 8. Data Quality & Integrity

### P8.1: Missing Data Validation at API Layer
**Description:** Relying on UI validation alone allows bad data through API, imports, and integrations.

**Warning Signs:**
- Invalid email addresses in database
- Phone numbers in inconsistent formats
- Required fields null despite UI requirements
- Date ranges inverted (end before start)
- Negative amounts in currency fields

**Prevention Strategy:**
- Implement validation at multiple layers:
  - Client-side (immediate feedback)
  - API/controller level (fluent validation)
  - Business logic layer (complex rules)
  - Database constraints (last resort)
- Use .NET FluentValidation for API validation
- Define validation rules per entity type
- Return clear validation error messages
- Validate custom fields based on type metadata
- Implement cross-field validation (end_date > start_date)
- Test API validation independently of UI

**Phase to Address:** Foundation (Phase 1) - before any data entry

**Impact if Ignored:** Data quality problems, broken business logic, reporting issues

---

### P8.2: Soft Delete Without Proper Handling
**Description:** Soft deletes not properly filtered in queries, causing "deleted" records to appear.

**Warning Signs:**
- Deleted records showing in lists
- Count operations including deleted records
- Foreign key references to deleted records breaking
- Search returning deleted items
- Audit trail showing resurrections

**Prevention Strategy:**
- Implement consistent soft delete pattern:
  - `deleted_at` timestamp column
  - Global query filter in EF Core: `builder.HasQueryFilter(e => e.DeletedAt == null)`
  - Explicit `IgnoreQueryFilters()` when need deleted records
- Create separate endpoints for "trash" view
- Implement permanent delete (hard delete after retention period)
- Handle cascading soft deletes carefully
- Audit soft delete and restore operations
- Consider archive table approach for old deleted data

**Phase to Address:** Foundation (Phase 1) - data architecture decision

**Impact if Ignored:** Data integrity issues, confusing UX, broken business logic

---

### P8.3: Inconsistent Duplicate Detection
**Description:** No or inconsistent duplicate detection leads to redundant records and data quality issues.

**Warning Signs:**
- Multiple contact records for same person
- Duplicate companies with slight name variations
- Merge operations required frequently
- Data quality degrading over time
- Import operations creating duplicates

**Prevention Strategy:**
- Implement duplicate detection:
  - Fuzzy matching on key fields (name, email, phone)
  - Show potential duplicates before save
  - Background duplicate detection job
  - Merge workflow with conflict resolution
  - Track merge history (merged_into_id)
- Use algorithms appropriate to field type:
  - Email: exact match (normalized)
  - Name: Levenshtein distance, Soundex
  - Phone: normalized comparison
  - Address: component-wise fuzzy match
- Provide admin tools for mass deduplication
- Set unique constraints where appropriate
- Implement data quality scoring

**Phase to Address:** Core CRM (Phase 2) for basic detection, Early Expansion (Phase 3) for advanced

**Impact if Ignored:** Poor data quality, user frustration, reporting inaccuracy

---

## 9. Integration & API Design

### P9.1: No API Versioning Strategy
**Description:** Breaking API changes without versioning destroys integrations and third-party apps.

**Warning Signs:**
- Integration partners complaining about broken integrations
- Cannot deploy changes without coordinating with all API consumers
- No way to deprecate old endpoints
- API documentation out of sync with reality
- Fear of making any API changes

**Prevention Strategy:**
- Implement API versioning from day one:
  - URL-based: `/api/v1/contacts`, `/api/v2/contacts`
  - Or header-based: `API-Version: 2`
- Semantic versioning for breaking vs non-breaking changes
- Maintain at least 2 versions simultaneously
- Clear deprecation policy (6-12 month sunset window)
- Document all breaking changes in migration guide
- Return API version in response headers
- Monitor version usage metrics
- Automated tests for version compatibility

**Phase to Address:** Foundation (Phase 1) - API design principle

**Impact if Ignored:** Cannot evolve product, broken integrations, angry partners

---

### P9.2: Inadequate Rate Limiting
**Description:** No or poor rate limiting allows resource exhaustion and DDoS vulnerabilities.

**Warning Signs:**
- Single user/integration consuming all resources
- API becoming unresponsive under load
- Database connection pool exhaustion
- Legitimate users impacted by one bad actor
- High hosting costs from abuse

**Prevention Strategy:**
- Implement multi-tier rate limiting:
  - Per API key: 1000 requests/hour
  - Per user: 100 requests/minute
  - Per tenant: 10000 requests/hour
  - Per endpoint: specific limits (search more restrictive than read)
- Use Redis for distributed rate limiting
- Return rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Implement exponential backoff guidance
- Different limits per plan tier (free, pro, enterprise)
- Allow rate limit increase requests
- Monitor and alert on rate limit hits
- Document rate limits clearly

**Phase to Address:** Foundation (Phase 1) for basic limits, Early Expansion (Phase 3) for sophistication

**Impact if Ignored:** Resource exhaustion, downtime, high costs, DDoS vulnerability

---

### P9.3: Webhook Delivery Failures and Retries
**Description:** Webhook integrations fail silently or retry improperly, losing events.

**Warning Signs:**
- Integration partners reporting missing events
- Events sent multiple times (idempotency issues)
- No visibility into webhook delivery status
- Webhooks failing permanently after transient errors
- Webhook queues backing up

**Prevention Strategy:**
- Implement robust webhook system:
  - Async delivery with job queue
  - Retry with exponential backoff (3 attempts over 1 hour)
  - Dead letter queue for permanent failures
  - Webhook delivery status tracking (sent, delivered, failed)
  - Event ordering guarantees where needed
- Support webhook signatures (HMAC) for security
- Provide webhook testing tools
- Build webhook monitoring dashboard
- Implement webhook replay functionality
- Timeout webhook calls (5-10 seconds max)
- Allow webhook filtering (only relevant events)

**Phase to Address:** Early Expansion (Phase 3) - when integration ecosystem grows

**Impact if Ignored:** Unreliable integrations, lost events, support burden

---

## 10. Testing & Quality Assurance

### P10.1: Insufficient Multi-Tenancy Testing
**Description:** Testing only with single tenant misses critical isolation and cross-tenant bugs.

**Warning Signs:**
- Cross-tenant data leakage found in production
- Performance issues when multiple tenants active
- Tenant-specific features breaking other tenants
- Cannot reproduce bugs without specific tenant data

**Prevention Strategy:**
- Multi-tenant test strategy:
  - Every integration test runs with multiple tenants
  - Test data includes tenant_a and tenant_b data
  - Assert queries never return cross-tenant data
  - Test concurrent operations across tenants
  - Test with different tenant configurations
- Build tenant isolation verification tests
- Test tenant-specific customizations don't bleed
- Performance test with realistic tenant distribution
- Chaos engineering: random tenant data injection
- Automated security scanning for tenant isolation

**Phase to Address:** Foundation (Phase 1) - testing strategy from start

**Impact if Ignored:** Security breaches, data leakage, hard-to-reproduce bugs

---

### P10.2: Missing Performance Testing
**Description:** No performance testing until production reveals scalability issues.

**Warning Signs:**
- Production slowdowns surprise team
- No baseline for performance comparison
- Cannot identify performance regressions
- Scaling up doesn't improve performance
- Database becomes bottleneck unexpectedly

**Prevention Strategy:**
- Implement performance testing:
  - Load testing with realistic data volumes (100k contacts, 1M activities)
  - Stress testing to find breaking points
  - Endurance testing (memory leaks, connection leaks)
  - Spike testing (sudden traffic increase)
- Use tools: k6, JMeter, or Azure Load Testing
- Performance test critical paths:
  - List views with filters
  - Search operations
  - Report generation
  - Email sync operations
  - Real-time notification delivery
- Set performance budgets (e.g., list views < 500ms)
- Automated performance tests in CI/CD
- Monitor performance trends over time

**Phase to Address:** Core CRM (Phase 2) before beta, ongoing throughout

**Impact if Ignored:** Production performance crises, cannot scale, poor user experience

---

### P10.3: Inadequate Email Integration Testing
**Description:** Email sync not tested with real-world email complexity and edge cases.

**Warning Signs:**
- Email sync breaking with certain providers
- Specific email formats causing errors
- Character encoding issues in production
- Attachment handling failures
- Threading breaking with real emails

**Prevention Strategy:**
- Build comprehensive email test suite:
  - Real email samples from Gmail, Outlook, other providers
  - Edge cases: huge emails, special characters, attachments
  - Malformed emails (test error handling)
  - Various MIME types and encodings
  - Email with embedded images, HTML complexity
  - Thread reconstruction scenarios
- Test OAuth flows completely:
  - Initial auth, token refresh, revocation
  - Multi-account scenarios
  - Provider-specific quirks
- Use email testing sandbox (Mailtrap, Mailosaur)
- Test sync performance with large mailboxes
- Test incremental sync, full sync, error recovery

**Phase to Address:** Early Expansion (Phase 3) - before email beta

**Impact if Ignored:** Broken email integration, poor adoption, support burden

---

## 11. DevOps & Deployment

### P11.1: Missing Database Migration Strategy
**Description:** No proper database schema migration process leads to deployment failures and data loss.

**Warning Signs:**
- Deployments require manual database changes
- Schema drift between environments
- Rollback process unclear or impossible
- Data migrations losing data
- Downtime required for every schema change

**Prevention Strategy:**
- Use EF Core Migrations properly:
  - Version control all migrations
  - Test migrations against production-size data
  - Write both Up and Down migrations
  - Never edit existing migrations (create new ones)
  - Include data migrations where needed
- Implement zero-downtime deployment pattern:
  - Expand-contract pattern for schema changes
  - Deploy compatible schema first, then code
  - Add columns as nullable, fill data, then make required
- Test rollback procedures
- Backup before major migrations
- Monitor migration duration (alert if slow)
- Practice migrations in staging first

**Phase to Address:** Foundation (Phase 1) - before first deployment

**Impact if Ignored:** Deployment failures, data loss, extended downtime

---

### P11.2: Configuration Management Chaos
**Description:** Configuration scattered across multiple locations, hardcoded values, no environment parity.

**Warning Signs:**
- Different configuration format per component
- Secrets in source control
  - Cannot spin up new environment easily
- Configuration changes require code deploys
- No way to feature flag components

**Prevention Strategy:**
- Centralize configuration management:
  - Use Azure App Configuration or similar
  - Environment-specific overrides (dev, staging, prod)
  - Secrets in Azure Key Vault
  - Feature flags for gradual rollout
- Configuration as code:
  - Version controlled config structure
  - Validated configuration schema
  - Type-safe configuration classes in .NET
- Implement configuration hot reload where safe
- Document all configuration options
- Use managed identity for Azure resources
- Never commit secrets (use git-secrets or similar)

**Phase to Address:** Foundation (Phase 1) - infrastructure setup

**Impact if Ignored:** Security breaches, deployment friction, cannot scale operations

---

### P11.3: Inadequate Monitoring and Alerting
**Description:** No visibility into system health leads to outages discovered by users.

**Warning Signs:**
- Users reporting issues before team knows
- Cannot diagnose production issues
- No metrics on system performance
- Alerts missing or too noisy
- Cannot track user journeys through system

**Prevention Strategy:**
- Implement comprehensive observability:
  - Application Insights for .NET application monitoring
  - Structured logging (Serilog with tenant_id context)
  - Custom metrics for business operations
  - Distributed tracing across services
  - Real User Monitoring (RUM) for Angular app
- Set up meaningful alerts:
  - Error rate thresholds
  - Performance degradation
  - Dependency failures (database, email APIs)
  - Security events (failed auth, permission escalation)
- Build operational dashboards:
  - System health overview
  - Per-tenant metrics
  - Real-time operation tracking
- Implement log aggregation and search
- Set up on-call rotation and runbooks

**Phase to Address:** Foundation (Phase 1) for basics, continuous improvement

**Impact if Ignored:** Extended outages, poor incident response, cannot optimize

---

## 12. User Experience & Adoption

### P12.1: Over-Engineering Customization
**Description:** Making everything customizable creates overwhelming complexity and poor UX.

**Warning Signs:**
- Users confused by too many options
- Configuration taking weeks not hours
- Support overwhelmed with "how do I" questions
- Power users can use product, others cannot
- Customization options contradict each other

**Prevention Strategy:**
- Follow 80/20 rule: default configuration works for 80% of use cases
- Progressive disclosure: start simple, expose advanced features as needed
- Provide templates/presets for common scenarios
- Limit customization where it doesn't add value
- User testing with non-technical users
- "Opinionated defaults" philosophy
- Customization hierarchy: global → role → user
- Validation prevents conflicting configurations
- Reset to defaults option always available

**Phase to Address:** Core CRM (Phase 2) - UX design phase

**Impact if Ignored:** Poor adoption, high training cost, support burden

---

### P12.2: Missing Bulk Operations
**Description:** No bulk edit, bulk delete, or mass update capabilities forces tedious one-by-one operations.

**Warning Signs:**
- Users complaining about repetitive tasks
- Workarounds like export/import for updates
- Low productivity on data cleanup tasks
- Requests for bulk operations in every feedback session

**Prevention Strategy:**
- Design bulk operations from start:
  - Bulk select (all on page, all matching filter)
  - Bulk edit (update common fields)
  - Bulk delete (with confirmation)
  - Bulk ownership transfer
  - Bulk status change
  - Bulk tag/categorize
- Show progress for long-running bulk operations
- Implement undo/rollback for bulk operations
- Permission checks on bulk operations (might escalate to admin)
- Audit log bulk operations with details
- Background jobs for large bulk operations
- Preview changes before applying

**Phase to address:** Core CRM (Phase 2) - before productivity features

**Impact if Ignored:** User frustration, low productivity, poor adoption

---

### P12.3: Poor Mobile Experience
**Description:** Treating .NET MAUI mobile app as afterthought creates disconnected experience.

**Warning Signs:**
- Mobile app missing features in web app
- Inconsistent UX between web and mobile
- Mobile performance poor
- Mobile offline support missing
- Users avoiding mobile app

**Prevention Strategy:**
- Mobile-first API design:
  - Efficient payload sizes
  - Batch operations for multiple requests
  - Offline-capable endpoints
  - Mobile-specific endpoints where needed
- Progressive Web App (PWA) as fallback
- Shared data models between platforms
- Offline-first architecture with sync
- Mobile-specific features: camera for docs, contacts sync, push notifications
- Test on actual devices (not just emulators)
- Monitor mobile performance separately
- Mobile usage analytics

**Phase to Address:** Early Expansion (Phase 3) - when mobile app developed

**Impact if Ignored:** Poor mobile adoption, user frustration, competitive disadvantage

---

## Summary: Phase-Critical Pitfalls

### Must Address in Foundation (Phase 1):
- P1.1: Tenant data isolation architecture
- P1.2: Shared schema performance strategy
- P2.1: JSONB indexing strategy
- P2.3: Custom field type system
- P3.1: Permission model architecture
- P7.1: N+1 query prevention
- P7.2: Database indexing
- P7.3: API pagination
- P8.1: API validation
- P8.2: Soft delete pattern
- P9.1: API versioning
- P9.2: Basic rate limiting
- P10.1: Multi-tenant testing
- P11.1: Database migrations
- P11.2: Configuration management
- P11.3: Basic monitoring

### Must Address in Core CRM (Phase 2):
- P2.2: Custom field governance
- P3.2: Permission audit trail
- P3.3: Permission race conditions
- P5.1: Real-time connection management
- P5.2: Real-time race conditions
- P5.3: Real-time performance
- P6.1: Configurable pipelines
- P6.2: Pipeline change history
- P6.3: Activity state machine
- P8.3: Duplicate detection
- P10.2: Performance testing
- P12.1: Customization UX
- P12.2: Bulk operations

### Must Address in Early Expansion (Phase 3):
- P4.1: Email sync data strategy
- P4.2: Email threading
- P4.3: OAuth token management
- P4.4: Email sanitization
- P9.3: Webhook reliability
- P10.3: Email integration testing
- P12.3: Mobile experience

---

## Using This Document

**For Architecture Decisions:**
Review Phase 1 pitfalls before finalizing technical architecture. These are non-negotiable foundations.

**For Sprint Planning:**
Check relevant pitfalls when planning features. Prevention is cheaper than remediation.

**For Code Review:**
Reference specific pitfalls when reviewing risky areas (multi-tenancy, permissions, real-time).

**For Testing:**
Use pitfall warning signs as test case inspiration.

**For Incident Response:**
When production issues occur, check if they match known pitfall patterns.

---

*Document Version: 1.0*
*Last Updated: 2026-02-16*
*Research Focus: Multi-tenant SaaS CRM with dynamic custom fields, RBAC, email sync, real-time features*
