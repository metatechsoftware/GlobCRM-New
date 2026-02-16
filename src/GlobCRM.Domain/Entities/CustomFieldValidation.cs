namespace GlobCRM.Domain.Entities;

/// <summary>
/// JSONB-mapped value type defining validation rules for a custom field.
/// Stored as a JSONB column on CustomFieldDefinition, not as a separate table.
/// Supports required, min/max length/value, regex, unique, and conditional required.
/// </summary>
public class CustomFieldValidation
{
    /// <summary>Whether this field is required.</summary>
    public bool Required { get; set; }

    /// <summary>Minimum text length (for Text fields).</summary>
    public int? MinLength { get; set; }

    /// <summary>Maximum text length (for Text fields).</summary>
    public int? MaxLength { get; set; }

    /// <summary>Minimum numeric value (for Number/Currency fields).</summary>
    public decimal? MinValue { get; set; }

    /// <summary>Maximum numeric value (for Number/Currency fields).</summary>
    public decimal? MaxValue { get; set; }

    /// <summary>Regex pattern for custom validation (for Text fields).</summary>
    public string? RegexPattern { get; set; }

    /// <summary>Whether the value must be unique within the tenant for this field.</summary>
    public bool Unique { get; set; }

    /// <summary>
    /// If set, this field is conditionally required when the named field has
    /// the value specified in <see cref="ConditionalRequiredValue"/>.
    /// </summary>
    public string? ConditionalRequiredField { get; set; }

    /// <summary>
    /// The value that <see cref="ConditionalRequiredField"/> must have
    /// for this field to become required.
    /// </summary>
    public string? ConditionalRequiredValue { get; set; }
}
