using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Note entities with server-side filtering, sorting,
/// pagination, and ownership scope enforcement. Uses ApplicationDbContext with
/// tenant-scoped global query filters.
///
/// Notes use AuthorId as the ownership field (matching OwnerId on other entities).
/// </summary>
public class NoteRepository : INoteRepository
{
    private readonly ApplicationDbContext _db;

    public NoteRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Note>> GetPagedAsync(
        EntityQueryParams queryParams,
        string? entityType,
        Guid? entityId,
        Guid userId,
        string scope,
        List<Guid>? teamMemberIds)
    {
        var query = _db.Notes.AsQueryable();

        // 1. Apply entity-scoped filtering
        if (!string.IsNullOrWhiteSpace(entityType) && entityId.HasValue)
        {
            query = query.Where(n => n.EntityType == entityType && n.EntityId == entityId.Value);
        }

        // 2. Apply ownership scope filtering (AuthorId = OwnerId for notes)
        if (Enum.TryParse<PermissionScope>(scope, true, out var permissionScope))
        {
            query = ApplyOwnershipScope(query, permissionScope, userId, teamMemberIds);
        }

        // 3. Apply search
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(n =>
                n.Title.ToLower().Contains(search) ||
                (n.PlainTextBody != null && n.PlainTextBody.ToLower().Contains(search)) ||
                (n.EntityName != null && n.EntityName.ToLower().Contains(search)));
        }

        // 4. Apply filters
        if (queryParams.Filters is { Count: > 0 })
        {
            query = ApplyFilters(query, queryParams.Filters);
        }

        // 5. Apply sorting
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        // 6. Get total count before pagination
        var totalCount = await query.CountAsync();

        // 7. Apply pagination and include Author navigation
        var items = await query
            .Include(n => n.Author)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Note>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Note?> GetByIdAsync(Guid id)
    {
        return await _db.Notes
            .Include(n => n.Author)
            .FirstOrDefaultAsync(n => n.Id == id);
    }

    /// <inheritdoc />
    public async Task<Note> AddAsync(Note note)
    {
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();
        return note;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Note note)
    {
        note.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Notes.Update(note);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var note = await _db.Notes.FindAsync(id);
        if (note is not null)
        {
            _db.Notes.Remove(note);
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<List<NoteTimelineEntry>> GetEntityNotesForTimelineAsync(string entityType, Guid entityId)
    {
        return await _db.Notes
            .Include(n => n.Author)
            .Where(n => n.EntityType == entityType && n.EntityId == entityId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NoteTimelineEntry
            {
                Id = n.Id,
                Title = n.Title,
                PlainTextBody = n.PlainTextBody != null && n.PlainTextBody.Length > 200
                    ? n.PlainTextBody.Substring(0, 200) + "..."
                    : n.PlainTextBody,
                AuthorName = n.Author != null
                    ? (n.Author.FirstName + " " + n.Author.LastName).Trim()
                    : null,
                AuthorId = n.AuthorId,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// Notes use AuthorId as the ownership field.
    /// </summary>
    private static IQueryable<Note> ApplyOwnershipScope(
        IQueryable<Note> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(n =>
                n.AuthorId == userId ||
                (teamMemberIds != null && n.AuthorId.HasValue && teamMemberIds.Contains(n.AuthorId.Value))),
            PermissionScope.Own => query.Where(n => n.AuthorId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters.
    /// </summary>
    private static IQueryable<Note> ApplyFilters(
        IQueryable<Note> query,
        List<FilterParam> filters)
    {
        foreach (var filter in filters)
        {
            if (string.IsNullOrEmpty(filter.Value)) continue;

            query = filter.FieldId.ToLower() switch
            {
                "title" => ApplyStringFilter(query, filter.Operator, filter.Value,
                    (q, v) => filter.Operator switch
                    {
                        "equals" => q.Where(n => n.Title.ToLower() == v),
                        "contains" => q.Where(n => n.Title.ToLower().Contains(v)),
                        "starts_with" => q.Where(n => n.Title.ToLower().StartsWith(v)),
                        _ => q
                    }),
                "entitytype" => query.Where(n => n.EntityType.ToLower() == filter.Value.ToLower()),
                "entityname" => query.Where(n => n.EntityName != null && n.EntityName.ToLower().Contains(filter.Value.ToLower())),
                _ => query
            };
        }

        return query;
    }

    private static IQueryable<Note> ApplyStringFilter(
        IQueryable<Note> query,
        string filterOperator,
        string value,
        Func<IQueryable<Note>, string, IQueryable<Note>> filterFunc)
    {
        return filterFunc(query, value.ToLower());
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper.
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Note> ApplySorting(
        IQueryable<Note> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(n => n.CreatedAt) : query.OrderByDescending(n => n.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "title" => desc ? query.OrderByDescending(n => n.Title) : query.OrderBy(n => n.Title),
            "entitytype" => desc ? query.OrderByDescending(n => n.EntityType) : query.OrderBy(n => n.EntityType),
            "entityname" => desc ? query.OrderByDescending(n => n.EntityName) : query.OrderBy(n => n.EntityName),
            "createdat" => desc ? query.OrderByDescending(n => n.CreatedAt) : query.OrderBy(n => n.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(n => n.UpdatedAt) : query.OrderBy(n => n.UpdatedAt),
            _ => query.OrderByDescending(n => n.CreatedAt)
        };
    }
}
