using FluentValidation;
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
/// REST endpoints for Kanban board CRUD, columns, cards, labels, checklists, and comments.
/// Board visibility: Private (creator only), Team (team members), Public (all tenant users).
/// Board creation supports optional template keys for pre-populated columns.
/// All endpoints require authentication.
/// </summary>
[ApiController]
[Route("api/boards")]
[Authorize]
public class BoardsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<BoardsController> _logger;

    public BoardsController(
        ApplicationDbContext db,
        ITenantProvider tenantProvider,
        ILogger<BoardsController> logger)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- Board Template Definitions ----

    private static readonly Dictionary<string, List<(string Name, int? WipLimit)>> BoardTemplates = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sprint"] = new()
        {
            ("Backlog", null),
            ("To Do", 5),
            ("In Progress", 3),
            ("Review", 2),
            ("Done", null)
        },
        ["content"] = new()
        {
            ("Ideas", null),
            ("Writing", null),
            ("Editing", null),
            ("Scheduled", null),
            ("Published", null)
        },
        ["sales"] = new()
        {
            ("To Contact", null),
            ("Contacted", null),
            ("Follow Up", null),
            ("Meeting Set", null),
            ("Closed", null)
        }
    };

    // ---- Board CRUD ----

    /// <summary>
    /// Lists all boards visible to the current user filtered by visibility:
    /// Public = all, Private = creator only, Team = team members.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<BoardListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");

        // Get team IDs the user belongs to for Team visibility check
        var userTeamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        var boards = await _db.KanbanBoards
            .Include(b => b.Creator)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
            .Where(b =>
                b.Visibility == BoardVisibility.Public ||
                (b.Visibility == BoardVisibility.Private && b.CreatorId == userId) ||
                (b.Visibility == BoardVisibility.Team && b.TeamId != null && userTeamIds.Contains(b.TeamId.Value)) ||
                isAdmin)
            .OrderBy(b => b.Name)
            .ToListAsync();

        var dtos = boards.Select(BoardListDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new board. If TemplateKey provided, populates with predefined columns.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateBoard([FromBody] CreateBoardRequest request)
    {
        var validator = new CreateBoardValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var board = new KanbanBoard
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            Color = request.Color,
            Visibility = request.Visibility ?? BoardVisibility.Private,
            CreatorId = userId,
            TeamId = request.TeamId
        };

        // Populate template columns if template key provided
        if (!string.IsNullOrWhiteSpace(request.TemplateKey) &&
            BoardTemplates.TryGetValue(request.TemplateKey, out var templateColumns))
        {
            for (int i = 0; i < templateColumns.Count; i++)
            {
                board.Columns.Add(new KanbanColumn
                {
                    BoardId = board.Id,
                    Name = templateColumns[i].Name,
                    WipLimit = templateColumns[i].WipLimit,
                    SortOrder = (i + 1) * 1.0
                });
            }
        }

        _db.KanbanBoards.Add(board);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Board created: {BoardName} ({BoardId})", board.Name, board.Id);

        // Reload with navigations
        var created = await _db.KanbanBoards
            .Include(b => b.Creator)
            .Include(b => b.Columns.OrderBy(c => c.SortOrder))
                .ThenInclude(c => c.Cards.Where(card => !card.IsArchived).OrderBy(card => card.SortOrder))
                    .ThenInclude(card => card.Labels)
                        .ThenInclude(cl => cl.Label)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
                    .ThenInclude(card => card.ChecklistItems)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
                    .ThenInclude(card => card.Assignees)
                        .ThenInclude(ca => ca.User)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
                    .ThenInclude(card => card.Comments)
            .Include(b => b.Labels)
            .FirstOrDefaultAsync(b => b.Id == board.Id);

        return CreatedAtAction(nameof(GetBoard), new { id = board.Id }, BoardDetailDto.FromEntity(created!));
    }

    /// <summary>
    /// Gets board detail with columns, cards, labels. Verifies access via visibility check.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBoard(Guid id)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        return Ok(BoardDetailDto.FromEntity(board));
    }

    /// <summary>
    /// Updates board properties. Only creator or admin can update.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BoardDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateBoard(Guid id, [FromBody] UpdateBoardRequest request)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        if (!CanEditBoard(board, userId))
            return Forbid();

        if (request.Name is not null) board.Name = request.Name;
        if (request.Description is not null) board.Description = request.Description;
        if (request.Color is not null) board.Color = request.Color;
        if (request.Visibility is not null) board.Visibility = request.Visibility.Value;
        if (request.TeamId is not null) board.TeamId = request.TeamId;
        board.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Board updated: {BoardId}", id);

        return Ok(BoardDetailDto.FromEntity(board));
    }

    /// <summary>
    /// Deletes board (cascade deletes columns, cards, etc.). Only creator or admin.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteBoard(Guid id)
    {
        var userId = GetCurrentUserId();
        var board = await _db.KanbanBoards.FindAsync(id);
        if (board is null)
            return NotFound(new { error = "Board not found." });

        if (!CanEditBoard(board, userId))
            return Forbid();

        _db.KanbanBoards.Remove(board);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Board deleted: {BoardId}", id);

        return NoContent();
    }

    // ---- Column Endpoints ----

    /// <summary>
    /// Adds a column to a board. SortOrder = max existing + 1.0.
    /// </summary>
    [HttpPost("{id:guid}/columns")]
    [ProducesResponseType(typeof(ColumnDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AddColumn(Guid id, [FromBody] CreateColumnRequest request)
    {
        var validator = new CreateColumnValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var maxSort = board.Columns.Any() ? board.Columns.Max(c => c.SortOrder) : 0.0;

        var column = new KanbanColumn
        {
            BoardId = board.Id,
            Name = request.Name,
            WipLimit = request.WipLimit,
            Color = request.Color,
            SortOrder = maxSort + 1.0
        };

        _db.KanbanColumns.Add(column);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Column added to board {BoardId}: {ColumnName}", id, column.Name);

        return CreatedAtAction(nameof(GetBoard), new { id }, ColumnDto.FromEntity(column));
    }

    /// <summary>
    /// Updates column name, WIP limit, color.
    /// </summary>
    [HttpPut("{id:guid}/columns/{colId:guid}")]
    [ProducesResponseType(typeof(ColumnDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateColumn(Guid id, Guid colId, [FromBody] UpdateColumnRequest request)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var column = board.Columns.FirstOrDefault(c => c.Id == colId);
        if (column is null)
            return NotFound(new { error = "Column not found." });

        if (request.Name is not null) column.Name = request.Name;
        if (request.WipLimit is not null) column.WipLimit = request.WipLimit;
        if (request.Color is not null) column.Color = request.Color;
        column.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ColumnDto.FromEntity(column));
    }

    /// <summary>
    /// Deletes a column. Moves remaining cards to the first column. Rejects if last column.
    /// </summary>
    [HttpDelete("{id:guid}/columns/{colId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteColumn(Guid id, Guid colId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        if (board.Columns.Count <= 1)
            return BadRequest(new { error = "Cannot delete the last column in a board." });

        var column = board.Columns.FirstOrDefault(c => c.Id == colId);
        if (column is null)
            return NotFound(new { error = "Column not found." });

        // Move cards to the first column (by SortOrder) that isn't the one being deleted
        var targetColumn = board.Columns
            .Where(c => c.Id != colId)
            .OrderBy(c => c.SortOrder)
            .First();

        if (column.Cards.Any())
        {
            var maxSort = targetColumn.Cards.Any() ? targetColumn.Cards.Max(c => c.SortOrder) : 0.0;
            foreach (var card in column.Cards.ToList())
            {
                maxSort += 1.0;
                card.ColumnId = targetColumn.Id;
                card.SortOrder = maxSort;
            }
        }

        _db.KanbanColumns.Remove(column);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Column {ColumnId} deleted from board {BoardId}", colId, id);

        return NoContent();
    }

    /// <summary>
    /// Reorders columns by accepting an array of column IDs.
    /// </summary>
    [HttpPatch("{id:guid}/columns/reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReorderColumns(Guid id, [FromBody] ReorderColumnsRequest request)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        if (request.ColumnIds is null || request.ColumnIds.Count == 0)
            return BadRequest(new { error = "ColumnIds array is required." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToHashSet();
        if (!request.ColumnIds.All(cid => boardColumnIds.Contains(cid)))
            return BadRequest(new { error = "Some column IDs do not belong to this board." });

        for (int i = 0; i < request.ColumnIds.Count; i++)
        {
            var column = board.Columns.First(c => c.Id == request.ColumnIds[i]);
            column.SortOrder = (i + 1) * 1.0;
            column.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---- Card Endpoints ----

    /// <summary>
    /// Creates a card. ColumnId optional (defaults to first column by SortOrder).
    /// </summary>
    [HttpPost("{id:guid}/cards")]
    [ProducesResponseType(typeof(CardDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCard(Guid id, [FromBody] CreateCardRequest request)
    {
        var validator = new CreateCardValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        if (!board.Columns.Any())
            return BadRequest(new { error = "Board has no columns. Add a column first." });

        KanbanColumn targetColumn;
        if (request.ColumnId.HasValue)
        {
            targetColumn = board.Columns.FirstOrDefault(c => c.Id == request.ColumnId.Value)
                ?? throw new InvalidOperationException("Column not found on this board.");
        }
        else
        {
            targetColumn = board.Columns.OrderBy(c => c.SortOrder).First();
        }

        var maxSort = targetColumn.Cards.Any() ? targetColumn.Cards.Max(c => c.SortOrder) : 0.0;

        var card = new KanbanCard
        {
            ColumnId = targetColumn.Id,
            Title = request.Title,
            Description = request.Description,
            DueDate = request.DueDate,
            SortOrder = maxSort + 1.0
        };

        _db.KanbanCards.Add(card);
        await _db.SaveChangesAsync();

        // Add assignees if provided
        if (request.AssigneeIds is { Count: > 0 })
        {
            foreach (var uid in request.AssigneeIds)
            {
                _db.KanbanCardAssignees.Add(new KanbanCardAssignee
                {
                    CardId = card.Id,
                    UserId = uid
                });
            }
            await _db.SaveChangesAsync();
        }

        // Reload with navigations for DTO
        var created = await _db.KanbanCards
            .Include(c => c.Assignees).ThenInclude(ca => ca.User)
            .Include(c => c.Labels).ThenInclude(cl => cl.Label)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Comments)
            .FirstAsync(c => c.Id == card.Id);

        _logger.LogInformation("Card created on board {BoardId}: {CardTitle}", id, card.Title);

        return CreatedAtAction(nameof(GetBoard), new { id }, CardDto.FromEntity(created));
    }

    /// <summary>
    /// Updates card properties (title, description, due date, assignee, entity link).
    /// </summary>
    [HttpPut("{id:guid}/cards/{cardId:guid}")]
    [ProducesResponseType(typeof(CardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCard(Guid id, Guid cardId, [FromBody] UpdateCardRequest request)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var card = await _db.KanbanCards
            .Include(c => c.Assignees).ThenInclude(ca => ca.User)
            .Include(c => c.Labels).ThenInclude(cl => cl.Label)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Comments)
            .FirstOrDefaultAsync(c => c.Id == cardId && board.Columns.Select(col => col.Id).Contains(c.ColumnId));

        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        if (request.Title is not null) card.Title = request.Title;
        if (request.Description is not null) card.Description = request.Description;
        if (request.DueDate.HasValue) card.DueDate = request.DueDate;
        if (request.LinkedEntityType is not null) card.LinkedEntityType = request.LinkedEntityType;
        if (request.LinkedEntityId.HasValue) card.LinkedEntityId = request.LinkedEntityId;
        if (request.LinkedEntityName is not null) card.LinkedEntityName = request.LinkedEntityName;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(CardDto.FromEntity(card));
    }

    /// <summary>
    /// Moves a card to a target column with a new sort order. Critical drag-and-drop endpoint.
    /// </summary>
    [HttpPatch("{id:guid}/cards/{cardId:guid}/move")]
    [ProducesResponseType(typeof(CardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> MoveCard(Guid id, Guid cardId, [FromBody] MoveCardRequest request)
    {
        var moveValidator = new MoveCardValidator();
        var moveValidation = await moveValidator.ValidateAsync(request);
        if (!moveValidation.IsValid)
        {
            return BadRequest(new
            {
                errors = moveValidation.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();

        var card = await _db.KanbanCards
            .Include(c => c.Assignees).ThenInclude(ca => ca.User)
            .Include(c => c.Labels).ThenInclude(cl => cl.Label)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Comments)
            .FirstOrDefaultAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));

        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        if (!boardColumnIds.Contains(request.TargetColumnId))
            return BadRequest(new { error = "Target column does not belong to this board." });

        card.ColumnId = request.TargetColumnId;
        card.SortOrder = request.SortOrder;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(CardDto.FromEntity(card));
    }

    /// <summary>
    /// Toggles card archive status.
    /// </summary>
    [HttpPatch("{id:guid}/cards/{cardId:guid}/archive")]
    [ProducesResponseType(typeof(CardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ArchiveCard(Guid id, Guid cardId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();

        var card = await _db.KanbanCards
            .Include(c => c.Assignees).ThenInclude(ca => ca.User)
            .Include(c => c.Labels).ThenInclude(cl => cl.Label)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Comments)
            .FirstOrDefaultAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));

        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        card.IsArchived = !card.IsArchived;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(CardDto.FromEntity(card));
    }

    // ---- Label Endpoints ----

    /// <summary>
    /// Creates a board-scoped label.
    /// </summary>
    [HttpPost("{id:guid}/labels")]
    [ProducesResponseType(typeof(LabelDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateLabel(Guid id, [FromBody] CreateLabelRequest request)
    {
        var validator = new CreateLabelValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var label = new KanbanLabel
        {
            BoardId = board.Id,
            Name = request.Name,
            Color = request.Color
        };

        _db.KanbanLabels.Add(label);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBoard), new { id }, LabelDto.FromEntity(label));
    }

    /// <summary>
    /// Updates a label's name and/or color.
    /// </summary>
    [HttpPut("{id:guid}/labels/{labelId:guid}")]
    [ProducesResponseType(typeof(LabelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLabel(Guid id, Guid labelId, [FromBody] UpdateLabelRequest request)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var label = board.Labels.FirstOrDefault(l => l.Id == labelId);
        if (label is null)
            return NotFound(new { error = "Label not found." });

        if (request.Name is not null) label.Name = request.Name;
        if (request.Color is not null) label.Color = request.Color;

        await _db.SaveChangesAsync();

        return Ok(LabelDto.FromEntity(label));
    }

    /// <summary>
    /// Deletes a label (cascades to remove KanbanCardLabel join entries).
    /// </summary>
    [HttpDelete("{id:guid}/labels/{labelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteLabel(Guid id, Guid labelId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var label = board.Labels.FirstOrDefault(l => l.Id == labelId);
        if (label is null)
            return NotFound(new { error = "Label not found." });

        _db.KanbanLabels.Remove(label);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Adds a label to a card. Verifies both belong to this board.
    /// </summary>
    [HttpPost("{id:guid}/cards/{cardId:guid}/labels/{labelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddLabelToCard(Guid id, Guid cardId, Guid labelId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        // Verify card belongs to this board
        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();
        var card = await _db.KanbanCards.FirstOrDefaultAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));
        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        // Verify label belongs to this board
        var label = board.Labels.FirstOrDefault(l => l.Id == labelId);
        if (label is null)
            return NotFound(new { error = "Label not found on this board." });

        // Check if already applied
        var existing = await _db.KanbanCardLabels
            .FirstOrDefaultAsync(cl => cl.CardId == cardId && cl.LabelId == labelId);
        if (existing is not null)
            return Conflict(new { error = "Label is already applied to this card." });

        _db.KanbanCardLabels.Add(new KanbanCardLabel
        {
            CardId = cardId,
            LabelId = labelId
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Removes a label from a card.
    /// </summary>
    [HttpDelete("{id:guid}/cards/{cardId:guid}/labels/{labelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveLabelFromCard(Guid id, Guid cardId, Guid labelId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var cardLabel = await _db.KanbanCardLabels
            .FirstOrDefaultAsync(cl => cl.CardId == cardId && cl.LabelId == labelId);
        if (cardLabel is null)
            return NotFound(new { error = "Label not applied to this card." });

        _db.KanbanCardLabels.Remove(cardLabel);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---- Card Assignee Endpoints ----

    /// <summary>
    /// Adds a user as an assignee to a card. Verifies board access and user exists.
    /// </summary>
    [HttpPost("{id:guid}/cards/{cardId:guid}/assignees/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddAssigneeToCard(Guid id, Guid cardId, Guid userId)
    {
        var currentUserId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, currentUserId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        // Verify card belongs to this board
        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();
        var card = await _db.KanbanCards.FirstOrDefaultAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));
        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        // Verify user exists
        var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
        if (!userExists)
            return NotFound(new { error = "User not found." });

        // Check if already assigned
        var existing = await _db.KanbanCardAssignees
            .FirstOrDefaultAsync(ca => ca.CardId == cardId && ca.UserId == userId);
        if (existing is not null)
            return Conflict(new { error = "User is already assigned to this card." });

        _db.KanbanCardAssignees.Add(new KanbanCardAssignee
        {
            CardId = cardId,
            UserId = userId
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Removes a user assignment from a card.
    /// </summary>
    [HttpDelete("{id:guid}/cards/{cardId:guid}/assignees/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveAssigneeFromCard(Guid id, Guid cardId, Guid userId)
    {
        var currentUserId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, currentUserId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var cardAssignee = await _db.KanbanCardAssignees
            .FirstOrDefaultAsync(ca => ca.CardId == cardId && ca.UserId == userId);
        if (cardAssignee is null)
            return NotFound(new { error = "User not assigned to this card." });

        _db.KanbanCardAssignees.Remove(cardAssignee);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---- Checklist Endpoints ----

    /// <summary>
    /// Gets all checklist items for a card, ordered by SortOrder ascending.
    /// </summary>
    [HttpGet("{id:guid}/cards/{cardId:guid}/checklist")]
    [ProducesResponseType(typeof(List<ChecklistItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetChecklistItems(Guid id, Guid cardId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();
        var card = await _db.KanbanCards
            .Include(c => c.ChecklistItems)
            .FirstOrDefaultAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));
        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        return Ok(card.ChecklistItems.OrderBy(ci => ci.SortOrder).Select(ChecklistItemDto.FromEntity).ToList());
    }

    /// <summary>
    /// Adds a checklist item to a card. SortOrder = max existing + 1.0.
    /// </summary>
    [HttpPost("{id:guid}/cards/{cardId:guid}/checklist")]
    [ProducesResponseType(typeof(ChecklistItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddChecklistItem(Guid id, Guid cardId, [FromBody] CreateChecklistItemRequest request)
    {
        var validator = new CreateChecklistItemValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();
        var card = await _db.KanbanCards
            .Include(c => c.ChecklistItems)
            .FirstOrDefaultAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));
        if (card is null)
            return NotFound(new { error = "Card not found on this board." });

        var maxSort = card.ChecklistItems.Any() ? card.ChecklistItems.Max(ci => ci.SortOrder) : 0.0;

        var item = new KanbanChecklistItem
        {
            CardId = cardId,
            Text = request.Text,
            SortOrder = maxSort + 1.0
        };

        _db.KanbanChecklistItems.Add(item);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBoard), new { id }, ChecklistItemDto.FromEntity(item));
    }

    /// <summary>
    /// Updates checklist item text and/or isChecked.
    /// </summary>
    [HttpPut("{id:guid}/cards/{cardId:guid}/checklist/{itemId:guid}")]
    [ProducesResponseType(typeof(ChecklistItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateChecklistItem(Guid id, Guid cardId, Guid itemId, [FromBody] UpdateChecklistItemRequest request)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var item = await _db.KanbanChecklistItems
            .FirstOrDefaultAsync(ci => ci.Id == itemId && ci.CardId == cardId);
        if (item is null)
            return NotFound(new { error = "Checklist item not found." });

        if (request.Text is not null) item.Text = request.Text;
        if (request.IsChecked.HasValue) item.IsChecked = request.IsChecked.Value;
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ChecklistItemDto.FromEntity(item));
    }

    /// <summary>
    /// Deletes a checklist item.
    /// </summary>
    [HttpDelete("{id:guid}/cards/{cardId:guid}/checklist/{itemId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteChecklistItem(Guid id, Guid cardId, Guid itemId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var item = await _db.KanbanChecklistItems
            .FirstOrDefaultAsync(ci => ci.Id == itemId && ci.CardId == cardId);
        if (item is null)
            return NotFound(new { error = "Checklist item not found." });

        _db.KanbanChecklistItems.Remove(item);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Toggles checklist item IsChecked boolean.
    /// </summary>
    [HttpPatch("{id:guid}/cards/{cardId:guid}/checklist/{itemId:guid}/toggle")]
    [ProducesResponseType(typeof(ChecklistItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleChecklistItem(Guid id, Guid cardId, Guid itemId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var item = await _db.KanbanChecklistItems
            .FirstOrDefaultAsync(ci => ci.Id == itemId && ci.CardId == cardId);
        if (item is null)
            return NotFound(new { error = "Checklist item not found." });

        item.IsChecked = !item.IsChecked;
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ChecklistItemDto.FromEntity(item));
    }

    // ---- Comment Endpoints ----

    /// <summary>
    /// Gets all comments for a card, organized as a threaded tree (top-level with nested replies).
    /// </summary>
    [HttpGet("{id:guid}/cards/{cardId:guid}/comments")]
    [ProducesResponseType(typeof(List<CardCommentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetComments(Guid id, Guid cardId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();
        var cardExists = await _db.KanbanCards.AnyAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));
        if (!cardExists)
            return NotFound(new { error = "Card not found on this board." });

        var comments = await _db.KanbanCardComments
            .Include(c => c.Author)
            .Where(c => c.CardId == cardId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        var tree = BuildCommentTree(comments);
        return Ok(tree);
    }

    /// <summary>
    /// Adds a comment to a card. Supports threaded replies via ParentCommentId.
    /// </summary>
    [HttpPost("{id:guid}/cards/{cardId:guid}/comments")]
    [ProducesResponseType(typeof(CardCommentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddComment(Guid id, Guid cardId, [FromBody] CreateCardCommentRequest request)
    {
        var validator = new CreateCardCommentValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var boardColumnIds = board.Columns.Select(c => c.Id).ToList();
        var cardExists = await _db.KanbanCards.AnyAsync(c => c.Id == cardId && boardColumnIds.Contains(c.ColumnId));
        if (!cardExists)
            return NotFound(new { error = "Card not found on this board." });

        // Verify parent comment exists on same card if provided
        if (request.ParentCommentId.HasValue)
        {
            var parentExists = await _db.KanbanCardComments
                .AnyAsync(c => c.Id == request.ParentCommentId.Value && c.CardId == cardId);
            if (!parentExists)
                return BadRequest(new { error = "Parent comment not found on this card." });
        }

        var comment = new KanbanCardComment
        {
            CardId = cardId,
            Content = request.Content,
            AuthorId = userId,
            ParentCommentId = request.ParentCommentId
        };

        _db.KanbanCardComments.Add(comment);
        await _db.SaveChangesAsync();

        // Reload with author
        var created = await _db.KanbanCardComments
            .Include(c => c.Author)
            .FirstAsync(c => c.Id == comment.Id);

        return CreatedAtAction(nameof(GetComments), new { id, cardId }, CardCommentDto.FromEntity(created));
    }

    /// <summary>
    /// Updates comment content. Only the author can update.
    /// </summary>
    [HttpPut("{id:guid}/cards/{cardId:guid}/comments/{commentId:guid}")]
    [ProducesResponseType(typeof(CardCommentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateComment(Guid id, Guid cardId, Guid commentId, [FromBody] UpdateCardCommentRequest request)
    {
        var validator = new UpdateCardCommentValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var comment = await _db.KanbanCardComments
            .Include(c => c.Author)
            .FirstOrDefaultAsync(c => c.Id == commentId && c.CardId == cardId);
        if (comment is null)
            return NotFound(new { error = "Comment not found." });

        if (comment.AuthorId != userId && !User.IsInRole("Admin"))
            return Forbid();

        comment.Content = request.Content;
        comment.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(CardCommentDto.FromEntity(comment));
    }

    /// <summary>
    /// Deletes a comment. Only author or admin. Cascade deletes replies.
    /// </summary>
    [HttpDelete("{id:guid}/cards/{cardId:guid}/comments/{commentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteComment(Guid id, Guid cardId, Guid commentId)
    {
        var userId = GetCurrentUserId();
        var board = await GetBoardWithAccessCheck(id, userId);
        if (board is null)
            return NotFound(new { error = "Board not found or access denied." });

        var comment = await _db.KanbanCardComments
            .Include(c => c.Replies)
            .FirstOrDefaultAsync(c => c.Id == commentId && c.CardId == cardId);
        if (comment is null)
            return NotFound(new { error = "Comment not found." });

        if (comment.AuthorId != userId && !User.IsInRole("Admin"))
            return Forbid();

        // Delete replies first (self-referencing FK with Restrict requires manual delete)
        if (comment.Replies.Any())
        {
            _db.KanbanCardComments.RemoveRange(comment.Replies);
        }

        _db.KanbanCardComments.Remove(comment);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Returns board with full navigation graph if user has access based on visibility rules.
    /// Returns null if board not found or user has no access.
    /// </summary>
    private async Task<KanbanBoard?> GetBoardWithAccessCheck(Guid boardId, Guid userId)
    {
        var board = await _db.KanbanBoards
            .Include(b => b.Creator)
            .Include(b => b.Columns.OrderBy(c => c.SortOrder))
                .ThenInclude(c => c.Cards.Where(card => !card.IsArchived).OrderBy(card => card.SortOrder))
                    .ThenInclude(card => card.Labels)
                        .ThenInclude(cl => cl.Label)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
                    .ThenInclude(card => card.ChecklistItems)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
                    .ThenInclude(card => card.Assignees)
                        .ThenInclude(ca => ca.User)
            .Include(b => b.Columns)
                .ThenInclude(c => c.Cards)
                    .ThenInclude(card => card.Comments)
            .Include(b => b.Labels)
            .FirstOrDefaultAsync(b => b.Id == boardId);

        if (board is null)
            return null;

        // Admin can access all boards
        if (User.IsInRole("Admin"))
            return board;

        switch (board.Visibility)
        {
            case BoardVisibility.Public:
                return board;

            case BoardVisibility.Private:
                return board.CreatorId == userId ? board : null;

            case BoardVisibility.Team:
                if (board.TeamId is null)
                    return null;

                var isMember = await _db.TeamMembers
                    .AnyAsync(tm => tm.TeamId == board.TeamId.Value && tm.UserId == userId);
                return isMember ? board : null;

            default:
                return null;
        }
    }

    /// <summary>
    /// Checks if user can edit/delete a board. Only creator or admin.
    /// </summary>
    private bool CanEditBoard(KanbanBoard board, Guid userId)
    {
        return board.CreatorId == userId || User.IsInRole("Admin");
    }

    /// <summary>
    /// Builds a threaded comment tree from a flat list. Top-level comments (ParentCommentId == null)
    /// get their replies attached recursively. Limited to 2 levels of nesting.
    /// </summary>
    private static List<CardCommentDto> BuildCommentTree(List<KanbanCardComment> comments)
    {
        var topLevel = comments.Where(c => c.ParentCommentId is null).ToList();
        var byParent = comments
            .Where(c => c.ParentCommentId is not null)
            .GroupBy(c => c.ParentCommentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        return topLevel.Select(c => BuildCommentNode(c, byParent, 0)).ToList();
    }

    private static CardCommentDto BuildCommentNode(
        KanbanCardComment comment,
        Dictionary<Guid, List<KanbanCardComment>> byParent,
        int depth)
    {
        var dto = CardCommentDto.FromEntity(comment);

        if (depth < 2 && byParent.TryGetValue(comment.Id, out var replies))
        {
            dto = dto with
            {
                Replies = replies.Select(r => BuildCommentNode(r, byParent, depth + 1)).ToList()
            };
        }

        return dto;
    }
}

// ---- DTOs ----

/// <summary>
/// DTO for board list view with aggregate counts.
/// </summary>
public record BoardListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Color { get; init; }
    public BoardVisibility Visibility { get; init; }
    public Guid? CreatorId { get; init; }
    public string? CreatorName { get; init; }
    public int ColumnCount { get; init; }
    public int CardCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static BoardListDto FromEntity(KanbanBoard entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Color = entity.Color,
        Visibility = entity.Visibility,
        CreatorId = entity.CreatorId,
        CreatorName = entity.Creator != null
            ? $"{entity.Creator.FirstName} {entity.Creator.LastName}".Trim()
            : null,
        ColumnCount = entity.Columns.Count,
        CardCount = entity.Columns.SelectMany(c => c.Cards).Count(),
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for board detail view with columns, cards, and labels.
/// </summary>
public record BoardDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Color { get; init; }
    public BoardVisibility Visibility { get; init; }
    public Guid? CreatorId { get; init; }
    public string? CreatorName { get; init; }
    public Guid? TeamId { get; init; }
    public List<ColumnDto> Columns { get; init; } = new();
    public List<LabelDto> Labels { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static BoardDetailDto FromEntity(KanbanBoard entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Color = entity.Color,
        Visibility = entity.Visibility,
        CreatorId = entity.CreatorId,
        CreatorName = entity.Creator != null
            ? $"{entity.Creator.FirstName} {entity.Creator.LastName}".Trim()
            : null,
        TeamId = entity.TeamId,
        Columns = entity.Columns
            .OrderBy(c => c.SortOrder)
            .Select(ColumnDto.FromEntity)
            .ToList(),
        Labels = entity.Labels
            .Select(LabelDto.FromEntity)
            .ToList(),
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for a column within a board.
/// </summary>
public record ColumnDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public double SortOrder { get; init; }
    public int? WipLimit { get; init; }
    public string? Color { get; init; }
    public bool IsCollapsed { get; init; }
    public List<CardDto> Cards { get; init; } = new();

    public static ColumnDto FromEntity(KanbanColumn entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        SortOrder = entity.SortOrder,
        WipLimit = entity.WipLimit,
        Color = entity.Color,
        IsCollapsed = entity.IsCollapsed,
        Cards = entity.Cards
            .OrderBy(c => c.SortOrder)
            .Select(CardDto.FromEntity)
            .ToList()
    };
}

/// <summary>
/// DTO for a user assigned to a card.
/// </summary>
public record CardAssigneeDto
{
    public Guid UserId { get; init; }
    public string Name { get; init; } = string.Empty;

    public static CardAssigneeDto FromEntity(KanbanCardAssignee e) => new()
    {
        UserId = e.UserId,
        Name = e.User != null ? $"{e.User.FirstName} {e.User.LastName}".Trim() : string.Empty
    };
}

/// <summary>
/// DTO for a card within a column.
/// </summary>
public record CardDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DateTimeOffset? DueDate { get; init; }
    public List<CardAssigneeDto> Assignees { get; init; } = new();
    public double SortOrder { get; init; }
    public bool IsArchived { get; init; }
    public string? LinkedEntityType { get; init; }
    public Guid? LinkedEntityId { get; init; }
    public string? LinkedEntityName { get; init; }
    public List<CardLabelDto> Labels { get; init; } = new();
    public int ChecklistTotal { get; init; }
    public int ChecklistChecked { get; init; }
    public int CommentCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static CardDto FromEntity(KanbanCard entity) => new()
    {
        Id = entity.Id,
        Title = entity.Title,
        Description = entity.Description,
        DueDate = entity.DueDate,
        Assignees = entity.Assignees
            .Select(CardAssigneeDto.FromEntity)
            .ToList(),
        SortOrder = entity.SortOrder,
        IsArchived = entity.IsArchived,
        LinkedEntityType = entity.LinkedEntityType,
        LinkedEntityId = entity.LinkedEntityId,
        LinkedEntityName = entity.LinkedEntityName,
        Labels = entity.Labels
            .Select(CardLabelDto.FromEntity)
            .ToList(),
        ChecklistTotal = entity.ChecklistItems.Count,
        ChecklistChecked = entity.ChecklistItems.Count(ci => ci.IsChecked),
        CommentCount = entity.Comments.Count,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for a label applied to a card.
/// </summary>
public record CardLabelDto
{
    public Guid LabelId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;

    public static CardLabelDto FromEntity(KanbanCardLabel entity) => new()
    {
        LabelId = entity.LabelId,
        Name = entity.Label.Name,
        Color = entity.Label.Color
    };
}

/// <summary>
/// DTO for a board-scoped label.
/// </summary>
public record LabelDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;

    public static LabelDto FromEntity(KanbanLabel entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Color = entity.Color
    };
}

/// <summary>
/// DTO for a checklist item within a card.
/// </summary>
public record ChecklistItemDto
{
    public Guid Id { get; init; }
    public string Text { get; init; } = string.Empty;
    public bool IsChecked { get; init; }
    public double SortOrder { get; init; }

    public static ChecklistItemDto FromEntity(KanbanChecklistItem entity) => new()
    {
        Id = entity.Id,
        Text = entity.Text,
        IsChecked = entity.IsChecked,
        SortOrder = entity.SortOrder
    };
}

/// <summary>
/// DTO for a card comment. Supports threaded replies.
/// </summary>
public record CardCommentDto
{
    public Guid Id { get; init; }
    public string Content { get; init; } = string.Empty;
    public Guid? AuthorId { get; init; }
    public string? AuthorName { get; init; }
    public Guid? ParentCommentId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
    public List<CardCommentDto> Replies { get; init; } = new();

    public static CardCommentDto FromEntity(KanbanCardComment entity) => new()
    {
        Id = entity.Id,
        Content = entity.Content,
        AuthorId = entity.AuthorId,
        AuthorName = entity.Author != null
            ? $"{entity.Author.FirstName} {entity.Author.LastName}".Trim()
            : null,
        ParentCommentId = entity.ParentCommentId,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt,
        Replies = new()
    };
}

// ---- Request Records ----

public record CreateBoardRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Color { get; init; }
    public BoardVisibility? Visibility { get; init; }
    public Guid? TeamId { get; init; }
    public string? TemplateKey { get; init; }
}

public record UpdateBoardRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Color { get; init; }
    public BoardVisibility? Visibility { get; init; }
    public Guid? TeamId { get; init; }
}

public record CreateColumnRequest
{
    public string Name { get; init; } = string.Empty;
    public int? WipLimit { get; init; }
    public string? Color { get; init; }
}

public record UpdateColumnRequest
{
    public string? Name { get; init; }
    public int? WipLimit { get; init; }
    public string? Color { get; init; }
}

public record ReorderColumnsRequest
{
    public List<Guid> ColumnIds { get; init; } = new();
}

public record CreateCardRequest
{
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DateTimeOffset? DueDate { get; init; }
    public List<Guid>? AssigneeIds { get; init; }
    public Guid? ColumnId { get; init; }
}

public record UpdateCardRequest
{
    public string? Title { get; init; }
    public string? Description { get; init; }
    public DateTimeOffset? DueDate { get; init; }
    public string? LinkedEntityType { get; init; }
    public Guid? LinkedEntityId { get; init; }
    public string? LinkedEntityName { get; init; }
}

public record MoveCardRequest
{
    public Guid TargetColumnId { get; init; }
    public double SortOrder { get; init; }
}

public record CreateLabelRequest
{
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
}

public record UpdateLabelRequest
{
    public string? Name { get; init; }
    public string? Color { get; init; }
}

public record CreateChecklistItemRequest
{
    public string Text { get; init; } = string.Empty;
}

public record UpdateChecklistItemRequest
{
    public string? Text { get; init; }
    public bool? IsChecked { get; init; }
}

public record CreateCardCommentRequest
{
    public string Content { get; init; } = string.Empty;
    public Guid? ParentCommentId { get; init; }
}

public record UpdateCardCommentRequest
{
    public string Content { get; init; } = string.Empty;
}

// ---- FluentValidation ----

public class CreateBoardValidator : AbstractValidator<CreateBoardRequest>
{
    public CreateBoardValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Board name is required.")
            .MaximumLength(200).WithMessage("Board name must be 200 characters or fewer.");

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithMessage("Description must be 2000 characters or fewer.");

        RuleFor(x => x.Color)
            .MaximumLength(10).WithMessage("Color must be 10 characters or fewer.");

        RuleFor(x => x.TemplateKey)
            .MaximumLength(50).WithMessage("Template key must be 50 characters or fewer.");
    }
}

public class CreateColumnValidator : AbstractValidator<CreateColumnRequest>
{
    public CreateColumnValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Column name is required.")
            .MaximumLength(100).WithMessage("Column name must be 100 characters or fewer.");

        RuleFor(x => x.WipLimit)
            .GreaterThan(0).When(x => x.WipLimit.HasValue)
            .WithMessage("WIP limit must be greater than 0.");

        RuleFor(x => x.Color)
            .MaximumLength(10).WithMessage("Color must be 10 characters or fewer.");
    }
}

public class CreateCardValidator : AbstractValidator<CreateCardRequest>
{
    public CreateCardValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Card title is required.")
            .MaximumLength(500).WithMessage("Card title must be 500 characters or fewer.");

        RuleFor(x => x.Description)
            .MaximumLength(10000).WithMessage("Description must be 10000 characters or fewer.");
    }
}

public class CreateLabelValidator : AbstractValidator<CreateLabelRequest>
{
    public CreateLabelValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Label name is required.")
            .MaximumLength(50).WithMessage("Label name must be 50 characters or fewer.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Label color is required.")
            .MaximumLength(10).WithMessage("Color must be 10 characters or fewer.");
    }
}

public class CreateChecklistItemValidator : AbstractValidator<CreateChecklistItemRequest>
{
    public CreateChecklistItemValidator()
    {
        RuleFor(x => x.Text)
            .NotEmpty().WithMessage("Checklist item text is required.")
            .MaximumLength(500).WithMessage("Text must be 500 characters or fewer.");
    }
}

public class CreateCardCommentValidator : AbstractValidator<CreateCardCommentRequest>
{
    public CreateCardCommentValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Comment content is required.")
            .MaximumLength(5000).WithMessage("Content must be 5000 characters or fewer.");
    }
}

public class UpdateCardCommentValidator : AbstractValidator<UpdateCardCommentRequest>
{
    public UpdateCardCommentValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Comment content is required.")
            .MaximumLength(5000).WithMessage("Content must be 5000 characters or fewer.");
    }
}

public class MoveCardValidator : AbstractValidator<MoveCardRequest>
{
    public MoveCardValidator()
    {
        RuleFor(x => x.TargetColumnId)
            .NotEmpty().WithMessage("Target column ID is required.");

        RuleFor(x => x.SortOrder)
            .GreaterThanOrEqualTo(0).WithMessage("Sort order must be non-negative.");
    }
}

public class UpdateCardValidator : AbstractValidator<UpdateCardRequest>
{
    public UpdateCardValidator()
    {
        RuleFor(x => x.Title)
            .MaximumLength(500).When(x => x.Title is not null)
            .WithMessage("Card title must be 500 characters or fewer.");

        RuleFor(x => x.Description)
            .MaximumLength(10000).When(x => x.Description is not null)
            .WithMessage("Description must be 10000 characters or fewer.");

        RuleFor(x => x.LinkedEntityType)
            .MaximumLength(50).When(x => x.LinkedEntityType is not null)
            .WithMessage("Entity type must be 50 characters or fewer.");

        RuleFor(x => x.LinkedEntityName)
            .MaximumLength(200).When(x => x.LinkedEntityName is not null)
            .WithMessage("Entity name must be 200 characters or fewer.");
    }
}
