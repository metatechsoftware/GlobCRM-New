using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace GlobCRM.Infrastructure.Search;

/// <summary>
/// Cross-entity search service using PostgreSQL tsvector with prefix matching.
/// Searches Company, Contact, and Deal entities with RBAC permission scoping.
/// Uses stored generated tsvector columns with GIN indexes for fast full-text search.
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

        // Build prefix query for partial word support
        var prefixTerm = BuildPrefixQuery(term);
        if (string.IsNullOrEmpty(prefixTerm))
            return result;

        // Search each entity type with permission checks
        var companyHits = await SearchCompaniesAsync(prefixTerm, userId, maxPerType);
        if (companyHits.Count > 0)
            result.Groups.Add(new SearchGroup { EntityType = "Company", Items = companyHits });

        var contactHits = await SearchContactsAsync(prefixTerm, userId, maxPerType);
        if (contactHits.Count > 0)
            result.Groups.Add(new SearchGroup { EntityType = "Contact", Items = contactHits });

        var dealHits = await SearchDealsAsync(prefixTerm, userId, maxPerType);
        if (dealHits.Count > 0)
            result.Groups.Add(new SearchGroup { EntityType = "Deal", Items = dealHits });

        return result;
    }

    /// <summary>
    /// Builds a prefix tsquery string for partial word matching.
    /// Splits on whitespace, appends :* to each token, joins with &amp;.
    /// Example: "john smi" becomes "john:* &amp; smi:*"
    /// </summary>
    private static string? BuildPrefixQuery(string term)
    {
        if (string.IsNullOrWhiteSpace(term))
            return null;

        // Remove non-alphanumeric characters except whitespace
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
    /// Searches companies with tsvector matching and RBAC scope filtering.
    /// </summary>
    private async Task<List<SearchHit>> SearchCompaniesAsync(string prefixTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var tsQuery = EF.Functions.ToTsQuery("english", prefixTerm);
        var query = _db.Companies
            .Where(c => c.SearchVector.Matches(tsQuery));

        // Apply ownership scope
        if (permission.Scope == PermissionScope.Own)
        {
            query = query.Where(c => c.OwnerId == userId);
        }
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            query = query.Where(c => c.OwnerId != null && teamMemberIds.Contains(c.OwnerId.Value));
        }
        // PermissionScope.All: no additional filter

        return await query
            .OrderByDescending(c => c.SearchVector.Rank(tsQuery))
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

    /// <summary>
    /// Searches contacts with tsvector matching and RBAC scope filtering.
    /// </summary>
    private async Task<List<SearchHit>> SearchContactsAsync(string prefixTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var tsQuery = EF.Functions.ToTsQuery("english", prefixTerm);
        var query = _db.Contacts
            .Where(c => c.SearchVector.Matches(tsQuery));

        // Apply ownership scope
        if (permission.Scope == PermissionScope.Own)
        {
            query = query.Where(c => c.OwnerId == userId);
        }
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            query = query.Where(c => c.OwnerId != null && teamMemberIds.Contains(c.OwnerId.Value));
        }

        return await query
            .OrderByDescending(c => c.SearchVector.Rank(tsQuery))
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

    /// <summary>
    /// Searches deals with tsvector matching and RBAC scope filtering.
    /// Includes pipeline name as subtitle.
    /// </summary>
    private async Task<List<SearchHit>> SearchDealsAsync(string prefixTerm, Guid userId, int maxPerType)
    {
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        if (permission.Scope == PermissionScope.None)
            return new List<SearchHit>();

        var tsQuery = EF.Functions.ToTsQuery("english", prefixTerm);
        var query = _db.Deals
            .Include(d => d.Pipeline)
            .Where(d => d.SearchVector.Matches(tsQuery));

        // Apply ownership scope
        if (permission.Scope == PermissionScope.Own)
        {
            query = query.Where(d => d.OwnerId == userId);
        }
        else if (permission.Scope == PermissionScope.Team)
        {
            var teamMemberIds = await GetTeamMemberIds(userId);
            query = query.Where(d => d.OwnerId != null && teamMemberIds.Contains(d.OwnerId.Value));
        }

        return await query
            .OrderByDescending(d => d.SearchVector.Rank(tsQuery))
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

    /// <summary>
    /// Gets all team member user IDs for the teams the specified user belongs to.
    /// Used for Team scope permission filtering.
    /// </summary>
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
