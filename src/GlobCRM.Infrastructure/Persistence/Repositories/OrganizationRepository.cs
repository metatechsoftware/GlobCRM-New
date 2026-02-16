using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository for Organization CRUD operations.
/// Operates on TenantDbContext (not tenant-scoped) since organizations
/// are the tenants themselves and need cross-tenant visibility.
/// </summary>
public class OrganizationRepository : IOrganizationRepository
{
    private readonly TenantDbContext _context;

    public OrganizationRepository(TenantDbContext context)
    {
        _context = context;
    }

    public async Task<Organization?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Organizations
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
    }

    public async Task<Organization?> GetBySubdomainAsync(string subdomain, CancellationToken cancellationToken = default)
    {
        var normalized = subdomain.ToLowerInvariant();
        return await _context.Organizations
            .FirstOrDefaultAsync(o => o.Subdomain == normalized, cancellationToken);
    }

    /// <summary>
    /// Checks if a subdomain already exists (case-insensitive).
    /// Used for availability checking during org creation.
    /// </summary>
    public async Task<bool> SubdomainExistsAsync(string subdomain, CancellationToken cancellationToken = default)
    {
        var normalized = subdomain.ToLowerInvariant();
        return await _context.Organizations
            .AnyAsync(o => o.Subdomain == normalized, cancellationToken);
    }

    public async Task<Organization> CreateAsync(Organization organization, CancellationToken cancellationToken = default)
    {
        // Ensure subdomain is stored lowercase
        organization.Subdomain = organization.Subdomain.ToLowerInvariant();

        _context.Organizations.Add(organization);
        await _context.SaveChangesAsync(cancellationToken);
        return organization;
    }

    public async Task UpdateAsync(Organization organization, CancellationToken cancellationToken = default)
    {
        organization.UpdatedAt = DateTimeOffset.UtcNow;
        _context.Organizations.Update(organization);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Organization>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Organizations
            .OrderBy(o => o.Name)
            .ToListAsync(cancellationToken);
    }
}
