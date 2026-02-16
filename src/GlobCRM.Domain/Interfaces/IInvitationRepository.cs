using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository for Invitation CRUD operations.
/// Includes both tenant-scoped and cross-tenant operations (token lookup).
/// </summary>
public interface IInvitationRepository
{
    /// <summary>
    /// Looks up an invitation by its token. Cross-tenant by design --
    /// invitation token lookup does not require tenant context since the
    /// accepting user hasn't joined an org yet.
    /// </summary>
    Task<Invitation?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all invitations for a specific organization.
    /// </summary>
    Task<IReadOnlyList<Invitation>> GetByOrganizationAsync(Guid orgId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a pending (not accepted, not expired) invitation for a specific email in an org.
    /// Used to check for duplicate invitations before sending.
    /// </summary>
    Task<Invitation?> GetPendingByEmailAsync(Guid orgId, string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets an invitation by ID within a specific organization.
    /// </summary>
    Task<Invitation?> GetByIdAsync(Guid id, Guid orgId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new invitation.
    /// </summary>
    Task<Invitation> CreateAsync(Invitation invitation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing invitation (e.g., mark as accepted, resend with new token).
    /// </summary>
    Task UpdateAsync(Invitation invitation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes (removes) an invitation. Used for revocation.
    /// </summary>
    Task DeleteAsync(Invitation invitation, CancellationToken cancellationToken = default);
}
