using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Duplicates;

/// <summary>
/// Merges two company records by transferring all FK and polymorphic references
/// from the loser to the survivor in a single transaction. The loser is soft-deleted
/// with MergedIntoId pointing to the survivor.
/// </summary>
public class CompanyMergeService
{
    private readonly ApplicationDbContext _db;

    public CompanyMergeService(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Merge the loser company into the survivor company.
    /// Transfers all 13 FK/polymorphic references and creates a MergeAuditLog.
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
            var survivor = await _db.Companies
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == survivorId)
                ?? throw new InvalidOperationException($"Survivor company {survivorId} not found.");

            var loser = await _db.Companies
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == loserId)
                ?? throw new InvalidOperationException($"Loser company {loserId} not found.");

            // 1. Apply field selections to survivor
            ApplyFieldSelections(survivor, loser, fieldSelections);

            // 2. Transfer all FK/polymorphic references
            var transferCounts = new Dictionary<string, int>();

            // 2a. Contacts (company_id)
            transferCounts["Contacts"] = await _db.Contacts
                .IgnoreQueryFilters()
                .Where(c => c.CompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.CompanyId, survivorId));

            // 2b. Deals (company_id)
            transferCounts["Deals"] = await _db.Deals
                .Where(d => d.CompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.CompanyId, survivorId));

            // 2c. Quotes (company_id)
            transferCounts["Quotes"] = await _db.Quotes
                .Where(q => q.CompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.CompanyId, survivorId));

            // 2d. Requests (company_id)
            transferCounts["Requests"] = await _db.Requests
                .Where(r => r.CompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.CompanyId, survivorId));

            // 2e. EmailMessages (linked_company_id)
            transferCounts["EmailMessages"] = await _db.EmailMessages
                .Where(e => e.LinkedCompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.LinkedCompanyId, survivorId));

            // 2f. EmailThreads (linked_company_id)
            transferCounts["EmailThreads"] = await _db.EmailThreads
                .Where(e => e.LinkedCompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.LinkedCompanyId, survivorId));

            // 2g. Leads (converted_company_id)
            transferCounts["Leads"] = await _db.Leads
                .IgnoreQueryFilters()
                .Where(l => l.ConvertedCompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.ConvertedCompanyId, survivorId));

            // 2h. LeadConversions (company_id)
            transferCounts["LeadConversions"] = await _db.LeadConversions
                .IgnoreQueryFilters()
                .Where(lc => lc.CompanyId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(lc => lc.CompanyId, (Guid?)survivorId));

            // 2i. Notes (polymorphic)
            transferCounts["Notes"] = await _db.Notes
                .Where(n => n.EntityType == "Company" && n.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.EntityId, survivorId));

            // 2j. Attachments (polymorphic)
            transferCounts["Attachments"] = await _db.Attachments
                .Where(a => a.EntityType == "Company" && a.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.EntityId, survivorId));

            // 2k. ActivityLinks (polymorphic -- check for conflicts)
            transferCounts["ActivityLinks"] = await TransferActivityLinks("Company", survivorId, loserId);

            // 2l. FeedItems (polymorphic)
            transferCounts["FeedItems"] = await _db.FeedItems
                .Where(f => f.EntityType == "Company" && f.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.EntityId, survivorId));

            // 2m. Notifications (polymorphic)
            transferCounts["Notifications"] = await _db.Notifications
                .Where(n => n.EntityType == "Company" && n.EntityId == loserId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.EntityId, survivorId));

            // 3. Soft-delete the loser
            loser.MergedIntoId = survivorId;
            loser.MergedAt = DateTimeOffset.UtcNow;
            loser.MergedByUserId = mergedByUserId;

            // 4. Create audit log
            var auditLog = new MergeAuditLog
            {
                TenantId = survivor.TenantId,
                EntityType = "Company",
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
    /// Apply field selections from the merge UI to the survivor company.
    /// Keys are property names; values are the selected values from either survivor or loser.
    /// </summary>
    private static void ApplyFieldSelections(
        Company survivor, Company loser,
        Dictionary<string, object?> fieldSelections)
    {
        foreach (var (fieldName, value) in fieldSelections)
        {
            switch (fieldName.ToLowerInvariant())
            {
                case "name":
                    survivor.Name = value?.ToString() ?? string.Empty;
                    break;
                case "industry":
                    survivor.Industry = value?.ToString();
                    break;
                case "website":
                    survivor.Website = value?.ToString();
                    break;
                case "phone":
                    survivor.Phone = value?.ToString();
                    break;
                case "email":
                    survivor.Email = value?.ToString();
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
                case "size":
                    survivor.Size = value?.ToString();
                    break;
                case "description":
                    survivor.Description = value?.ToString();
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
