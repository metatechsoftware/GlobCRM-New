namespace GlobCRM.Domain.Entities;

/// <summary>
/// Tenant-scoped webhook subscription entity.
/// Stores the target URL, HMAC secret, event subscriptions (as JSONB list of "Entity.EventType" strings),
/// active/disabled state, and consecutive failure tracking for auto-disable.
///
/// Core 5 entities: Contact, Company, Deal, Lead, Activity.
/// Event types per entity: Created, Updated, Deleted.
/// </summary>
public class WebhookSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Human-readable name for this subscription (e.g., "Zapier Integration", "ERP Sync").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The target URL that receives webhook POST requests.
    /// Must be HTTPS in production.
    /// </summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// HMAC-SHA256 secret for payload signing. Prefixed with "whsec_".
    /// Used to generate the X-Webhook-Signature header so consumers can verify payload authenticity.
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    /// <summary>
    /// List of subscribed events in "Entity.EventType" format.
    /// Examples: "Contact.Created", "Deal.Updated", "Company.Deleted".
    /// Stored as JSONB in PostgreSQL for efficient querying.
    /// </summary>
    public List<string> EventSubscriptions { get; set; } = new();

    /// <summary>
    /// Whether to include custom fields in webhook payloads.
    /// Opt-in per subscription to avoid leaking sensitive custom field data.
    /// </summary>
    public bool IncludeCustomFields { get; set; } = false;

    /// <summary>
    /// Admin-controlled toggle. When false, no webhooks are delivered for this subscription.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Auto-disabled by the system when consecutive failure threshold is exceeded.
    /// Different from IsActive: IsActive is manual, IsDisabled is automatic.
    /// </summary>
    public bool IsDisabled { get; set; } = false;

    /// <summary>
    /// Number of consecutive delivery failures. Reset to 0 on successful delivery.
    /// When this exceeds the threshold, IsDisabled is set to true.
    /// </summary>
    public int ConsecutiveFailureCount { get; set; } = 0;

    /// <summary>
    /// Timestamp of the last successful or attempted delivery.
    /// </summary>
    public DateTimeOffset? LastDeliveryAt { get; set; }

    /// <summary>
    /// Timestamp when the subscription was auto-disabled due to consecutive failures.
    /// </summary>
    public DateTimeOffset? DisabledAt { get; set; }

    /// <summary>
    /// Human-readable reason for auto-disable (e.g., "10 consecutive failures").
    /// </summary>
    public string? DisabledReason { get; set; }

    /// <summary>
    /// The user who created this subscription.
    /// </summary>
    public Guid CreatedByUserId { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
