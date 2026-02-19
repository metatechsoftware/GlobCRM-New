using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.FormulaFields;

namespace GlobCRM.Infrastructure.Reporting;

/// <summary>
/// Discovers all available fields for a given CRM entity type, grouped by category:
/// system fields, custom fields, formula fields, and related entity fields (one level deep).
/// Used by the report builder to populate the field selection UI and by the query engine
/// to validate field references.
/// </summary>
public class ReportFieldMetadataService
{
    private readonly FieldRegistryService _fieldRegistry;
    private readonly ICustomFieldRepository _customFieldRepo;

    public ReportFieldMetadataService(
        FieldRegistryService fieldRegistry,
        ICustomFieldRepository customFieldRepo)
    {
        _fieldRegistry = fieldRegistry;
        _customFieldRepo = customFieldRepo;
    }

    /// <summary>
    /// Returns all available fields for the specified entity type, categorized into
    /// system, custom, formula, and related entity fields.
    /// </summary>
    public async Task<ReportFieldMetadataResult> GetFieldsForEntityTypeAsync(string entityType)
    {
        var customFieldDefs = await _customFieldRepo.GetFieldsByEntityTypeAsync(entityType);

        // System fields from FieldRegistryService
        var systemFields = _fieldRegistry.GetAvailableFields(entityType, [])
            .Select(f => new ReportFieldInfo
            {
                FieldId = f.Name,
                Label = f.Label,
                Category = "system",
                DataType = MapDataType(f.DataType),
                IsAggregatable = f.DataType is "number",
                IsGroupable = true,
                RelatedEntity = null,
                RelatedField = null
            })
            .ToList();

        // Custom fields (non-formula)
        var customFields = customFieldDefs
            .Where(f => f.FieldType != CustomFieldType.Formula)
            .Select(f => new ReportFieldInfo
            {
                FieldId = f.Name,
                Label = f.Label,
                Category = "custom",
                DataType = MapCustomFieldType(f.FieldType),
                IsAggregatable = f.FieldType is CustomFieldType.Number or CustomFieldType.Currency,
                IsGroupable = true,
                RelatedEntity = null,
                RelatedField = null
            })
            .ToList();

        // Formula fields
        var formulaFields = customFieldDefs
            .Where(f => f.FieldType == CustomFieldType.Formula)
            .Select(f => new ReportFieldInfo
            {
                FieldId = f.Name,
                Label = f.Label,
                Category = "formula",
                DataType = MapDataType(f.FormulaResultType ?? "text"),
                IsAggregatable = f.FormulaResultType == "number",
                IsGroupable = false, // Cannot GROUP BY formula in SQL -- computed server-side
                RelatedEntity = null,
                RelatedField = null
            })
            .ToList();

        // Related entity fields (one level deep)
        var relatedFields = GetRelatedFieldsForEntityType(entityType);

        return new ReportFieldMetadataResult
        {
            SystemFields = systemFields,
            CustomFields = customFields,
            FormulaFields = formulaFields,
            RelatedFields = relatedFields
        };
    }

    /// <summary>
    /// Returns related entity fields based on the FK relationship map for each entity type.
    /// Field IDs use "related.{RelatedEntity}.{fieldName}" format.
    /// Labels use "{RelatedEntity} > {FieldLabel}" format.
    /// </summary>
    private static List<ReportFieldInfo> GetRelatedFieldsForEntityType(string entityType) => entityType switch
    {
        "Contact" =>
        [
            .. BuildRelatedFields("Company", [
                ("name", "Name", "string"),
                ("industry", "Industry", "string"),
                ("website", "Website", "string"),
                ("phone", "Phone", "string"),
                ("city", "City", "string"),
                ("country", "Country", "string")
            ]),
            .. BuildRelatedFields("Owner", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ])
        ],

        "Deal" =>
        [
            .. BuildRelatedFields("Company", [
                ("name", "Name", "string"),
                ("industry", "Industry", "string")
            ]),
            .. BuildRelatedFields("Stage", [
                ("name", "Name", "string")
            ]),
            .. BuildRelatedFields("Pipeline", [
                ("name", "Name", "string")
            ]),
            .. BuildRelatedFields("Owner", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ])
        ],

        "Lead" =>
        [
            .. BuildRelatedFields("Stage", [
                ("name", "Name", "string")
            ]),
            .. BuildRelatedFields("Source", [
                ("name", "Name", "string")
            ]),
            .. BuildRelatedFields("Owner", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ])
        ],

        "Activity" =>
        [
            .. BuildRelatedFields("Owner", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ]),
            .. BuildRelatedFields("AssignedTo", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ])
        ],

        "Quote" =>
        [
            .. BuildRelatedFields("Contact", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ]),
            .. BuildRelatedFields("Company", [
                ("name", "Name", "string")
            ]),
            .. BuildRelatedFields("Deal", [
                ("title", "Title", "string"),
                ("value", "Value", "number")
            ]),
            .. BuildRelatedFields("Owner", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ])
        ],

        "Request" =>
        [
            .. BuildRelatedFields("Contact", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ]),
            .. BuildRelatedFields("Company", [
                ("name", "Name", "string")
            ]),
            .. BuildRelatedFields("Owner", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ]),
            .. BuildRelatedFields("AssignedTo", [
                ("firstName", "First Name", "string"),
                ("lastName", "Last Name", "string"),
                ("email", "Email", "string")
            ])
        ],

        "Company" => [],  // No related entity fields for Company
        "Product" => [],  // No related entity fields for Product

        _ => []
    };

    /// <summary>
    /// Builds ReportFieldInfo entries for a related entity's fields.
    /// </summary>
    private static List<ReportFieldInfo> BuildRelatedFields(
        string relatedEntity,
        List<(string fieldName, string label, string dataType)> fields)
    {
        return fields.Select(f => new ReportFieldInfo
        {
            FieldId = $"related.{relatedEntity}.{f.fieldName}",
            Label = $"{relatedEntity} > {f.label}",
            Category = "related",
            DataType = f.dataType,
            IsAggregatable = f.dataType is "number" or "currency",
            IsGroupable = true,
            RelatedEntity = relatedEntity,
            RelatedField = f.fieldName
        }).ToList();
    }

    /// <summary>
    /// Maps FieldRegistryService data type strings to ReportFieldInfo data types.
    /// </summary>
    private static string MapDataType(string dataType) => dataType switch
    {
        "number" => "number",
        "text" => "string",
        "date" => "date",
        "boolean" => "boolean",
        _ => "string"
    };

    /// <summary>
    /// Maps CustomFieldType enum to data type string.
    /// </summary>
    private static string MapCustomFieldType(CustomFieldType fieldType) => fieldType switch
    {
        CustomFieldType.Number => "number",
        CustomFieldType.Currency => "currency",
        CustomFieldType.Date => "date",
        CustomFieldType.Checkbox => "boolean",
        _ => "string"
    };
}

/// <summary>
/// Result container for field metadata grouped by category.
/// </summary>
public record ReportFieldMetadataResult
{
    public List<ReportFieldInfo> SystemFields { get; init; } = [];
    public List<ReportFieldInfo> CustomFields { get; init; } = [];
    public List<ReportFieldInfo> FormulaFields { get; init; } = [];
    public List<ReportFieldInfo> RelatedFields { get; init; } = [];
}

/// <summary>
/// Metadata about a single field available for report configuration.
/// </summary>
public record ReportFieldInfo
{
    /// <summary>
    /// Field identifier, e.g., "name", "custom_field_name", "related.Company.name".
    /// </summary>
    public string FieldId { get; init; } = string.Empty;

    /// <summary>
    /// Display name, e.g., "Company > Name".
    /// </summary>
    public string Label { get; init; } = string.Empty;

    /// <summary>
    /// Category: "system", "custom", "formula", "related".
    /// </summary>
    public string Category { get; init; } = string.Empty;

    /// <summary>
    /// Data type: "string", "number", "date", "boolean", "currency".
    /// </summary>
    public string DataType { get; init; } = string.Empty;

    /// <summary>
    /// True for number, currency, and formula-number fields.
    /// </summary>
    public bool IsAggregatable { get; init; }

    /// <summary>
    /// True for all except formula fields (can't GROUP BY formula in SQL).
    /// </summary>
    public bool IsGroupable { get; init; }

    /// <summary>
    /// Null for direct fields, "Company" for related.Company.name.
    /// </summary>
    public string? RelatedEntity { get; init; }

    /// <summary>
    /// Null for direct fields, "name" for related.Company.name.
    /// </summary>
    public string? RelatedField { get; init; }
}
