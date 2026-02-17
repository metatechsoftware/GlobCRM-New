using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a per-user Gmail OAuth connection in the CRM.
/// Stores encrypted OAuth tokens, sync state, and Gmail history ID for incremental sync.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// One account per user per tenant enforced by unique composite index.
/// </summary>
public class EmailAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// FK to ApplicationUser -- the CRM user who owns this Gmail connection.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the owning user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// The connected Gmail address (e.g., "user@gmail.com").
    /// </summary>
    public string GmailAddress { get; set; } = string.Empty;

    /// <summary>
    /// Encrypted OAuth access token for Gmail API calls.
    /// </summary>
    public string EncryptedAccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Encrypted OAuth refresh token for obtaining new access tokens.
    /// </summary>
    public string EncryptedRefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// When the current access token was issued.
    /// </summary>
    public DateTimeOffset TokenIssuedAt { get; set; }

    /// <summary>
    /// When the current access token expires.
    /// </summary>
    public DateTimeOffset TokenExpiresAt { get; set; }

    /// <summary>
    /// Gmail history ID for incremental sync. Null until first full sync completes.
    /// </summary>
    public ulong? LastHistoryId { get; set; }

    /// <summary>
    /// Timestamp of last successful sync. Null if never synced.
    /// </summary>
    public DateTimeOffset? LastSyncAt { get; set; }

    /// <summary>
    /// Current sync status of the email account.
    /// </summary>
    public EmailSyncStatus SyncStatus { get; set; } = EmailSyncStatus.Active;

    /// <summary>
    /// Stores last error message when SyncStatus is Error.
    /// </summary>
    public string? ErrorMessage { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
