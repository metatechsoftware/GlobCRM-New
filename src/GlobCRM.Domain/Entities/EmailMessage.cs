namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a synced email message in the CRM.
/// Stores Gmail identifiers, metadata, body content, and auto-linked contact/company references.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// Unique composite index on (tenant_id, gmail_message_id) prevents duplicate synced messages.
/// </summary>
public class EmailMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// FK to EmailAccount -- the account that synced this message.
    /// </summary>
    public Guid EmailAccountId { get; set; }

    /// <summary>
    /// Navigation property to the syncing email account.
    /// </summary>
    public EmailAccount EmailAccount { get; set; } = null!;

    /// <summary>
    /// Gmail's unique message ID. Unique per tenant for deduplication.
    /// </summary>
    public string GmailMessageId { get; set; } = string.Empty;

    /// <summary>
    /// Gmail's thread ID for grouping related messages.
    /// </summary>
    public string GmailThreadId { get; set; } = string.Empty;

    /// <summary>
    /// Email subject line.
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Sender email address.
    /// </summary>
    public string FromAddress { get; set; } = string.Empty;

    /// <summary>
    /// Sender display name.
    /// </summary>
    public string FromName { get; set; } = string.Empty;

    /// <summary>
    /// JSON array of recipient email addresses stored as string.
    /// </summary>
    public string ToAddresses { get; set; } = "[]";

    /// <summary>
    /// JSON array of CC email addresses stored as string. Nullable.
    /// </summary>
    public string? CcAddresses { get; set; }

    /// <summary>
    /// JSON array of BCC email addresses stored as string. Nullable.
    /// </summary>
    public string? BccAddresses { get; set; }

    /// <summary>
    /// First ~200 chars of email body for list display.
    /// </summary>
    public string? BodyPreview { get; set; }

    /// <summary>
    /// Full HTML body of the email.
    /// </summary>
    public string? BodyHtml { get; set; }

    /// <summary>
    /// Plain text body of the email.
    /// </summary>
    public string? BodyText { get; set; }

    /// <summary>
    /// Whether the email has file attachments.
    /// </summary>
    public bool HasAttachments { get; set; }

    /// <summary>
    /// True = received (inbound), false = sent from CRM.
    /// </summary>
    public bool IsInbound { get; set; }

    /// <summary>
    /// Whether the email has been read.
    /// </summary>
    public bool IsRead { get; set; }

    /// <summary>
    /// Whether the email is starred/flagged.
    /// </summary>
    public bool IsStarred { get; set; }

    /// <summary>
    /// FK to Contact for auto-linking by email address. Nullable.
    /// </summary>
    public Guid? LinkedContactId { get; set; }

    /// <summary>
    /// Navigation property to the auto-linked contact.
    /// </summary>
    public Contact? LinkedContact { get; set; }

    /// <summary>
    /// FK to Company for auto-linking via contact's company. Nullable.
    /// </summary>
    public Guid? LinkedCompanyId { get; set; }

    /// <summary>
    /// Navigation property to the auto-linked company.
    /// </summary>
    public Company? LinkedCompany { get; set; }

    /// <summary>
    /// Original email send timestamp from Gmail.
    /// </summary>
    public DateTimeOffset SentAt { get; set; }

    /// <summary>
    /// When this message was synced into the CRM.
    /// </summary>
    public DateTimeOffset SyncedAt { get; set; } = DateTimeOffset.UtcNow;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
