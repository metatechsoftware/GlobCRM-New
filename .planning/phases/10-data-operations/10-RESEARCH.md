# Phase 10: Data Operations - Research

**Researched:** 2026-02-17
**Domain:** CSV Import with Field Mapping + Global Cross-Entity Search
**Confidence:** HIGH

## Summary

Phase 10 delivers two distinct feature domains: (1) CSV import for contacts, companies, and deals with field mapping, preview, duplicate detection, and progress tracking; and (2) global search across all entity types with partial matching, type-as-you-type responsiveness, and recent search history.

For CSV import, the backend should use CsvHelper (the standard .NET CSV library with 483M+ NuGet downloads) to parse uploaded CSV files, with a multi-step workflow: upload + header detection, user-defined field mapping, preview with validation, and batch execution with progress tracking via SignalR. The import process follows the existing BackgroundService + IServiceScopeFactory pattern (EmailSyncBackgroundService, DueDateNotificationService) but uses a per-import task rather than a polling loop. Import records are stored in new ImportJob/ImportJobError entities for audit and progress tracking.

For global search, PostgreSQL's built-in full-text search (tsvector/tsquery) provides the best balance of performance and simplicity. Npgsql EF Core has first-class support via `HasGeneratedTsVectorColumn()` and LINQ `Matches()` / `Rank()` operators. Adding a stored `SearchVector` tsvector column to Company, Contact, and Deal entities (with GIN indexes) enables sub-100ms search across millions of rows. The frontend uses a debounced search input in the navbar with a dropdown overlay showing results grouped by entity type.

**Primary recommendation:** Use CsvHelper for CSV parsing with SignalR progress tracking; use PostgreSQL tsvector with GIN indexes for global search. No third-party search engine (Elasticsearch, etc.) needed at this scale.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CsvHelper | 33.x | CSV file parsing and field mapping | 483M+ NuGet downloads, .NET Standard 2.0, handles encoding/escaping/quoting edge cases |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.0 (already installed) | tsvector/tsquery LINQ support | Already in project, full-text search via HasGeneratedTsVectorColumn, GIN indexes |
| @microsoft/signalr | 10.0.0 (already installed) | Real-time import progress | Already in project for notifications/feed, reuse CrmHub |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| NpgsqlTsVector | (part of Npgsql) | Search vector type for entity models | Add to Company, Contact, Deal entities |
| Angular CDK Overlay | (already installed via @angular/cdk) | Search dropdown overlay | Positioned overlay for global search results |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL FTS | Elasticsearch | Far more powerful at scale, but massive operational complexity for <1M rows per tenant |
| CsvHelper | Sep (fastest CSV parser) | Sep is faster but has a more minimal API -- CsvHelper's dynamic record reading and class mapping are better for user-defined field mapping |
| SignalR progress | HTTP polling | SignalR already in place; polling adds latency and unnecessary requests |
| Stored tsvector column | EF.Functions.ToTsVector() inline | Inline recomputes on every query; stored column + GIN index is dramatically faster |

**Installation:**
```bash
# Backend - add CsvHelper to Infrastructure project
dotnet add src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj package CsvHelper

# Frontend - no new packages needed (Angular Material, CDK, SignalR already installed)
```

## Architecture Patterns

### Recommended Project Structure
```
# Backend additions
src/GlobCRM.Domain/
├── Entities/
│   ├── ImportJob.cs              # Import job tracking entity
│   └── ImportJobError.cs         # Per-row import errors
├── Enums/
│   ├── ImportStatus.cs           # Pending, Processing, Completed, Failed
│   └── ImportEntityType.cs       # Contact, Company, Deal
└── Interfaces/
    ├── IImportRepository.cs      # Import job CRUD
    └── ISearchService.cs         # Cross-entity search interface

src/GlobCRM.Infrastructure/
├── Import/
│   ├── CsvParserService.cs       # CsvHelper wrapper for parsing + header detection
│   ├── ImportService.cs          # Core import logic (mapping, validation, batch insert)
│   ├── ImportServiceExtensions.cs # DI registration
│   └── DuplicateDetector.cs      # Duplicate matching logic
├── Search/
│   ├── GlobalSearchService.cs    # Cross-entity search using tsvector
│   └── SearchServiceExtensions.cs # DI registration
└── Persistence/
    └── Repositories/
        └── ImportRepository.cs

src/GlobCRM.Api/Controllers/
├── ImportsController.cs          # Upload, map, preview, execute, status endpoints
└── SearchController.cs           # Global search endpoint

# Frontend additions
globcrm-web/src/app/
├── features/
│   └── import/
│       ├── import.models.ts
│       ├── import.service.ts
│       ├── import-wizard/         # Multi-step import wizard component
│       │   ├── import-wizard.component.ts
│       │   ├── step-upload.component.ts
│       │   ├── step-mapping.component.ts
│       │   ├── step-preview.component.ts
│       │   └── step-progress.component.ts
│       └── import-history/
│           └── import-history.component.ts
└── shared/
    └── components/
        └── global-search/
            ├── global-search.component.ts    # Navbar search bar + overlay
            ├── search.service.ts
            └── search.models.ts
```

### Pattern 1: Multi-Step Import Wizard (Backend)
**What:** CSV import follows a stateful multi-step workflow: Upload -> Map -> Preview -> Execute
**When to use:** When import requires user decisions between steps (field mapping, duplicate handling)
**Example:**
```csharp
// Step 1: Upload CSV, parse headers, return column names
// POST /api/imports/upload (IFormFile)
// Returns: { importJobId, headers: ["Name", "Email", "Phone", ...], rowCount, sampleRows }

// Step 2: Submit field mapping
// POST /api/imports/{id}/mapping
// Body: { mappings: [{ csvColumn: "Name", entityField: "name", isCustomField: false }], duplicateStrategy: "skip" }

// Step 3: Preview (dry-run validation)
// POST /api/imports/{id}/preview
// Returns: { validRows, invalidRows, duplicateRows, errors: [{ row, field, message }] }

// Step 4: Execute import
// POST /api/imports/{id}/execute
// Returns 202 Accepted; progress via SignalR

// Step 5: Check status / get results
// GET /api/imports/{id}
// Returns: { status, totalRows, processedRows, successCount, errorCount, errors }
```

### Pattern 2: CsvHelper Dynamic Record Reading
**What:** Parse CSV without a predefined class using dynamic records
**When to use:** When CSV columns are unknown until runtime (user-uploaded files)
**Example:**
```csharp
// Source: CsvHelper official docs - https://joshclose.github.io/CsvHelper/
using var reader = new StreamReader(stream);
using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
{
    HasHeaderRecord = true,
    MissingFieldFound = null,  // Don't throw on missing columns
    BadDataFound = null,       // Collect errors instead of throwing
    TrimOptions = TrimOptions.Trim
});

csv.Read();
csv.ReadHeader();
var headers = csv.HeaderRecord; // string[] of column names

var records = new List<Dictionary<string, string>>();
while (csv.Read())
{
    var record = new Dictionary<string, string>();
    foreach (var header in headers)
    {
        record[header] = csv.GetField(header) ?? string.Empty;
    }
    records.Add(record);
}
```

### Pattern 3: PostgreSQL Full-Text Search with EF Core
**What:** Stored tsvector columns with GIN indexes for fast full-text search
**When to use:** Cross-entity search with partial matching and ranking
**Example:**
```csharp
// Source: Npgsql EF Core docs - https://www.npgsql.org/efcore/mapping/full-text-search.html

// Entity model
public class Company
{
    // ... existing fields ...
    public NpgsqlTsVector SearchVector { get; set; } = null!;
}

// EF Core configuration (in ApplicationDbContext.OnModelCreating)
modelBuilder.Entity<Company>()
    .HasGeneratedTsVectorColumn(
        c => c.SearchVector,
        "english",
        c => new { c.Name, c.Industry, c.Email, c.City })
    .HasIndex(c => c.SearchVector)
    .HasMethod("GIN");

// LINQ query
var query = EF.Functions.WebSearchToTsQuery("english", searchTerm);
var results = await _db.Companies
    .Where(c => c.SearchVector.Matches(query))
    .OrderByDescending(c => c.SearchVector.Rank(query))
    .Take(5)
    .Select(c => new SearchResultDto
    {
        Id = c.Id,
        EntityType = "Company",
        Title = c.Name,
        Subtitle = c.Industry,
        Url = $"/companies/{c.Id}"
    })
    .ToListAsync();
```

### Pattern 4: SignalR Import Progress
**What:** Real-time progress updates during import execution via existing CrmHub
**When to use:** When import processes large files that take seconds to minutes
**Example:**
```csharp
// Reuse existing CrmHub pattern from Phase 8
// Send progress to specific user (not broadcast)
await _hubContext.Clients.User(userId.ToString())
    .SendAsync("ImportProgress", new
    {
        ImportJobId = importJob.Id,
        ProcessedRows = processed,
        TotalRows = total,
        SuccessCount = successes,
        ErrorCount = errors,
        Status = importJob.Status.ToString()
    });
```

### Pattern 5: Import File Upload (Backend)
**What:** IFormFile upload following existing ActivityAttachment pattern
**When to use:** CSV file upload endpoint
**Example:**
```csharp
// Follows ActivitiesController.UploadAttachment pattern
[HttpPost("upload")]
[Authorize(Policy = "Permission:Contact:Create")]  // Require Create on target entity
[RequestSizeLimit(10 * 1024 * 1024)] // 10MB max CSV
public async Task<IActionResult> Upload(
    IFormFile file,
    [FromQuery] string entityType)
{
    if (file == null || file.Length == 0)
        return BadRequest(new { error = "No file provided." });

    if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        return BadRequest(new { error = "Only CSV files are supported." });

    // Parse headers and sample rows
    using var stream = file.OpenReadStream();
    var parseResult = await _csvParserService.ParseHeadersAndSample(stream);

    // Create import job entity
    var importJob = new ImportJob { ... };
    // Save CSV to temp storage via IFileStorageService
    // Return job ID + headers + sample data
}
```

### Pattern 6: Global Search Navbar Integration
**What:** Search bar in navbar with debounced input and overlay dropdown
**When to use:** Single search bar for cross-entity search (SRCH-01)
**Example:**
```typescript
// Follows Subject-based debounced search pattern (02-11, 03-07)
private searchSubject = new Subject<string>();

constructor() {
  this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    filter(term => term.length >= 2),
    switchMap(term => this.searchService.search(term))
  ).subscribe(results => this.searchResults.set(results));
}
```

### Anti-Patterns to Avoid
- **Loading entire CSV into memory:** Stream large files row-by-row using CsvHelper's `Read()` loop, not `GetRecords<T>().ToList()`. For files >1000 rows, process in batches (e.g., 100 rows per SaveChanges).
- **Inline ToTsVector() in queries:** Always use stored generated tsvector columns with GIN indexes. Inline computation defeats the purpose of full-text indexing.
- **Synchronous import execution:** Never process large imports in the HTTP request thread. Return 202 Accepted and process via background task with SignalR progress.
- **Global SearchStore:** Do NOT create a root-provided signal store for search. The search component is in the navbar (always present); use local component state with signals.
- **Elasticsearch for <1M rows per tenant:** PostgreSQL FTS handles this scale trivially. Adding Elasticsearch adds infrastructure complexity with zero benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom string splitting | CsvHelper | RFC 4180 compliance, encoding detection, quoted fields with embedded commas/newlines, BOM handling |
| Full-text search | LIKE '%term%' queries | PostgreSQL tsvector + GIN index | LIKE scans every row; tsvector uses inverted index for O(log n) lookup, supports stemming/ranking |
| Duplicate detection | Exact string comparison | Normalized comparison (lowercase, trim, remove punctuation) | Real duplicates have whitespace, case, and formatting differences |
| Import progress | HTTP polling | SignalR (already in project) | Sub-second updates, no wasted requests, existing infrastructure |
| Search debouncing | Custom setTimeout/clearTimeout | RxJS Subject + debounceTime + distinctUntilChanged + switchMap | Handles race conditions, cancels stale requests, standard Angular pattern |
| CSV column type inference | Manual type detection | Sample row analysis + entity field type metadata | Custom field definitions already store type information; match CSV values against known field types |

**Key insight:** CSV parsing has RFC 4180 compliance edge cases (embedded quotes, multi-line fields, BOM markers, encoding variations) that make hand-rolling extremely error-prone. CsvHelper handles all of these.

## Common Pitfalls

### Pitfall 1: CSV Encoding Issues
**What goes wrong:** CSV files from Excel on Windows use Windows-1252 encoding with BOM; files from Mac use UTF-8 without BOM. CsvHelper may misread characters.
**Why it happens:** Different systems produce different encodings, and UTF-8 is not universal.
**How to avoid:** Use `new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true)` to auto-detect encoding. CsvHelper respects the StreamReader's encoding.
**Warning signs:** Garbled characters in preview data, especially accented characters.

### Pitfall 2: Large File Memory Pressure
**What goes wrong:** Loading 100K+ row CSV into memory as List<Dictionary<string,string>> causes OutOfMemoryException or GC pressure.
**Why it happens:** Each row creates a dictionary with string allocations.
**How to avoid:** For preview, only read first N rows (e.g., 100). For execution, stream row-by-row with batch commits every 100 rows. Store the CSV file temporarily on disk via IFileStorageService rather than holding in memory.
**Warning signs:** Memory spikes during import, slow GC pauses.

### Pitfall 3: DbContext Concurrency in Batch Import
**What goes wrong:** Calling SaveChangesAsync after every row is extremely slow; calling it once at the end risks losing all progress on failure.
**Why it happens:** EF Core change tracking overhead per entity; single transaction timeout for large batches.
**How to avoid:** Batch commits every 100 rows with a new DbContext scope per batch. Use `IServiceScopeFactory.CreateScope()` to get fresh DbContext per batch (matching BackgroundService pattern).
**Warning signs:** Import takes minutes for 1K rows, or entire import fails on row 999.

### Pitfall 4: tsvector Column Migration on Existing Data
**What goes wrong:** Adding a stored generated tsvector column to tables with existing data causes a long-running migration that locks the table.
**Why it happens:** PostgreSQL must compute the tsvector for every existing row during ALTER TABLE.
**How to avoid:** For development/small datasets this is fine. For production with large tables, use `CONCURRENTLY` index creation. The migration should create the column and index in the standard way -- this is acceptable for the project's current scale.
**Warning signs:** Migration takes >30 seconds on tables with >100K rows.

### Pitfall 5: Duplicate Detection False Positives
**What goes wrong:** Overly aggressive duplicate matching marks legitimate distinct records as duplicates.
**Why it happens:** Simple name matching doesn't account for common names (e.g., "John Smith").
**How to avoid:** Use multiple fields for matching: for contacts, match on email (primary) + name (secondary). For companies, match on name + domain. Offer skip/overwrite/merge UI so user makes the final decision (IMPT-05). Never auto-merge without user confirmation.
**Warning signs:** High duplicate rate on import preview, user complaints about missing imported records.

### Pitfall 6: Search Ranking with Short Queries
**What goes wrong:** Single-character or very short search terms return irrelevant results or no results with tsquery.
**Why it happens:** Full-text search expects word tokens, not partial strings.
**How to avoid:** Use `EF.Functions.WebSearchToTsQuery()` which handles partial terms gracefully. Additionally, append `:*` prefix matching for partial word support (e.g., "acm" matches "Acme"). Require minimum 2 characters before searching.
**Warning signs:** Empty results for partial company names, unexpected ranking order.

### Pitfall 7: Permission Bypass in Import
**What goes wrong:** Import creates entities without checking Create permissions, ownership assignment, or custom field validation.
**Why it happens:** Import service bypasses the controller-level permission checks.
**How to avoid:** Import service must: (1) verify user has Create permission for the target entity type, (2) assign OwnerId to the importing user, (3) validate custom field values using existing CustomFieldValidator, (4) respect TenantId from current tenant context.
**Warning signs:** Unpermissioned users creating entities, entities with wrong TenantId.

## Code Examples

Verified patterns from official sources and existing codebase:

### Import Job Entity
```csharp
// Follows existing entity pattern (Company, Dashboard, etc.)
public class ImportJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }           // Who initiated the import
    public ApplicationUser? User { get; set; }

    public ImportEntityType EntityType { get; set; }  // Contact, Company, Deal
    public ImportStatus Status { get; set; } = ImportStatus.Pending;

    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFilePath { get; set; } = string.Empty;  // IFileStorageService path

    public int TotalRows { get; set; }
    public int ProcessedRows { get; set; }
    public int SuccessCount { get; set; }
    public int ErrorCount { get; set; }
    public int DuplicateCount { get; set; }

    // Field mapping stored as JSONB
    public List<ImportFieldMapping> Mappings { get; set; } = new();

    public string DuplicateStrategy { get; set; } = "skip";  // skip, overwrite, merge

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public ICollection<ImportJobError> Errors { get; set; } = new List<ImportJobError>();
}

public class ImportFieldMapping
{
    public string CsvColumn { get; set; } = string.Empty;
    public string EntityField { get; set; } = string.Empty;
    public bool IsCustomField { get; set; }
}

public class ImportJobError
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ImportJobId { get; set; }
    public ImportJob ImportJob { get; set; } = null!;
    public int RowNumber { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public string? RawValue { get; set; }
}
```

### Global Search Service
```csharp
// Source: Npgsql EF Core full-text search docs
public class GlobalSearchService : ISearchService
{
    private readonly ApplicationDbContext _db;
    private readonly IPermissionService _permissionService;

    public async Task<GlobalSearchResult> SearchAsync(
        string term, Guid userId, int maxPerType = 5)
    {
        var result = new GlobalSearchResult();

        // Search companies (with permission check)
        var companyPerm = await _permissionService
            .GetEffectivePermissionAsync(userId, "Company", "View");
        if (companyPerm.Scope != PermissionScope.None)
        {
            var tsQuery = EF.Functions.WebSearchToTsQuery("english", term);
            result.Companies = await _db.Companies
                .Where(c => c.SearchVector.Matches(tsQuery))
                .OrderByDescending(c => c.SearchVector.Rank(tsQuery))
                .Take(maxPerType)
                .Select(c => new SearchHit
                {
                    Id = c.Id,
                    Title = c.Name,
                    Subtitle = c.Industry,
                    EntityType = "Company"
                })
                .ToListAsync();
        }

        // Repeat for Contact, Deal, etc.
        return result;
    }
}
```

### Frontend Global Search Component (Navbar)
```typescript
// Follows Subject-based debounced search pattern from Phase 02-11, 03-07
@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatInputModule, RouterLink],
  template: `
    <div class="global-search" (clickOutside)="close()">
      <mat-icon>search</mat-icon>
      <input #searchInput
        placeholder="Search..."
        [value]="searchTerm()"
        (input)="onSearch($event)"
        (focus)="onFocus()" />
      @if (isOpen() && results()) {
        <div class="global-search__overlay">
          @for (group of results()!.groups; track group.entityType) {
            <div class="global-search__group">
              <h4>{{ group.entityType }}</h4>
              @for (hit of group.items; track hit.id) {
                <a [routerLink]="hit.url" (click)="close()">
                  {{ hit.title }}
                  <span class="subtitle">{{ hit.subtitle }}</span>
                </a>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
```

### Import Wizard Step: Field Mapping
```typescript
// Step 2: User maps CSV columns to entity fields
// csvColumns from step 1, entityFields from CustomFieldService + hardcoded core fields
@Component({
  template: `
    <h2>Map CSV Columns</h2>
    @for (col of csvColumns; track col) {
      <div class="mapping-row">
        <span class="csv-col">{{ col }}</span>
        <mat-icon>arrow_forward</mat-icon>
        <mat-select [(value)]="mappings[col]" placeholder="Select field...">
          <mat-option value="">-- Skip --</mat-option>
          <mat-optgroup label="Core Fields">
            @for (f of coreFields; track f.key) {
              <mat-option [value]="f.key">{{ f.label }}</mat-option>
            }
          </mat-optgroup>
          <mat-optgroup label="Custom Fields">
            @for (f of customFields(); track f.id) {
              <mat-option [value]="f.id">{{ f.label }}</mat-option>
            }
          </mat-optgroup>
        </mat-select>
      </div>
    }
  `
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LIKE '%term%' queries | PostgreSQL tsvector + GIN index | PostgreSQL 8.3+ (mature) | Orders of magnitude faster for text search; supports stemming, ranking, relevance |
| CsvHelper ClassMap only | CsvHelper dynamic record reading | CsvHelper 20+ | Enables runtime field mapping without compile-time class definitions |
| HTTP polling for progress | SignalR WebSocket push | Already in project since Phase 8 | Real-time progress updates without polling overhead |
| Separate search services | Npgsql HasGeneratedTsVectorColumn | Npgsql EF Core 6+ | Stored generated columns auto-update when source fields change |
| Elasticsearch for all search | PostgreSQL FTS for <1M rows | Industry consensus | No need for separate search infrastructure at this scale |

**Deprecated/outdated:**
- `EF.Functions.ToTsVector()` inline in WHERE clause: Still works but defeats GIN indexing. Use stored generated columns instead.
- `EF.Functions.FreeTextSearch()`: SQL Server only, not applicable to PostgreSQL/Npgsql.

## Open Questions

1. **Deal import field mapping complexity**
   - What we know: Deals require PipelineId and PipelineStageId. These are Guid FKs, not user-friendly CSV values.
   - What's unclear: Should import accept pipeline/stage names and resolve to IDs, or require users to map to specific IDs?
   - Recommendation: Accept pipeline and stage names as strings, resolve to IDs via name lookup. If ambiguous (duplicate names), report as validation error in preview step. This is the most user-friendly approach.

2. **Custom field import for Dropdown/MultiSelect types**
   - What we know: Custom fields have typed validation (Dropdown must match defined options, MultiSelect is an array).
   - What's unclear: How to map CSV string values to dropdown option values and handle arrays in CSV.
   - Recommendation: For Dropdown, match CSV value against option labels (case-insensitive). For MultiSelect, use semicolon-delimited values in CSV (e.g., "Option1;Option2"). Document this format in the import UI.

3. **Search vector update for custom field values**
   - What we know: tsvector stored generated columns only include properties defined at column creation time. Custom field values are in JSONB.
   - What's unclear: Whether custom field text values should be searchable via global search.
   - Recommendation: Do NOT include custom fields in tsvector for v1. Core fields (name, email, title, etc.) provide sufficient search coverage. Custom field search can be added later via a trigger-based approach if needed.

4. **Recent searches storage**
   - What we know: SRCH-04 requires saving recent searches for quick access.
   - What's unclear: Server-side vs client-side storage.
   - Recommendation: Use localStorage on the client side (per-user, per-browser). Store last 10 search terms as a simple string array. No backend entity needed -- this is a UI convenience feature, not a data requirement.

## Sources

### Primary (HIGH confidence)
- Npgsql EF Core Full-Text Search documentation: https://www.npgsql.org/efcore/mapping/full-text-search.html -- HasGeneratedTsVectorColumn, Matches, Rank, WebSearchToTsQuery, GIN indexing
- CsvHelper official documentation: https://joshclose.github.io/CsvHelper/ -- Dynamic record reading, CsvConfiguration, header handling
- CsvHelper NuGet: https://www.nuget.org/packages/csvhelper/ -- Version 33.1.0, 483M+ downloads
- PostgreSQL Full-Text Search documentation: https://www.postgresql.org/docs/current/textsearch-intro.html -- tsvector, tsquery, GIN indexes

### Secondary (MEDIUM confidence)
- Existing codebase patterns verified by direct code reading:
  - BackgroundService pattern: `EmailSyncBackgroundService.cs`, `DueDateNotificationService.cs`
  - IFormFile upload pattern: `ActivitiesController.cs` (UploadAttachment), `ProfileController.cs` (UploadAvatar)
  - IFileStorageService abstraction: `Infrastructure/Storage/IFileStorageService.cs`
  - Subject-based debounced search: Established pattern in Phase 02-11, 03-07
  - DI extension pattern: `CrmEntityServiceExtensions.cs`, `NotificationServiceExtensions.cs`
  - SignalR hub: `CrmHub` in Infrastructure with user-targeted messaging

### Tertiary (LOW confidence)
- None. All findings verified against official docs or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CsvHelper is the undisputed standard for .NET CSV; PostgreSQL FTS is built-in with excellent Npgsql EF Core support
- Architecture: HIGH - All patterns follow established codebase conventions (BackgroundService, IFormFile, SignalR, DI extensions, signal stores)
- Pitfalls: HIGH - Well-documented pitfalls from both official docs and real-world experience; encoding, memory, batch size, permissions

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain, no fast-moving dependencies)
