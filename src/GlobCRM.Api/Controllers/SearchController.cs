using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoint for cross-entity global search using PostgreSQL full-text search.
/// Any authenticated user can search; results are filtered by RBAC permissions per entity type.
/// </summary>
[ApiController]
[Route("api/search")]
[Authorize]
public class SearchController : ControllerBase
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchController> _logger;

    public SearchController(
        ISearchService searchService,
        ILogger<SearchController> logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    /// <summary>
    /// Searches across Company, Contact, and Deal entities using PostgreSQL tsvector.
    /// Returns results grouped by entity type with ranking and partial word matching.
    /// Minimum 2-character query enforced.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(SearchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search(
        [FromQuery(Name = "q")] string? term,
        [FromQuery] int maxPerType = 5)
    {
        if (string.IsNullOrWhiteSpace(term) || term.Trim().Length < 2)
            return BadRequest(new { error = "Search term must be at least 2 characters." });

        if (maxPerType < 1) maxPerType = 1;
        if (maxPerType > 20) maxPerType = 20;

        var userId = GetCurrentUserId();

        var searchResult = await _searchService.SearchAsync(term.Trim(), userId, maxPerType);

        var response = new SearchResponse(
            Groups: searchResult.Groups.Select(g => new SearchGroupDto(
                EntityType: g.EntityType,
                Items: g.Items.Select(h => new SearchHitDto(
                    Id: h.Id,
                    Title: h.Title,
                    Subtitle: h.Subtitle,
                    EntityType: h.EntityType,
                    Url: h.Url
                )).ToList()
            )).ToList(),
            TotalCount: searchResult.Groups.Sum(g => g.Items.Count)
        );

        return Ok(response);
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }
}

// ---- Search DTOs ----

/// <summary>
/// Response for global search containing grouped results and total count.
/// </summary>
public record SearchResponse(
    List<SearchGroupDto> Groups,
    int TotalCount
);

/// <summary>
/// A group of search results for a specific entity type.
/// </summary>
public record SearchGroupDto(
    string EntityType,
    List<SearchHitDto> Items
);

/// <summary>
/// A single search result hit with display information and navigation URL.
/// </summary>
public record SearchHitDto(
    Guid Id,
    string Title,
    string? Subtitle,
    string EntityType,
    string Url
);
