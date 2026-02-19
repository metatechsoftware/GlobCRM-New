using System.Reflection;
using System.Text.Json;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Workflow action that updates a field value on the triggering entity.
/// Supports both static values and dynamic mapping from trigger entity fields.
/// Handles both standard entity properties (via reflection) and custom fields (JSONB).
///
/// WARNING: SaveChangesAsync here WILL trigger DomainEventInterceptor, which re-enters
/// WorkflowDomainEventHandler. The WorkflowLoopGuard prevents infinite recursion.
/// </summary>
public class UpdateFieldAction
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<UpdateFieldAction> _logger;

    public UpdateFieldAction(ApplicationDbContext db, ILogger<UpdateFieldAction> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Executes the update field action.
    /// </summary>
    /// <param name="configJson">JSON config: { FieldName, Value, IsDynamic, DynamicSourceField }</param>
    /// <param name="entityData">Current entity data dictionary for dynamic value resolution.</param>
    /// <param name="context">Trigger context with entity type and ID.</param>
    public async Task ExecuteAsync(
        string configJson,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var config = JsonSerializer.Deserialize<UpdateFieldConfig>(configJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (config is null || string.IsNullOrEmpty(config.FieldName))
            throw new InvalidOperationException("UpdateField action requires FieldName in config");

        // Resolve value: static or dynamic
        var value = config.IsDynamic && !string.IsNullOrEmpty(config.DynamicSourceField)
            ? WorkflowConditionEvaluator.GetFieldValue(config.DynamicSourceField, entityData)?.ToString()
            : config.Value;

        _logger.LogDebug(
            "UpdateField action: setting {FieldName} to {Value} on {EntityType}/{EntityId}",
            config.FieldName, value, context.EntityType, context.EntityId);

        // Load entity and update
        var entity = await LoadEntityAsync(context.EntityType, context.EntityId);
        if (entity is null)
            throw new InvalidOperationException(
                $"Entity {context.EntityType}/{context.EntityId} not found for UpdateField action");

        // Check if it's a custom field (starts with "custom." or not a standard property)
        if (config.FieldName.StartsWith("custom.", StringComparison.OrdinalIgnoreCase))
        {
            // Update custom field in JSONB
            var customFieldName = config.FieldName["custom.".Length..];
            var customFieldsProp = entity.GetType().GetProperty("CustomFields");
            if (customFieldsProp?.GetValue(entity) is Dictionary<string, object?> customFields)
            {
                customFields[customFieldName] = value;
            }
        }
        else
        {
            // Update standard property via reflection
            var propInfo = entity.GetType().GetProperty(config.FieldName,
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);

            if (propInfo is not null && propInfo.CanWrite)
            {
                var convertedValue = ConvertValue(value, propInfo.PropertyType);
                propInfo.SetValue(entity, convertedValue);
            }
            else
            {
                _logger.LogWarning(
                    "Property {FieldName} not found or not writable on {EntityType}",
                    config.FieldName, context.EntityType);
            }
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Loads the entity from DbContext by type and ID.
    /// </summary>
    private async Task<object?> LoadEntityAsync(string entityType, Guid entityId)
    {
        return entityType switch
        {
            "Contact" => await _db.Contacts.FirstOrDefaultAsync(c => c.Id == entityId),
            "Company" => await _db.Companies.FirstOrDefaultAsync(c => c.Id == entityId),
            "Deal" => await _db.Deals.FirstOrDefaultAsync(d => d.Id == entityId),
            "Lead" => await _db.Leads.FirstOrDefaultAsync(l => l.Id == entityId),
            "Activity" => await _db.Activities.FirstOrDefaultAsync(a => a.Id == entityId),
            _ => null
        };
    }

    /// <summary>
    /// Converts a string value to the target property type.
    /// </summary>
    private static object? ConvertValue(string? value, Type targetType)
    {
        if (value is null)
            return null;

        var underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;

        if (underlyingType == typeof(string))
            return value;

        if (underlyingType == typeof(Guid))
            return Guid.TryParse(value, out var guid) ? guid : null;

        if (underlyingType == typeof(int))
            return int.TryParse(value, out var intVal) ? intVal : null;

        if (underlyingType == typeof(decimal))
            return decimal.TryParse(value, out var decVal) ? decVal : null;

        if (underlyingType == typeof(double))
            return double.TryParse(value, out var dblVal) ? dblVal : null;

        if (underlyingType == typeof(bool))
            return bool.TryParse(value, out var boolVal) ? boolVal : null;

        if (underlyingType == typeof(DateTimeOffset))
            return DateTimeOffset.TryParse(value, out var dto) ? dto : null;

        if (underlyingType.IsEnum)
            return Enum.TryParse(underlyingType, value, true, out var enumVal) ? enumVal : null;

        return Convert.ChangeType(value, underlyingType);
    }

    private class UpdateFieldConfig
    {
        public string FieldName { get; set; } = string.Empty;
        public string? Value { get; set; }
        public bool IsDynamic { get; set; }
        public string? DynamicSourceField { get; set; }
    }
}
