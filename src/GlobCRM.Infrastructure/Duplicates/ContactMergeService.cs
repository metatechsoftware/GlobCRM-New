using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Duplicates;

/// <summary>
/// Merges two contact records by transferring all FK and polymorphic references
/// from the loser to the survivor in a single transaction. The loser is soft-deleted
/// with MergedIntoId pointing to the survivor.
/// </summary>
public class ContactMergeService
{
    private readonly ApplicationDbContext _db;

    public ContactMergeService(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Merge the loser contact into the survivor contact.
    /// Transfers all 12 FK/polymorphic references and creates a MergeAuditLog.
    /// </summary>
    /// <returns>Dictionary of transfer counts per entity type.</returns>
    public async Task<Dictionary<string, int>> MergeAsync(
        Guid survivorId, Guid loserId,
        Dictionary<string, object?> fieldSelections,
        Guid mergedByUserId)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // Load survivor and loser (IgnoreQueryFilters to handle edge cases)
            var survivor = await _db.Contacts
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == survivorId)
                ?? throw new InvalidOperationException($"Survivor contact {survivorId} not found.");

            var loser = await _db.Contacts
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == loserId)
                ?? throw new InvalidOperationException($"Loser contact {loserId} not found.");

            // 1. Apply field selections to survivor
            ApplyFieldSelections(survivor, loser, fieldSelections);

            // 2. Transfer all FK/polymorphic references
            var transferCounts = new Dictionary<string, int>();

            // 2a. DealContacts (composite PK -- check for conflicts)
            transferCounts["DealContacts"] = await TransferDealContacts(survivorId, loserId);

            // 2b. Quotes
            transferCounts["Quotes"] = await _db.Quotes
                .Where(q => q.ContactId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.ContactId, survivorId));

            // 2c. Requests
            transferCounts["Requests"] = await _db.Requests
                .Where(r => r.ContactId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.ContactId, survivorId));

            // 2d. EmailMessages
            transferCounts["EmailMessages"] = await _db.EmailMessages
                .Where(e => e.LinkedContactId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.LinkedContactId, survivorId));

            // 2e. EmailThreads
            transferCounts["EmailThreads"] = await _db.EmailThreads
                .Where(e => e.LinkedContactId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.LinkedContactId, survivorId));

            // 2f. Leads (converted_contact_id)
            transferCounts["Leads"] = await _db.Leads
                .IgnoreQueryFilters()
                .Where(l => l.ConvertedContactId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.ConvertedContactId, survivorId));

            // 2g. LeadConversions
            transferCounts["LeadConversions"] = await _db.LeadConversions
                .IgnoreQueryFilters()
                .Where(lc => lc.ContactId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(lc => lc.ContactId, survivorId));

            // 2h. Notes (polymorphic)
            transferCounts["Notes"] = await _db.Notes
                .Where(n => n.EntityType == "Contact" && n.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.EntityId, survivorId));

            // 2i. Attachments (polymorphic)
            transferCounts["Attachments"] = await _db.Attachments
                .Where(a => a.EntityType == "Contact" && a.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.EntityId, survivorId));

            // 2j. ActivityLinks (polymorphic -- check for conflicts)
            transferCounts["ActivityLinks"] = await TransferActivityLinks("Contact", survivorId, loserId);

            // 2k. FeedItems (polymorphic)
            transferCounts["FeedItems"] = await _db.FeedItems
                .Where(f => f.EntityType == "Contact" && f.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.EntityId, survivorId));

            // 2l. Notifications (polymorphic)
            transferCounts["Notifications"] = await _db.Notifications
                .Where(n => n.EntityType == "Contact" && n.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.EntityId, survivorId));

            // 3. Soft-delete the loser
            loser.MergedIntoId = survivorId;
            loser.MergedAt = DateTimeOffset.UtcNow;
            loser.MergedByUserId = mergedByUserId;

            // 4. Create audit log
            var auditLog = new MergeAuditLog
            {
                TenantId = survivor.TenantId,
                EntityType = "Contact",
                SurvivorId = survivorId,
                LoserId = loserId,
                MergedByUserId = mergedByUserId,
                FieldSelections = fieldSelections,
                TransferCounts = transferCounts,
                MergedAt = DateTimeOffset.UtcNow
            };
            _db.MergeAuditLogs.Add(auditLog);

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return transferCounts;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Transfer DealContact records, handling composite PK conflicts.
    /// If survivor is already linked to the same deal, delete the loser's link.
    /// </summary>
    private async Task<int> TransferDealContacts(Guid survivorId, Guid loserId)
    {
        var loserLinks = await _db.DealContacts
            .Where(dc => dc.ContactId == loserId)
            .ToListAsync();

        if (loserLinks.Count == 0) return 0;

        var survivorDealIds = await _db.DealContacts
            .Where(dc => dc.ContactId == survivorId)
            .Select(dc => dc.DealId)
            .ToHashSetAsync();

        var transferred = 0;
        foreach (var link in loserLinks)
        {
            if (survivorDealIds.Contains(link.DealId))
            {
                // Conflict: survivor already linked to this deal -- remove loser's link
                _db.DealContacts.Remove(link);
            }
            else
            {
                // No conflict: re-point to survivor
                link.ContactId = survivorId;
                transferred++;
            }
        }

        return transferred;
    }

    /// <summary>
    /// Transfer ActivityLink records, handling deduplication for same ActivityId.
    /// </summary>
    private async Task<int> TransferActivityLinks(string entityType, Guid survivorId, Guid loserId)
    {
        var loserLinks = await _db.ActivityLinks
            .Where(al => al.EntityType == entityType && al.EntityId == loserId)
            .ToListAsync();

        if (loserLinks.Count == 0) return 0;

        var survivorActivityIds = await _db.ActivityLinks
            .Where(al => al.EntityType == entityType && al.EntityId == survivorId)
            .Select(al => al.ActivityId)
            .ToHashSetAsync();

        var transferred = 0;
        foreach (var link in loserLinks)
        {
            if (survivorActivityIds.Contains(link.ActivityId))
            {
                // Conflict: survivor already linked to this activity -- remove loser's link
                _db.ActivityLinks.Remove(link);
            }
            else
            {
                // No conflict: re-point to survivor
                link.EntityId = survivorId;
                transferred++;
            }
        }

        return transferred;
    }

    /// <summary>
    /// Apply field selections from the merge UI to the survivor contact.
    /// Keys are property names; values are the selected values from either survivor or loser.
    /// </summary>
    private static void ApplyFieldSelections(
        Contact survivor, Contact loser,
        Dictionary<string, object?> fieldSelections)
    {
        foreach (var (fieldName, value) in fieldSelections)
        {
            switch (fieldName.ToLowerInvariant())
            {
                case "firstname":
                    survivor.FirstName = value?.ToString() ?? string.Empty;
                    break;
                case "lastname":
                    survivor.LastName = value?.ToString() ?? string.Empty;
                    break;
                case "email":
                    survivor.Email = value?.ToString();
                    break;
                case "phone":
                    survivor.Phone = value?.ToString();
                    break;
                case "mobilephone":
                    survivor.MobilePhone = value?.ToString();
                    break;
                case "jobtitle":
                    survivor.JobTitle = value?.ToString();
                    break;
                case "department":
                    survivor.Department = value?.ToString();
                    break;
                case "address":
                    survivor.Address = value?.ToString();
                    break;
                case "city":
                    survivor.City = value?.ToString();
                    break;
                case "state":
                    survivor.State = value?.ToString();
                    break;
                case "country":
                    survivor.Country = value?.ToString();
                    break;
                case "postalcode":
                    survivor.PostalCode = value?.ToString();
                    break;
                case "description":
                    survivor.Description = value?.ToString();
                    break;
                case "companyid":
                    if (value is Guid companyId)
                        survivor.CompanyId = companyId;
                    else if (value is string guidStr && Guid.TryParse(guidStr, out var parsed))
                        survivor.CompanyId = parsed;
                    else
                        survivor.CompanyId = null;
                    break;
                case "ownerid":
                    if (value is Guid ownerId)
                        survivor.OwnerId = ownerId;
                    else if (value is string ownerStr && Guid.TryParse(ownerStr, out var parsedOwner))
                        survivor.OwnerId = parsedOwner;
                    else
                        survivor.OwnerId = null;
                    break;
                default:
                    // Custom fields or unknown -- store in CustomFields
                    survivor.CustomFields[fieldName] = value;
                    break;
            }
        }
    }
}
