using System.Text.RegularExpressions;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Note CRUD operations with entity-scoped queries,
/// ownership scope enforcement (AuthorId = OwnerId), and timeline integration.
/// Notes support rich text body (HTML) with server-side plain text stripping.
/// </summary>
[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController : ControllerBase
{
    private readonly INoteRepository _noteRepository;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<NotesController> _logger;

    public NotesController(
        INoteRepository noteRepository,
        IPermissionService permissionService,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<NotesController> logger)
    {
        _noteRepository = noteRepository;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    // ---- CRUD Endpoints ----

    /// <summary>
    /// Lists notes with server-side filtering, sorting, pagination, and ownership scope.
    /// Supports optional entityType/entityId for entity-scoped queries.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Note:View")]
    [ProducesResponseType(typeof(PagedResult<NoteListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] EntityQueryParams queryParams,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? entityId = null)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Note", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _noteRepository.GetPagedAsync(
            queryParams, entityType, entityId, userId,
            permission.Scope.ToString(), teamMemberIds);

        var dtoResult = new PagedResult<NoteListDto>
        {
            Items = pagedResult.Items.Select(NoteListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single note by ID with full HTML body.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Note:View")]
    [ProducesResponseType(typeof(NoteDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var note = await _noteRepository.GetByIdAsync(id);
        if (note is null)
            return NotFound(new { error = "Note not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Note", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(note.AuthorId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var dto = NoteDetailDto.FromEntity(note);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new note. AuthorId set from current user.
    /// Server-side strips HTML to generate PlainTextBody.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Note:Create")]
    [ProducesResponseType(typeof(NoteDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateNoteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 500)
            return BadRequest(new { error = "Title is required and must be at most 500 characters." });

        if (string.IsNullOrWhiteSpace(request.Body))
            return BadRequest(new { error = "Body is required." });

        if (string.IsNullOrWhiteSpace(request.EntityType) || request.EntityId == Guid.Empty)
            return BadRequest(new { error = "EntityType and EntityId are required." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var note = new Note
        {
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Body = request.Body,
            PlainTextBody = StripHtml(request.Body),
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            EntityName = request.EntityName,
            AuthorId = userId
        };

        var created = await _noteRepository.AddAsync(note);

        _logger.LogInformation("Note created: {Title} ({NoteId}) on {EntityType}/{EntityId}",
            created.Title, created.Id, created.EntityType, created.EntityId);

        // Reload with Author navigation
        var reloaded = await _noteRepository.GetByIdAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            NoteDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Updates a note. Author-only or admin. Regenerates PlainTextBody.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Note:Edit")]
    [ProducesResponseType(typeof(NoteDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateNoteRequest request)
    {
        var note = await _noteRepository.GetByIdAsync(id);
        if (note is null)
            return NotFound(new { error = "Note not found." });

        var userId = GetCurrentUserId();

        // Author-only or admin
        var isAdmin = User.IsInRole("Admin");
        if (note.AuthorId != userId && !isAdmin)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 500)
            return BadRequest(new { error = "Title is required and must be at most 500 characters." });

        if (string.IsNullOrWhiteSpace(request.Body))
            return BadRequest(new { error = "Body is required." });

        note.Title = request.Title.Trim();
        note.Body = request.Body;
        note.PlainTextBody = StripHtml(request.Body);

        await _noteRepository.UpdateAsync(note);

        _logger.LogInformation("Note updated: {NoteId}", id);

        // Reload with Author navigation
        var reloaded = await _noteRepository.GetByIdAsync(id);
        return Ok(NoteDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Deletes a note. Author-only or admin.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Note:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var note = await _noteRepository.GetByIdAsync(id);
        if (note is null)
            return NotFound(new { error = "Note not found." });

        var userId = GetCurrentUserId();

        // Author-only or admin
        var isAdmin = User.IsInRole("Admin");
        if (note.AuthorId != userId && !isAdmin)
            return Forbid();

        await _noteRepository.DeleteAsync(id);

        _logger.LogInformation("Note deleted: {NoteId}", id);

        return NoContent();
    }

    /// <summary>
    /// Gets notes scoped to a specific entity for tab content display.
    /// </summary>
    [HttpGet("entity/{entityType}/{entityId:guid}")]
    [Authorize(Policy = "Permission:Note:View")]
    [ProducesResponseType(typeof(List<NoteListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEntityNotes(string entityType, Guid entityId)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Note", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        // Use a large page size to get all entity notes
        var queryParams = new EntityQueryParams { Page = 1, PageSize = 100, SortDirection = "desc" };

        var pagedResult = await _noteRepository.GetPagedAsync(
            queryParams, entityType, entityId, userId,
            permission.Scope.ToString(), teamMemberIds);

        var dtos = pagedResult.Items.Select(NoteListDto.FromEntity).ToList();

        return Ok(dtos);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Checks if a note is within the user's ownership scope.
    /// Notes use AuthorId as the ownership field.
    /// </summary>
    private static bool IsWithinScope(
        Guid? authorId,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => true,
            PermissionScope.Team => authorId is null ||
                                    authorId == userId ||
                                    (teamMemberIds is not null && teamMemberIds.Contains(authorId.Value)),
            PermissionScope.Own => authorId == userId,
            PermissionScope.None => false,
            _ => false
        };
    }

    /// <summary>
    /// Gets team member user IDs for Team scope filtering.
    /// </summary>
    private async Task<List<Guid>?> GetTeamMemberIds(Guid userId, PermissionScope scope)
    {
        if (scope != PermissionScope.Team)
            return null;

        var userTeamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        if (userTeamIds.Count == 0)
            return new List<Guid>();

        var memberIds = await _db.TeamMembers
            .Where(tm => userTeamIds.Contains(tm.TeamId))
            .Select(tm => tm.UserId)
            .Distinct()
            .ToListAsync();

        return memberIds;
    }

    /// <summary>
    /// Strips HTML tags from rich text body to generate plain text.
    /// Uses simple regex for server-side conversion.
    /// </summary>
    private static string StripHtml(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return string.Empty;

        // Remove HTML tags
        var text = Regex.Replace(html, "<[^>]+>", " ");
        // Decode common HTML entities
        text = text.Replace("&amp;", "&")
                   .Replace("&lt;", "<")
                   .Replace("&gt;", ">")
                   .Replace("&quot;", "\"")
                   .Replace("&#39;", "'")
                   .Replace("&nbsp;", " ");
        // Collapse whitespace
        text = Regex.Replace(text, @"\s+", " ").Trim();

        return text;
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for note list views.
/// PlainTextBody truncated to 200 chars for list display.
/// </summary>
public record NoteListDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? PlainTextBody { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string? EntityName { get; init; }
    public string? AuthorName { get; init; }
    public Guid? AuthorId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static NoteListDto FromEntity(Note entity) => new()
    {
        Id = entity.Id,
        Title = entity.Title,
        PlainTextBody = entity.PlainTextBody != null && entity.PlainTextBody.Length > 200
            ? entity.PlainTextBody[..200] + "..."
            : entity.PlainTextBody,
        EntityType = entity.EntityType,
        EntityName = entity.EntityName,
        AuthorName = entity.Author != null
            ? $"{entity.Author.FirstName} {entity.Author.LastName}".Trim()
            : null,
        AuthorId = entity.AuthorId,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for note detail view with full HTML body.
/// </summary>
public record NoteDetailDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public string? PlainTextBody { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string? EntityName { get; init; }
    public string? AuthorName { get; init; }
    public Guid? AuthorId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static NoteDetailDto FromEntity(Note entity) => new()
    {
        Id = entity.Id,
        Title = entity.Title,
        Body = entity.Body,
        PlainTextBody = entity.PlainTextBody,
        EntityType = entity.EntityType,
        EntityId = entity.EntityId,
        EntityName = entity.EntityName,
        AuthorName = entity.Author != null
            ? $"{entity.Author.FirstName} {entity.Author.LastName}".Trim()
            : null,
        AuthorId = entity.AuthorId,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a note.
/// </summary>
public record CreateNoteRequest
{
    public string Title { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string? EntityName { get; init; }
}

/// <summary>
/// Request body for updating a note.
/// </summary>
public record UpdateNoteRequest
{
    public string Title { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
}
