using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Tenant-scoped integration entity.
/// Stores per-tenant connection state for a third-party integration (e.g., "slack", "gmail").
/// Credentials are stored as an AES-256 encrypted JSON blob via DataProtection.
/// One integration per key per tenant (enforced by unique composite index).
/// </summary>
public class Integration
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Matches the frontend catalog key slug (e.g., "slack", "gmail", "zapier").
    /// Used to look up the integration definition from the static catalog.
    /// </summary>
    public string IntegrationKey { get; set; } = string.Empty;

    /// <summary>
    /// Current connection status: Connected or Disconnected.
    /// </summary>
    public IntegrationStatus Status { get; set; } = IntegrationStatus.Disconnected;

    /// <summary>
    /// AES-256 encrypted JSON blob of all credentials for this integration.
    /// Encrypted via CredentialEncryptionService (DataProtection).
    /// Null when disconnected and credentials have been cleared.
    /// </summary>
    public string? EncryptedCredentials { get; set; }

    /// <summary>
    /// Masked display value for the primary credential (e.g., "........a1b2").
    /// Safe to display in UI without exposing the actual credential.
    /// </summary>
    public string? CredentialMask { get; set; }

    /// <summary>
    /// The user who connected (or last reconnected) this integration.
    /// </summary>
    public Guid ConnectedByUserId { get; set; }

    /// <summary>
    /// Timestamp when the integration was connected (or last reconnected).
    /// </summary>
    public DateTimeOffset ConnectedAt { get; set; }

    /// <summary>
    /// Timestamp when the integration was disconnected. Null if currently connected.
    /// </summary>
    public DateTimeOffset? DisconnectedAt { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Activity log entries for this integration (connect, disconnect, test events).
    /// </summary>
    public ICollection<IntegrationActivityLog> ActivityLogs { get; set; } = new List<IntegrationActivityLog>();
}
