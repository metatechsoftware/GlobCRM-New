using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository for Invitation CRUD operations.
/// Uses ApplicationDbContext for tenant-scoped operations and
/// raw queries bypassing query filters for cross-tenant token lookup.
/// </summary>
public class InvitationRepository : IInvitationRepository
{
    private readonly ApplicationDbContext _context;

    public InvitationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Looks up an invitation by its token. Cross-tenant by design --
    /// bypasses the global query filter using IgnoreQueryFilters() because
    /// invitation acceptance happens before the user has a tenant context.
    /// </summary>
    public async Task<Invitation?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        return await _context.Invitations
            .IgnoreQueryFilters()
            .Include(i => i.InvitedByUser)
            .FirstOrDefaultAsync(i => i.Token == token, cancellationToken);
    }

    /// <summary>
    /// Gets all invitations for a specific organization, ordered by creation date descending.
    /// Uses IgnoreQueryFilters to allow explicit org filtering without relying on tenant context.
    /// </summary>
    public async Task<IReadOnlyList<Invitation>> GetByOrganizationAsync(
        Guid orgId, CancellationToken cancellationToken = default)
    {
        return await _context.Invitations
            .IgnoreQueryFilters()
            .Include(i => i.InvitedByUser)
            .Where(i => i.TenantId == orgId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Gets a pending (not accepted, not expired) invitation for a specific email in an org.
    /// Used to check for duplicate invitations before sending.
    /// </summary>
    public async Task<Invitation?> GetPendingByEmailAsync(
        Guid orgId, string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        return await _context.Invitations
            .IgnoreQueryFilters()
            .Where(i => i.TenantId == orgId
                && i.Email == normalizedEmail
                && i.AcceptedAt == null
                && i.ExpiresAt > DateTimeOffset.UtcNow)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Gets an invitation by ID within a specific organization.
    /// </summary>
    public async Task<Invitation?> GetByIdAsync(
        Guid id, Guid orgId, CancellationToken cancellationToken = default)
    {
        return await _context.Invitations
            .IgnoreQueryFilters()
            .Include(i => i.InvitedByUser)
            .Where(i => i.Id == id && i.TenantId == orgId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Creates a new invitation.
    /// </summary>
    public async Task<Invitation> CreateAsync(
        Invitation invitation, CancellationToken cancellationToken = default)
    {
        _context.Invitations.Add(invitation);
        await _context.SaveChangesAsync(cancellationToken);
        return invitation;
    }

    /// <summary>
    /// Updates an existing invitation (e.g., mark as accepted, resend with new token).
    /// </summary>
    public async Task UpdateAsync(
        Invitation invitation, CancellationToken cancellationToken = default)
    {
        _context.Invitations.Update(invitation);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Deletes (removes) an invitation. Used for revocation.
    /// </summary>
    public async Task DeleteAsync(
        Invitation invitation, CancellationToken cancellationToken = default)
    {
        _context.Invitations.Remove(invitation);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
