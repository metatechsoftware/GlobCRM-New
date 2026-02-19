namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the entity types that can have CRUD permissions assigned.
/// Used as permission targets in the RBAC system.
/// </summary>
public enum EntityType
{
    Contact,
    Company,
    Deal,
    Activity,
    Quote,
    Request,
    Product,
    Note,
    Lead,
    EmailTemplate,
    EmailSequence
}
