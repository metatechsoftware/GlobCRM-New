namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a stage within a deal pipeline.
/// Child entity of Pipeline — inherits tenant isolation via Pipeline FK (no TenantId).
/// Stages are ordered by SortOrder and can be terminal (won/lost).
/// </summary>
public class PipelineStage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Parent pipeline this stage belongs to.
    /// </summary>
    public Guid PipelineId { get; set; }

    /// <summary>
    /// Navigation property to the parent pipeline.
    /// </summary>
    public Pipeline Pipeline { get; set; } = null!;

    /// <summary>
    /// Display name of the stage (e.g., "Qualification", "Proposal", "Negotiation").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Position of this stage in the pipeline (0-based).
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Hex color code for visual representation in the UI (e.g., "#1976d2").
    /// </summary>
    public string Color { get; set; } = "#1976d2";

    /// <summary>
    /// Default probability (0.0-1.0) applied to deals entering this stage.
    /// For example, 0.25 represents 25% win probability.
    /// </summary>
    public decimal DefaultProbability { get; set; }

    /// <summary>
    /// Whether this stage represents a won deal (terminal stage).
    /// </summary>
    public bool IsWon { get; set; }

    /// <summary>
    /// Whether this stage represents a lost deal (terminal stage).
    /// </summary>
    public bool IsLost { get; set; }

    /// <summary>
    /// JSONB map of field IDs that must be filled before a deal can enter this stage.
    /// Keys are custom field definition IDs, values are constraint metadata.
    /// </summary>
    public Dictionary<string, object?> RequiredFields { get; set; } = new();

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
