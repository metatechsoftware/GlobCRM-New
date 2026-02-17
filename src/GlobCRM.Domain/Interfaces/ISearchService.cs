namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Service interface for cross-entity full-text search using PostgreSQL tsvector.
/// </summary>
public interface ISearchService
{
    /// <summary>
    /// Searches across Company, Contact, and Deal entities using full-text search.
    /// </summary>
    /// <param name="term">The search term.</param>
    /// <param name="userId">The current user's ID for scope filtering.</param>
    /// <param name="maxPerType">Maximum results per entity type (default 5).</param>
    Task<GlobalSearchResult> SearchAsync(string term, Guid userId, int maxPerType = 5);
}

/// <summary>
/// Result of a cross-entity search, grouped by entity type.
/// </summary>
public class GlobalSearchResult
{
    public List<SearchGroup> Groups { get; set; } = new();
}

/// <summary>
/// A group of search hits for a specific entity type.
/// </summary>
public class SearchGroup
{
    public string EntityType { get; set; } = string.Empty;
    public List<SearchHit> Items { get; set; } = new();
}

/// <summary>
/// A single search result hit with display info and navigation target.
/// </summary>
public class SearchHit
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}
