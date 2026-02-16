namespace GlobCRM.Domain.Enums;

/// <summary>
/// Supported custom field types for admin-defined fields.
/// Each type determines input rendering, validation rules, and storage behavior.
/// </summary>
public enum CustomFieldType
{
    /// <summary>Single-line or multi-line text input.</summary>
    Text = 0,

    /// <summary>Numeric input with optional min/max validation.</summary>
    Number = 1,

    /// <summary>Date picker input.</summary>
    Date = 2,

    /// <summary>Single-select dropdown with predefined options.</summary>
    Dropdown = 3,

    /// <summary>Boolean checkbox (true/false).</summary>
    Checkbox = 4,

    /// <summary>Multi-select with predefined options (rendered as chips).</summary>
    MultiSelect = 5,

    /// <summary>Currency amount with formatting.</summary>
    Currency = 6,

    /// <summary>File attachment reference.</summary>
    File = 7,

    /// <summary>Relation to another entity (e.g., Contact -> Company).</summary>
    Relation = 8
}
