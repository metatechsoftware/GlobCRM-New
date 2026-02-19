namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Service for detecting duplicate contacts and companies using
/// a two-tier approach: pg_trgm database pre-filtering + FuzzySharp in-memory scoring.
/// </summary>
public interface IDuplicateDetectionService
{
    /// <summary>
    /// Find contacts that are potential duplicates of the given contact fields.
    /// Used for real-time duplicate warnings on create forms.
    /// </summary>
    Task<List<DuplicateMatch>> FindContactDuplicatesAsync(
        string? firstName, string? lastName, string? email,
        int threshold, Guid? excludeId = null);

    /// <summary>
    /// Find companies that are potential duplicates of the given company fields.
    /// Used for real-time duplicate warnings on create forms.
    /// </summary>
    Task<List<DuplicateMatch>> FindCompanyDuplicatesAsync(
        string? name, string? website,
        int threshold, Guid? excludeId = null);

    /// <summary>
    /// Scan all contacts for duplicate pairs. Used for on-demand batch scanning.
    /// Returns paginated results sorted by confidence score descending.
    /// </summary>
    Task<List<DuplicatePair>> ScanContactDuplicatesAsync(
        int threshold, int page, int pageSize);

    /// <summary>
    /// Scan all companies for duplicate pairs. Used for on-demand batch scanning.
    /// Returns paginated results sorted by confidence score descending.
    /// </summary>
    Task<List<DuplicatePair>> ScanCompanyDuplicatesAsync(
        int threshold, int page, int pageSize);
}

/// <summary>
/// Represents a single potential duplicate match found for a given record.
/// </summary>
public record DuplicateMatch(
    Guid EntityId,
    string FullName,
    string? Email,
    int Score,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Represents a pair of records detected as potential duplicates during batch scanning.
/// </summary>
public record DuplicatePair(
    DuplicateMatch RecordA,
    DuplicateMatch RecordB,
    int Score);
