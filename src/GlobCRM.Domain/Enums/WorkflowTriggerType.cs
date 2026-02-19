namespace GlobCRM.Domain.Enums;

/// <summary>
/// Types of events that can trigger a workflow execution.
/// RecordCreated/Updated/Deleted: CRUD operations on CRM entities.
/// FieldChanged: specific field value change detection.
/// DateBased: scheduled trigger based on a date field (e.g., CloseDate approaching).
/// </summary>
public enum WorkflowTriggerType
{
    RecordCreated,
    RecordUpdated,
    RecordDeleted,
    FieldChanged,
    DateBased
}
