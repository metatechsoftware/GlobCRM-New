using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace GlobCRM.Infrastructure.Search;

/// <summary>
/// Cross-entity search service using PostgreSQL tsvector with ILIKE fallback.
/// Searches Company, Contact, Deal, Product, Activity, Quote, and Request entities
/// with RBAC permission scoping.
/// </summary>
public class GlobalSearchService : ISearchService
{
    private readonly ApplicationDbContext _db;
    private readonly IPermissionService _permissionService;

    public GlobalSearchService(
        ApplicationDbContext db,
        IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    /// <inheritdoc />
    public async Task<GlobalSearchResult> SearchAsync(string term, Guid userId, int maxPerType = 5)
    {
        var result = new GlobalSearchResult();

        if (string.IsNullOrWhiteSpace(term) || term.Trim().Length < 2)
            return result;

        var cleanTerm = term.Trim();
        var prefixTerm = BuildPrefixQuery(cleanTerm);

        // Run searches sequentially — DbContext is not thread-safe
        AddGroup(result, "Company", await SearchCompaniesAsync(prefixTerm, cleanTerm, userId, maxPerType));
        AddGroup(result, "Contact", await SearchContactsAsync(prefixTerm, cleanTerm, userId, maxPerType));
        AddGroup(result, "Deal", await SearchDealsAsync(prefixTerm, cleanTerm, userId, maxPerType));
        AddGroup(result, "Product", await SearchProductsAsync(cleanTerm, userId, maxPerType));
        AddGroup(result, "Activity", await SearchActivitiesAsync(cleanTerm, userId, maxPerType));
        AddGroup(result, "Quote", await SearchQuotesAsync(cleanTerm, userId, maxPerType));
        AddGroup(result, "Request", await SearchRequestsAsync(cleanTerm, userId, maxPerType));

        return result;
    }

    private static void AddGroup(GlobalSearchResult result, string entityType, List<SearchHit> hits)
    {
        if (hits.Count > 0)
            result.Groups.Add(new SearchGroup { EntityType = entityType, Items = hits });
    }

    /// <summary>
    /// Builds a prefix tsquery string for partial word matching.
    /// Returns null if the term can't produce a valid tsquery.
    /// </summary>
    private static string? BuildPrefixQuery(string term)
    {
        if (string.IsNullOrWhiteSpace(term))
            return null;

        var cleaned = Regex.Replace(term.Trim(), @"[^\w\s]", "", RegexOptions.None);
        if (string.IsNullOrWhiteSpace(cleaned))
            return null;

        var tokens = cleaned
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(t => t.Length > 0)
            .Select(t => $"{t}:*")
            .ToArray();

        return tokens.Length > 0 ? string.Join(" & ", tokens) : null;
    }

    /// <summary>
    /// Escapes LIKE special characters to prevent pattern injection.
    /// </summary>
    private static string EscapeLikePattern(string input) =>
        input.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    // ─── Company ────────────────────────────────────────────────────────

    private async Task<List<SearchHit>> SearchCompaniesAsync(string? prefixTerm, string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var baseQuery = _db.Companies.AsQueryable();

        // Apply ownership scope
        if (permission.Scope == PermissionScope.Own)
            baseQuery = baseQuery.Where(c => c.OwnerId == userId);
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            baseQuery = baseQuery.Where(c => c.OwnerId != null && teamMemberIds.Contains(c.OwnerId.Value));
        }

        // 1. tsvector search (fast path) — ToTsQuery must be inlined for EF translation
        var tsHits = new List<SearchHit>();
        if (prefixTerm != null)
        {
            tsHits = await baseQuery
                .Where(c => c.SearchVector.Matches(EF.Functions.ToTsQuery("english", prefixTerm)))
                .OrderByDescending(c => c.SearchVector.Rank(EF.Functions.ToTsQuery("english", prefixTerm)))
                .Take(maxPerType)
                .Select(c => new SearchHit
                {
                    Id = c.Id,
                    Title = c.Name,
                    Subtitle = c.Industry,
                    EntityType = "Company",
                    Url = $"/companies/{c.Id}"
                })
                .ToListAsync();
        }

        // 2. ILIKE fallback if not enough results
        if (tsHits.Count < maxPerType)
        {
            var tsHitIds = tsHits.Select(h => h.Id).ToHashSet();
            var remaining = maxPerType - tsHits.Count;
            var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

            var ilikeFallback = await baseQuery
                .Where(c => !tsHitIds.Contains(c.Id))
                .Where(c =>
                    EF.Functions.ILike(c.Name, likePattern) ||
                    (c.Industry != null && EF.Functions.ILike(c.Industry, likePattern)) ||
                    (c.Email != null && EF.Functions.ILike(c.Email, likePattern)) ||
                    (c.Phone != null && EF.Functions.ILike(c.Phone, likePattern)))
                .OrderBy(c => EF.Functions.ILike(c.Name, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
                .ThenBy(c => c.Name)
                .Take(remaining)
                .Select(c => new SearchHit
                {
                    Id = c.Id,
                    Title = c.Name,
                    Subtitle = c.Industry,
                    EntityType = "Company",
                    Url = $"/companies/{c.Id}"
                })
                .ToListAsync();

            tsHits.AddRange(ilikeFallback);
        }

        return tsHits;
    }

    // ─── Contact ────────────────────────────────────────────────────────

    private async Task<List<SearchHit>> SearchContactsAsync(string? prefixTerm, string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var baseQuery = _db.Contacts.AsQueryable();

        if (permission.Scope == PermissionScope.Own)
            baseQuery = baseQuery.Where(c => c.OwnerId == userId);
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            baseQuery = baseQuery.Where(c => c.OwnerId != null && teamMemberIds.Contains(c.OwnerId.Value));
        }

        // 1. tsvector search — ToTsQuery must be inlined for EF translation
        var tsHits = new List<SearchHit>();
        if (prefixTerm != null)
        {
            tsHits = await baseQuery
                .Where(c => c.SearchVector.Matches(EF.Functions.ToTsQuery("english", prefixTerm)))
                .OrderByDescending(c => c.SearchVector.Rank(EF.Functions.ToTsQuery("english", prefixTerm)))
                .Take(maxPerType)
                .Select(c => new SearchHit
                {
                    Id = c.Id,
                    Title = c.FirstName + " " + c.LastName,
                    Subtitle = c.JobTitle,
                    EntityType = "Contact",
                    Url = $"/contacts/{c.Id}"
                })
                .ToListAsync();
        }

        // 2. ILIKE fallback
        if (tsHits.Count < maxPerType)
        {
            var tsHitIds = tsHits.Select(h => h.Id).ToHashSet();
            var remaining = maxPerType - tsHits.Count;
            var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

            var ilikeFallback = await baseQuery
                .Where(c => !tsHitIds.Contains(c.Id))
                .Where(c =>
                    EF.Functions.ILike(c.FirstName + " " + c.LastName, likePattern) ||
                    EF.Functions.ILike(c.FirstName, likePattern) ||
                    EF.Functions.ILike(c.LastName, likePattern) ||
                    (c.Email != null && EF.Functions.ILike(c.Email, likePattern)) ||
                    (c.JobTitle != null && EF.Functions.ILike(c.JobTitle, likePattern)))
                .OrderBy(c => EF.Functions.ILike(c.FirstName, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
                .ThenBy(c => c.FirstName)
                .Take(remaining)
                .Select(c => new SearchHit
                {
                    Id = c.Id,
                    Title = c.FirstName + " " + c.LastName,
                    Subtitle = c.JobTitle,
                    EntityType = "Contact",
                    Url = $"/contacts/{c.Id}"
                })
                .ToListAsync();

            tsHits.AddRange(ilikeFallback);
        }

        return tsHits;
    }

    // ─── Deal ───────────────────────────────────────────────────────────

    private async Task<List<SearchHit>> SearchDealsAsync(string? prefixTerm, string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var baseQuery = _db.Deals.Include(d => d.Pipeline).AsQueryable();

        if (permission.Scope == PermissionScope.Own)
            baseQuery = baseQuery.Where(d => d.OwnerId == userId);
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            baseQuery = baseQuery.Where(d => d.OwnerId != null && teamMemberIds.Contains(d.OwnerId.Value));
        }

        // 1. tsvector search — ToTsQuery must be inlined for EF translation
        var tsHits = new List<SearchHit>();
        if (prefixTerm != null)
        {
            tsHits = await baseQuery
                .Where(d => d.SearchVector.Matches(EF.Functions.ToTsQuery("english", prefixTerm)))
                .OrderByDescending(d => d.SearchVector.Rank(EF.Functions.ToTsQuery("english", prefixTerm)))
                .Take(maxPerType)
                .Select(d => new SearchHit
                {
                    Id = d.Id,
                    Title = d.Title,
                    Subtitle = d.Pipeline != null ? d.Pipeline.Name : null,
                    EntityType = "Deal",
                    Url = $"/deals/{d.Id}"
                })
                .ToListAsync();
        }

        // 2. ILIKE fallback
        if (tsHits.Count < maxPerType)
        {
            var tsHitIds = tsHits.Select(h => h.Id).ToHashSet();
            var remaining = maxPerType - tsHits.Count;
            var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

            var ilikeFallback = await baseQuery
                .Where(d => !tsHitIds.Contains(d.Id))
                .Where(d =>
                    EF.Functions.ILike(d.Title, likePattern) ||
                    (d.Description != null && EF.Functions.ILike(d.Description, likePattern)))
                .OrderBy(d => EF.Functions.ILike(d.Title, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
                .ThenBy(d => d.Title)
                .Take(remaining)
                .Select(d => new SearchHit
                {
                    Id = d.Id,
                    Title = d.Title,
                    Subtitle = d.Pipeline != null ? d.Pipeline.Name : null,
                    EntityType = "Deal",
                    Url = $"/deals/{d.Id}"
                })
                .ToListAsync();

            tsHits.AddRange(ilikeFallback);
        }

        return tsHits;
    }

    // ─── Product (ILIKE only, no tsvector) ──────────────────────────────

    private async Task<List<SearchHit>> SearchProductsAsync(string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Product", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        // Products have no OwnerId — no ownership scope filtering needed
        var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

        return await _db.Products
            .Where(p =>
                EF.Functions.ILike(p.Name, likePattern) ||
                (p.SKU != null && EF.Functions.ILike(p.SKU, likePattern)) ||
                (p.Category != null && EF.Functions.ILike(p.Category, likePattern)))
            .OrderBy(p => EF.Functions.ILike(p.Name, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
            .ThenBy(p => p.Name)
            .Take(maxPerType)
            .Select(p => new SearchHit
            {
                Id = p.Id,
                Title = p.Name,
                Subtitle = p.Category,
                EntityType = "Product",
                Url = $"/products/{p.Id}"
            })
            .ToListAsync();
    }

    // ─── Activity (ILIKE only, no tsvector) ─────────────────────────────

    private async Task<List<SearchHit>> SearchActivitiesAsync(string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var baseQuery = _db.Activities.AsQueryable();

        if (permission.Scope == PermissionScope.Own)
            baseQuery = baseQuery.Where(a => a.OwnerId == userId);
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            baseQuery = baseQuery.Where(a => a.OwnerId != null && teamMemberIds.Contains(a.OwnerId.Value));
        }

        var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

        return await baseQuery
            .Where(a => EF.Functions.ILike(a.Subject, likePattern))
            .OrderBy(a => EF.Functions.ILike(a.Subject, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
            .ThenBy(a => a.Subject)
            .Take(maxPerType)
            .Select(a => new SearchHit
            {
                Id = a.Id,
                Title = a.Subject,
                Subtitle = a.Type.ToString(),
                EntityType = "Activity",
                Url = $"/activities/{a.Id}"
            })
            .ToListAsync();
    }

    // ─── Quote (ILIKE only, no tsvector) ────────────────────────────────

    private async Task<List<SearchHit>> SearchQuotesAsync(string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var baseQuery = _db.Quotes.AsQueryable();

        if (permission.Scope == PermissionScope.Own)
            baseQuery = baseQuery.Where(q => q.OwnerId == userId);
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            baseQuery = baseQuery.Where(q => q.OwnerId != null && teamMemberIds.Contains(q.OwnerId.Value));
        }

        var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

        return await baseQuery
            .Where(q =>
                EF.Functions.ILike(q.Title, likePattern) ||
                EF.Functions.ILike(q.QuoteNumber, likePattern))
            .OrderBy(q => EF.Functions.ILike(q.Title, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
            .ThenBy(q => q.Title)
            .Take(maxPerType)
            .Select(q => new SearchHit
            {
                Id = q.Id,
                Title = q.Title,
                Subtitle = q.QuoteNumber,
                EntityType = "Quote",
                Url = $"/quotes/{q.Id}"
            })
            .ToListAsync();
    }

    // ─── Request (ILIKE only, no tsvector) ──────────────────────────────

    private async Task<List<SearchHit>> SearchRequestsAsync(string rawTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var baseQuery = _db.Requests.AsQueryable();

        if (permission.Scope == PermissionScope.Own)
            baseQuery = baseQuery.Where(r => r.OwnerId == userId);
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            baseQuery = baseQuery.Where(r => r.OwnerId != null && teamMemberIds.Contains(r.OwnerId.Value));
        }

        var likePattern = $"%{EscapeLikePattern(rawTerm)}%";

        return await baseQuery
            .Where(r =>
                EF.Functions.ILike(r.Subject, likePattern) ||
                (r.Category != null && EF.Functions.ILike(r.Category, likePattern)))
            .OrderBy(r => EF.Functions.ILike(r.Subject, $"{EscapeLikePattern(rawTerm)}%") ? 0 : 1)
            .ThenBy(r => r.Subject)
            .Take(maxPerType)
            .Select(r => new SearchHit
            {
                Id = r.Id,
                Title = r.Subject,
                Subtitle = r.Category,
                EntityType = "Request",
                Url = $"/requests/{r.Id}"
            })
            .ToListAsync();
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private async Task<List<Guid>> GetTeamMemberIds(Guid userId)
    {
        var userTeamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        if (userTeamIds.Count == 0)
            return new List<Guid>();

        return await _db.TeamMembers
            .Where(tm => userTeamIds.Contains(tm.TeamId))
            .Select(tm => tm.UserId)
            .Distinct()
            .ToListAsync();
    }
}
