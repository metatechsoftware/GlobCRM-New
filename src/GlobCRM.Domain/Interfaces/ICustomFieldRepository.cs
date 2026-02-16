using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository for custom field definition and section CRUD operations.
/// Operates on ApplicationDbContext (tenant-scoped via global query filters).
/// Includes methods for soft-delete management and restore.
/// </summary>
public interface ICustomFieldRepository
{
    /// <summary>
    /// Gets all active (non-deleted) custom field definitions for an entity type,
    /// ordered by SortOrder. Includes Section navigation property.
    /// </summary>
    Task<List<CustomFieldDefinition>> GetFieldsByEntityTypeAsync(string entityType);

    /// <summary>
    /// Gets a single custom field definition by ID.
    /// Returns null if not found or soft-deleted.
    /// </summary>
    Task<CustomFieldDefinition?> GetByIdAsync(Guid id);

    /// <summary>
    /// Creates a new custom field definition.
    /// </summary>
    Task<CustomFieldDefinition> CreateAsync(CustomFieldDefinition field);

    /// <summary>
    /// Updates an existing custom field definition.
    /// </summary>
    Task UpdateAsync(CustomFieldDefinition field);

    /// <summary>
    /// Soft-deletes a custom field definition by setting IsDeleted=true and DeletedAt=now.
    /// Data is preserved for potential restoration.
    /// </summary>
    Task SoftDeleteAsync(Guid id);

    /// <summary>
    /// Restores a soft-deleted custom field definition by setting IsDeleted=false and DeletedAt=null.
    /// Uses IgnoreQueryFilters() to find deleted fields.
    /// </summary>
    Task RestoreAsync(Guid id);

    /// <summary>
    /// Gets all soft-deleted custom field definitions for an entity type.
    /// Used by the admin restore UI. Bypasses the soft-delete query filter.
    /// </summary>
    Task<List<CustomFieldDefinition>> GetDeletedFieldsAsync(string entityType);

    /// <summary>
    /// Gets all sections for an entity type, ordered by SortOrder.
    /// </summary>
    Task<List<CustomFieldSection>> GetSectionsAsync(string entityType);

    /// <summary>
    /// Creates a new custom field section.
    /// </summary>
    Task<CustomFieldSection> CreateSectionAsync(CustomFieldSection section);

    /// <summary>
    /// Updates an existing custom field section.
    /// </summary>
    Task UpdateSectionAsync(CustomFieldSection section);

    /// <summary>
    /// Hard-deletes a section. Fields in the deleted section get their SectionId set to null.
    /// </summary>
    Task DeleteSectionAsync(Guid sectionId);
}
