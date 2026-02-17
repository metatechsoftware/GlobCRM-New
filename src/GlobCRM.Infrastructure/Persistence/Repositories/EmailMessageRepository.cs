using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for EmailMessage and EmailThread entities.
/// Provides paged queries with sorting/filtering, thread view, entity-scoped
/// queries for contact/company detail tabs, Gmail deduplication, and upsert sync.
/// Uses ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public class EmailMessageRepository : IEmailMessageRepository
{
    private readonly ApplicationDbContext _db;

    public EmailMessageRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<EmailMessage>> GetPagedAsync(EntityQueryParams queryParams)
    {
        var query = _db.EmailMessages.AsQueryable();

        // Apply search (case-insensitive across subject, from address, from name, body preview)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(em =>
                em.Subject.ToLower().Contains(search) ||
                em.FromAddress.ToLower().Contains(search) ||
                em.FromName.ToLower().Contains(search) ||
                (em.BodyPreview != null && em.BodyPreview.ToLower().Contains(search)));
        }

        // Apply filters
        if (queryParams.Filters is { Count: > 0 })
        {
            query = ApplyFilters(query, queryParams.Filters);
        }

        // Apply sorting (default: SentAt DESC)
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        // Get total count before pagination
        var totalCount = await query.CountAsync();

        // Apply pagination and include navigations
        var items = await query
            .Include(em => em.LinkedContact)
            .Include(em => em.LinkedCompany)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<EmailMessage>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<EmailMessage?> GetByIdAsync(Guid id)
    {
        return await _db.EmailMessages
            .Include(em => em.LinkedContact)
            .Include(em => em.LinkedCompany)
            .FirstOrDefaultAsync(em => em.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<EmailMessage>> GetByThreadIdAsync(string gmailThreadId)
    {
        return await _db.EmailMessages
            .Where(em => em.GmailThreadId == gmailThreadId)
            .Include(em => em.LinkedContact)
            .Include(em => em.LinkedCompany)
            .OrderBy(em => em.SentAt) // Chronological for thread view
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<PagedResult<EmailMessage>> GetByContactIdAsync(Guid contactId, EntityQueryParams queryParams)
    {
        var query = _db.EmailMessages
            .Where(em => em.LinkedContactId == contactId);

        // Apply sorting (default: SentAt DESC)
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        var totalCount = await query.CountAsync();

        var items = await query
            .Include(em => em.LinkedContact)
            .Include(em => em.LinkedCompany)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<EmailMessage>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<PagedResult<EmailMessage>> GetByCompanyIdAsync(Guid companyId, EntityQueryParams queryParams)
    {
        var query = _db.EmailMessages
            .Where(em => em.LinkedCompanyId == companyId);

        // Apply sorting (default: SentAt DESC)
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        var totalCount = await query.CountAsync();

        var items = await query
            .Include(em => em.LinkedContact)
            .Include(em => em.LinkedCompany)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<EmailMessage>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<EmailMessage> CreateAsync(EmailMessage emailMessage)
    {
        _db.EmailMessages.Add(emailMessage);
        await _db.SaveChangesAsync();
        return emailMessage;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(EmailMessage emailMessage)
    {
        emailMessage.UpdatedAt = DateTimeOffset.UtcNow;
        _db.EmailMessages.Update(emailMessage);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var message = await _db.EmailMessages.FindAsync(id);
        if (message is not null)
        {
            _db.EmailMessages.Remove(message);
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<bool> ExistsByGmailMessageIdAsync(string gmailMessageId)
    {
        return await _db.EmailMessages
            .AnyAsync(em => em.GmailMessageId == gmailMessageId);
    }

    /// <inheritdoc />
    public async Task<EmailMessage> UpsertByGmailMessageIdAsync(EmailMessage message)
    {
        var existing = await _db.EmailMessages
            .FirstOrDefaultAsync(em => em.GmailMessageId == message.GmailMessageId);

        if (existing is not null)
        {
            // Update existing message fields
            existing.Subject = message.Subject;
            existing.FromAddress = message.FromAddress;
            existing.FromName = message.FromName;
            existing.ToAddresses = message.ToAddresses;
            existing.CcAddresses = message.CcAddresses;
            existing.BccAddresses = message.BccAddresses;
            existing.BodyPreview = message.BodyPreview;
            existing.BodyHtml = message.BodyHtml;
            existing.BodyText = message.BodyText;
            existing.HasAttachments = message.HasAttachments;
            existing.IsInbound = message.IsInbound;
            existing.IsRead = message.IsRead;
            existing.IsStarred = message.IsStarred;
            existing.LinkedContactId = message.LinkedContactId;
            existing.LinkedCompanyId = message.LinkedCompanyId;
            existing.SentAt = message.SentAt;
            existing.SyncedAt = DateTimeOffset.UtcNow;
            existing.UpdatedAt = DateTimeOffset.UtcNow;

            _db.EmailMessages.Update(existing);
            await _db.SaveChangesAsync();
            return existing;
        }

        // Create new
        _db.EmailMessages.Add(message);
        await _db.SaveChangesAsync();
        return message;
    }

    /// <inheritdoc />
    public async Task<EmailThread> GetThreadAsync(string gmailThreadId)
    {
        var thread = await _db.EmailThreads
            .FirstOrDefaultAsync(t => t.GmailThreadId == gmailThreadId);

        if (thread is not null)
            return thread;

        // Create new thread
        thread = new EmailThread
        {
            GmailThreadId = gmailThreadId
        };

        _db.EmailThreads.Add(thread);
        await _db.SaveChangesAsync();
        return thread;
    }

    /// <inheritdoc />
    public async Task UpdateThreadAsync(EmailThread thread)
    {
        thread.UpdatedAt = DateTimeOffset.UtcNow;
        _db.EmailThreads.Update(thread);
        await _db.SaveChangesAsync();
    }

    // ---- Private Helpers ----

    /// <summary>
    /// Applies field-level filters for email messages.
    /// Supports filtering on IsInbound, IsRead, HasAttachments.
    /// </summary>
    private static IQueryable<EmailMessage> ApplyFilters(
        IQueryable<EmailMessage> query,
        List<FilterParam> filters)
    {
        foreach (var filter in filters)
        {
            if (string.IsNullOrEmpty(filter.Value)) continue;

            query = filter.FieldId.ToLower() switch
            {
                "isinbound" => bool.TryParse(filter.Value, out var isInbound)
                    ? query.Where(em => em.IsInbound == isInbound)
                    : query,
                "isread" => bool.TryParse(filter.Value, out var isRead)
                    ? query.Where(em => em.IsRead == isRead)
                    : query,
                "hasattachments" => bool.TryParse(filter.Value, out var hasAttachments)
                    ? query.Where(em => em.HasAttachments == hasAttachments)
                    : query,
                "subject" => query.Where(em => em.Subject.ToLower().Contains(filter.Value.ToLower())),
                "fromaddress" => query.Where(em => em.FromAddress.ToLower().Contains(filter.Value.ToLower())),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper.
    /// Default sort: SentAt descending (most recent first).
    /// </summary>
    private static IQueryable<EmailMessage> ApplySorting(
        IQueryable<EmailMessage> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            // Default: SentAt DESC
            return desc ? query.OrderByDescending(em => em.SentAt) : query.OrderBy(em => em.SentAt);
        }

        return sortField.ToLower() switch
        {
            "sentat" => desc ? query.OrderByDescending(em => em.SentAt) : query.OrderBy(em => em.SentAt),
            "subject" => desc ? query.OrderByDescending(em => em.Subject) : query.OrderBy(em => em.Subject),
            "fromaddress" => desc ? query.OrderByDescending(em => em.FromAddress) : query.OrderBy(em => em.FromAddress),
            "fromname" => desc ? query.OrderByDescending(em => em.FromName) : query.OrderBy(em => em.FromName),
            "createdat" => desc ? query.OrderByDescending(em => em.CreatedAt) : query.OrderBy(em => em.CreatedAt),
            // Default to SentAt descending for unrecognized fields.
            _ => query.OrderByDescending(em => em.SentAt)
        };
    }
}
