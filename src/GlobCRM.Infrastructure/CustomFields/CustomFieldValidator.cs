using System.Text.Json;
using System.Text.RegularExpressions;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;

namespace GlobCRM.Infrastructure.CustomFields;

/// <summary>
/// Server-side validator for custom field values against their field definitions.
/// Validates type correctness, required fields, min/max constraints, regex patterns,
/// and dropdown option membership. Per research pitfall #6: server-side validation
/// is critical; do NOT rely solely on client-side validation.
///
/// Unique constraint validation is deferred to Phase 3 when entities exist.
/// </summary>
public class CustomFieldValidator
{
    private readonly ICustomFieldRepository _repository;

    public CustomFieldValidator(ICustomFieldRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Validates custom field values against their definitions.
    /// Each key in customFieldValues is the field ID (as string GUID).
    /// Returns a list of validation errors (empty = valid).
    /// </summary>
    public async Task<List<ValidationError>> ValidateAsync(
        string entityType,
        Dictionary<string, object?> customFieldValues)
    {
        var errors = new List<ValidationError>();
        var fields = await _repository.GetFieldsByEntityTypeAsync(entityType);
        var fieldMap = fields.ToDictionary(f => f.Id.ToString(), f => f);

        foreach (var (fieldId, value) in customFieldValues)
        {
            // Look up the field definition
            if (!fieldMap.TryGetValue(fieldId, out var fieldDef))
            {
                errors.Add(new ValidationError(fieldId, "Unknown field."));
                continue;
            }

            // Check required validation
            if (fieldDef.Validation.Required && IsNullOrEmpty(value))
            {
                errors.Add(new ValidationError(fieldId, $"'{fieldDef.Label}' is required."));
                continue;
            }

            // Skip type validation if value is null/empty (field is not required)
            if (IsNullOrEmpty(value))
                continue;

            // Validate value against field type
            var typeError = ValidateFieldType(fieldDef, value);
            if (typeError is not null)
            {
                errors.Add(new ValidationError(fieldId, typeError));
            }
        }

        // Check required fields that are not in the submitted values
        foreach (var field in fields)
        {
            if (field.Validation.Required && !customFieldValues.ContainsKey(field.Id.ToString()))
            {
                errors.Add(new ValidationError(field.Id.ToString(), $"'{field.Label}' is required."));
            }
        }

        return errors;
    }

    /// <summary>
    /// Validates a value against the field's type and validation rules.
    /// Returns an error message if invalid, or null if valid.
    /// </summary>
    private string? ValidateFieldType(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        return fieldDef.FieldType switch
        {
            CustomFieldType.Text => ValidateText(fieldDef, value),
            CustomFieldType.Number => ValidateNumber(fieldDef, value),
            CustomFieldType.Date => ValidateDate(fieldDef, value),
            CustomFieldType.Dropdown => ValidateDropdown(fieldDef, value),
            CustomFieldType.Checkbox => ValidateCheckbox(fieldDef, value),
            CustomFieldType.MultiSelect => ValidateMultiSelect(fieldDef, value),
            CustomFieldType.Currency => ValidateCurrency(fieldDef, value),
            CustomFieldType.File => ValidateFile(fieldDef, value),
            CustomFieldType.Relation => ValidateRelation(fieldDef, value),
            _ => $"Unsupported field type: {fieldDef.FieldType}."
        };
    }

    private string? ValidateText(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        var str = ConvertToString(value);
        if (str is null)
            return $"'{fieldDef.Label}' must be a text value.";

        if (fieldDef.Validation.MinLength.HasValue && str.Length < fieldDef.Validation.MinLength.Value)
            return $"'{fieldDef.Label}' must be at least {fieldDef.Validation.MinLength.Value} characters.";

        if (fieldDef.Validation.MaxLength.HasValue && str.Length > fieldDef.Validation.MaxLength.Value)
            return $"'{fieldDef.Label}' must be at most {fieldDef.Validation.MaxLength.Value} characters.";

        if (!string.IsNullOrEmpty(fieldDef.Validation.RegexPattern))
        {
            try
            {
                if (!Regex.IsMatch(str, fieldDef.Validation.RegexPattern))
                    return $"'{fieldDef.Label}' does not match the required pattern.";
            }
            catch (RegexParseException)
            {
                return $"'{fieldDef.Label}' has an invalid validation pattern configured.";
            }
        }

        return null;
    }

    private string? ValidateNumber(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        if (!TryConvertToDecimal(value, out var number))
            return $"'{fieldDef.Label}' must be a numeric value.";

        if (fieldDef.Validation.MinValue.HasValue && number < fieldDef.Validation.MinValue.Value)
            return $"'{fieldDef.Label}' must be at least {fieldDef.Validation.MinValue.Value}.";

        if (fieldDef.Validation.MaxValue.HasValue && number > fieldDef.Validation.MaxValue.Value)
            return $"'{fieldDef.Label}' must be at most {fieldDef.Validation.MaxValue.Value}.";

        return null;
    }

    private string? ValidateDate(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        var str = ConvertToString(value);
        if (str is null || !DateTimeOffset.TryParse(str, out _))
            return $"'{fieldDef.Label}' must be a valid date.";

        return null;
    }

    private string? ValidateDropdown(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        var str = ConvertToString(value);
        if (str is null)
            return $"'{fieldDef.Label}' must be a text value.";

        if (fieldDef.Options is null || !fieldDef.Options.Any(o => o.Value == str))
            return $"'{fieldDef.Label}' must be one of the defined options.";

        return null;
    }

    private static string? ValidateCheckbox(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        if (value is bool)
            return null;

        if (value is JsonElement je && je.ValueKind == JsonValueKind.True || value is JsonElement je2 && je2.ValueKind == JsonValueKind.False)
            return null;

        var str = ConvertToString(value);
        if (str is not null && bool.TryParse(str, out _))
            return null;

        return $"'{fieldDef.Label}' must be a boolean value (true/false).";
    }

    private string? ValidateMultiSelect(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        var values = ConvertToStringList(value);
        if (values is null)
            return $"'{fieldDef.Label}' must be a list of values.";

        if (fieldDef.Options is null)
            return $"'{fieldDef.Label}' has no defined options.";

        var validValues = fieldDef.Options.Select(o => o.Value).ToHashSet();
        var invalidValues = values.Where(v => !validValues.Contains(v)).ToList();

        if (invalidValues.Count > 0)
            return $"'{fieldDef.Label}' contains invalid options: {string.Join(", ", invalidValues)}.";

        return null;
    }

    private string? ValidateCurrency(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        if (!TryConvertToDecimal(value, out var amount))
            return $"'{fieldDef.Label}' must be a numeric (decimal) value.";

        if (fieldDef.Validation.MinValue.HasValue && amount < fieldDef.Validation.MinValue.Value)
            return $"'{fieldDef.Label}' must be at least {fieldDef.Validation.MinValue.Value}.";

        if (fieldDef.Validation.MaxValue.HasValue && amount > fieldDef.Validation.MaxValue.Value)
            return $"'{fieldDef.Label}' must be at most {fieldDef.Validation.MaxValue.Value}.";

        return null;
    }

    private static string? ValidateFile(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        var str = ConvertToString(value);
        if (str is null)
            return $"'{fieldDef.Label}' must be a file path or URL string.";

        return null;
    }

    private static string? ValidateRelation(Domain.Entities.CustomFieldDefinition fieldDef, object? value)
    {
        var str = ConvertToString(value);
        if (str is null || !Guid.TryParse(str, out _))
            return $"'{fieldDef.Label}' must be a valid entity ID (GUID).";

        return null;
    }

    // ---- Helper methods ----

    private static bool IsNullOrEmpty(object? value)
    {
        if (value is null)
            return true;

        if (value is JsonElement je && je.ValueKind == JsonValueKind.Null)
            return true;

        var str = ConvertToString(value);
        return string.IsNullOrWhiteSpace(str);
    }

    private static string? ConvertToString(object? value)
    {
        if (value is null)
            return null;

        if (value is string s)
            return s;

        if (value is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => je.GetString(),
                JsonValueKind.Number => je.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Null => null,
                _ => je.GetRawText()
            };
        }

        return value.ToString();
    }

    private static bool TryConvertToDecimal(object? value, out decimal result)
    {
        result = 0;

        if (value is null)
            return false;

        if (value is decimal d) { result = d; return true; }
        if (value is int i) { result = i; return true; }
        if (value is long l) { result = l; return true; }
        if (value is double dbl) { result = (decimal)dbl; return true; }
        if (value is float f) { result = (decimal)f; return true; }

        if (value is JsonElement je && je.ValueKind == JsonValueKind.Number)
        {
            if (je.TryGetDecimal(out var jd)) { result = jd; return true; }
        }

        var str = ConvertToString(value);
        return str is not null && decimal.TryParse(str, out result);
    }

    private static List<string>? ConvertToStringList(object? value)
    {
        if (value is null)
            return null;

        if (value is List<string> list)
            return list;

        if (value is IEnumerable<string> enumerable)
            return enumerable.ToList();

        if (value is JsonElement je && je.ValueKind == JsonValueKind.Array)
        {
            var result = new List<string>();
            foreach (var item in je.EnumerateArray())
            {
                var str = item.ValueKind == JsonValueKind.String
                    ? item.GetString()
                    : item.GetRawText();

                if (str is not null)
                    result.Add(str);
            }
            return result;
        }

        return null;
    }
}

/// <summary>
/// Represents a single validation error for a custom field value.
/// </summary>
/// <param name="FieldId">The custom field definition ID that failed validation.</param>
/// <param name="Message">Human-readable error message describing the validation failure.</param>
public record ValidationError(string FieldId, string Message);
