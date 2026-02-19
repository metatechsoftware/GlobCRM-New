# Phase 16: Duplicate Detection & Merge - Research

**Researched:** 2026-02-19
**Domain:** Fuzzy string matching, record merge with relationship transfer, PostgreSQL pg_trgm, admin configuration
**Confidence:** HIGH

## Summary

Phase 16 adds duplicate detection and merge for contacts and companies. The technical domain spans three areas: (1) fuzzy matching via a two-tier system of PostgreSQL pg_trgm for database-level candidate pre-filtering and FuzzySharp for nuanced in-memory scoring, (2) a merge engine that transfers all FK-based and polymorphic relationships from the losing record to the surviving record within a single transaction, and (3) admin-configurable matching rules stored as a tenant-scoped settings entity.

The codebase already has all the infrastructure needed: EF Core with Npgsql 10.0.0 (which includes built-in trigram function translations via `EF.Functions.TrigramsSimilarity()`), the DomainEventInterceptor for post-create event hooks, and established patterns for JSONB configuration entities (CustomFieldDefinition) and admin settings pages. The primary implementation risk is the merge operation's FK reference map -- the research identifies all 14+ FK/polymorphic references that must be transferred for contacts and 10+ for companies.

**Primary recommendation:** Use pg_trgm + FuzzySharp two-tier approach. pg_trgm GIN indexes pre-filter candidates at database level; FuzzySharp computes weighted composite scores in memory. The merge operation should execute as a single `SaveChangesAsync` transaction with direct DbContext operations (matching the Lead conversion pattern from Phase 13).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Matching Rules
- **Contact matching fields:** Name + Email (fuzzy name similarity AND exact/fuzzy email match)
- **Company matching fields:** Company name + domain (fuzzy name similarity AND website/email domain match)
- **Admin-configurable:** Admin settings page to toggle which fields participate in matching, set similarity threshold (e.g., 70%-90%), and enable/disable auto-detection per tenant
- **Scoring:** Confidence score + ranked list — show match percentage (e.g., 87% match) and sort results by confidence so users prioritize the highest-confidence duplicates first

#### Duplicate Warnings UX
- **Warning style:** Inline banner inside the create form (yellow/amber) showing potential matches — non-blocking, user can dismiss and continue creating
- **Trigger timing:** On blur of key fields (name, email for contacts; company name for companies) — immediate feedback without slowing typing
- **Warning content:** Show matching record(s) with name, email, and match score. Include clickable link to view the existing record
- **Scope:** Create forms only — editing existing records does NOT trigger duplicate warnings

#### Side-by-Side Comparison
- **Layout:** Two-column side-by-side on a full dedicated page (e.g., `/contacts/merge?ids=1,2`)
- **Difference highlighting:** Differing fields highlighted in amber/yellow. Matching fields shown in gray/muted
- **Field selection:** Radio buttons per field row — user clicks to pick which value survives on the merged record
- **Default primary:** Most recently updated record auto-selected as primary (surviving record). User can flip the default

#### Merge Behavior
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DUP-01 | System warns user of potential duplicates when creating a contact or company | On-blur API endpoint calls DuplicateDetectionService; inline banner component in create forms |
| DUP-02 | User can run an on-demand duplicate scan for contacts and companies | Dedicated scan page with DuplicateDetectionService batch mode; paginated results sorted by confidence |
| DUP-03 | Admin can configure matching rules and similarity thresholds | DuplicateMatchingConfig entity (tenant-scoped JSONB); admin settings page in settings hub |
| DUP-04 | System uses fuzzy matching (handles typos, name variations) for duplicate detection | Two-tier: pg_trgm GIN-indexed similarity() at DB level + FuzzySharp TokenSortRatio/WeightedRatio in memory |
| DUP-05 | User can view a side-by-side comparison of duplicate records | Full-page comparison component at /contacts/merge and /companies/merge with field-by-field radio selection |
| DUP-06 | User can merge duplicate contacts with relationship transfer to the surviving record | MergeService transfers 14+ FK/polymorphic references in single transaction; soft-delete with MergedIntoId |
| DUP-07 | User can merge duplicate companies with relationship transfer to the surviving record | MergeService transfers 10+ FK/polymorphic references in single transaction; soft-delete with MergedIntoId |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL pg_trgm | Built-in extension | Database-level trigram similarity with GIN indexing | Core PostgreSQL extension, no install needed, GIN indexes for fast fuzzy queries at scale |
| FuzzySharp | 2.0.2 | In-memory fuzzy string matching (Levenshtein, Jaro-Winkler, token sort) | Stable C# port of proven Python FuzzyWuzzy; provides weighted multi-field scoring |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.0 (existing) | EF Core trigram function translations | Already installed; includes `EF.Functions.TrigramsSimilarity()` -- no additional package needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Angular Material Dialog | Existing | Merge confirmation dialog | Pre-merge summary with counts |
| Angular Material Radio | Existing | Field selection in comparison UI | Per-field radio buttons for value selection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_trgm + FuzzySharp | pg_trgm only | Trigram similarity is a blunt instrument; misses transpositions ("John Smith" vs "Smith, John") and partial matches |
| pg_trgm + FuzzySharp | FuzzySharp only | Cannot run at database level; would require loading all records into memory |
| pg_trgm + FuzzySharp | Elasticsearch | Massive overkill; adds infrastructure dependency for a focused use case |

**Installation:**
```bash
# Backend: FuzzySharp NuGet package
cd src/GlobCRM.Infrastructure && dotnet add package FuzzySharp --version 2.0.2

# Frontend: No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
src/GlobCRM.Domain/
├── Entities/
│   ├── DuplicateMatchingConfig.cs    # Tenant-scoped matching rules (NEW)
│   └── MergeAuditLog.cs             # Merge operation audit trail (NEW)
├── Enums/
│   └── (no new enums needed)
├── Interfaces/
│   └── IDuplicateDetectionService.cs # (NEW)

src/GlobCRM.Infrastructure/
├── Duplicates/
│   ├── DuplicateDetectionService.cs  # Two-tier pg_trgm + FuzzySharp (NEW)
│   ├── ContactMergeService.cs        # Contact merge with FK transfer (NEW)
│   ├── CompanyMergeService.cs        # Company merge with FK transfer (NEW)
│   └── DuplicateServiceExtensions.cs # DI registration (NEW)
├── Persistence/
│   ├── Configurations/
│   │   ├── DuplicateMatchingConfigConfiguration.cs (NEW)
│   │   └── MergeAuditLogConfiguration.cs           (NEW)
│   └── Migrations/
│       └── App/
│           └── XXXXXX_AddDuplicateDetection.cs     (NEW)

src/GlobCRM.Api/
├── Controllers/
│   ├── DuplicatesController.cs       # Scan, check, merge endpoints (NEW)
│   └── DuplicateSettingsController.cs # Admin matching config (NEW)

globcrm-web/src/app/
├── features/
│   ├── duplicates/                   # New feature area (NEW)
│   │   ├── duplicates.routes.ts
│   │   ├── duplicate.service.ts
│   │   ├── duplicate.models.ts
│   │   ├── duplicate-scan/           # On-demand scan page
│   │   │   └── duplicate-scan.component.ts
│   │   └── merge-comparison/         # Side-by-side comparison + merge
│   │       └── merge-comparison.component.ts
│   ├── contacts/
│   │   └── contact-form/
│   │       └── contact-form.component.ts  # Add duplicate warning banner (MODIFY)
│   └── companies/
│       └── company-form/
│           └── company-form.component.ts  # Add duplicate warning banner (MODIFY)
├── features/settings/
│   ├── duplicate-rules/              # Admin matching config page (NEW)
│   │   └── duplicate-rules.component.ts
│   └── settings-hub.component.ts     # Add duplicate rules card (MODIFY)
```

### Pattern 1: Two-Tier Duplicate Detection (pg_trgm + FuzzySharp)

**What:** Database pre-filter with pg_trgm similarity, then in-memory scoring with FuzzySharp.

**When to use:** Both real-time create warnings (fast path) and on-demand batch scan.

**Example:**

```csharp
// Tier 1: pg_trgm database pre-filter via EF Core
// Npgsql 10.0.0 includes trigram function translations natively
var candidates = await _db.Contacts
    .Where(c => c.Id != sourceId)
    .Where(c =>
        EF.Functions.TrigramsSimilarity(c.FirstName + " " + c.LastName, fullName) > threshold
        || (email != null && EF.Functions.TrigramsSimilarity(c.Email!, email) > threshold))
    .Select(c => new CandidateRecord
    {
        Id = c.Id,
        FirstName = c.FirstName,
        LastName = c.LastName,
        Email = c.Email,
        Phone = c.Phone,
        CompanyName = c.Company != null ? c.Company.Name : null,
        UpdatedAt = c.UpdatedAt
    })
    .Take(50)
    .ToListAsync();

// Tier 2: FuzzySharp composite scoring
var scored = candidates.Select(c =>
{
    decimal score = 0;
    // Name weight: 50%
    score += 0.5m * (Fuzz.TokenSortRatio(fullName, $"{c.FirstName} {c.LastName}") / 100m);
    // Email weight: 50% (when both present)
    if (!string.IsNullOrEmpty(email) && !string.IsNullOrEmpty(c.Email))
        score += 0.5m * (Fuzz.Ratio(email.ToLower(), c.Email.ToLower()) / 100m);
    else
        score += 0.5m * 0; // No email = no email score

    return new DuplicateMatch { EntityId = c.Id, Score = score, /* ... */ };
})
.Where(m => m.Score >= (configuredThreshold / 100m))
.OrderByDescending(m => m.Score)
.Take(10)
.ToList();
```

### Pattern 2: Single-Transaction Merge with Relationship Transfer

**What:** Execute all FK updates and the soft-delete in a single `SaveChangesAsync` call.

**When to use:** Contact merge and company merge operations.

**Why:** Matches the Lead conversion pattern (Phase 13-02) which uses direct DbContext operations for atomicity. If any step fails, the entire merge rolls back.

**Example:**

```csharp
// ContactMergeService.MergeAsync(survivorId, loserId, fieldSelections)
using var transaction = await _db.Database.BeginTransactionAsync();
try
{
    var survivor = await _db.Contacts.FindAsync(survivorId);
    var loser = await _db.Contacts.FindAsync(loserId);

    // 1. Apply field selections to survivor
    ApplyFieldSelections(survivor, loser, fieldSelections);

    // 2. Transfer FK relationships (see FK Reference Map below)
    await TransferDealContacts(survivorId, loserId);
    await TransferQuotes(survivorId, loserId);
    await TransferRequests(survivorId, loserId);
    // ... all 14 FK references

    // 3. Transfer polymorphic relationships
    await TransferNotes("Contact", survivorId, loserId);
    await TransferAttachments("Contact", survivorId, loserId);
    await TransferActivityLinks("Contact", survivorId, loserId);
    await TransferFeedItems("Contact", survivorId, loserId);
    await TransferNotifications("Contact", survivorId, loserId);

    // 4. Soft-delete loser with MergedIntoId
    loser.MergedIntoId = survivorId;
    loser.MergedAt = DateTimeOffset.UtcNow;
    loser.MergedByUserId = currentUserId;
    // Handled by a new IsDeleted/IsMerged flag or separate property

    // 5. Create audit log
    _db.MergeAuditLogs.Add(new MergeAuditLog { /* ... */ });

    await _db.SaveChangesAsync();
    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

### Pattern 3: MergedIntoId Redirect Pattern

**What:** When a user navigates to a merged record's URL, detect the soft-delete + MergedIntoId and redirect to the survivor.

**When to use:** Contact and Company detail page load, and any API GET by ID.

**Recommendation:** On the backend, when GetById returns a record with `MergedIntoId` set (the record is soft-deleted but still queryable via `IgnoreQueryFilters` or a separate status), return a 301/redirect response or a special DTO indicating the merge. On the frontend, the detail component checks the response and navigates to the survivor's URL. This is simpler than intercepting at the HTTP level.

**Practical approach:** Add `MergedIntoId` to Contact and Company entities. Modify GetById to check for merged state: if the record has `MergedIntoId != null`, return a `410 Gone` with a body containing `{ mergedIntoId: "guid" }`. The frontend detail component handles 410 by navigating to the survivor.

### Pattern 4: Duplicate Warning Banner in Create Forms

**What:** On blur of key fields, call a lightweight duplicate-check API endpoint that returns potential matches.

**When to use:** Contact and Company create forms only (not edit forms, per locked decision).

**Example:**

```typescript
// In ContactFormComponent, add blur handler for name/email fields
private checkDuplicates(): void {
  const firstName = this.contactForm.get('firstName')?.value;
  const lastName = this.contactForm.get('lastName')?.value;
  const email = this.contactForm.get('email')?.value;

  if (!firstName && !lastName) return;

  this.duplicateService.checkContactDuplicates({ firstName, lastName, email })
    .pipe(takeUntil(this.destroy$))
    .subscribe(matches => {
      this.potentialDuplicates.set(matches);
    });
}
```

```html
<!-- Inline warning banner (amber) -->
@if (potentialDuplicates().length > 0) {
  <div class="duplicate-warning">
    <mat-icon>warning</mat-icon>
    <div class="duplicate-warning__content">
      <strong>Potential duplicates found:</strong>
      @for (match of potentialDuplicates(); track match.id) {
        <div class="duplicate-warning__match">
          <a [routerLink]="['/contacts', match.id]" target="_blank">
            {{ match.fullName }}
          </a>
          <span>({{ match.email }}) — {{ match.score }}% match</span>
        </div>
      }
    </div>
    <button mat-icon-button (click)="dismissDuplicateWarning()">
      <mat-icon>close</mat-icon>
    </button>
  </div>
}
```

### Anti-Patterns to Avoid
- **Loading all records for comparison:** Never load all contacts/companies into memory for FuzzySharp comparison. Always use pg_trgm database pre-filter first.
- **Multiple SaveChangesAsync in merge:** All merge operations must be in a single transaction. Multiple saves risk partial merges if the process crashes mid-way.
- **Hard-deleting the merged record:** The merged record must be soft-deleted with MergedIntoId preserved for audit trail and redirect support.
- **Triggering duplicate warnings on edit:** Per locked decision, only create forms trigger warnings. Edit forms do NOT.

## Complete FK Reference Map

### Contact FK References (must transfer during merge)

| # | Table / Entity | Column | FK Type | Transfer Strategy |
|---|---------------|--------|---------|-------------------|
| 1 | `deal_contacts` (DealContact) | `contact_id` | Direct FK, composite PK | Re-point to survivor; skip if survivor already linked to same deal |
| 2 | `quotes` (Quote) | `contact_id` | Nullable FK | `UPDATE SET contact_id = survivorId WHERE contact_id = loserId` |
| 3 | `requests` (Request) | `contact_id` | Nullable FK | `UPDATE SET contact_id = survivorId WHERE contact_id = loserId` |
| 4 | `email_messages` (EmailMessage) | `linked_contact_id` | Nullable FK | `UPDATE SET linked_contact_id = survivorId WHERE linked_contact_id = loserId` |
| 5 | `email_threads` (EmailThread) | `linked_contact_id` | Nullable FK | `UPDATE SET linked_contact_id = survivorId WHERE linked_contact_id = loserId` |
| 6 | `leads` (Lead) | `converted_contact_id` | Nullable FK (no constraint) | `UPDATE SET converted_contact_id = survivorId WHERE converted_contact_id = loserId` |
| 7 | `lead_conversions` (LeadConversion) | `contact_id` | Required FK | `UPDATE SET contact_id = survivorId WHERE contact_id = loserId` |
| 8 | `notes` (Note) | `entity_id` (where `entity_type = 'Contact'`) | Polymorphic | `UPDATE SET entity_id = survivorId WHERE entity_type = 'Contact' AND entity_id = loserId` |
| 9 | `attachments` (Attachment) | `entity_id` (where `entity_type = 'Contact'`) | Polymorphic | Same as notes |
| 10 | `activity_links` (ActivityLink) | `entity_id` (where `entity_type = 'Contact'`) | Polymorphic | Re-point; skip if survivor already linked to same activity |
| 11 | `feed_items` (FeedItem) | `entity_id` (where `entity_type = 'Contact'`) | Polymorphic | `UPDATE SET entity_id = survivorId` |
| 12 | `notifications` (Notification) | `entity_id` (where `entity_type = 'Contact'`) | Polymorphic | `UPDATE SET entity_id = survivorId` |
| 13 | `import_jobs` (ImportJob) | N/A | No direct FK | No transfer needed |
| 14 | `saved_views` | N/A | No FK to contacts | No transfer needed |

### Company FK References (must transfer during merge)

| # | Table / Entity | Column | FK Type | Transfer Strategy |
|---|---------------|--------|---------|-------------------|
| 1 | `contacts` (Contact) | `company_id` | Nullable FK | `UPDATE SET company_id = survivorId WHERE company_id = loserId` |
| 2 | `deals` (Deal) | `company_id` | Nullable FK | `UPDATE SET company_id = survivorId WHERE company_id = loserId` |
| 3 | `quotes` (Quote) | `company_id` | Nullable FK | `UPDATE SET company_id = survivorId WHERE company_id = loserId` |
| 4 | `requests` (Request) | `company_id` | Nullable FK | `UPDATE SET company_id = survivorId WHERE company_id = loserId` |
| 5 | `email_messages` (EmailMessage) | `linked_company_id` | Nullable FK | `UPDATE SET linked_company_id = survivorId WHERE linked_company_id = loserId` |
| 6 | `email_threads` (EmailThread) | `linked_company_id` | Nullable FK | `UPDATE SET linked_company_id = survivorId WHERE linked_company_id = loserId` |
| 7 | `leads` (Lead) | `converted_company_id` | Nullable FK (no constraint) | `UPDATE SET converted_company_id = survivorId WHERE converted_company_id = loserId` |
| 8 | `lead_conversions` (LeadConversion) | `company_id` | Nullable FK | `UPDATE SET company_id = survivorId WHERE company_id = loserId` |
| 9 | `notes` (Note) | `entity_id` (where `entity_type = 'Company'`) | Polymorphic | Same pattern as contacts |
| 10 | `attachments` (Attachment) | `entity_id` (where `entity_type = 'Company'`) | Polymorphic | Same pattern |
| 11 | `activity_links` (ActivityLink) | `entity_id` (where `entity_type = 'Company'`) | Polymorphic | Re-point; deduplicate |
| 12 | `feed_items` (FeedItem) | `entity_id` (where `entity_type = 'Company'`) | Polymorphic | Same pattern |
| 13 | `notifications` (Notification) | `entity_id` (where `entity_type = 'Company'`) | Polymorphic | Same pattern |

### Deduplication During Transfer

For join tables with composite keys (e.g., `DealContact` with PK `(DealId, ContactId)`), re-pointing would create a duplicate PK if the survivor is already linked to the same deal. Strategy:
1. Query existing links for survivor
2. Delete loser's links that would conflict (same DealId)
3. Update remaining loser links to survivor

For `ActivityLink`, use the same approach: check if an ActivityLink already exists for the same `(ActivityId, EntityType='Contact', EntityId=survivorId)`. If so, delete the loser's link. Otherwise, update it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein/Soundex | pg_trgm + FuzzySharp | pg_trgm has GIN index support; FuzzySharp handles weighted multi-field scoring with token sort |
| Database-level similarity | Raw SQL strings | `EF.Functions.TrigramsSimilarity()` | Npgsql 10.0.0 includes native translations; type-safe, composable with LINQ |
| pg_trgm extension setup | Manual SQL scripts | `modelBuilder.HasPostgresExtension("pg_trgm")` | EF Core migration generates `CREATE EXTENSION IF NOT EXISTS` automatically |
| Trigram GIN indexes | Raw migration SQL | `builder.HasIndex().HasMethod("gin").HasOperators("gin_trgm_ops")` | EF Core generates the correct DDL; safer than raw SQL |

**Key insight:** The existing Npgsql 10.0.0 package already includes all trigram function translations. No additional NuGet package is needed for the database tier. The only new NuGet dependency is FuzzySharp 2.0.2 for the in-memory scoring tier.

## Common Pitfalls

### Pitfall 1: Composite PK Conflicts During DealContact Transfer
**What goes wrong:** When transferring DealContact records from loser to survivor, if both contacts are linked to the same deal, the UPDATE creates a duplicate composite PK violation.
**Why it happens:** DealContact has PK `(DealId, ContactId)`. If survivor and loser are both linked to Deal X, changing loser's ContactId to survivor's creates `(DealX, Survivor)` which already exists.
**How to avoid:** Before bulk-updating, query for conflicting deals. Delete loser's DealContact rows that conflict, then update the rest.
**Warning signs:** `DbUpdateException` with unique constraint violation on `deal_contacts_pkey`.

### Pitfall 2: pg_trgm Extension Not Enabled
**What goes wrong:** `EF.Functions.TrigramsSimilarity()` throws at runtime because the pg_trgm extension is not installed in the database.
**Why it happens:** The extension exists in PostgreSQL but must be explicitly enabled per database with `CREATE EXTENSION IF NOT EXISTS pg_trgm`.
**How to avoid:** Add `modelBuilder.HasPostgresExtension("pg_trgm")` in `ApplicationDbContext.OnModelCreating()`. This generates the extension creation in the migration.
**Warning signs:** SQL error "function similarity(text, text) does not exist".

### Pitfall 3: Orphaned Polymorphic References After Merge
**What goes wrong:** Notes, attachments, feed items, or notifications still reference the loser's ID after merge, causing 404s when users click on them.
**Why it happens:** Polymorphic references (EntityType + EntityId) have no FK constraints, so the database does not enforce referential integrity. If the merge forgets to update a polymorphic table, references are silently broken.
**How to avoid:** Maintain the FK reference map (documented above) as the authoritative list. The merge service must iterate ALL tables in the map. Add integration tests that create records in every referenced table, merge, and verify all references point to survivor.
**Warning signs:** 404 errors on entity detail pages after merge; timeline entries pointing to non-existent records.

### Pitfall 4: EF Core Global Query Filter Hiding Merged Records
**What goes wrong:** After soft-deleting a merged contact (setting a flag), the global query filter hides it. The MergedIntoId redirect cannot work because the record is invisible.
**Why it happens:** The existing `IsDeleted` pattern (used by CustomFieldDefinition) filters out soft-deleted records by default.
**How to avoid:** Do NOT reuse the `IsDeleted` flag. Instead, add a nullable `MergedIntoId` column. The record remains visible to queries (not filtered out). The merge status is indicated by `MergedIntoId != null`. The GetById endpoint checks this and returns 410 with the redirect target. Alternatively, add a separate `IsMerged` boolean and include it in the query filter to exclude merged records from list queries but allow direct ID lookup.
**Warning signs:** Merged records appearing in list views; or merged records completely invisible even for redirect.

### Pitfall 5: Race Condition Between Duplicate Check and Create
**What goes wrong:** Two users simultaneously create contacts with the same name/email. The duplicate check returns "no duplicates" for both because neither has been saved yet.
**Why it happens:** The duplicate check runs before SaveChanges. Both requests pass the check, then both save.
**How to avoid:** This is acceptable for v1.1. The on-demand scan catches these after the fact. A unique index on (tenant_id, email) could prevent exact email duplicates at the database level, but fuzzy duplicates cannot be prevented this way.
**Warning signs:** Duplicate records appearing despite real-time warnings being enabled.

### Pitfall 6: N+1 Queries in Merge Relationship Counting
**What goes wrong:** The merge confirmation dialog needs counts (e.g., "5 deals, 12 notes will be transferred"). Fetching counts individually for each relationship type creates many queries.
**Why it happens:** Naive implementation calls a separate COUNT query for each table.
**How to avoid:** Use a single raw SQL query with multiple subqueries, or batch the counts into a stored procedure. Alternatively, execute multiple COUNT queries in parallel using `Task.WhenAll`.
**Warning signs:** Slow merge confirmation dialog; many database round-trips visible in logs.

## Code Examples

### Migration: Enable pg_trgm and Add Trigram Indexes

```csharp
// In ApplicationDbContext.OnModelCreating(), add:
modelBuilder.HasPostgresExtension("pg_trgm");

// In ContactConfiguration, add GIN trigram indexes:
// Note: EF Core expression indexes for concatenated columns may need raw SQL
builder.HasIndex(c => c.Email)
    .HasMethod("gin")
    .HasOperators("gin_trgm_ops")
    .HasDatabaseName("idx_contacts_email_trgm");

// For concatenated name, use raw SQL in migration:
migrationBuilder.Sql(@"
    CREATE INDEX idx_contacts_name_trgm ON contacts
        USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
");

migrationBuilder.Sql(@"
    CREATE INDEX idx_companies_name_trgm ON companies
        USING gin (name gin_trgm_ops);
");

migrationBuilder.Sql(@"
    CREATE INDEX idx_companies_website_trgm ON companies
        USING gin (website gin_trgm_ops);
");
```

### DuplicateMatchingConfig Entity

```csharp
// Domain/Entities/DuplicateMatchingConfig.cs
public class DuplicateMatchingConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>Entity type: "Contact" or "Company"</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>Whether auto-detection on create is enabled</summary>
    public bool AutoDetectionEnabled { get; set; } = true;

    /// <summary>Similarity threshold 0-100 (default 70)</summary>
    public int SimilarityThreshold { get; set; } = 70;

    /// <summary>Which fields participate in matching (stored as JSONB array of field names)</summary>
    public List<string> MatchingFields { get; set; } = new();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### MergeAuditLog Entity

```csharp
// Domain/Entities/MergeAuditLog.cs
public class MergeAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public string EntityType { get; set; } = string.Empty; // "Contact" or "Company"
    public Guid SurvivorId { get; set; }
    public Guid LoserId { get; set; }
    public Guid MergedByUserId { get; set; }

    /// <summary>Snapshot of field selections (which values were chosen)</summary>
    public Dictionary<string, object?> FieldSelections { get; set; } = new();

    /// <summary>Summary of transferred relationships</summary>
    public Dictionary<string, int> TransferCounts { get; set; } = new();

    public DateTimeOffset MergedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public ApplicationUser? MergedByUser { get; set; }
}
```

### Contact Entity Additions

```csharp
// Add to Contact entity:
/// <summary>
/// If this contact was merged into another, this points to the surviving contact.
/// Null for active (non-merged) contacts.
/// </summary>
public Guid? MergedIntoId { get; set; }

/// <summary>When this contact was merged.</summary>
public DateTimeOffset? MergedAt { get; set; }

/// <summary>User who performed the merge.</summary>
public Guid? MergedByUserId { get; set; }
```

### Duplicate Check API Endpoint

```csharp
// POST /api/duplicates/check/contacts
[HttpPost("check/contacts")]
[Authorize(Policy = "Permission:Contact:View")]
public async Task<IActionResult> CheckContactDuplicates([FromBody] CheckContactDuplicatesRequest request)
{
    var config = await _configRepository.GetAsync("Contact");
    if (config is not null && !config.AutoDetectionEnabled)
        return Ok(Array.Empty<DuplicateMatchDto>());

    var threshold = config?.SimilarityThreshold ?? 70;
    var matches = await _detectionService.FindContactDuplicatesAsync(
        request.FirstName, request.LastName, request.Email, threshold);

    return Ok(matches.Select(DuplicateMatchDto.FromResult));
}
```

### Merge Confirmation Summary Endpoint

```csharp
// GET /api/duplicates/merge-preview/contacts?survivorId=X&loserId=Y
[HttpGet("merge-preview/contacts")]
[Authorize(Policy = "Permission:Contact:Edit")]
public async Task<IActionResult> GetContactMergePreview(
    [FromQuery] Guid survivorId, [FromQuery] Guid loserId)
{
    // Returns counts of relationships that will be transferred
    var preview = new MergePreviewDto
    {
        DealCount = await _db.DealContacts.CountAsync(dc => dc.ContactId == loserId),
        QuoteCount = await _db.Quotes.CountAsync(q => q.ContactId == loserId),
        RequestCount = await _db.Requests.CountAsync(r => r.ContactId == loserId),
        NoteCount = await _db.Notes.CountAsync(n => n.EntityType == "Contact" && n.EntityId == loserId),
        AttachmentCount = await _db.Attachments.CountAsync(a => a.EntityType == "Contact" && a.EntityId == loserId),
        ActivityLinkCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Contact" && al.EntityId == loserId),
        EmailMessageCount = await _db.EmailMessages.CountAsync(em => em.LinkedContactId == loserId),
        FeedItemCount = await _db.FeedItems.CountAsync(fi => fi.EntityType == "Contact" && fi.EntityId == loserId),
        NotificationCount = await _db.Notifications.CountAsync(n => n.EntityType == "Contact" && n.EntityId == loserId),
    };
    return Ok(preview);
}
```

## Discretion Recommendations

### Algorithm Choice: pg_trgm + FuzzySharp (Two-Tier)

**Recommendation:** Use both. pg_trgm handles the database pre-filter with GIN index performance. FuzzySharp handles weighted multi-field scoring in memory.

**Rationale:** pg_trgm alone is a blunt instrument -- it cannot handle field weighting or transpositions well. FuzzySharp alone requires loading all records into memory. The two-tier approach is already the recommended pattern in the project's pre-existing research (STACK.md, ARCHITECTURE.md) and matches the scale requirements (10K-100K records per tenant).

**Contact scoring weights:** Name 50%, Email 50% (when both present). If email is null, name gets 100%.
**Company scoring weights:** Company name 60%, Domain/Website 40% (when both present). Domain matching extracts domain from Website URL or Email field.

### Duplicate Scan Page Layout

**Recommendation:** Use a simple list/table layout with expandable rows. Each row shows the duplicate pair (Record A vs Record B), confidence score as a colored badge, and action buttons (Compare, Dismiss). Paginate with standard server-side pagination (reuse `EntityQueryParams` pattern). Sort by confidence descending by default.

### MergedIntoId Redirect Handling

**Recommendation:**
- **Backend:** Add a check in Contact/Company GetById. If the record has `MergedIntoId != null`, return HTTP 301 with `Location` header pointing to `/api/contacts/{mergedIntoId}` (or return a custom JSON response with the merged ID).
- **Frontend:** The detail component catches 301/410 responses. Use `router.navigate(['/contacts', mergedIntoId], { replaceUrl: true })` to redirect transparently.
- **List views:** Exclude merged records using a query filter extension. Add `WHERE merged_into_id IS NULL` to list queries (either via EF global query filter or in the repository).

### Loading States and Error Handling During Merge

**Recommendation:**
- Show a full-page loading overlay with progress text ("Merging records... Transferring deals...") during the merge API call.
- If the merge fails, show a snackbar with "Merge failed. No changes were made." (since the transaction rolls back).
- Disable the "Confirm Merge" button after click to prevent double submission.
- After successful merge, navigate to the survivor's detail page with a success snackbar.

### Mobile Responsiveness for Comparison Page

**Recommendation:** On screens narrower than 768px, stack the two columns vertically (Record A on top, Record B below) with the radio buttons between them. Use responsive CSS Grid that switches from `grid-template-columns: 1fr 1fr` to `grid-template-columns: 1fr`. On very small screens, the comparison becomes scrollable.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Npgsql.EntityFrameworkCore.PostgreSQL.Trigrams (separate package) | Built into Npgsql.EntityFrameworkCore.PostgreSQL base package | Npgsql 6.0+ | No extra NuGet package needed for trigram functions |
| Raw SQL for similarity queries | `EF.Functions.TrigramsSimilarity()` | Npgsql 6.0+ | Type-safe, composable LINQ expressions |
| FuzzySharp 1.x | FuzzySharp 2.0.2 | 2023 | Improved performance, better API |

**Deprecated/outdated:**
- `Npgsql.EntityFrameworkCore.PostgreSQL.Trigrams` NuGet package: Deprecated; functionality merged into base provider.
- Using Soundex/Metaphone alone: Too coarse for name matching; trigram similarity with token sort produces better results.

## Open Questions

1. **EF Core Expression Index for Concatenated Columns**
   - What we know: pg_trgm GIN indexes on concatenated columns (`first_name || ' ' || last_name`) require raw SQL in migrations because EF Core does not support expression indexes natively.
   - What's unclear: Whether Npgsql 10.0.0 has added expression index support via fluent API.
   - Recommendation: Use raw SQL in migration `Up()` method. This is safe and well-established.

2. **Query Filter Strategy for Merged Records**
   - What we know: Merged records should be excluded from list queries but accessible via direct ID lookup (for redirect).
   - What's unclear: Best approach -- use a global query filter with `IgnoreQueryFilters()` for the redirect case, or filter in the repository.
   - Recommendation: Add `MergedIntoId` as a nullable column. Add a condition to the existing global query filter: `&& c.MergedIntoId == null`. Use `IgnoreQueryFilters()` in the GetById controller action when checking for merged redirect.

3. **Company Domain Extraction from Website/Email**
   - What we know: The Company entity has `Website` (URL string) and `Email` fields but no separate `Domain` field.
   - What's unclear: Whether to extract domain from Website URL at query time or store it as a computed/cached column.
   - Recommendation: Extract domain at query time in the DuplicateDetectionService. For the pg_trgm tier, match against the full Website string with trigram similarity. For the FuzzySharp tier, extract domain from URL (strip protocol/path) and compare domains. No new column needed.

## Sources

### Primary (HIGH confidence)
- [Npgsql EF Core Trigram Functions API](https://www.npgsql.org/efcore/api/Microsoft.EntityFrameworkCore.NpgsqlTrigramsDbFunctionsExtensions.html) - Verified `TrigramsSimilarity`, `TrigramsAreSimilar`, and all related methods available in base package
- [PostgreSQL pg_trgm Documentation](https://www.postgresql.org/docs/current/pgtrgm.html) - Core extension, built into PostgreSQL 17
- [FuzzySharp 2.0.2 on NuGet](https://www.nuget.org/packages/FuzzySharp) - Verified current version, .NET Standard 2.0+ compatible
- [FuzzySharp GitHub](https://github.com/JakeBayer/FuzzySharp) - C# port of Python FuzzyWuzzy, provides Fuzz.Ratio, TokenSortRatio, WeightedRatio
- Codebase analysis of all Contact/Company FK references (14 entities with ContactId, 13 entities with CompanyId)

### Secondary (MEDIUM confidence)
- [Npgsql EF Core Translations](https://www.npgsql.org/efcore/mapping/translations.html) - Confirmed trigram functions included in base provider
- Project pre-existing research: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md` - Two-tier pg_trgm + FuzzySharp approach previously validated

### Tertiary (LOW confidence)
- Expression index support in Npgsql 10.0.0 fluent API -- could not verify definitively; raw SQL migration is the safe fallback

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pg_trgm is core PostgreSQL; FuzzySharp is stable; Npgsql includes trigram translations natively
- Architecture: HIGH -- Two-tier detection pattern well-documented in project research; merge transaction pattern matches Lead conversion (Phase 13)
- FK Reference Map: HIGH -- Complete enumeration of all entities verified against Domain/Entities and EF configurations
- Pitfalls: HIGH -- Based on direct codebase analysis (composite PK conflicts, query filter interactions, polymorphic references)

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, no fast-moving dependencies)
