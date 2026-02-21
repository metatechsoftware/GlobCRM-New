using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records each connect, disconnect, or test event for an integration.
/// Provides an audit trail of integration lifecycle events per tenant.
/// User name is denormalized for efficient display without joins.
/// </summary>
public class IntegrationActivityLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// FK to the parent Integration entity.
    /// </summary>
    public Guid IntegrationId { get; set; }

    /// <summary>
    /// The action that was performed (Connected, Disconnected, TestSuccess, TestFailed).
    /// </summary>
    public IntegrationAction Action { get; set; }

    /// <summary>
    /// The user who performed this action.
    /// </summary>
    public Guid PerformedByUserId { get; set; }

    /// <summary>
    /// Denormalized user display name for efficient rendering without joins.
    /// </summary>
    public string PerformedByUserName { get; set; } = string.Empty;

    /// <summary>
    /// Optional detail text (e.g., "Test failed: connection timeout").
    /// </summary>
    public string? Details { get; set; }

    // Audit timestamp
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Navigation property to the parent Integration.
    /// </summary>
    public Integration Integration { get; set; } = null!;
}
