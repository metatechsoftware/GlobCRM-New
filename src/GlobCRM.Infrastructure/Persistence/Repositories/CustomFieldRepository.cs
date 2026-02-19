using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository for custom field definition and section CRUD operations.
/// Uses ApplicationDbContext with tenant-scoped global query filters.
/// Soft-deleted fields are excluded by default; dedicated methods use
/// IgnoreQueryFilters() for admin restore operations.
/// </summary>
public class CustomFieldRepository : ICustomFieldRepository
{
    private readonly ApplicationDbContext _context;

    public CustomFieldRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Gets all active (non-deleted) custom field definitions for an entity type.
    /// The global query filter already excludes IsDeleted=true, so no additional filtering needed.
    /// Includes Section navigation property for grouping display.
    /// </summary>
    public async Task<List<CustomFieldDefinition>> GetFieldsByEntityTypeAsync(string entityType)
    {
        return await _context.CustomFieldDefinitions
            .Include(f => f.Section)
            .Where(f => f.EntityType == entityType)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();
    }

    /// <summary>
    /// Gets a single custom field definition by ID.
    /// Returns null if not found or soft-deleted (filtered by global query filter).
    /// </summary>
    public async Task<CustomFieldDefinition?> GetByIdAsync(Guid id)
    {
        return await _context.CustomFieldDefinitions
            .Include(f => f.Section)
            .FirstOrDefaultAsync(f => f.Id == id);
    }

    public async Task<CustomFieldDefinition> CreateAsync(CustomFieldDefinition field)
    {
        _context.CustomFieldDefinitions.Add(field);
        await _context.SaveChangesAsync();
        return field;
    }

    public async Task UpdateAsync(CustomFieldDefinition field)
    {
        field.UpdatedAt = DateTimeOffset.UtcNow;
        _context.CustomFieldDefinitions.Update(field);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Soft-deletes a field by setting IsDeleted=true and DeletedAt=now.
    /// The field remains in the database for data preservation but is excluded
    /// from normal queries by the global query filter.
    /// </summary>
    public async Task SoftDeleteAsync(Guid id)
    {
        var field = await _context.CustomFieldDefinitions
            .FirstOrDefaultAsync(f => f.Id == id);

        if (field is not null)
        {
            field.IsDeleted = true;
            field.DeletedAt = DateTimeOffset.UtcNow;
            field.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Restores a soft-deleted field. Uses IgnoreQueryFilters() to bypass
    /// the soft-delete portion of the global query filter, then sets
    /// IsDeleted=false and clears DeletedAt.
    /// </summary>
    public async Task RestoreAsync(Guid id)
    {
        var field = await _context.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.Id == id && f.IsDeleted);

        if (field is not null)
        {
            field.IsDeleted = false;
            field.DeletedAt = null;
            field.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Gets all soft-deleted fields for an entity type using IgnoreQueryFilters()
    /// to bypass the global query filter, then explicitly filtering for IsDeleted=true.
    /// Used by the admin restore UI.
    /// </summary>
    public async Task<List<CustomFieldDefinition>> GetDeletedFieldsAsync(string entityType)
    {
        return await _context.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .Where(f => f.EntityType == entityType && f.IsDeleted)
            .OrderBy(f => f.DeletedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Gets all sections for an entity type, ordered by SortOrder.
    /// </summary>
    public async Task<List<CustomFieldSection>> GetSectionsAsync(string entityType)
    {
        return await _context.CustomFieldSections
            .Where(s => s.EntityType == entityType)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    public async Task<CustomFieldSection> CreateSectionAsync(CustomFieldSection section)
    {
        _context.CustomFieldSections.Add(section);
        await _context.SaveChangesAsync();
        return section;
    }

    public async Task UpdateSectionAsync(CustomFieldSection section)
    {
        _context.CustomFieldSections.Update(section);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Gets custom field definitions marked as ShowInPreview for an entity type.
    /// Excludes soft-deleted fields. Ordered by SortOrder for consistent display.
    /// </summary>
    public async Task<List<CustomFieldDefinition>> GetPinnedForPreviewAsync(string entityType)
    {
        return await _context.CustomFieldDefinitions
            .Where(c => c.EntityType == entityType && c.ShowInPreview && !c.IsDeleted)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();
    }

    /// <summary>
    /// Hard-deletes a section. Fields referencing this section get their SectionId
    /// set to null so they appear in the default (ungrouped) area.
    /// </summary>
    public async Task DeleteSectionAsync(Guid sectionId)
    {
        var section = await _context.CustomFieldSections
            .FirstOrDefaultAsync(s => s.Id == sectionId);

        if (section is not null)
        {
            // Unlink fields from this section before deleting
            var fieldsInSection = await _context.CustomFieldDefinitions
                .Where(f => f.SectionId == sectionId)
                .ToListAsync();

            foreach (var field in fieldsInSection)
            {
                field.SectionId = null;
            }

            _context.CustomFieldSections.Remove(section);
            await _context.SaveChangesAsync();
        }
    }
}
