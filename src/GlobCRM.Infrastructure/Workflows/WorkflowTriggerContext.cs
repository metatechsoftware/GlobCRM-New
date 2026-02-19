namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Serializable context record passed to Hangfire for workflow execution.
/// Contains all information needed to evaluate conditions and execute actions
/// without re-querying the triggering event details.
///
/// NOTE: All properties must be primitive/string types for Hangfire JSON serialization.
/// ChangedProperties and OldPropertyValues are serialized as JSON strings.
/// </summary>
/// <param name="WorkflowId">The workflow to execute.</param>
/// <param name="EntityId">The entity that triggered the workflow.</param>
/// <param name="EntityType">The entity type name (e.g., "Contact", "Deal").</param>
/// <param name="TenantId">The tenant context for scoped operations.</param>
/// <param name="TriggerType">The trigger type that matched (e.g., "RecordCreated", "FieldChanged").</param>
/// <param name="EventType">The domain event type (e.g., "Created", "Updated", "Deleted").</param>
/// <param name="ChangedPropertiesJson">Serialized dictionary of changed property name to new value. Null for Created/Deleted.</param>
/// <param name="OldPropertyValuesJson">Serialized dictionary of property name to original value. Null for Created/Deleted.</param>
/// <param name="CurrentDepth">Execution depth for cross-Hangfire-job loop guard tracking.</param>
public record WorkflowTriggerContext(
    Guid WorkflowId,
    Guid EntityId,
    string EntityType,
    Guid TenantId,
    string TriggerType,
    string EventType,
    string? ChangedPropertiesJson,
    string? OldPropertyValuesJson,
    int CurrentDepth);
