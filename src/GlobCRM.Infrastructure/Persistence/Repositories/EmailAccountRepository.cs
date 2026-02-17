using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for EmailAccount entities.
/// Supports per-user account lookup, cross-tenant active account listing for
/// background sync service, and standard CRUD operations.
/// Uses ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public class EmailAccountRepository : IEmailAccountRepository
{
    private readonly ApplicationDbContext _db;

    public EmailAccountRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<EmailAccount?> GetByUserIdAsync(Guid userId)
    {
        return await _db.EmailAccounts
            .FirstOrDefaultAsync(ea => ea.UserId == userId);
    }

    /// <inheritdoc />
    public async Task<List<EmailAccount>> GetAllActiveAccountsAsync()
    {
        // Background sync runs across all tenants -- bypass tenant query filter.
        // Each returned account has TenantId populated for per-account processing.
        return await _db.EmailAccounts
            .IgnoreQueryFilters()
            .Where(ea => ea.SyncStatus == EmailSyncStatus.Active)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<EmailAccount> CreateAsync(EmailAccount emailAccount)
    {
        _db.EmailAccounts.Add(emailAccount);
        await _db.SaveChangesAsync();
        return emailAccount;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(EmailAccount emailAccount)
    {
        emailAccount.UpdatedAt = DateTimeOffset.UtcNow;
        _db.EmailAccounts.Update(emailAccount);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var account = await _db.EmailAccounts.FindAsync(id);
        if (account is not null)
        {
            _db.EmailAccounts.Remove(account);
            await _db.SaveChangesAsync();
        }
    }
}
