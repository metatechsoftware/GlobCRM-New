using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.EmailTemplates;

/// <summary>
/// Repository for EmailTemplate CRUD operations.
/// All queries are automatically tenant-scoped via global query filters.
/// </summary>
public class EmailTemplateRepository
{
    private readonly ApplicationDbContext _db;

    public EmailTemplateRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Gets all email templates for the current tenant with optional filtering.
    /// </summary>
    public async Task<List<EmailTemplate>> GetAllAsync(
        Guid? categoryId = null,
        bool? isShared = null,
        string? search = null,
        CancellationToken ct = default)
    {
        var query = _db.EmailTemplates
            .Include(t => t.Category)
            .Include(t => t.Owner)
            .AsQueryable();

        if (categoryId.HasValue)
            query = query.Where(t => t.CategoryId == categoryId.Value);

        if (isShared.HasValue)
            query = query.Where(t => t.IsShared == isShared.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(t =>
                t.Name.ToLower().Contains(searchLower) ||
                (t.Subject != null && t.Subject.ToLower().Contains(searchLower)));
        }

        return await query
            .OrderBy(t => t.Name)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Gets a single email template by ID.
    /// </summary>
    public async Task<EmailTemplate?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.EmailTemplates
            .Include(t => t.Category)
            .Include(t => t.Owner)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    /// <summary>
    /// Creates a new email template.
    /// </summary>
    public async Task<EmailTemplate> CreateAsync(EmailTemplate template, CancellationToken ct = default)
    {
        _db.EmailTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return template;
    }

    /// <summary>
    /// Updates an existing email template.
    /// </summary>
    public async Task<EmailTemplate> UpdateAsync(EmailTemplate template, CancellationToken ct = default)
    {
        _db.EmailTemplates.Update(template);
        await _db.SaveChangesAsync(ct);
        return template;
    }

    /// <summary>
    /// Deletes an email template by ID.
    /// </summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _db.EmailTemplates.FindAsync([id], ct);
        if (template != null)
        {
            _db.EmailTemplates.Remove(template);
            await _db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Clones an existing email template with a new name.
    /// Creates a deep copy with a new ID and reset audit fields.
    /// </summary>
    public async Task<EmailTemplate?> CloneAsync(Guid id, string newName, CancellationToken ct = default)
    {
        var source = await _db.EmailTemplates.FindAsync([id], ct);
        if (source == null) return null;

        var clone = new EmailTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = source.TenantId,
            Name = newName,
            Subject = source.Subject,
            DesignJson = source.DesignJson,
            HtmlBody = source.HtmlBody,
            CategoryId = source.CategoryId,
            OwnerId = source.OwnerId,
            IsShared = source.IsShared,
            IsSeedData = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.EmailTemplates.Add(clone);
        await _db.SaveChangesAsync(ct);
        return clone;
    }
}
