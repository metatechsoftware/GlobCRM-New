namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records each webhook delivery attempt for auditing, debugging, and retry tracking.
/// Each row represents a single HTTP POST attempt to a subscription's URL.
/// Multiple attempts for the same event are tracked via AttemptNumber.
/// </summary>
public class WebhookDeliveryLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// FK to the WebhookSubscription that triggered this delivery.
    /// </summary>
    public Guid SubscriptionId { get; set; }

    /// <summary>
    /// Navigation property to the parent subscription.
    /// </summary>
    public WebhookSubscription Subscription { get; set; } = null!;

    /// <summary>
    /// The event type in "Entity.EventType" format (e.g., "Contact.Updated").
    /// </summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>
    /// The ID of the entity that triggered the event (as string for flexibility).
    /// </summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>
    /// Which attempt this is (1 = first attempt, 2 = first retry, etc.).
    /// </summary>
    public int AttemptNumber { get; set; } = 1;

    /// <summary>
    /// Whether the delivery was successful (2xx response).
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// The HTTP status code returned by the target URL. Null if connection failed.
    /// </summary>
    public int? HttpStatusCode { get; set; }

    /// <summary>
    /// Response body from the target URL, truncated to 1KB for storage efficiency.
    /// </summary>
    public string? ResponseBody { get; set; }

    /// <summary>
    /// Error message if the delivery failed (e.g., timeout, DNS failure, connection refused).
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// The full JSON payload that was sent. Stored as text (not JSONB) to preserve
    /// exact serialization for HMAC signature verification.
    /// </summary>
    public string RequestPayload { get; set; } = string.Empty;

    /// <summary>
    /// Round-trip duration of the HTTP request in milliseconds.
    /// </summary>
    public long DurationMs { get; set; }

    // Audit timestamp
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
