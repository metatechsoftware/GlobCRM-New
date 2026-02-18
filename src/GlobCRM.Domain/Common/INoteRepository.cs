using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Common;

/// <summary>
/// Repository interface for Note CRUD operations with server-side
/// filtering, sorting, pagination, and ownership scope enforcement.
/// Notes use AuthorId as the ownership field (matching OwnerId pattern).
/// </summary>
public interface INoteRepository
{
    /// <summary>
    /// Gets a paged list of notes with server-side filtering, sorting, and ownership scope.
    /// Supports optional entityType/entityId filtering for entity-scoped queries.
    /// </summary>
    Task<PagedResult<Note>> GetPagedAsync(
        EntityQueryParams queryParams,
        string? entityType,
        Guid? entityId,
        Guid userId,
        string scope,
        List<Guid>? teamMemberIds);

    /// <summary>
    /// Gets a single note by ID, including Author navigation.
    /// </summary>
    Task<Note?> GetByIdAsync(Guid id);

    /// <summary>
    /// Creates a new note entity.
    /// </summary>
    Task<Note> AddAsync(Note note);

    /// <summary>
    /// Updates an existing note entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Note note);

    /// <summary>
    /// Deletes a note by ID.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Gets notes for an entity as timeline entries (type="note").
    /// Used by entity timeline endpoints to include note entries.
    /// </summary>
    Task<List<NoteTimelineEntry>> GetEntityNotesForTimelineAsync(string entityType, Guid entityId);
}

/// <summary>
/// Lightweight DTO for note entries in entity timelines.
/// </summary>
public record NoteTimelineEntry
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? PlainTextBody { get; init; }
    public string? AuthorName { get; init; }
    public Guid? AuthorId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
