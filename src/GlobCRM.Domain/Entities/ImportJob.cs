using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Tracks a CSV import job including file metadata, progress, field mappings, and error counts.
/// Tenant-scoped with global query filter + RLS.
/// </summary>
public class ImportJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant (organization) ID for multi-tenancy isolation.</summary>
    public Guid TenantId { get; set; }

    /// <summary>User who initiated the import. Nullable for SetNull on user deletion.</summary>
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }

    /// <summary>The type of entity being imported (Contact, Company, Deal).</summary>
    public ImportEntityType EntityType { get; set; }

    /// <summary>Current status of the import job.</summary>
    public ImportStatus Status { get; set; } = ImportStatus.Pending;

    /// <summary>Original file name as uploaded by the user.</summary>
    public string OriginalFileName { get; set; } = string.Empty;

    /// <summary>Path where the uploaded CSV is stored (from IFileStorageService).</summary>
    public string StoredFilePath { get; set; } = string.Empty;

    /// <summary>Total number of data rows in the CSV.</summary>
    public int TotalRows { get; set; }

    /// <summary>Number of rows processed so far.</summary>
    public int ProcessedRows { get; set; }

    /// <summary>Number of rows successfully imported.</summary>
    public int SuccessCount { get; set; }

    /// <summary>Number of rows that failed validation or import.</summary>
    public int ErrorCount { get; set; }

    /// <summary>Number of duplicate rows detected.</summary>
    public int DuplicateCount { get; set; }

    /// <summary>CSV column to entity field mappings, stored as JSONB.</summary>
    public List<ImportFieldMapping> Mappings { get; set; } = new();

    /// <summary>Strategy for handling duplicate records: skip, overwrite, or merge.</summary>
    public string DuplicateStrategy { get; set; } = "skip";

    // Timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    // Navigation: Import job has many errors
    public ICollection<ImportJobError> Errors { get; set; } = new List<ImportJobError>();
}

/// <summary>
/// Value object representing a mapping between a CSV column and an entity field.
/// Stored as part of ImportJob.Mappings JSONB array.
/// </summary>
public class ImportFieldMapping
{
    /// <summary>Name of the column in the CSV file.</summary>
    public string CsvColumn { get; set; } = string.Empty;

    /// <summary>Name of the entity field to map to.</summary>
    public string EntityField { get; set; } = string.Empty;

    /// <summary>Whether this maps to a custom field (JSONB key) rather than a core property.</summary>
    public bool IsCustomField { get; set; }
}
