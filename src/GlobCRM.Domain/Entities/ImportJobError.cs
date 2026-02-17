namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records a per-row error encountered during CSV import processing.
/// Child entity of ImportJob -- inherits tenant isolation via FK.
/// </summary>
public class ImportJobError
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The import job this error belongs to.</summary>
    public Guid ImportJobId { get; set; }
    public ImportJob ImportJob { get; set; } = null!;

    /// <summary>The row number in the CSV where the error occurred.</summary>
    public int RowNumber { get; set; }

    /// <summary>The field name that caused the error.</summary>
    public string FieldName { get; set; } = string.Empty;

    /// <summary>Description of the error.</summary>
    public string ErrorMessage { get; set; } = string.Empty;

    /// <summary>The raw value from the CSV that failed validation.</summary>
    public string? RawValue { get; set; }
}
