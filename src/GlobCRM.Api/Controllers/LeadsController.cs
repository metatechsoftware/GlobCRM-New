using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.FormulaFields;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Lead CRUD, stage transitions (forward-only + reopen),
/// Kanban board data, timeline assembly, duplicate checking, and lead-to-contact
/// conversion. Ownership scope enforcement follows the DealsController pattern
/// with per-endpoint permission policies.
/// </summary>
[ApiController]
[Route("api/leads")]
[Authorize]
public class LeadsController : ControllerBase
{
    private readonly ILeadRepository _leadRepository;
    private readonly INoteRepository _noteRepository;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly NotificationDispatcher _dispatcher;
    private readonly IFeedRepository _feedRepository;
    private readonly FormulaEvaluationService _formulaEvaluator;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<LeadsController> _logger;

    public LeadsController(
        ILeadRepository leadRepository,
        INoteRepository noteRepository,
        IPermissionService permissionService,
        ITenantProvider tenantProvider,
        NotificationDispatcher dispatcher,
        IFeedRepository feedRepository,
        FormulaEvaluationService formulaEvaluator,
        ApplicationDbContext db,
        ILogger<LeadsController> logger)
    {
        _leadRepository = leadRepository;
        _noteRepository = noteRepository;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _dispatcher = dispatcher;
        _feedRepository = feedRepository;
        _formulaEvaluator = formulaEvaluator;
        _db = db;
        _logger = logger;
    }

    // ---- Core CRUD Endpoints ----

    /// <summary>
    /// Lists leads with server-side filtering, sorting, pagination, and ownership scope.
    /// Supports optional stageId, sourceId, and temperature query parameters.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Lead:View")]
    [ProducesResponseType(typeof(PagedResult<LeadListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] EntityQueryParams queryParams,
        [FromQuery] Guid? stageId = null,
        [FromQuery] Guid? sourceId = null,
        [FromQuery] LeadTemperature? temperature = null)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _leadRepository.GetPagedAsync(
            queryParams, permission.Scope, userId, teamMemberIds, stageId, sourceId, temperature);

        var dtoResult = new PagedResult<LeadListDto>
        {
            Items = pagedResult.Items.Select(LeadListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single lead by ID with full detail including conversion info.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Lead:View")]
    [ProducesResponseType(typeof(LeadDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var lead = await _leadRepository.GetByIdWithDetailsAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var enriched = await _formulaEvaluator.EvaluateFormulasForEntityAsync("Lead", lead, lead.CustomFields);
        var dto = LeadDetailDto.FromEntity(lead, enriched);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new lead with an initial stage history entry.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Lead:Create")]
    [ProducesResponseType(typeof(LeadDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateLeadRequest request)
    {
        var validator = new CreateLeadValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Validate stage exists
        var stage = await _db.LeadStages.FindAsync(request.LeadStageId);
        if (stage is null)
            return BadRequest(new { error = "Lead stage not found." });

        // Validate source exists if provided
        if (request.LeadSourceId.HasValue)
        {
            var source = await _db.LeadSources.FindAsync(request.LeadSourceId.Value);
            if (source is null)
                return BadRequest(new { error = "Lead source not found." });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var lead = new Lead
        {
            TenantId = tenantId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            MobilePhone = request.MobilePhone,
            JobTitle = request.JobTitle,
            CompanyName = request.CompanyName,
            LeadStageId = request.LeadStageId,
            LeadSourceId = request.LeadSourceId,
            Temperature = request.Temperature ?? LeadTemperature.Warm,
            OwnerId = request.OwnerId ?? userId,
            Description = request.Description,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _leadRepository.CreateAsync(lead);

        // Create initial stage history entry
        var initialHistory = new LeadStageHistory
        {
            LeadId = created.Id,
            FromStageId = null,
            ToStageId = request.LeadStageId,
            ChangedByUserId = userId,
            Notes = "Lead created"
        };
        _db.LeadStageHistories.Add(initialHistory);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead created: {LeadName} ({LeadId})", created.FullName, created.Id);

        // Dispatch feed event for lead creation
        try
        {
            var feedItem = new FeedItem
            {
                TenantId = tenantId,
                Type = FeedItemType.SystemEvent,
                Content = $"Lead '{created.FullName}' was created",
                EntityType = "Lead",
                EntityId = created.Id,
                EntityName = created.FullName,
                AuthorId = userId
            };
            await _feedRepository.CreateFeedItemAsync(feedItem);
            await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch feed event for lead creation {LeadId}", created.Id);
        }

        // Reload with navigations for DTO
        var reloaded = await _leadRepository.GetByIdWithDetailsAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            LeadDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Updates a lead's properties.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Lead:Update")]
    [ProducesResponseType(typeof(LeadDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLeadRequest request)
    {
        var lead = await _leadRepository.GetByIdAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var validator = new UpdateLeadValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Validate stage exists
        var stage = await _db.LeadStages.FindAsync(request.LeadStageId);
        if (stage is null)
            return BadRequest(new { error = "Lead stage not found." });

        // Validate source exists if provided
        if (request.LeadSourceId.HasValue)
        {
            var source = await _db.LeadSources.FindAsync(request.LeadSourceId.Value);
            if (source is null)
                return BadRequest(new { error = "Lead source not found." });
        }

        // Update lead properties
        lead.FirstName = request.FirstName;
        lead.LastName = request.LastName;
        lead.Email = request.Email;
        lead.Phone = request.Phone;
        lead.MobilePhone = request.MobilePhone;
        lead.JobTitle = request.JobTitle;
        lead.CompanyName = request.CompanyName;
        lead.LeadStageId = request.LeadStageId;
        lead.LeadSourceId = request.LeadSourceId;
        lead.Temperature = request.Temperature ?? lead.Temperature;
        lead.OwnerId = request.OwnerId;
        lead.Description = request.Description;

        if (request.CustomFields is not null)
            lead.CustomFields = request.CustomFields;

        await _leadRepository.UpdateAsync(lead);

        _logger.LogInformation("Lead updated: {LeadId}", id);

        var reloaded = await _leadRepository.GetByIdWithDetailsAsync(id);
        return Ok(LeadDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Deletes a lead with ownership scope verification.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Lead:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var lead = await _leadRepository.GetByIdAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _leadRepository.DeleteAsync(id);

        _logger.LogInformation("Lead deleted: {LeadId}", id);

        return NoContent();
    }

    // ---- Stage Transition Endpoints ----

    /// <summary>
    /// Moves a lead to a new stage. Forward-only enforcement: the target stage must have
    /// a higher SortOrder than the current stage. If the lead is in a terminal stage
    /// (IsConverted or IsLost), returns 400. Use the reopen endpoint to move backward.
    /// </summary>
    [HttpPatch("{id:guid}/stage")]
    [Authorize(Policy = "Permission:Lead:Update")]
    [ProducesResponseType(typeof(LeadDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStage(Guid id, [FromBody] UpdateLeadStageRequest request)
    {
        var lead = await _leadRepository.GetByIdAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Get current and target stages
        var currentStage = await _db.LeadStages.FindAsync(lead.LeadStageId);
        if (currentStage is null)
            return BadRequest(new { error = "Current stage not found." });

        // Reject if in terminal stage
        if (currentStage.IsConverted || currentStage.IsLost)
            return BadRequest(new { error = "Cannot change stage of a converted or lost lead. Use the reopen endpoint to move the lead backward." });

        var targetStage = await _db.LeadStages.FindAsync(request.StageId);
        if (targetStage is null)
            return BadRequest(new { error = "Target stage not found." });

        // Forward-only enforcement: target SortOrder must be greater
        if (targetStage.SortOrder <= currentStage.SortOrder)
            return BadRequest(new { error = "Use the reopen endpoint to move a lead backward." });

        // Record stage history
        var history = new LeadStageHistory
        {
            LeadId = lead.Id,
            FromStageId = lead.LeadStageId,
            ToStageId = request.StageId,
            ChangedByUserId = userId
        };
        _db.LeadStageHistories.Add(history);

        lead.LeadStageId = request.StageId;
        await _leadRepository.UpdateAsync(lead);

        _logger.LogInformation("Lead {LeadId} stage changed to {StageName}", id, targetStage.Name);

        // Dispatch notifications for stage change
        try
        {
            var tenantId = _tenantProvider.GetTenantId()
                ?? throw new InvalidOperationException("No tenant context.");

            // Notify lead owner about stage change
            if (lead.OwnerId.HasValue && lead.OwnerId.Value != userId)
            {
                await _dispatcher.DispatchAsync(new NotificationRequest
                {
                    RecipientId = lead.OwnerId.Value,
                    Type = NotificationType.DealStageChanged,
                    Title = "Lead Stage Changed",
                    Message = $"Lead '{lead.FullName}' moved to {targetStage.Name}",
                    EntityType = "Lead",
                    EntityId = lead.Id,
                    CreatedById = userId
                });
            }

            // Create feed event
            var feedItem = new FeedItem
            {
                TenantId = tenantId,
                Type = FeedItemType.SystemEvent,
                Content = $"Lead '{lead.FullName}' moved to {targetStage.Name}",
                EntityType = "Lead",
                EntityId = lead.Id,
                EntityName = lead.FullName,
                AuthorId = userId
            };
            await _feedRepository.CreateFeedItemAsync(feedItem);
            await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch notifications for lead stage change {LeadId}", id);
        }

        var reloaded = await _leadRepository.GetByIdWithDetailsAsync(id);
        return Ok(LeadDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Reopens a lead from a terminal stage (converted or lost).
    /// Target stage must not be a terminal stage. If the lead was converted,
    /// clears all conversion tracking fields.
    /// </summary>
    [HttpPost("{id:guid}/reopen")]
    [Authorize(Policy = "Permission:Lead:Update")]
    [ProducesResponseType(typeof(LeadDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reopen(Guid id, [FromBody] ReopenLeadRequest request)
    {
        var lead = await _leadRepository.GetByIdAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate target stage is not terminal
        var targetStage = await _db.LeadStages.FindAsync(request.StageId);
        if (targetStage is null)
            return BadRequest(new { error = "Target stage not found." });

        if (targetStage.IsConverted || targetStage.IsLost)
            return BadRequest(new { error = "Cannot reopen to a terminal stage (converted or lost)." });

        // Record stage history
        var history = new LeadStageHistory
        {
            LeadId = lead.Id,
            FromStageId = lead.LeadStageId,
            ToStageId = request.StageId,
            ChangedByUserId = userId,
            Notes = "Lead reopened"
        };
        _db.LeadStageHistories.Add(history);

        // If lead was converted, clear conversion tracking
        if (lead.IsConverted)
        {
            lead.IsConverted = false;
            lead.ConvertedAt = null;
            lead.ConvertedByUserId = null;
            lead.ConvertedContactId = null;
            lead.ConvertedCompanyId = null;
            lead.ConvertedDealId = null;
        }

        lead.LeadStageId = request.StageId;
        await _leadRepository.UpdateAsync(lead);

        _logger.LogInformation("Lead {LeadId} reopened to stage {StageName}", id, targetStage.Name);

        // Dispatch feed event
        try
        {
            var tenantId = _tenantProvider.GetTenantId()
                ?? throw new InvalidOperationException("No tenant context.");

            var feedItem = new FeedItem
            {
                TenantId = tenantId,
                Type = FeedItemType.SystemEvent,
                Content = $"Lead '{lead.FullName}' was reopened to {targetStage.Name}",
                EntityType = "Lead",
                EntityId = lead.Id,
                EntityName = lead.FullName,
                AuthorId = userId
            };
            await _feedRepository.CreateFeedItemAsync(feedItem);
            await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch feed event for lead reopen {LeadId}", id);
        }

        var reloaded = await _leadRepository.GetByIdWithDetailsAsync(id);
        return Ok(LeadDetailDto.FromEntity(reloaded!));
    }

    // ---- Kanban Board Endpoint ----

    /// <summary>
    /// Gets Kanban board data: all lead stages with leads grouped per stage.
    /// Respects ownership scope. Optionally includes terminal stages.
    /// </summary>
    [HttpGet("kanban")]
    [Authorize(Policy = "Permission:Lead:View")]
    [ProducesResponseType(typeof(LeadKanbanDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetKanban([FromQuery] bool includeTerminal = false)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        // Get all stages
        var allStages = await _leadRepository.GetStagesAsync();

        // Get leads for kanban
        var leads = await _leadRepository.GetForKanbanAsync(
            permission.Scope, userId, teamMemberIds, includeTerminal);

        // Group leads by stage
        var leadsByStage = leads
            .GroupBy(l => l.LeadStageId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Get last stage change dates for DaysInStage calculation
        var leadIds = leads.Select(l => l.Id).ToList();
        var latestStageChanges = await _db.LeadStageHistories
            .Where(h => leadIds.Contains(h.LeadId))
            .GroupBy(h => h.LeadId)
            .Select(g => new { LeadId = g.Key, LastChanged = g.Max(h => h.ChangedAt) })
            .ToDictionaryAsync(x => x.LeadId, x => x.LastChanged);

        var stages = allStages
            .Where(s => includeTerminal || (!s.IsConverted && !s.IsLost))
            .Select(s => new LeadKanbanStageDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Color = s.Color,
                IsConverted = s.IsConverted,
                IsLost = s.IsLost
            }).ToList();

        var kanbanLeads = leads.Select(l => new LeadKanbanCardDto
        {
            Id = l.Id,
            FullName = l.FullName,
            CompanyName = l.CompanyName,
            Email = l.Email,
            SourceName = l.Source?.Name,
            Temperature = l.Temperature,
            OwnerName = l.Owner != null
                ? $"{l.Owner.FirstName} {l.Owner.LastName}".Trim()
                : null,
            OwnerInitials = l.Owner != null
                ? $"{(l.Owner.FirstName.Length > 0 ? l.Owner.FirstName[0] : ' ')}{(l.Owner.LastName.Length > 0 ? l.Owner.LastName[0] : ' ')}".Trim()
                : null,
            LeadStageId = l.LeadStageId,
            DaysInStage = (int)(DateTimeOffset.UtcNow - (latestStageChanges.GetValueOrDefault(l.Id, l.CreatedAt))).TotalDays,
            CreatedAt = l.CreatedAt
        }).ToList();

        var kanban = new LeadKanbanDto
        {
            Stages = stages,
            Leads = kanbanLeads
        };

        return Ok(kanban);
    }

    // ---- Timeline Endpoint ----

    /// <summary>
    /// Returns chronological timeline events for a lead: creation, stage history,
    /// notes, activities, attachments, and conversion event.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Lead:View")]
    [ProducesResponseType(typeof(List<LeadTimelineEventDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var lead = await _leadRepository.GetByIdWithDetailsAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<LeadTimelineEventDto>();

        // 1. Lead creation event
        entries.Add(new LeadTimelineEventDto
        {
            Type = "created",
            Description = $"Lead '{lead.FullName}' was created.",
            Timestamp = lead.CreatedAt,
            UserId = lead.OwnerId,
            UserName = lead.Owner != null
                ? $"{lead.Owner.FirstName} {lead.Owner.LastName}".Trim()
                : null
        });

        // 2. Stage history events
        var stageHistory = await _leadRepository.GetStageHistoryAsync(id);
        foreach (var history in stageHistory)
        {
            var fromName = history.FromStage?.Name ?? "New";
            var toName = history.ToStage.Name;
            var description = history.Notes is not null
                ? $"Stage changed: {fromName} -> {toName}. {history.Notes}"
                : $"Stage changed: {fromName} -> {toName}";

            entries.Add(new LeadTimelineEventDto
            {
                Type = "stage_changed",
                Description = description,
                Timestamp = history.ChangedAt,
                UserId = history.ChangedByUserId,
                UserName = history.ChangedByUser != null
                    ? $"{history.ChangedByUser.FirstName} {history.ChangedByUser.LastName}".Trim()
                    : null
            });
        }

        // 3. Notes on this entity
        var noteEntries = await _noteRepository.GetEntityNotesForTimelineAsync("Lead", id);
        foreach (var note in noteEntries)
        {
            entries.Add(new LeadTimelineEventDto
            {
                Type = "note",
                Description = $"Note: {note.Title} - {note.PlainTextBody}",
                Timestamp = note.CreatedAt,
                UserId = note.AuthorId,
                UserName = note.AuthorName
            });
        }

        // 4. Activities linked to this entity (via ActivityLink join table)
        var activityLinks = await _db.ActivityLinks
            .Where(al => al.EntityType == "Lead" && al.EntityId == id)
            .Include(al => al.Activity)
                .ThenInclude(a => a.Owner)
            .OrderByDescending(al => al.LinkedAt)
            .ToListAsync();

        foreach (var link in activityLinks)
        {
            entries.Add(new LeadTimelineEventDto
            {
                Type = "activity",
                Description = $"Activity: {link.Activity.Subject}",
                Timestamp = link.Activity.CreatedAt,
                UserId = link.Activity.OwnerId,
                UserName = link.Activity.Owner != null
                    ? $"{link.Activity.Owner.FirstName} {link.Activity.Owner.LastName}".Trim()
                    : null
            });
        }

        // 5. Attachments on this entity
        var attachments = await _db.Attachments
            .Where(a => a.EntityType == "Lead" && a.EntityId == id)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        foreach (var attachment in attachments)
        {
            entries.Add(new LeadTimelineEventDto
            {
                Type = "attachment",
                Description = $"Attachment added: {attachment.FileName}",
                Timestamp = attachment.UploadedAt,
                UserId = attachment.UploadedById
            });
        }

        // 6. Conversion event
        if (lead.IsConverted && lead.ConvertedAt.HasValue)
        {
            entries.Add(new LeadTimelineEventDto
            {
                Type = "converted",
                Description = "Lead was converted to a contact.",
                Timestamp = lead.ConvertedAt.Value,
                UserId = lead.ConvertedByUserId
            });
        }

        // Sort by timestamp descending
        var sorted = entries.OrderByDescending(e => e.Timestamp).ToList();

        return Ok(sorted);
    }

    // ---- Summary ----

    /// <summary>
    /// Returns aggregated summary data for a lead including key properties,
    /// stage progress info, association counts, recent/upcoming activities,
    /// notes preview, attachment count, and last contacted date.
    /// </summary>
    [HttpGet("{id:guid}/summary")]
    [Authorize(Policy = "Permission:Lead:View")]
    [ProducesResponseType(typeof(LeadSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSummary(Guid id)
    {
        var lead = await _leadRepository.GetByIdWithDetailsAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var now = DateTimeOffset.UtcNow;

        // Sequential queries — DbContext does not support concurrent async operations.
        // Note: Activity Type/Status are enums with HasConversion<string>().
        // EF Core cannot translate .ToString() on value-converted enums in server-side
        // LINQ projections, so we select raw enum values first, then map to DTOs in memory.
        var recentActivitiesRaw = await _db.ActivityLinks
            .Where(al => al.EntityType == "Lead" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.DueDate, a.CreatedAt })
            .ToListAsync();

        var upcomingActivitiesRaw = await _db.ActivityLinks
            .Where(al => al.EntityType == "Lead" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .Where(a => a.Status != ActivityStatus.Done && a.DueDate != null && a.DueDate >= now)
            .OrderBy(a => a.DueDate)
            .Take(5)
            .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.DueDate, a.CreatedAt })
            .ToListAsync();

        var recentNotes = await _db.Notes
            .Where(n => n.EntityType == "Lead" && n.EntityId == id)
            .OrderByDescending(n => n.CreatedAt)
            .Take(3)
            .Select(n => new LeadSummaryNoteDto
            {
                Id = n.Id,
                Title = n.Title,
                Preview = n.PlainTextBody != null
                    ? n.PlainTextBody.Substring(0, Math.Min(n.PlainTextBody.Length, 100))
                    : null,
                AuthorName = n.Author != null
                    ? (n.Author.FirstName + " " + n.Author.LastName).Trim()
                    : null,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Lead" && al.EntityId == id);
        var noteCount = await _db.Notes.CountAsync(n => n.EntityType == "Lead" && n.EntityId == id);
        var attachmentCount = await _db.Attachments.CountAsync(a => a.EntityType == "Lead" && a.EntityId == id);

        var lastActivity = await _db.ActivityLinks
            .Where(al => al.EntityType == "Lead" && al.EntityId == id)
            .Join(_db.Activities.Where(a => a.Status == ActivityStatus.Done), al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => (DateTimeOffset?)a.CreatedAt)
            .FirstOrDefaultAsync();

        // Last email to lead's email address
        var lastEmail = !string.IsNullOrWhiteSpace(lead.Email)
            ? await _db.EmailMessages
                .Where(e => e.LinkedContactId == null) // lead emails won't be linked to a contact
                .OrderByDescending(e => e.SentAt)
                .Select(e => (DateTimeOffset?)e.SentAt)
                .FirstOrDefaultAsync()
            : (DateTimeOffset?)null;

        // Stage progress info for all lead stages
        var stageInfo = await _db.LeadStages
            .OrderBy(s => s.SortOrder)
            .Select(s => new LeadStageInfoDto
            {
                Id = s.Id,
                Name = s.Name,
                Color = s.Color,
                SortOrder = s.SortOrder,
                IsCurrent = s.Id == lead.LeadStageId,
                IsTerminal = s.IsConverted || s.IsLost
            })
            .ToListAsync();

        // Map raw activity data to DTOs (ToString() on enums must happen in memory)
        var recentActivities = recentActivitiesRaw
            .Select(a => new LeadSummaryActivityDto
            {
                Id = a.Id, Subject = a.Subject, Type = a.Type.ToString(),
                Status = a.Status.ToString(), DueDate = a.DueDate, CreatedAt = a.CreatedAt
            }).ToList();

        var upcomingActivities = upcomingActivitiesRaw
            .Select(a => new LeadSummaryActivityDto
            {
                Id = a.Id, Subject = a.Subject, Type = a.Type.ToString(),
                Status = a.Status.ToString(), DueDate = a.DueDate, CreatedAt = a.CreatedAt
            }).ToList();

        // Compute last contacted date
        DateTimeOffset? lastContacted = (lastActivity, lastEmail) switch
        {
            (not null, not null) => lastActivity > lastEmail ? lastActivity : lastEmail,
            (not null, null) => lastActivity,
            (null, not null) => lastEmail,
            _ => null
        };

        var associations = new List<LeadSummaryAssociationDto>
        {
            new() { EntityType = "Activity", Label = "Activities", Icon = "event", Count = activityCount },
            new() { EntityType = "Note", Label = "Notes", Icon = "note", Count = noteCount },
        };

        var dto = new LeadSummaryDto
        {
            Id = lead.Id,
            FullName = lead.FullName,
            Email = lead.Email,
            Phone = lead.Phone,
            CompanyName = lead.CompanyName,
            SourceName = lead.Source?.Name,
            Temperature = lead.Temperature.ToString(),
            OwnerName = lead.Owner != null
                ? $"{lead.Owner.FirstName} {lead.Owner.LastName}".Trim()
                : null,
            Stages = stageInfo,
            Associations = associations,
            RecentActivities = recentActivities,
            UpcomingActivities = upcomingActivities,
            RecentNotes = recentNotes,
            AttachmentCount = attachmentCount,
            LastContacted = lastContacted
        };

        return Ok(dto);
    }

    // ---- Conversion Endpoints ----

    /// <summary>
    /// Checks for duplicate contacts (by email) and companies (by name) before conversion.
    /// Uses the lead's existing data for matching.
    /// </summary>
    [HttpGet("{id:guid}/convert/check-duplicates")]
    [Authorize(Policy = "Permission:Lead:Update")]
    [ProducesResponseType(typeof(CheckDuplicatesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CheckDuplicates(Guid id)
    {
        var lead = await _leadRepository.GetByIdAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var contactMatches = new List<ContactMatchDto>();
        var companyMatches = new List<CompanyMatchDto>();

        // Check email against existing contacts (case-insensitive exact match)
        if (!string.IsNullOrWhiteSpace(lead.Email))
        {
            var emailLower = lead.Email.ToLowerInvariant();
            var matchingContacts = await _db.Contacts
                .Where(c => c.Email != null && c.Email.ToLower() == emailLower)
                .Include(c => c.Company)
                .ToListAsync();

            contactMatches = matchingContacts.Select(c => new ContactMatchDto
            {
                Id = c.Id,
                FullName = c.FullName,
                Email = c.Email,
                CompanyName = c.Company?.Name
            }).ToList();
        }

        // Check CompanyName against existing companies (case-insensitive contains)
        if (!string.IsNullOrWhiteSpace(lead.CompanyName))
        {
            var companyNameLower = lead.CompanyName.ToLowerInvariant();
            var matchingCompanies = await _db.Companies
                .Where(c => c.Name.ToLower().Contains(companyNameLower))
                .ToListAsync();

            companyMatches = matchingCompanies.Select(c => new CompanyMatchDto
            {
                Id = c.Id,
                Name = c.Name,
                Phone = c.Phone,
                Website = c.Website
            }).ToList();
        }

        return Ok(new CheckDuplicatesResult
        {
            ContactMatches = contactMatches,
            CompanyMatches = companyMatches
        });
    }

    /// <summary>
    /// Converts a lead to a contact (required), optional company, and optional deal.
    /// Single SaveChangesAsync for atomicity. Creates LeadConversion record and
    /// moves lead to the Converted stage.
    /// </summary>
    [HttpPost("{id:guid}/convert")]
    [Authorize(Policy = "Permission:Lead:Update")]
    [ProducesResponseType(typeof(ConvertLeadResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertLeadRequest request)
    {
        var lead = await _leadRepository.GetByIdAsync(id);
        if (lead is null)
            return NotFound(new { error = "Lead not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate lead is not already converted or lost
        var currentStage = await _db.LeadStages.FindAsync(lead.LeadStageId);
        if (currentStage is not null && (currentStage.IsConverted || currentStage.IsLost))
            return BadRequest(new { error = "Cannot convert a lead that is already converted or lost." });

        if (lead.IsConverted)
            return BadRequest(new { error = "This lead has already been converted." });

        // Validate request
        var validator = new ConvertLeadValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        // a. Create Contact from request fields
        var contact = new Contact
        {
            TenantId = tenantId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            MobilePhone = request.MobilePhone,
            JobTitle = request.JobTitle,
            OwnerId = userId
        };

        Guid? companyId = null;

        // b. Handle company: existing or new
        if (request.ExistingCompanyId.HasValue)
        {
            // Link to existing company
            var existingCompany = await _db.Companies.FindAsync(request.ExistingCompanyId.Value);
            if (existingCompany is null)
                return BadRequest(new { error = "Specified company not found." });

            contact.CompanyId = request.ExistingCompanyId.Value;
            companyId = request.ExistingCompanyId.Value;
        }
        else if (request.CreateCompany)
        {
            // Create new company
            var company = new Company
            {
                TenantId = tenantId,
                Name = request.NewCompanyName!,
                Website = request.NewCompanyWebsite,
                Phone = request.NewCompanyPhone
            };
            _db.Companies.Add(company);
            contact.CompanyId = company.Id;
            companyId = company.Id;
        }

        _db.Contacts.Add(contact);

        // c. Handle deal creation
        Guid? dealId = null;
        if (request.CreateDeal)
        {
            // Find the first stage of the specified pipeline (or default pipeline)
            Pipeline? pipeline = null;
            if (request.DealPipelineId.HasValue)
            {
                pipeline = await _db.Pipelines
                    .Include(p => p.Stages)
                    .FirstOrDefaultAsync(p => p.Id == request.DealPipelineId.Value);
            }
            else
            {
                pipeline = await _db.Pipelines
                    .Include(p => p.Stages)
                    .FirstOrDefaultAsync(p => p.IsDefault);
            }

            if (pipeline is null)
                return BadRequest(new { error = "Pipeline not found. Specify a valid pipeline for deal creation." });

            var firstStage = pipeline.Stages.OrderBy(s => s.SortOrder).FirstOrDefault();
            if (firstStage is null)
                return BadRequest(new { error = "Pipeline has no stages." });

            var deal = new Deal
            {
                TenantId = tenantId,
                Title = request.DealTitle!,
                Value = request.DealValue,
                PipelineId = pipeline.Id,
                PipelineStageId = firstStage.Id,
                CompanyId = companyId,
                OwnerId = userId,
                Probability = firstStage.DefaultProbability
            };
            _db.Deals.Add(deal);

            // Link contact to deal via DealContact
            var dealContact = new DealContact
            {
                DealId = deal.Id,
                ContactId = contact.Id
            };
            _db.DealContacts.Add(dealContact);

            dealId = deal.Id;
        }

        // d. Create LeadConversion record
        var conversion = new LeadConversion
        {
            LeadId = lead.Id,
            ContactId = contact.Id,
            CompanyId = companyId,
            DealId = dealId,
            ConvertedByUserId = userId
        };
        _db.LeadConversions.Add(conversion);

        // e. Mark lead as converted
        lead.IsConverted = true;
        lead.ConvertedAt = DateTimeOffset.UtcNow;
        lead.ConvertedByUserId = userId;
        lead.ConvertedContactId = contact.Id;
        lead.ConvertedCompanyId = companyId;
        lead.ConvertedDealId = dealId;

        // f. Move lead to the Converted stage
        var convertedStage = await _db.LeadStages.FirstOrDefaultAsync(s => s.IsConverted);
        if (convertedStage is not null)
        {
            var stageHistory = new LeadStageHistory
            {
                LeadId = lead.Id,
                FromStageId = lead.LeadStageId,
                ToStageId = convertedStage.Id,
                ChangedByUserId = userId,
                Notes = "Lead converted"
            };
            _db.LeadStageHistories.Add(stageHistory);

            lead.LeadStageId = convertedStage.Id;
        }

        lead.UpdatedAt = DateTimeOffset.UtcNow;

        // g. Single SaveChangesAsync -- atomic transaction
        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead {LeadId} converted: Contact={ContactId}, Company={CompanyId}, Deal={DealId}",
            id, contact.Id, companyId, dealId);

        // Dispatch feed event + notifications in try/catch
        try
        {
            var feedItem = new FeedItem
            {
                TenantId = tenantId,
                Type = FeedItemType.SystemEvent,
                Content = $"Lead '{lead.FullName}' was converted to a contact",
                EntityType = "Lead",
                EntityId = lead.Id,
                EntityName = lead.FullName,
                AuthorId = userId
            };
            await _feedRepository.CreateFeedItemAsync(feedItem);
            await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });

            // Notify lead owner about conversion
            if (lead.OwnerId.HasValue && lead.OwnerId.Value != userId)
            {
                await _dispatcher.DispatchAsync(new NotificationRequest
                {
                    RecipientId = lead.OwnerId.Value,
                    Type = NotificationType.DealStageChanged,
                    Title = "Lead Converted",
                    Message = $"Lead '{lead.FullName}' was converted to a contact",
                    EntityType = "Lead",
                    EntityId = lead.Id,
                    CreatedById = userId
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch feed/notification for lead conversion {LeadId}", id);
        }

        return Ok(new ConvertLeadResult
        {
            ContactId = contact.Id,
            CompanyId = companyId,
            DealId = dealId
        });
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Checks if an entity is within the user's ownership scope.
    /// </summary>
    private static bool IsWithinScope(
        Guid? ownerId,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => true,
            PermissionScope.Team => ownerId is null ||
                                    ownerId == userId ||
                                    (teamMemberIds is not null && teamMemberIds.Contains(ownerId.Value)),
            PermissionScope.Own => ownerId == userId,
            PermissionScope.None => false,
            _ => false
        };
    }

    /// <summary>
    /// Gets team member user IDs for Team scope filtering.
    /// Only queries when scope is Team.
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
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for lead list views.
/// </summary>
public record LeadListDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? CompanyName { get; init; }
    public string StageName { get; init; } = string.Empty;
    public string StageColor { get; init; } = string.Empty;
    public string? SourceName { get; init; }
    public LeadTemperature Temperature { get; init; }
    public string? OwnerName { get; init; }
    public bool IsConverted { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static LeadListDto FromEntity(Lead entity) => new()
    {
        Id = entity.Id,
        FirstName = entity.FirstName,
        LastName = entity.LastName,
        FullName = entity.FullName,
        Email = entity.Email,
        Phone = entity.Phone,
        CompanyName = entity.CompanyName,
        StageName = entity.Stage?.Name ?? string.Empty,
        StageColor = entity.Stage?.Color ?? string.Empty,
        SourceName = entity.Source?.Name,
        Temperature = entity.Temperature,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        IsConverted = entity.IsConverted,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for lead detail view including conversion info.
/// </summary>
public record LeadDetailDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? MobilePhone { get; init; }
    public string? JobTitle { get; init; }
    public string? CompanyName { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public Guid LeadStageId { get; init; }
    public string StageName { get; init; } = string.Empty;
    public string StageColor { get; init; } = string.Empty;
    public Guid? LeadSourceId { get; init; }
    public string? SourceName { get; init; }
    public LeadTemperature Temperature { get; init; }
    public bool IsConverted { get; init; }
    public DateTimeOffset? ConvertedAt { get; init; }
    public string? ConvertedByUserName { get; init; }
    public Guid? ConvertedContactId { get; init; }
    public Guid? ConvertedCompanyId { get; init; }
    public Guid? ConvertedDealId { get; init; }
    public LeadConversionDetailDto? ConversionDetails { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static LeadDetailDto FromEntity(Lead entity, Dictionary<string, object?>? enrichedCustomFields = null) => new()
    {
        Id = entity.Id,
        FirstName = entity.FirstName,
        LastName = entity.LastName,
        FullName = entity.FullName,
        Email = entity.Email,
        Phone = entity.Phone,
        MobilePhone = entity.MobilePhone,
        JobTitle = entity.JobTitle,
        CompanyName = entity.CompanyName,
        Description = entity.Description,
        CustomFields = enrichedCustomFields ?? entity.CustomFields,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        LeadStageId = entity.LeadStageId,
        StageName = entity.Stage?.Name ?? string.Empty,
        StageColor = entity.Stage?.Color ?? string.Empty,
        LeadSourceId = entity.LeadSourceId,
        SourceName = entity.Source?.Name,
        Temperature = entity.Temperature,
        IsConverted = entity.IsConverted,
        ConvertedAt = entity.ConvertedAt,
        ConvertedByUserName = entity.LeadConversion?.ConvertedByUser != null
            ? $"{entity.LeadConversion.ConvertedByUser.FirstName} {entity.LeadConversion.ConvertedByUser.LastName}".Trim()
            : null,
        ConvertedContactId = entity.ConvertedContactId,
        ConvertedCompanyId = entity.ConvertedCompanyId,
        ConvertedDealId = entity.ConvertedDealId,
        ConversionDetails = entity.LeadConversion != null
            ? LeadConversionDetailDto.FromEntity(entity.LeadConversion)
            : null,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for lead conversion details.
/// </summary>
public record LeadConversionDetailDto
{
    public Guid ContactId { get; init; }
    public string? ContactName { get; init; }
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public Guid? DealId { get; init; }
    public string? DealTitle { get; init; }
    public string? ConvertedByUserName { get; init; }
    public DateTimeOffset ConvertedAt { get; init; }
    public string? Notes { get; init; }

    public static LeadConversionDetailDto FromEntity(LeadConversion entity) => new()
    {
        ContactId = entity.ContactId,
        ContactName = entity.Contact?.FullName,
        CompanyId = entity.CompanyId,
        CompanyName = entity.Company?.Name,
        DealId = entity.DealId,
        DealTitle = entity.Deal?.Title,
        ConvertedByUserName = entity.ConvertedByUser != null
            ? $"{entity.ConvertedByUser.FirstName} {entity.ConvertedByUser.LastName}".Trim()
            : null,
        ConvertedAt = entity.ConvertedAt,
        Notes = entity.Notes
    };
}

/// <summary>
/// DTO for Kanban board stage column.
/// </summary>
public record LeadKanbanStageDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string Color { get; init; } = string.Empty;
    public bool IsConverted { get; init; }
    public bool IsLost { get; init; }
}

/// <summary>
/// DTO for Kanban board lead card.
/// </summary>
public record LeadKanbanCardDto
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string? Email { get; init; }
    public string? SourceName { get; init; }
    public LeadTemperature Temperature { get; init; }
    public string? OwnerName { get; init; }
    public string? OwnerInitials { get; init; }
    public Guid LeadStageId { get; init; }
    public int DaysInStage { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Kanban board data containing stages and leads.
/// </summary>
public record LeadKanbanDto
{
    public List<LeadKanbanStageDto> Stages { get; init; } = new();
    public List<LeadKanbanCardDto> Leads { get; init; } = new();
}

/// <summary>
/// Lead stage DTO for stage listing.
/// </summary>
public record LeadStageListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string Color { get; init; } = string.Empty;
    public bool IsConverted { get; init; }
    public bool IsLost { get; init; }
}

/// <summary>
/// Lead timeline event DTO.
/// </summary>
public record LeadTimelineEventDto
{
    public string Type { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public DateTimeOffset Timestamp { get; init; }
    public Guid? UserId { get; init; }
    public string? UserName { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a lead.
/// </summary>
public record CreateLeadRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? MobilePhone { get; init; }
    public string? JobTitle { get; init; }
    public string? CompanyName { get; init; }
    public Guid LeadStageId { get; init; }
    public Guid? LeadSourceId { get; init; }
    public LeadTemperature? Temperature { get; init; }
    public Guid? OwnerId { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a lead.
/// </summary>
public record UpdateLeadRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? MobilePhone { get; init; }
    public string? JobTitle { get; init; }
    public string? CompanyName { get; init; }
    public Guid LeadStageId { get; init; }
    public Guid? LeadSourceId { get; init; }
    public LeadTemperature? Temperature { get; init; }
    public Guid? OwnerId { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for changing a lead's stage (forward-only).
/// </summary>
public record UpdateLeadStageRequest
{
    public Guid StageId { get; init; }
}

/// <summary>
/// Request body for reopening a lead from a terminal stage.
/// </summary>
public record ReopenLeadRequest
{
    public Guid StageId { get; init; }
}

/// <summary>
/// Request body for converting a lead to contact + optional company + optional deal.
/// </summary>
public record ConvertLeadRequest
{
    // Contact fields (required, pre-filled from lead)
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? MobilePhone { get; init; }
    public string? JobTitle { get; init; }

    // Company choice: existing or new
    public Guid? ExistingCompanyId { get; init; }
    public bool CreateCompany { get; init; }
    public string? NewCompanyName { get; init; }
    public string? NewCompanyWebsite { get; init; }
    public string? NewCompanyPhone { get; init; }

    // Deal choice
    public bool CreateDeal { get; init; }
    public string? DealTitle { get; init; }
    public decimal? DealValue { get; init; }
    public Guid? DealPipelineId { get; init; }
}

/// <summary>
/// Result of duplicate check for lead conversion.
/// </summary>
public record CheckDuplicatesResult
{
    public List<ContactMatchDto> ContactMatches { get; init; } = new();
    public List<CompanyMatchDto> CompanyMatches { get; init; } = new();
}

/// <summary>
/// DTO for a matching contact found during duplicate check.
/// </summary>
public record ContactMatchDto
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? CompanyName { get; init; }
}

/// <summary>
/// DTO for a matching company found during duplicate check.
/// </summary>
public record CompanyMatchDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string? Website { get; init; }
}

/// <summary>
/// Result of lead conversion.
/// </summary>
public record ConvertLeadResult
{
    public Guid ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? DealId { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateLeadRequest.
/// </summary>
public class CreateLeadValidator : AbstractValidator<CreateLeadRequest>
{
    public CreateLeadValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name must be at most 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name must be at most 100 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Email must be a valid email address.");

        RuleFor(x => x.Phone)
            .MaximumLength(50).WithMessage("Phone must be at most 50 characters.");

        RuleFor(x => x.LeadStageId)
            .NotEmpty().WithMessage("Lead stage is required.");
    }
}

/// <summary>
/// FluentValidation validator for UpdateLeadRequest.
/// </summary>
public class UpdateLeadValidator : AbstractValidator<UpdateLeadRequest>
{
    public UpdateLeadValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name must be at most 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name must be at most 100 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Email must be a valid email address.");

        RuleFor(x => x.Phone)
            .MaximumLength(50).WithMessage("Phone must be at most 50 characters.");

        RuleFor(x => x.LeadStageId)
            .NotEmpty().WithMessage("Lead stage is required.");
    }
}

/// <summary>
/// FluentValidation validator for ConvertLeadRequest.
/// </summary>
public class ConvertLeadValidator : AbstractValidator<ConvertLeadRequest>
{
    public ConvertLeadValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name must be at most 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name must be at most 100 characters.");

        RuleFor(x => x.NewCompanyName)
            .NotEmpty().WithMessage("Company name is required when creating a new company.")
            .When(x => x.CreateCompany);

        RuleFor(x => x.DealTitle)
            .NotEmpty().WithMessage("Deal title is required when creating a deal.")
            .When(x => x.CreateDeal);

        RuleFor(x => x.DealPipelineId)
            .NotEmpty().WithMessage("Pipeline is required when creating a deal.")
            .When(x => x.CreateDeal);
    }
}

// ---- Summary DTOs ----

/// <summary>
/// Aggregated summary DTO for the lead detail summary tab.
/// </summary>
public record LeadSummaryDto
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? CompanyName { get; init; }
    public string? SourceName { get; init; }
    public string Temperature { get; init; } = string.Empty;
    public string? OwnerName { get; init; }
    public List<LeadStageInfoDto> Stages { get; init; } = new();
    public List<LeadSummaryAssociationDto> Associations { get; init; } = new();
    public List<LeadSummaryActivityDto> RecentActivities { get; init; } = new();
    public List<LeadSummaryActivityDto> UpcomingActivities { get; init; } = new();
    public List<LeadSummaryNoteDto> RecentNotes { get; init; } = new();
    public int AttachmentCount { get; init; }
    public DateTimeOffset? LastContacted { get; init; }
}

public record LeadStageInfoDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsCurrent { get; init; }
    public bool IsTerminal { get; init; }
}

public record LeadSummaryActivityDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record LeadSummaryNoteDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Preview { get; init; }
    public string? AuthorName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record LeadSummaryAssociationDto
{
    public string EntityType { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Icon { get; init; } = string.Empty;
    public int Count { get; init; }
}
