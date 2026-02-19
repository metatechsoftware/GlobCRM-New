using System.Text.Json;
using GlobCRM.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Evaluates workflow condition groups against entity data and change tracking information.
/// OR logic across groups (any group passes = true), AND logic within groups (all conditions pass = true).
/// Supports field-change operators (changed_to, changed_from_to) using the DomainEvent's
/// ChangedProperties and OldPropertyValues dictionaries.
/// </summary>
public class WorkflowConditionEvaluator
{
    private readonly ILogger<WorkflowConditionEvaluator> _logger;

    public WorkflowConditionEvaluator(ILogger<WorkflowConditionEvaluator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Evaluates condition groups against entity data and change tracking.
    /// Returns true if no conditions are configured (unconditional execution).
    /// </summary>
    /// <param name="conditionGroups">The condition groups from the workflow definition.</param>
    /// <param name="entityData">Current entity field values as a flat dictionary.</param>
    /// <param name="changedProperties">Changed property values from the domain event (null for non-update events).</param>
    /// <param name="oldPropertyValues">Original property values before the change (null for non-update events).</param>
    /// <returns>True if conditions pass (any group matches), false otherwise.</returns>
    public bool Evaluate(
        List<WorkflowConditionGroup> conditionGroups,
        Dictionary<string, object?> entityData,
        Dictionary<string, object?>? changedProperties,
        Dictionary<string, object?>? oldPropertyValues)
    {
        // No conditions = always pass
        if (conditionGroups is null or { Count: 0 })
            return true;

        // OR logic across groups: any group passing = overall pass
        return conditionGroups.Any(group => EvaluateGroup(group, entityData, changedProperties, oldPropertyValues));
    }

    /// <summary>
    /// Evaluates a single condition group. AND logic: all conditions must pass.
    /// </summary>
    private bool EvaluateGroup(
        WorkflowConditionGroup group,
        Dictionary<string, object?> entityData,
        Dictionary<string, object?>? changedProperties,
        Dictionary<string, object?>? oldPropertyValues)
    {
        if (group.Conditions is null or { Count: 0 })
            return true;

        return group.Conditions.All(condition =>
            EvaluateCondition(condition, entityData, changedProperties, oldPropertyValues));
    }

    /// <summary>
    /// Evaluates a single condition against entity data and change info.
    /// </summary>
    private bool EvaluateCondition(
        WorkflowCondition condition,
        Dictionary<string, object?> entityData,
        Dictionary<string, object?>? changedProperties,
        Dictionary<string, object?>? oldPropertyValues)
    {
        try
        {
            var fieldValue = GetFieldValue(condition.Field, entityData);
            var fieldStr = fieldValue?.ToString();
            var conditionValue = condition.Value;

            return condition.Operator.ToLowerInvariant() switch
            {
                "equals" => string.Equals(fieldStr, conditionValue, StringComparison.OrdinalIgnoreCase),

                "not_equals" => !string.Equals(fieldStr, conditionValue, StringComparison.OrdinalIgnoreCase),

                "gt" => CompareNumeric(fieldStr, conditionValue) > 0,

                "gte" => CompareNumeric(fieldStr, conditionValue) >= 0,

                "lt" => CompareNumeric(fieldStr, conditionValue) < 0,

                "lte" => CompareNumeric(fieldStr, conditionValue) <= 0,

                "contains" => fieldStr?.Contains(conditionValue ?? "", StringComparison.OrdinalIgnoreCase) == true,

                "changed_to" => EvaluateChangedTo(condition.Field, conditionValue, changedProperties),

                "changed_from_to" => EvaluateChangedFromTo(
                    condition.Field, condition.FromValue, conditionValue,
                    changedProperties, oldPropertyValues),

                "is_null" => fieldValue is null || fieldStr == "",

                "is_not_null" => fieldValue is not null && fieldStr != "",

                _ => false
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Condition evaluation failed for field {Field} operator {Operator}: {Error}",
                condition.Field, condition.Operator, ex.Message);
            return false;
        }
    }

    /// <summary>
    /// Evaluates a changed_to condition: the field must be in ChangedProperties
    /// AND the new value must match the condition value.
    /// </summary>
    private static bool EvaluateChangedTo(
        string field,
        string? expectedValue,
        Dictionary<string, object?>? changedProperties)
    {
        if (changedProperties is null)
            return false;

        if (!changedProperties.TryGetValue(field, out var newValue))
            return false;

        return string.Equals(newValue?.ToString(), expectedValue, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Evaluates a changed_from_to condition: the field must be in ChangedProperties,
    /// the new value must match, and if FromValue is specified, the old value must match too.
    /// Per locked decision: "from" value is optional — if null, only the "to" value is checked.
    /// </summary>
    private static bool EvaluateChangedFromTo(
        string field,
        string? fromValue,
        string? toValue,
        Dictionary<string, object?>? changedProperties,
        Dictionary<string, object?>? oldPropertyValues)
    {
        if (changedProperties is null)
            return false;

        // Check that the field was changed and the new value matches
        if (!changedProperties.TryGetValue(field, out var newValue))
            return false;

        if (!string.Equals(newValue?.ToString(), toValue, StringComparison.OrdinalIgnoreCase))
            return false;

        // If FromValue is specified, check the old value
        if (fromValue is not null)
        {
            if (oldPropertyValues is null)
                return false;

            if (!oldPropertyValues.TryGetValue(field, out var oldValue))
                return false;

            if (!string.Equals(oldValue?.ToString(), fromValue, StringComparison.OrdinalIgnoreCase))
                return false;
        }

        return true;
    }

    /// <summary>
    /// Resolves a field value from the entity data dictionary.
    /// Supports nested access via dot notation (e.g., "custom.my_field", "company.name").
    /// </summary>
    public static object? GetFieldValue(string field, Dictionary<string, object?> entityData)
    {
        if (string.IsNullOrEmpty(field))
            return null;

        // Simple top-level lookup first
        if (entityData.TryGetValue(field, out var directValue))
            return ResolveJsonElement(directValue);

        // Dot notation for nested access (e.g., "custom.field_name")
        var parts = field.Split('.', 2);
        if (parts.Length != 2)
            return null;

        if (!entityData.TryGetValue(parts[0], out var parentValue) || parentValue is null)
            return null;

        // If parent is a Dictionary, recurse
        if (parentValue is Dictionary<string, object?> nestedDict)
        {
            return nestedDict.TryGetValue(parts[1], out var nestedValue)
                ? ResolveJsonElement(nestedValue)
                : null;
        }

        // If parent is a JsonElement (from deserialized JSON)
        if (parentValue is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
        {
            if (jsonElement.TryGetProperty(parts[1], out var prop))
                return ResolveJsonElement(prop);
        }

        return null;
    }

    /// <summary>
    /// Unwraps a JsonElement to its primitive value for string comparison.
    /// </summary>
    private static object? ResolveJsonElement(object? value)
    {
        if (value is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => je.GetString(),
                JsonValueKind.Number => je.GetDecimal(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => je.GetRawText()
            };
        }

        return value;
    }

    /// <summary>
    /// Compares two string values as decimals. Returns -1, 0, or 1.
    /// Returns 0 if either value cannot be parsed (condition fails safely).
    /// </summary>
    private static int CompareNumeric(string? left, string? right)
    {
        if (decimal.TryParse(left, out var leftVal) && decimal.TryParse(right, out var rightVal))
            return leftVal.CompareTo(rightVal);

        // Can't compare — return 0 which effectively fails most comparisons
        return 0;
    }
}
