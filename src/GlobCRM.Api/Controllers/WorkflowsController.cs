using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for workflow automation CRUD, enable/disable toggle, duplication,
/// execution log viewing, and entity field listing. Co-located DTOs, request records,
/// and validators. Route: /api/workflows
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkflowsController : ControllerBase
{
    private readonly IWorkflowRepository _workflowRepository;
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly IMemoryCache _cache;
    private readonly ILogger<WorkflowsController> _logger;

    public WorkflowsController(
        IWorkflowRepository workflowRepository,
        ApplicationDbContext db,
        ITenantProvider tenantProvider,
        IMemoryCache cache,
        ILogger<WorkflowsController> logger)
    {
        _workflowRepository = workflowRepository;
        _db = db;
        _tenantProvider = tenantProvider;
        _cache = cache;
        _logger = logger;
    }

    // ---- Workflow CRUD Endpoints ----

    /// <summary>
    /// 1. List workflows (paginated), optionally filtered by entityType and status.
    /// Returns lightweight WorkflowListDto without full definition.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(WorkflowPaginatedResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] string? entityType = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        WorkflowStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<WorkflowStatus>(status, true, out var parsed))
            statusFilter = parsed;

        var (items, totalCount) = await _workflowRepository.GetAllAsync(entityType, statusFilter, page, pageSize);

        return Ok(new WorkflowPaginatedResponse
        {
            Items = items.Select(WorkflowListDto.FromEntity).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// 2. Get workflow with full definition.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        return Ok(WorkflowDto.FromEntity(workflow));
    }

    /// <summary>
    /// 3. Create workflow. Sets Status = Draft, IsActive = false.
    /// Computes TriggerSummary from Definition. Invalidates workflow cache.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Workflow:Create")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateWorkflowRequest request)
    {
        var validator = new CreateWorkflowValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        var definition = MapDefinition(request.Definition);

        var workflow = new Workflow
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            EntityType = request.EntityType,
            Definition = definition,
            TriggerSummary = ComputeTriggerSummary(request.Definition),
            Status = WorkflowStatus.Draft,
            IsActive = false,
            CreatedByUserId = userId
        };

        var created = await _workflowRepository.CreateAsync(workflow);
        InvalidateWorkflowCache(tenantId, request.EntityType);

        _logger.LogInformation("Workflow created: {WorkflowName} ({WorkflowId})", created.Name, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            WorkflowDto.FromEntity(created));
    }

    /// <summary>
    /// 4. Update workflow. Recomputes TriggerSummary. Invalidates workflow cache.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Workflow:Edit")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkflowRequest request)
    {
        var validator = new UpdateWorkflowValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        var tenantId = GetTenantId();
        var oldEntityType = workflow.EntityType;

        workflow.Name = request.Name;
        workflow.Description = request.Description;
        workflow.EntityType = request.EntityType;
        workflow.Definition = MapDefinition(request.Definition);
        workflow.TriggerSummary = ComputeTriggerSummary(request.Definition);

        await _workflowRepository.UpdateAsync(workflow);
        InvalidateWorkflowCache(tenantId, request.EntityType);
        if (oldEntityType != request.EntityType)
            InvalidateWorkflowCache(tenantId, oldEntityType);

        _logger.LogInformation("Workflow updated: {WorkflowId}", id);

        var fetched = await _workflowRepository.GetByIdAsync(id);
        return Ok(WorkflowDto.FromEntity(fetched!));
    }

    /// <summary>
    /// 5. Delete workflow. Cascade deletes execution logs and action logs.
    /// Invalidates workflow cache.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Workflow:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        var tenantId = GetTenantId();

        await _workflowRepository.DeleteAsync(id);
        InvalidateWorkflowCache(tenantId, workflow.EntityType);

        _logger.LogInformation("Workflow deleted: {WorkflowId}", id);

        return NoContent();
    }

    /// <summary>
    /// 6. PATCH enable/disable workflow (WFLOW-12).
    /// When enabling: Status = Active, IsActive = true.
    /// When disabling: Status = Paused, IsActive = false.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Permission:Workflow:Edit")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateWorkflowStatusRequest request)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        var tenantId = GetTenantId();

        if (request.IsActive)
        {
            workflow.IsActive = true;
            workflow.Status = WorkflowStatus.Active;
        }
        else
        {
            workflow.IsActive = false;
            workflow.Status = WorkflowStatus.Paused;
        }

        await _workflowRepository.UpdateAsync(workflow);
        InvalidateWorkflowCache(tenantId, workflow.EntityType);

        _logger.LogInformation("Workflow status updated: {WorkflowId} IsActive={IsActive}", id, request.IsActive);

        var fetched = await _workflowRepository.GetByIdAsync(id);
        return Ok(WorkflowDto.FromEntity(fetched!));
    }

    /// <summary>
    /// 7. Activate workflow. Validates at least one trigger and one action.
    /// Sets Status = Active, IsActive = true. Invalidates workflow cache.
    /// </summary>
    [HttpPost("{id:guid}/activate")]
    [Authorize(Policy = "Permission:Workflow:Edit")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Activate(Guid id)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        // Validate: must have at least one trigger and one action
        if (workflow.Definition.Triggers.Count == 0)
            return BadRequest(new { error = "Workflow must have at least one trigger to activate." });

        if (workflow.Definition.Actions.Count == 0)
            return BadRequest(new { error = "Workflow must have at least one action to activate." });

        var tenantId = GetTenantId();

        workflow.Status = WorkflowStatus.Active;
        workflow.IsActive = true;

        await _workflowRepository.UpdateAsync(workflow);
        InvalidateWorkflowCache(tenantId, workflow.EntityType);

        _logger.LogInformation("Workflow activated: {WorkflowId}", id);

        var fetched = await _workflowRepository.GetByIdAsync(id);
        return Ok(WorkflowDto.FromEntity(fetched!));
    }

    /// <summary>
    /// 8. Deactivate workflow. Sets Status = Paused, IsActive = false.
    /// Invalidates workflow cache.
    /// </summary>
    [HttpPost("{id:guid}/deactivate")]
    [Authorize(Policy = "Permission:Workflow:Edit")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        var tenantId = GetTenantId();

        workflow.Status = WorkflowStatus.Paused;
        workflow.IsActive = false;

        await _workflowRepository.UpdateAsync(workflow);
        InvalidateWorkflowCache(tenantId, workflow.EntityType);

        _logger.LogInformation("Workflow deactivated: {WorkflowId}", id);

        var fetched = await _workflowRepository.GetByIdAsync(id);
        return Ok(WorkflowDto.FromEntity(fetched!));
    }

    /// <summary>
    /// 9. Duplicate workflow. Creates a copy with "(Copy)" appended to name,
    /// Status = Draft, IsActive = false. Resets execution counters.
    /// </summary>
    [HttpPost("{id:guid}/duplicate")]
    [Authorize(Policy = "Permission:Workflow:Create")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Duplicate(Guid id)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        var clone = new Workflow
        {
            TenantId = tenantId,
            Name = $"{workflow.Name} (Copy)",
            Description = workflow.Description,
            EntityType = workflow.EntityType,
            Definition = CloneDefinition(workflow.Definition),
            TriggerSummary = new List<string>(workflow.TriggerSummary),
            Status = WorkflowStatus.Draft,
            IsActive = false,
            CreatedByUserId = userId,
            ExecutionCount = 0,
            LastExecutedAt = null
        };

        var created = await _workflowRepository.CreateAsync(clone);
        InvalidateWorkflowCache(tenantId, clone.EntityType);

        _logger.LogInformation("Workflow duplicated: {OriginalId} -> {CloneId}", id, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            WorkflowDto.FromEntity(created));
    }

    /// <summary>
    /// 10. List execution logs for a workflow (WFLOW-11). Paginated, without ActionLogs.
    /// </summary>
    [HttpGet("{id:guid}/logs")]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(WorkflowExecutionLogPaginatedResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExecutionLogs(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var (items, totalCount) = await _workflowRepository.GetExecutionLogsAsync(id, page, pageSize);

        return Ok(new WorkflowExecutionLogPaginatedResponse
        {
            Items = items.Select(l => WorkflowExecutionLogDto.FromEntity(l, includeActionLogs: false)).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// 11. Get execution log detail with action logs (WFLOW-11).
    /// </summary>
    [HttpGet("{id:guid}/logs/{logId:guid}")]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(WorkflowExecutionLogDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExecutionLogDetail(Guid id, Guid logId)
    {
        var log = await _workflowRepository.GetExecutionLogDetailAsync(logId);
        if (log is null || log.WorkflowId != id)
            return NotFound(new { error = "Execution log not found." });

        return Ok(WorkflowExecutionLogDto.FromEntity(log, includeActionLogs: true));
    }

    /// <summary>
    /// 12. Get available fields for an entity type. Used by the builder for
    /// trigger field selection and condition configuration. Includes standard
    /// fields and custom fields.
    /// </summary>
    [HttpGet("entity-fields/{entityType}")]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(List<EntityFieldDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetEntityFields(string entityType)
    {
        var validEntityTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Contact", "Company", "Deal", "Lead", "Activity"
        };

        if (!validEntityTypes.Contains(entityType))
            return BadRequest(new { error = $"Invalid entity type: {entityType}. Must be one of: {string.Join(", ", validEntityTypes)}" });

        var fields = GetStandardFields(entityType);

        // Add custom fields for this entity type
        var customFields = await _db.CustomFieldDefinitions
            .Where(c => c.EntityType == entityType && !c.IsDeleted)
            .OrderBy(c => c.SortOrder)
            .Select(c => new EntityFieldDto
            {
                Name = c.Name,
                Label = c.Label,
                FieldType = c.FieldType.ToString().ToLowerInvariant()
            })
            .ToListAsync();

        fields.AddRange(customFields);

        return Ok(fields);
    }

    // ---- Private Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    private Guid GetTenantId()
    {
        return _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
    }

    /// <summary>
    /// Invalidates the active workflow cache for a specific tenant and entity type.
    /// Uses the same cache key pattern as the execution engine for compatibility.
    /// </summary>
    private void InvalidateWorkflowCache(Guid tenantId, string entityType)
    {
        _cache.Remove($"workflow_active_{tenantId}_{entityType}");
    }

    /// <summary>
    /// Computes trigger summary strings from the workflow definition for fast event matching.
    /// </summary>
    private static List<string> ComputeTriggerSummary(WorkflowDefinitionDto definition)
    {
        var summaries = new List<string>();

        foreach (var trigger in definition.Triggers)
        {
            var summary = trigger.TriggerType switch
            {
                "RecordCreated" or "recordCreated" => "RecordCreated",
                "RecordUpdated" or "recordUpdated" => "RecordUpdated",
                "RecordDeleted" or "recordDeleted" => "RecordDeleted",
                "FieldChanged" or "fieldChanged" => string.IsNullOrWhiteSpace(trigger.FieldName)
                    ? "FieldChanged"
                    : $"FieldChanged:{trigger.FieldName}",
                "DateBased" or "dateBased" => string.IsNullOrWhiteSpace(trigger.FieldName)
                    ? "DateBased"
                    : $"DateBased:{trigger.FieldName}",
                _ => trigger.TriggerType
            };

            summaries.Add(summary);
        }

        return summaries;
    }

    /// <summary>
    /// Maps a WorkflowDefinitionDto to the domain WorkflowDefinition.
    /// </summary>
    private static WorkflowDefinition MapDefinition(WorkflowDefinitionDto dto)
    {
        return new WorkflowDefinition
        {
            Nodes = dto.Nodes.Select(n => new WorkflowNode
            {
                Id = n.Id,
                Type = n.Type,
                Label = n.Label,
                Position = new WorkflowNodePosition { X = n.Position.X, Y = n.Position.Y },
                Config = n.Config
            }).ToList(),
            Connections = dto.Connections.Select(c => new WorkflowConnection
            {
                Id = c.Id,
                SourceNodeId = c.SourceNodeId,
                TargetNodeId = c.TargetNodeId,
                SourceOutput = c.SourceOutput
            }).ToList(),
            Triggers = dto.Triggers.Select(t => new WorkflowTriggerConfig
            {
                Id = t.Id,
                NodeId = t.NodeId,
                TriggerType = Enum.TryParse<WorkflowTriggerType>(t.TriggerType, true, out var tt) ? tt : WorkflowTriggerType.RecordCreated,
                EventType = t.EventType,
                FieldName = t.FieldName,
                DateOffsetDays = t.DateOffsetDays,
                PreferredTime = t.PreferredTime.HasValue ? TimeOnly.FromTimeSpan(t.PreferredTime.Value) : null
            }).ToList(),
            Conditions = dto.Conditions.Select(cg => new WorkflowConditionGroup
            {
                Id = cg.Id,
                NodeId = cg.NodeId,
                Conditions = cg.Conditions.Select(c => new WorkflowCondition
                {
                    Field = c.Field,
                    Operator = c.Operator,
                    Value = c.Value,
                    FromValue = c.FromValue
                }).ToList()
            }).ToList(),
            Actions = dto.Actions.Select(a => new WorkflowActionConfig
            {
                Id = a.Id,
                NodeId = a.NodeId,
                ActionType = Enum.TryParse<WorkflowActionType>(a.ActionType, true, out var at) ? at : WorkflowActionType.UpdateField,
                ContinueOnError = a.ContinueOnError,
                Order = a.Order,
                Config = a.Config ?? "{}"
            }).ToList()
        };
    }

    /// <summary>
    /// Deep clones a WorkflowDefinition by creating new instances of all nested objects.
    /// </summary>
    private static WorkflowDefinition CloneDefinition(WorkflowDefinition source)
    {
        return new WorkflowDefinition
        {
            Nodes = source.Nodes.Select(n => new WorkflowNode
            {
                Id = n.Id,
                Type = n.Type,
                Label = n.Label,
                Position = new WorkflowNodePosition { X = n.Position.X, Y = n.Position.Y },
                Config = n.Config
            }).ToList(),
            Connections = source.Connections.Select(c => new WorkflowConnection
            {
                Id = c.Id,
                SourceNodeId = c.SourceNodeId,
                TargetNodeId = c.TargetNodeId,
                SourceOutput = c.SourceOutput
            }).ToList(),
            Triggers = source.Triggers.Select(t => new WorkflowTriggerConfig
            {
                Id = t.Id,
                NodeId = t.NodeId,
                TriggerType = t.TriggerType,
                EventType = t.EventType,
                FieldName = t.FieldName,
                DateOffsetDays = t.DateOffsetDays,
                PreferredTime = t.PreferredTime
            }).ToList(),
            Conditions = source.Conditions.Select(cg => new WorkflowConditionGroup
            {
                Id = cg.Id,
                NodeId = cg.NodeId,
                Conditions = cg.Conditions.Select(c => new WorkflowCondition
                {
                    Field = c.Field,
                    Operator = c.Operator,
                    Value = c.Value,
                    FromValue = c.FromValue
                }).ToList()
            }).ToList(),
            Actions = source.Actions.Select(a => new WorkflowActionConfig
            {
                Id = a.Id,
                NodeId = a.NodeId,
                ActionType = a.ActionType,
                ContinueOnError = a.ContinueOnError,
                Order = a.Order,
                Config = a.Config
            }).ToList()
        };
    }

    /// <summary>
    /// Returns standard fields for a given entity type.
    /// </summary>
    private static List<EntityFieldDto> GetStandardFields(string entityType)
    {
        return entityType switch
        {
            "Contact" =>
            [
                new() { Name = "FirstName", Label = "First Name", FieldType = "text" },
                new() { Name = "LastName", Label = "Last Name", FieldType = "text" },
                new() { Name = "Email", Label = "Email", FieldType = "text" },
                new() { Name = "Phone", Label = "Phone", FieldType = "text" },
                new() { Name = "JobTitle", Label = "Job Title", FieldType = "text" },
                new() { Name = "Department", Label = "Department", FieldType = "text" },
                new() { Name = "CompanyId", Label = "Company", FieldType = "relation" },
                new() { Name = "CreatedAt", Label = "Created At", FieldType = "date" },
                new() { Name = "UpdatedAt", Label = "Updated At", FieldType = "date" }
            ],
            "Company" =>
            [
                new() { Name = "Name", Label = "Name", FieldType = "text" },
                new() { Name = "Industry", Label = "Industry", FieldType = "text" },
                new() { Name = "Website", Label = "Website", FieldType = "text" },
                new() { Name = "Phone", Label = "Phone", FieldType = "text" },
                new() { Name = "Email", Label = "Email", FieldType = "text" },
                new() { Name = "Size", Label = "Size", FieldType = "text" },
                new() { Name = "CreatedAt", Label = "Created At", FieldType = "date" },
                new() { Name = "UpdatedAt", Label = "Updated At", FieldType = "date" }
            ],
            "Deal" =>
            [
                new() { Name = "Title", Label = "Title", FieldType = "text" },
                new() { Name = "Value", Label = "Value", FieldType = "number" },
                new() { Name = "Probability", Label = "Probability", FieldType = "number" },
                new() { Name = "ExpectedCloseDate", Label = "Expected Close Date", FieldType = "date" },
                new() { Name = "Stage", Label = "Stage", FieldType = "text" },
                new() { Name = "PipelineId", Label = "Pipeline", FieldType = "relation" },
                new() { Name = "PipelineStageId", Label = "Pipeline Stage", FieldType = "relation" },
                new() { Name = "CreatedAt", Label = "Created At", FieldType = "date" },
                new() { Name = "UpdatedAt", Label = "Updated At", FieldType = "date" }
            ],
            "Lead" =>
            [
                new() { Name = "FirstName", Label = "First Name", FieldType = "text" },
                new() { Name = "LastName", Label = "Last Name", FieldType = "text" },
                new() { Name = "Email", Label = "Email", FieldType = "text" },
                new() { Name = "Phone", Label = "Phone", FieldType = "text" },
                new() { Name = "CompanyName", Label = "Company Name", FieldType = "text" },
                new() { Name = "Status", Label = "Status", FieldType = "text" },
                new() { Name = "Temperature", Label = "Temperature", FieldType = "text" },
                new() { Name = "IsConverted", Label = "Is Converted", FieldType = "checkbox" },
                new() { Name = "CreatedAt", Label = "Created At", FieldType = "date" },
                new() { Name = "UpdatedAt", Label = "Updated At", FieldType = "date" }
            ],
            "Activity" =>
            [
                new() { Name = "Subject", Label = "Subject", FieldType = "text" },
                new() { Name = "Type", Label = "Type", FieldType = "text" },
                new() { Name = "Status", Label = "Status", FieldType = "text" },
                new() { Name = "Priority", Label = "Priority", FieldType = "text" },
                new() { Name = "DueDate", Label = "Due Date", FieldType = "date" },
                new() { Name = "CompletedAt", Label = "Completed At", FieldType = "date" },
                new() { Name = "CreatedAt", Label = "Created At", FieldType = "date" },
                new() { Name = "UpdatedAt", Label = "Updated At", FieldType = "date" }
            ],
            _ => []
        };
    }
}

// ---- DTOs ----

/// <summary>
/// Full workflow DTO with complete definition for builder/editor views.
/// </summary>
public record WorkflowDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public List<string> TriggerSummary { get; init; } = [];
    public int ExecutionCount { get; init; }
    public DateTimeOffset? LastExecutedAt { get; init; }
    public WorkflowDefinitionDto Definition { get; init; } = new();
    public Guid CreatedByUserId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static WorkflowDto FromEntity(Workflow w) => new()
    {
        Id = w.Id,
        Name = w.Name,
        Description = w.Description,
        EntityType = w.EntityType,
        Status = w.Status.ToString(),
        IsActive = w.IsActive,
        TriggerSummary = w.TriggerSummary,
        ExecutionCount = w.ExecutionCount,
        LastExecutedAt = w.LastExecutedAt,
        Definition = WorkflowDefinitionDto.FromEntity(w.Definition),
        CreatedByUserId = w.CreatedByUserId,
        CreatedAt = w.CreatedAt,
        UpdatedAt = w.UpdatedAt
    };
}

/// <summary>
/// Lightweight workflow DTO for list page — no full definition.
/// </summary>
public record WorkflowListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public List<string> TriggerSummary { get; init; } = [];
    public int ExecutionCount { get; init; }
    public DateTimeOffset? LastExecutedAt { get; init; }
    public int NodeCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static WorkflowListDto FromEntity(Workflow w) => new()
    {
        Id = w.Id,
        Name = w.Name,
        Description = w.Description,
        EntityType = w.EntityType,
        Status = w.Status.ToString(),
        IsActive = w.IsActive,
        TriggerSummary = w.TriggerSummary,
        ExecutionCount = w.ExecutionCount,
        LastExecutedAt = w.LastExecutedAt,
        NodeCount = w.Definition.Nodes.Count,
        CreatedAt = w.CreatedAt,
        UpdatedAt = w.UpdatedAt
    };
}

/// <summary>
/// Full workflow definition DTO mirroring WorkflowDefinition structure.
/// </summary>
public record WorkflowDefinitionDto
{
    public List<WorkflowNodeDto> Nodes { get; init; } = [];
    public List<WorkflowConnectionDto> Connections { get; init; } = [];
    public List<WorkflowTriggerConfigDto> Triggers { get; init; } = [];
    public List<WorkflowConditionGroupDto> Conditions { get; init; } = [];
    public List<WorkflowActionConfigDto> Actions { get; init; } = [];

    public static WorkflowDefinitionDto FromEntity(WorkflowDefinition d) => new()
    {
        Nodes = d.Nodes.Select(n => new WorkflowNodeDto
        {
            Id = n.Id,
            Type = n.Type,
            Label = n.Label,
            Position = new WorkflowNodePositionDto { X = n.Position.X, Y = n.Position.Y },
            Config = n.Config
        }).ToList(),
        Connections = d.Connections.Select(c => new WorkflowConnectionDto
        {
            Id = c.Id,
            SourceNodeId = c.SourceNodeId,
            TargetNodeId = c.TargetNodeId,
            SourceOutput = c.SourceOutput
        }).ToList(),
        Triggers = d.Triggers.Select(t => new WorkflowTriggerConfigDto
        {
            Id = t.Id,
            NodeId = t.NodeId,
            TriggerType = t.TriggerType.ToString(),
            EventType = t.EventType,
            FieldName = t.FieldName,
            DateOffsetDays = t.DateOffsetDays,
            PreferredTime = t.PreferredTime.HasValue ? t.PreferredTime.Value.ToTimeSpan() : null
        }).ToList(),
        Conditions = d.Conditions.Select(cg => new WorkflowConditionGroupDto
        {
            Id = cg.Id,
            NodeId = cg.NodeId,
            Conditions = cg.Conditions.Select(c => new WorkflowConditionDto
            {
                Field = c.Field,
                Operator = c.Operator,
                Value = c.Value,
                FromValue = c.FromValue
            }).ToList()
        }).ToList(),
        Actions = d.Actions.Select(a => new WorkflowActionConfigDto
        {
            Id = a.Id,
            NodeId = a.NodeId,
            ActionType = a.ActionType.ToString(),
            ContinueOnError = a.ContinueOnError,
            Order = a.Order,
            Config = a.Config
        }).ToList()
    };
}

public record WorkflowNodeDto
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public WorkflowNodePositionDto Position { get; init; } = new();
    public string? Config { get; init; }
}

public record WorkflowNodePositionDto
{
    public double X { get; init; }
    public double Y { get; init; }
}

public record WorkflowConnectionDto
{
    public string Id { get; init; } = string.Empty;
    public string SourceNodeId { get; init; } = string.Empty;
    public string TargetNodeId { get; init; } = string.Empty;
    public string? SourceOutput { get; init; }
}

public record WorkflowTriggerConfigDto
{
    public string Id { get; init; } = string.Empty;
    public string NodeId { get; init; } = string.Empty;
    public string TriggerType { get; init; } = string.Empty;
    public string? EventType { get; init; }
    public string? FieldName { get; init; }
    public int? DateOffsetDays { get; init; }
    public TimeSpan? PreferredTime { get; init; }
}

public record WorkflowConditionGroupDto
{
    public string Id { get; init; } = string.Empty;
    public string NodeId { get; init; } = string.Empty;
    public List<WorkflowConditionDto> Conditions { get; init; } = [];
}

public record WorkflowConditionDto
{
    public string Field { get; init; } = string.Empty;
    public string Operator { get; init; } = string.Empty;
    public string? Value { get; init; }
    public string? FromValue { get; init; }
}

public record WorkflowActionConfigDto
{
    public string Id { get; init; } = string.Empty;
    public string NodeId { get; init; } = string.Empty;
    public string ActionType { get; init; } = string.Empty;
    public bool ContinueOnError { get; init; }
    public int Order { get; init; }
    public string Config { get; init; } = "{}";
}

/// <summary>
/// Execution log DTO. Includes ActionLogs when fetching detail view.
/// </summary>
public record WorkflowExecutionLogDto
{
    public Guid Id { get; init; }
    public Guid WorkflowId { get; init; }
    public string? WorkflowName { get; init; }
    public string TriggerType { get; init; } = string.Empty;
    public string TriggerEvent { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public bool ConditionsEvaluated { get; init; }
    public bool ConditionsPassed { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? ErrorMessage { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset CompletedAt { get; init; }
    public int DurationMs { get; init; }
    public List<WorkflowActionLogDto>? ActionLogs { get; init; }

    public static WorkflowExecutionLogDto FromEntity(WorkflowExecutionLog log, bool includeActionLogs = false) => new()
    {
        Id = log.Id,
        WorkflowId = log.WorkflowId,
        WorkflowName = log.Workflow?.Name,
        TriggerType = log.TriggerType,
        TriggerEvent = log.TriggerEvent,
        EntityId = log.EntityId,
        EntityType = log.EntityType,
        ConditionsEvaluated = log.ConditionsEvaluated,
        ConditionsPassed = log.ConditionsPassed,
        Status = log.Status.ToString(),
        ErrorMessage = log.ErrorMessage,
        StartedAt = log.StartedAt,
        CompletedAt = log.CompletedAt,
        DurationMs = log.DurationMs,
        ActionLogs = includeActionLogs
            ? log.ActionLogs.Select(WorkflowActionLogDto.FromEntity).ToList()
            : null
    };
}

/// <summary>
/// Per-action execution log DTO.
/// </summary>
public record WorkflowActionLogDto
{
    public Guid Id { get; init; }
    public string ActionType { get; init; } = string.Empty;
    public string ActionNodeId { get; init; } = string.Empty;
    public int Order { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? ErrorMessage { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public int DurationMs { get; init; }

    public static WorkflowActionLogDto FromEntity(WorkflowActionLog log) => new()
    {
        Id = log.Id,
        ActionType = log.ActionType,
        ActionNodeId = log.ActionNodeId,
        Order = log.Order,
        Status = log.Status,
        ErrorMessage = log.ErrorMessage,
        StartedAt = log.StartedAt,
        CompletedAt = log.CompletedAt,
        DurationMs = log.DurationMs
    };
}

/// <summary>
/// Entity field descriptor for workflow builder field selection.
/// </summary>
public record EntityFieldDto
{
    public string Name { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
}

/// <summary>
/// Paginated workflow list response.
/// </summary>
public record WorkflowPaginatedResponse
{
    public List<WorkflowListDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

/// <summary>
/// Paginated execution log response.
/// </summary>
public record WorkflowExecutionLogPaginatedResponse
{
    public List<WorkflowExecutionLogDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

// ---- Request Records ----

public record CreateWorkflowRequest(string Name, string? Description, string EntityType, WorkflowDefinitionDto Definition);

public record UpdateWorkflowRequest(string Name, string? Description, string EntityType, WorkflowDefinitionDto Definition);

public record UpdateWorkflowStatusRequest(bool IsActive);

// ---- Validators ----

/// <summary>
/// Validates CreateWorkflowRequest: Name required 1-200 chars, EntityType must be valid,
/// Definition required with at least one trigger.
/// </summary>
public class CreateWorkflowValidator : AbstractValidator<CreateWorkflowRequest>
{
    private static readonly HashSet<string> ValidEntityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Contact", "Company", "Deal", "Lead", "Activity"
    };

    public CreateWorkflowValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer.");

        RuleFor(x => x.EntityType)
            .NotEmpty().WithMessage("Entity type is required.")
            .Must(et => ValidEntityTypes.Contains(et))
            .WithMessage("Entity type must be one of: Contact, Company, Deal, Lead, Activity.");

        RuleFor(x => x.Definition)
            .NotNull().WithMessage("Definition is required.");

        RuleFor(x => x.Definition.Triggers)
            .NotEmpty().WithMessage("At least one trigger is required.")
            .When(x => x.Definition is not null);
    }
}

/// <summary>
/// Validates UpdateWorkflowRequest: Same rules as create.
/// </summary>
public class UpdateWorkflowValidator : AbstractValidator<UpdateWorkflowRequest>
{
    private static readonly HashSet<string> ValidEntityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Contact", "Company", "Deal", "Lead", "Activity"
    };

    public UpdateWorkflowValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer.");

        RuleFor(x => x.EntityType)
            .NotEmpty().WithMessage("Entity type is required.")
            .Must(et => ValidEntityTypes.Contains(et))
            .WithMessage("Entity type must be one of: Contact, Company, Deal, Lead, Activity.");

        RuleFor(x => x.Definition)
            .NotNull().WithMessage("Definition is required.");

        RuleFor(x => x.Definition.Triggers)
            .NotEmpty().WithMessage("At least one trigger is required.")
            .When(x => x.Definition is not null);
    }
}
