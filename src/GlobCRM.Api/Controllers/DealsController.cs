using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.FormulaFields;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Deal CRUD, stage transitions, entity linking,
/// Kanban board data, and deal timeline. Ownership scope enforcement
/// follows the CompaniesController pattern with per-endpoint permission policies.
/// </summary>
[ApiController]
[Route("api/deals")]
[Authorize]
public class DealsController : ControllerBase
{
    private readonly IDealRepository _dealRepository;
    private readonly IPipelineRepository _pipelineRepository;
    private readonly INoteRepository _noteRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly NotificationDispatcher _dispatcher;
    private readonly IFeedRepository _feedRepository;
    private readonly FormulaEvaluationService _formulaEvaluator;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<DealsController> _logger;

    public DealsController(
        IDealRepository dealRepository,
        IPipelineRepository pipelineRepository,
        INoteRepository noteRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        NotificationDispatcher dispatcher,
        IFeedRepository feedRepository,
        FormulaEvaluationService formulaEvaluator,
        ApplicationDbContext db,
        ILogger<DealsController> logger)
    {
        _dealRepository = dealRepository;
        _pipelineRepository = pipelineRepository;
        _noteRepository = noteRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _dispatcher = dispatcher;
        _feedRepository = feedRepository;
        _formulaEvaluator = formulaEvaluator;
        _db = db;
        _logger = logger;
    }

    // ---- Core CRUD Endpoints ----

    /// <summary>
    /// Lists deals with server-side filtering, sorting, pagination, and ownership scope.
    /// Supports optional pipelineId and stageId query parameters.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Deal:View")]
    [ProducesResponseType(typeof(PagedResult<DealListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] EntityQueryParams queryParams,
        [FromQuery] Guid? pipelineId = null,
        [FromQuery] Guid? stageId = null)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _dealRepository.GetPagedAsync(
            queryParams, permission.Scope, userId, teamMemberIds, pipelineId, stageId);

        // Enrich custom fields with formula values
        var items = new List<DealListDto>();
        foreach (var deal in pagedResult.Items)
        {
            var enriched = await _formulaEvaluator.EvaluateFormulasForEntityAsync("Deal", deal, deal.CustomFields);
            items.Add(DealListDto.FromEntity(deal, enriched));
        }

        var dtoResult = new PagedResult<DealListDto>
        {
            Items = items,
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single deal by ID with linked contacts, products, and stage info.
    /// Ownership scope verified.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Deal:View")]
    [ProducesResponseType(typeof(DealDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var deal = await _dealRepository.GetByIdWithLinksAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var enriched = await _formulaEvaluator.EvaluateFormulasForEntityAsync("Deal", deal, deal.CustomFields);
        var dto = DealDetailDto.FromEntity(deal, enriched);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new deal. If pipelineStageId not provided, defaults to
    /// the first stage of the pipeline (SortOrder = 0).
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Deal:Create")]
    [ProducesResponseType(typeof(DealListDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateDealRequest request)
    {
        var validator = new CreateDealRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Deal", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Validate pipeline exists
        var pipeline = await _pipelineRepository.GetByIdWithStagesAsync(request.PipelineId);
        if (pipeline is null)
            return BadRequest(new { error = "Pipeline not found." });

        // Resolve stage: provided or default to first stage
        Guid stageId;
        if (request.PipelineStageId.HasValue)
        {
            var stage = pipeline.Stages.FirstOrDefault(s => s.Id == request.PipelineStageId.Value);
            if (stage is null)
                return BadRequest(new { error = "Stage does not belong to the specified pipeline." });
            stageId = stage.Id;
        }
        else
        {
            var firstStage = pipeline.Stages.OrderBy(s => s.SortOrder).FirstOrDefault();
            if (firstStage is null)
                return BadRequest(new { error = "Pipeline has no stages." });
            stageId = firstStage.Id;
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        // Get the stage to set default probability
        var dealStage = pipeline.Stages.First(s => s.Id == stageId);

        var deal = new Deal
        {
            TenantId = tenantId,
            Title = request.Title,
            Value = request.Value,
            Probability = request.Probability ?? dealStage.DefaultProbability,
            ExpectedCloseDate = request.ExpectedCloseDate,
            PipelineId = request.PipelineId,
            PipelineStageId = stageId,
            CompanyId = request.CompanyId,
            OwnerId = request.OwnerId ?? userId,
            Description = request.Description,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _dealRepository.CreateAsync(deal);

        _logger.LogInformation("Deal created: {DealTitle} ({DealId})", created.Title, created.Id);

        // Dispatch feed event for deal creation
        try
        {
            var feedItem = new FeedItem
            {
                TenantId = tenantId,
                Type = FeedItemType.SystemEvent,
                Content = $"Deal '{created.Title}' was created",
                EntityType = "Deal",
                EntityId = created.Id,
                EntityName = created.Title,
                AuthorId = userId
            };
            await _feedRepository.CreateFeedItemAsync(feedItem);
            await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch feed event for deal creation {DealId}", created.Id);
        }

        // Reload with navigations for DTO
        var reloaded = await _dealRepository.GetByIdAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            DealListDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Updates a deal. If PipelineStageId changes, creates DealStageHistory record.
    /// On terminal stages (IsWon/IsLost), sets ActualCloseDate.
    /// Auto-updates Probability to stage DefaultProbability when stage changes
    /// (unless user explicitly set Probability in the request).
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Deal:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDealRequest request)
    {
        var deal = await _dealRepository.GetByIdAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Deal", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Check if stage is changing
        var stageChanged = request.PipelineStageId.HasValue &&
                           request.PipelineStageId.Value != deal.PipelineStageId;

        if (stageChanged)
        {
            var newStageId = request.PipelineStageId!.Value;

            // Validate new stage belongs to deal's pipeline
            var newStage = await _db.PipelineStages
                .FirstOrDefaultAsync(s => s.Id == newStageId && s.PipelineId == deal.PipelineId);

            if (newStage is null)
                return BadRequest(new { error = "Stage does not belong to the deal's pipeline." });

            // Create stage history record
            var history = new DealStageHistory
            {
                DealId = deal.Id,
                FromStageId = deal.PipelineStageId,
                ToStageId = newStageId,
                ChangedByUserId = userId,
            };
            _db.DealStageHistories.Add(history);

            deal.PipelineStageId = newStageId;

            // Auto-update probability unless user explicitly set it
            if (!request.Probability.HasValue)
            {
                deal.Probability = newStage.DefaultProbability;
            }

            // Set ActualCloseDate on terminal stages
            if (newStage.IsWon || newStage.IsLost)
            {
                deal.ActualCloseDate = DateOnly.FromDateTime(DateTime.UtcNow);
            }
            else
            {
                deal.ActualCloseDate = null;
            }
        }

        // Update deal properties
        deal.Title = request.Title;
        deal.Value = request.Value;
        deal.ExpectedCloseDate = request.ExpectedCloseDate;
        deal.CompanyId = request.CompanyId;
        deal.OwnerId = request.OwnerId;
        deal.Description = request.Description;

        if (request.Probability.HasValue)
            deal.Probability = request.Probability;

        if (request.CustomFields is not null)
            deal.CustomFields = request.CustomFields;

        await _dealRepository.UpdateAsync(deal);

        _logger.LogInformation("Deal updated: {DealId}", id);

        // Dispatch notifications for stage change
        if (stageChanged)
        {
            try
            {
                var newStage = await _db.PipelineStages.FindAsync(request.PipelineStageId!.Value);
                var stageName = newStage?.Name ?? "unknown stage";
                var tenantId = _tenantProvider.GetTenantId()
                    ?? throw new InvalidOperationException("No tenant context.");

                // Notify deal owner about stage change
                if (deal.OwnerId.HasValue && deal.OwnerId.Value != userId)
                {
                    await _dispatcher.DispatchAsync(new NotificationRequest
                    {
                        RecipientId = deal.OwnerId.Value,
                        Type = NotificationType.DealStageChanged,
                        Title = "Deal Stage Changed",
                        Message = $"Deal '{deal.Title}' moved to {stageName}",
                        EntityType = "Deal",
                        EntityId = deal.Id,
                        CreatedById = userId
                    });
                }

                // Create feed event for stage change
                var feedItem = new FeedItem
                {
                    TenantId = tenantId,
                    Type = FeedItemType.SystemEvent,
                    Content = $"Deal '{deal.Title}' moved to {stageName}",
                    EntityType = "Deal",
                    EntityId = deal.Id,
                    EntityName = deal.Title,
                    AuthorId = userId
                };
                await _feedRepository.CreateFeedItemAsync(feedItem);
                await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to dispatch notifications for deal stage change {DealId}", id);
            }
        }

        return NoContent();
    }

    /// <summary>
    /// Deletes a deal with ownership scope verification.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Deal:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deal = await _dealRepository.GetByIdAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _dealRepository.DeleteAsync(id);

        _logger.LogInformation("Deal deleted: {DealId}", id);

        return NoContent();
    }

    // ---- Stage Transition ----

    /// <summary>
    /// Dedicated stage change endpoint for Kanban drag-drop.
    /// Validates stage belongs to same pipeline. Creates DealStageHistory.
    /// Updates Probability and sets ActualCloseDate on terminal stages.
    /// </summary>
    [HttpPatch("{id:guid}/stage")]
    [Authorize(Policy = "Permission:Deal:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStage(Guid id, [FromBody] UpdateDealStageRequest request)
    {
        var deal = await _dealRepository.GetByIdAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate stage belongs to same pipeline
        var newStage = await _db.PipelineStages
            .FirstOrDefaultAsync(s => s.Id == request.StageId && s.PipelineId == deal.PipelineId);

        if (newStage is null)
            return BadRequest(new { error = "Stage does not belong to the deal's pipeline." });

        if (deal.PipelineStageId == request.StageId)
            return NoContent(); // No-op if already in the same stage

        // Create stage history record
        var history = new DealStageHistory
        {
            DealId = deal.Id,
            FromStageId = deal.PipelineStageId,
            ToStageId = request.StageId,
            ChangedByUserId = userId,
        };
        _db.DealStageHistories.Add(history);

        deal.PipelineStageId = request.StageId;
        deal.Probability = newStage.DefaultProbability;

        // Set ActualCloseDate on terminal stages
        if (newStage.IsWon || newStage.IsLost)
        {
            deal.ActualCloseDate = DateOnly.FromDateTime(DateTime.UtcNow);
        }
        else
        {
            deal.ActualCloseDate = null;
        }

        await _dealRepository.UpdateAsync(deal);

        _logger.LogInformation("Deal {DealId} stage changed to {StageName}", id, newStage.Name);

        // Dispatch notifications for stage change
        try
        {
            var tenantId = _tenantProvider.GetTenantId()
                ?? throw new InvalidOperationException("No tenant context.");

            // Notify deal owner about stage change
            if (deal.OwnerId.HasValue && deal.OwnerId.Value != userId)
            {
                await _dispatcher.DispatchAsync(new NotificationRequest
                {
                    RecipientId = deal.OwnerId.Value,
                    Type = NotificationType.DealStageChanged,
                    Title = "Deal Stage Changed",
                    Message = $"Deal '{deal.Title}' moved to {newStage.Name}",
                    EntityType = "Deal",
                    EntityId = deal.Id,
                    CreatedById = userId
                });
            }

            // Create feed event for stage change
            var feedItem = new FeedItem
            {
                TenantId = tenantId,
                Type = FeedItemType.SystemEvent,
                Content = $"Deal '{deal.Title}' moved to {newStage.Name}",
                EntityType = "Deal",
                EntityId = deal.Id,
                EntityName = deal.Title,
                AuthorId = userId
            };
            await _feedRepository.CreateFeedItemAsync(feedItem);
            await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch notifications for deal stage change {DealId}", id);
        }

        return NoContent();
    }

    // ---- Entity Linking: Contacts ----

    /// <summary>
    /// Links a contact to a deal.
    /// </summary>
    [HttpPost("{id:guid}/contacts/{contactId:guid}")]
    [Authorize(Policy = "Permission:Deal:Update")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LinkContact(Guid id, Guid contactId)
    {
        var deal = await _dealRepository.GetByIdAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Verify contact exists
        var contactExists = await _db.Contacts.AnyAsync(c => c.Id == contactId);
        if (!contactExists)
            return NotFound(new { error = "Contact not found." });

        // Check if already linked
        var alreadyLinked = await _db.DealContacts
            .AnyAsync(dc => dc.DealId == id && dc.ContactId == contactId);
        if (alreadyLinked)
            return BadRequest(new { error = "Contact is already linked to this deal." });

        var dealContact = new DealContact
        {
            DealId = id,
            ContactId = contactId
        };
        _db.DealContacts.Add(dealContact);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Contact {ContactId} linked to deal {DealId}", contactId, id);

        return StatusCode(StatusCodes.Status201Created);
    }

    /// <summary>
    /// Unlinks a contact from a deal.
    /// </summary>
    [HttpDelete("{id:guid}/contacts/{contactId:guid}")]
    [Authorize(Policy = "Permission:Deal:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnlinkContact(Guid id, Guid contactId)
    {
        var dealContact = await _db.DealContacts
            .FirstOrDefaultAsync(dc => dc.DealId == id && dc.ContactId == contactId);

        if (dealContact is null)
            return NotFound(new { error = "Contact link not found." });

        _db.DealContacts.Remove(dealContact);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Contact {ContactId} unlinked from deal {DealId}", contactId, id);

        return NoContent();
    }

    // ---- Entity Linking: Products ----

    /// <summary>
    /// Links a product to a deal with optional quantity and unit price.
    /// </summary>
    [HttpPost("{id:guid}/products")]
    [Authorize(Policy = "Permission:Deal:Update")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LinkProduct(Guid id, [FromBody] LinkProductRequest request)
    {
        var deal = await _dealRepository.GetByIdAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Verify product exists
        var productExists = await _db.Products.AnyAsync(p => p.Id == request.ProductId);
        if (!productExists)
            return NotFound(new { error = "Product not found." });

        // Check if already linked
        var alreadyLinked = await _db.DealProducts
            .AnyAsync(dp => dp.DealId == id && dp.ProductId == request.ProductId);
        if (alreadyLinked)
            return BadRequest(new { error = "Product is already linked to this deal." });

        var dealProduct = new DealProduct
        {
            DealId = id,
            ProductId = request.ProductId,
            Quantity = request.Quantity ?? 1,
            UnitPrice = request.UnitPrice
        };
        _db.DealProducts.Add(dealProduct);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Product {ProductId} linked to deal {DealId}", request.ProductId, id);

        return StatusCode(StatusCodes.Status201Created);
    }

    /// <summary>
    /// Unlinks a product from a deal.
    /// </summary>
    [HttpDelete("{id:guid}/products/{productId:guid}")]
    [Authorize(Policy = "Permission:Deal:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnlinkProduct(Guid id, Guid productId)
    {
        var dealProduct = await _db.DealProducts
            .FirstOrDefaultAsync(dp => dp.DealId == id && dp.ProductId == productId);

        if (dealProduct is null)
            return NotFound(new { error = "Product link not found." });

        _db.DealProducts.Remove(dealProduct);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Product {ProductId} unlinked from deal {DealId}", productId, id);

        return NoContent();
    }

    // ---- View Endpoints ----

    /// <summary>
    /// Gets all deals for a pipeline grouped by stage for Kanban board display.
    /// Uses GetByPipelineForKanbanAsync. Respects ownership scope.
    /// </summary>
    [HttpGet("kanban")]
    [Authorize(Policy = "Permission:Deal:View")]
    [ProducesResponseType(typeof(KanbanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetKanban(
        [FromQuery] Guid pipelineId,
        [FromQuery] bool includeTerminal = false)
    {
        var pipeline = await _pipelineRepository.GetByIdWithStagesAsync(pipelineId);
        if (pipeline is null)
            return BadRequest(new { error = "Pipeline not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var deals = await _dealRepository.GetByPipelineForKanbanAsync(
            pipelineId, permission.Scope, userId, teamMemberIds, includeTerminal);

        // Group deals by stage
        var dealsByStage = deals
            .GroupBy(d => d.PipelineStageId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var stages = pipeline.Stages
            .OrderBy(s => s.SortOrder)
            .Where(s => includeTerminal || (!s.IsWon && !s.IsLost))
            .Select(s => new KanbanStageDto
            {
                Id = s.Id,
                Name = s.Name,
                Color = s.Color,
                SortOrder = s.SortOrder,
                IsWon = s.IsWon,
                IsLost = s.IsLost,
                Deals = dealsByStage.GetValueOrDefault(s.Id, new List<Deal>())
                    .Select(d => new DealKanbanCardDto
                    {
                        Id = d.Id,
                        Title = d.Title,
                        Value = d.Value,
                        CompanyName = d.Company?.Name,
                        OwnerName = d.Owner != null
                            ? $"{d.Owner.FirstName} {d.Owner.LastName}".Trim()
                            : null,
                        ExpectedCloseDate = d.ExpectedCloseDate
                    }).ToList()
            }).ToList();

        var kanban = new KanbanDto
        {
            PipelineId = pipeline.Id,
            PipelineName = pipeline.Name,
            Stages = stages
        };

        return Ok(kanban);
    }

    /// <summary>
    /// Returns chronological timeline for a deal: creation, updates,
    /// stage changes (from DealStageHistory), contact links, and product links.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Deal:View")]
    [ProducesResponseType(typeof(List<DealTimelineEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var deal = await _dealRepository.GetByIdWithLinksAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<DealTimelineEntryDto>();

        // 1. Entity creation
        entries.Add(new DealTimelineEntryDto
        {
            Id = Guid.NewGuid(),
            Type = "created",
            Title = "Deal created",
            Description = $"Deal '{deal.Title}' was created.",
            Timestamp = deal.CreatedAt,
            UserId = deal.OwnerId,
            UserName = deal.Owner != null
                ? $"{deal.Owner.FirstName} {deal.Owner.LastName}".Trim()
                : null
        });

        // 2. Entity update (if UpdatedAt differs from CreatedAt)
        if (deal.UpdatedAt > deal.CreatedAt.AddSeconds(1))
        {
            entries.Add(new DealTimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "updated",
                Title = "Deal updated",
                Description = $"Deal '{deal.Title}' was updated.",
                Timestamp = deal.UpdatedAt
            });
        }

        // 3. Stage history events
        var stageHistory = await _dealRepository.GetStageHistoryAsync(id);
        foreach (var history in stageHistory)
        {
            entries.Add(new DealTimelineEntryDto
            {
                Id = history.Id,
                Type = "stage_changed",
                Title = $"Stage changed: {history.FromStage.Name} -> {history.ToStage.Name}",
                Description = $"Deal moved from '{history.FromStage.Name}' to '{history.ToStage.Name}'.",
                Timestamp = history.ChangedAt,
                UserId = history.ChangedByUserId,
                UserName = history.ChangedByUser != null
                    ? $"{history.ChangedByUser.FirstName} {history.ChangedByUser.LastName}".Trim()
                    : null
            });
        }

        // 4. Contact link events
        foreach (var dc in deal.DealContacts)
        {
            entries.Add(new DealTimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "contact_linked",
                Title = $"Contact linked: {dc.Contact.FullName}",
                Description = $"Contact '{dc.Contact.FullName}' was linked to this deal.",
                Timestamp = dc.LinkedAt
            });
        }

        // 5. Product link events
        foreach (var dp in deal.DealProducts)
        {
            entries.Add(new DealTimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "product_linked",
                Title = $"Product linked: {dp.Product.Name}",
                Description = $"Product '{dp.Product.Name}' was linked to this deal.",
                Timestamp = dp.LinkedAt
            });
        }

        // 6. Notes on this entity
        var noteEntries = await _noteRepository.GetEntityNotesForTimelineAsync("Deal", id);
        foreach (var note in noteEntries)
        {
            entries.Add(new DealTimelineEntryDto
            {
                Id = note.Id,
                Type = "note",
                Title = $"Note: {note.Title}",
                Description = note.PlainTextBody,
                Timestamp = note.CreatedAt,
                UserId = note.AuthorId,
                UserName = note.AuthorName
            });
        }

        // Sort by timestamp descending
        var sorted = entries.OrderByDescending(e => e.Timestamp).ToList();

        return Ok(sorted);
    }

    // ---- Summary ----

    /// <summary>
    /// Returns aggregated summary data for a deal including key properties,
    /// stage progress info, association counts, recent/upcoming activities,
    /// notes preview, attachment count, and last contacted date.
    /// </summary>
    [HttpGet("{id:guid}/summary")]
    [Authorize(Policy = "Permission:Deal:View")]
    [ProducesResponseType(typeof(DealSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSummary(Guid id)
    {
        var deal = await _dealRepository.GetByIdWithLinksAsync(id);
        if (deal is null)
            return NotFound(new { error = "Deal not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var now = DateTimeOffset.UtcNow;

        // Parallel queries via Task.WhenAll
        // Note: Activity Type/Status are enums with HasConversion<string>().
        // EF Core cannot translate .ToString() on value-converted enums in server-side
        // LINQ projections, so we select raw enum values first, then map to DTOs in memory.
        var recentActivitiesRawTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Deal" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.DueDate, a.CreatedAt })
            .ToListAsync();

        var upcomingActivitiesRawTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Deal" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .Where(a => a.Status != ActivityStatus.Done && a.DueDate != null && a.DueDate >= now)
            .OrderBy(a => a.DueDate)
            .Take(5)
            .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.DueDate, a.CreatedAt })
            .ToListAsync();

        var recentNotesTask = _db.Notes
            .Where(n => n.EntityType == "Deal" && n.EntityId == id)
            .OrderByDescending(n => n.CreatedAt)
            .Take(3)
            .Select(n => new DealSummaryNoteDto
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

        var contactCountTask = _db.DealContacts.CountAsync(dc => dc.DealId == id);
        var productCountTask = _db.DealProducts.CountAsync(dp => dp.DealId == id);
        var activityCountTask = _db.ActivityLinks.CountAsync(al => al.EntityType == "Deal" && al.EntityId == id);
        var quoteCountTask = _db.Quotes.CountAsync(q => q.DealId == id);
        var attachmentCountTask = _db.Attachments.CountAsync(a => a.EntityType == "Deal" && a.EntityId == id);

        var lastActivityDateTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Deal" && al.EntityId == id)
            .Join(_db.Activities.Where(a => a.Status == ActivityStatus.Done), al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => (DateTimeOffset?)a.CreatedAt)
            .FirstOrDefaultAsync();

        var lastEmailDateTask = _db.EmailMessages
            .Where(e => e.LinkedCompanyId == deal.CompanyId && deal.CompanyId != null)
            .OrderByDescending(e => e.SentAt)
            .Select(e => (DateTimeOffset?)e.SentAt)
            .FirstOrDefaultAsync();

        // Stage progress info
        var stageInfoTask = _db.PipelineStages
            .Where(s => s.PipelineId == deal.PipelineId)
            .OrderBy(s => s.SortOrder)
            .Select(s => new DealStageInfoDto
            {
                Id = s.Id,
                Name = s.Name,
                Color = s.Color,
                SortOrder = s.SortOrder,
                IsCurrent = s.Id == deal.PipelineStageId
            })
            .ToListAsync();

        await Task.WhenAll(
            recentActivitiesRawTask, upcomingActivitiesRawTask, recentNotesTask,
            contactCountTask, productCountTask, activityCountTask, quoteCountTask,
            attachmentCountTask, lastActivityDateTask, lastEmailDateTask, stageInfoTask);

        // Map raw activity data to DTOs (ToString() on enums must happen in memory)
        var recentActivities = recentActivitiesRawTask.Result
            .Select(a => new DealSummaryActivityDto
            {
                Id = a.Id, Subject = a.Subject, Type = a.Type.ToString(),
                Status = a.Status.ToString(), DueDate = a.DueDate, CreatedAt = a.CreatedAt
            }).ToList();

        var upcomingActivities = upcomingActivitiesRawTask.Result
            .Select(a => new DealSummaryActivityDto
            {
                Id = a.Id, Subject = a.Subject, Type = a.Type.ToString(),
                Status = a.Status.ToString(), DueDate = a.DueDate, CreatedAt = a.CreatedAt
            }).ToList();

        // Compute last contacted date
        var lastActivity = lastActivityDateTask.Result;
        var lastEmail = lastEmailDateTask.Result;
        DateTimeOffset? lastContacted = (lastActivity, lastEmail) switch
        {
            (not null, not null) => lastActivity > lastEmail ? lastActivity : lastEmail,
            (not null, null) => lastActivity,
            (null, not null) => lastEmail,
            _ => null
        };

        var associations = new List<DealSummaryAssociationDto>
        {
            new() { EntityType = "Contact", Label = "Contacts", Icon = "people", Count = contactCountTask.Result },
            new() { EntityType = "Product", Label = "Products", Icon = "inventory_2", Count = productCountTask.Result },
            new() { EntityType = "Activity", Label = "Activities", Icon = "event", Count = activityCountTask.Result },
            new() { EntityType = "Quote", Label = "Quotes", Icon = "request_quote", Count = quoteCountTask.Result },
        };

        var dto = new DealSummaryDto
        {
            Id = deal.Id,
            Title = deal.Title,
            Value = deal.Value,
            Probability = deal.Probability,
            ExpectedCloseDate = deal.ExpectedCloseDate,
            PipelineName = deal.Pipeline?.Name ?? string.Empty,
            StageName = deal.Stage?.Name ?? string.Empty,
            CompanyName = deal.Company?.Name,
            OwnerName = deal.Owner != null
                ? $"{deal.Owner.FirstName} {deal.Owner.LastName}".Trim()
                : null,
            Stages = stageInfoTask.Result,
            Associations = associations,
            RecentActivities = recentActivities,
            UpcomingActivities = upcomingActivities,
            RecentNotes = recentNotesTask.Result,
            AttachmentCount = attachmentCountTask.Result,
            LastContacted = lastContacted
        };

        return Ok(dto);
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
/// Summary DTO for deal list views.
/// </summary>
public record DealListDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public decimal? Probability { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public string StageName { get; init; } = string.Empty;
    public string StageColor { get; init; } = string.Empty;
    public string PipelineName { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string? OwnerName { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static DealListDto FromEntity(Deal entity, Dictionary<string, object?>? enrichedCustomFields = null) => new()
    {
        Id = entity.Id,
        Title = entity.Title,
        Value = entity.Value,
        Probability = entity.Probability,
        ExpectedCloseDate = entity.ExpectedCloseDate,
        StageName = entity.Stage?.Name ?? string.Empty,
        StageColor = entity.Stage?.Color ?? string.Empty,
        PipelineName = entity.Pipeline?.Name ?? entity.Stage?.Pipeline?.Name ?? string.Empty,
        CompanyName = entity.Company?.Name,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        CustomFields = enrichedCustomFields ?? entity.CustomFields,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for deal detail view including linked contacts and products.
/// </summary>
public record DealDetailDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public decimal? Probability { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public DateOnly? ActualCloseDate { get; init; }
    public string? Description { get; init; }
    public Guid PipelineId { get; init; }
    public string PipelineName { get; init; } = string.Empty;
    public Guid PipelineStageId { get; init; }
    public string StageName { get; init; } = string.Empty;
    public string StageColor { get; init; } = string.Empty;
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public List<LinkedContactDto> LinkedContacts { get; init; } = new();
    public List<LinkedProductDto> LinkedProducts { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static DealDetailDto FromEntity(Deal entity, Dictionary<string, object?>? enrichedCustomFields = null) => new()
    {
        Id = entity.Id,
        Title = entity.Title,
        Value = entity.Value,
        Probability = entity.Probability,
        ExpectedCloseDate = entity.ExpectedCloseDate,
        ActualCloseDate = entity.ActualCloseDate,
        Description = entity.Description,
        PipelineId = entity.PipelineId,
        PipelineName = entity.Pipeline?.Name ?? string.Empty,
        PipelineStageId = entity.PipelineStageId,
        StageName = entity.Stage?.Name ?? string.Empty,
        StageColor = entity.Stage?.Color ?? string.Empty,
        CompanyId = entity.CompanyId,
        CompanyName = entity.Company?.Name,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        CustomFields = enrichedCustomFields ?? entity.CustomFields,
        LinkedContacts = entity.DealContacts.Select(dc => new LinkedContactDto
        {
            Id = dc.ContactId,
            Name = dc.Contact.FullName
        }).ToList(),
        LinkedProducts = entity.DealProducts.Select(dp => new LinkedProductDto
        {
            Id = dp.ProductId,
            Name = dp.Product.Name,
            Quantity = dp.Quantity,
            UnitPrice = dp.UnitPrice
        }).ToList(),
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for a contact linked to a deal.
/// </summary>
public record LinkedContactDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
}

/// <summary>
/// DTO for a product linked to a deal.
/// </summary>
public record LinkedProductDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal? UnitPrice { get; init; }
}

/// <summary>
/// Kanban board data for a pipeline.
/// </summary>
public record KanbanDto
{
    public Guid PipelineId { get; init; }
    public string PipelineName { get; init; } = string.Empty;
    public List<KanbanStageDto> Stages { get; init; } = new();
}

/// <summary>
/// A stage column in the Kanban board with its deals.
/// </summary>
public record KanbanStageDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsWon { get; init; }
    public bool IsLost { get; init; }
    public List<DealKanbanCardDto> Deals { get; init; } = new();
}

/// <summary>
/// Compact deal card for Kanban board display.
/// </summary>
public record DealKanbanCardDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public string? CompanyName { get; init; }
    public string? OwnerName { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
}

/// <summary>
/// Deal timeline entry DTO.
/// </summary>
public record DealTimelineEntryDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public Guid? UserId { get; init; }
    public string? UserName { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a deal.
/// </summary>
public record CreateDealRequest
{
    public string Title { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public decimal? Probability { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public Guid PipelineId { get; init; }
    public Guid? PipelineStageId { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? OwnerId { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a deal.
/// </summary>
public record UpdateDealRequest
{
    public string Title { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public decimal? Probability { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public Guid? PipelineStageId { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? OwnerId { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for the dedicated stage change endpoint (Kanban drag-drop).
/// </summary>
public record UpdateDealStageRequest
{
    public Guid StageId { get; init; }
}

/// <summary>
/// Request body for linking a product to a deal.
/// </summary>
public record LinkProductRequest
{
    public Guid ProductId { get; init; }
    public int? Quantity { get; init; }
    public decimal? UnitPrice { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateDealRequest.
/// </summary>
public class CreateDealRequestValidator : AbstractValidator<CreateDealRequest>
{
    public CreateDealRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Deal title is required.")
            .MaximumLength(300).WithMessage("Deal title must be at most 300 characters.");

        RuleFor(x => x.PipelineId)
            .NotEmpty().WithMessage("Pipeline is required.");
    }
}

// ---- Summary DTOs ----

/// <summary>
/// Aggregated summary DTO for the deal detail summary tab.
/// </summary>
public record DealSummaryDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public decimal? Probability { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public string PipelineName { get; init; } = string.Empty;
    public string StageName { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string? OwnerName { get; init; }
    public List<DealStageInfoDto> Stages { get; init; } = new();
    public List<DealSummaryAssociationDto> Associations { get; init; } = new();
    public List<DealSummaryActivityDto> RecentActivities { get; init; } = new();
    public List<DealSummaryActivityDto> UpcomingActivities { get; init; } = new();
    public List<DealSummaryNoteDto> RecentNotes { get; init; } = new();
    public int AttachmentCount { get; init; }
    public DateTimeOffset? LastContacted { get; init; }
}

public record DealStageInfoDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsCurrent { get; init; }
}

public record DealSummaryActivityDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record DealSummaryNoteDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Preview { get; init; }
    public string? AuthorName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record DealSummaryAssociationDto
{
    public string EntityType { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Icon { get; init; } = string.Empty;
    public int Count { get; init; }
}
