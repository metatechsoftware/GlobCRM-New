namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a thread grouping of email messages by Gmail thread ID.
/// Stores thread-level metadata (subject, snippet, message count, last message timestamp)
/// and auto-linked contact/company references.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// Unique composite index on (tenant_id, gmail_thread_id) prevents duplicate threads.
/// </summary>
public class EmailThread
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Gmail's thread ID. Unique per tenant.
    /// </summary>
    public string GmailThreadId { get; set; } = string.Empty;

    /// <summary>
    /// Subject of the first message in the thread.
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Preview text snippet for list display.
    /// </summary>
    public string? Snippet { get; set; }

    /// <summary>
    /// Number of messages in this thread.
    /// </summary>
    public int MessageCount { get; set; } = 0;

    /// <summary>
    /// Timestamp of the most recent message in the thread.
    /// </summary>
    public DateTimeOffset LastMessageAt { get; set; }

    /// <summary>
    /// FK to Contact for auto-linking from messages. Nullable.
    /// </summary>
    public Guid? LinkedContactId { get; set; }

    /// <summary>
    /// Navigation property to the auto-linked contact.
    /// </summary>
    public Contact? LinkedContact { get; set; }

    /// <summary>
    /// FK to Company for auto-linking from messages. Nullable.
    /// </summary>
    public Guid? LinkedCompanyId { get; set; }

    /// <summary>
    /// Navigation property to the auto-linked company.
    /// </summary>
    public Company? LinkedCompany { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
