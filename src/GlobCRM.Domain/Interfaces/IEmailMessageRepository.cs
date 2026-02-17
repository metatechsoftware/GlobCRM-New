using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for EmailMessage and EmailThread CRUD operations.
/// Supports paged listing, thread view, entity-scoped queries (contact/company),
/// Gmail deduplication, and upsert for sync.
/// </summary>
public interface IEmailMessageRepository
{
    /// <summary>
    /// Gets a paged list of email messages for the email list view.
    /// Includes EmailAccount and LinkedContact navigations.
    /// </summary>
    Task<PagedResult<EmailMessage>> GetPagedAsync(EntityQueryParams queryParams);

    /// <summary>
    /// Gets a single email message by ID with full details for the message detail view.
    /// </summary>
    Task<EmailMessage?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets all messages in a thread by Gmail thread ID, ordered by SentAt.
    /// </summary>
    Task<List<EmailMessage>> GetByThreadIdAsync(string gmailThreadId);

    /// <summary>
    /// Gets emails linked to a specific contact for the contact detail emails tab.
    /// </summary>
    Task<PagedResult<EmailMessage>> GetByContactIdAsync(Guid contactId, EntityQueryParams queryParams);

    /// <summary>
    /// Gets emails linked to a specific company for the company detail emails tab.
    /// </summary>
    Task<PagedResult<EmailMessage>> GetByCompanyIdAsync(Guid companyId, EntityQueryParams queryParams);

    /// <summary>
    /// Creates a new email message entity.
    /// </summary>
    Task<EmailMessage> CreateAsync(EmailMessage emailMessage);

    /// <summary>
    /// Updates an existing email message entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(EmailMessage emailMessage);

    /// <summary>
    /// Deletes an email message by ID.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Checks whether a message with the given Gmail message ID already exists in the current tenant.
    /// Used for deduplication during sync.
    /// </summary>
    Task<bool> ExistsByGmailMessageIdAsync(string gmailMessageId);

    /// <summary>
    /// Inserts or updates an email message based on Gmail message ID.
    /// Used during sync to handle both new and updated messages.
    /// </summary>
    Task<EmailMessage> UpsertByGmailMessageIdAsync(EmailMessage message);

    /// <summary>
    /// Gets or creates an EmailThread for the given Gmail thread ID.
    /// </summary>
    Task<EmailThread> GetThreadAsync(string gmailThreadId);

    /// <summary>
    /// Updates an EmailThread after a new message is synced (message count, last message timestamp).
    /// </summary>
    Task UpdateThreadAsync(EmailThread thread);
}
