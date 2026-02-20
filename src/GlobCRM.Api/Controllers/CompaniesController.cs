using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.FormulaFields;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Company CRUD operations with permission enforcement,
/// ownership scope checking, custom field validation, and timeline generation.
/// </summary>
[ApiController]
[Route("api/companies")]
[Authorize]
public class CompaniesController : ControllerBase
{
    private readonly ICompanyRepository _companyRepository;
    private readonly IContactRepository _contactRepository;
    private readonly INoteRepository _noteRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly FormulaEvaluationService _formulaEvaluator;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CompaniesController> _logger;

    public CompaniesController(
        ICompanyRepository companyRepository,
        IContactRepository contactRepository,
        INoteRepository noteRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        FormulaEvaluationService formulaEvaluator,
        ApplicationDbContext db,
        ILogger<CompaniesController> logger)
    {
        _companyRepository = companyRepository;
        _contactRepository = contactRepository;
        _noteRepository = noteRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _formulaEvaluator = formulaEvaluator;
        _db = db;
        _logger = logger;
    }

    // ---- CRUD Endpoints ----

    /// <summary>
    /// Lists companies with server-side filtering, sorting, pagination, and ownership scope.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(PagedResult<CompanyListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _companyRepository.GetPagedAsync(
            queryParams, permission.Scope, userId, teamMemberIds);

        var dtoResult = new PagedResult<CompanyListDto>
        {
            Items = pagedResult.Items.Select(CompanyListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single company by ID with ownership scope verification.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
        {
            // Check if this company was merged into another record
            var mergedCompany = await _db.Companies
                .IgnoreQueryFilters()
                .Where(c => c.Id == id && c.MergedIntoId != null)
                .Select(c => new { c.MergedIntoId })
                .FirstOrDefaultAsync();

            if (mergedCompany is not null)
                return Ok(new MergedRedirectDto { MergedIntoId = mergedCompany.MergedIntoId!.Value, IsMerged = true });

            return NotFound(new { error = "Company not found." });
        }

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(company.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Get contact count for this company
        var contacts = await _contactRepository.GetByCompanyIdAsync(id);
        var contactCount = contacts.Count;

        var enriched = await _formulaEvaluator.EvaluateFormulasForEntityAsync("Company", company, company.CustomFields);
        var dto = CompanyDetailDto.FromEntity(company, contactCount, enriched);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new company with custom field validation.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Company:Create")]
    [ProducesResponseType(typeof(CompanyListDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCompanyRequest request)
    {
        // Validate request
        var validator = new CreateCompanyRequestValidator();
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
            var cfErrors = await _customFieldValidator.ValidateAsync("Company", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var company = new Company
        {
            TenantId = tenantId,
            Name = request.Name,
            Industry = request.Industry,
            Website = request.Website,
            Phone = request.Phone,
            Email = request.Email,
            Address = request.Address,
            City = request.City,
            State = request.State,
            Country = request.Country,
            PostalCode = request.PostalCode,
            Size = request.Size,
            Description = request.Description,
            OwnerId = userId,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _companyRepository.CreateAsync(company);

        _logger.LogInformation("Company created: {CompanyName} ({CompanyId})", created.Name, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            CompanyListDto.FromEntity(created));
    }

    /// <summary>
    /// Updates an existing company with ownership scope verification and custom field validation.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Company:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCompanyRequest request)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "Edit");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(company.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Company", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Update fields
        company.Name = request.Name;
        company.Industry = request.Industry;
        company.Website = request.Website;
        company.Phone = request.Phone;
        company.Email = request.Email;
        company.Address = request.Address;
        company.City = request.City;
        company.State = request.State;
        company.Country = request.Country;
        company.PostalCode = request.PostalCode;
        company.Size = request.Size;
        company.Description = request.Description;

        if (request.CustomFields is not null)
            company.CustomFields = request.CustomFields;

        await _companyRepository.UpdateAsync(company);

        _logger.LogInformation("Company updated: {CompanyId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a company with ownership scope verification.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Company:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(company.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _companyRepository.DeleteAsync(id);

        _logger.LogInformation("Company deleted: {CompanyId}", id);

        return NoContent();
    }

    // ---- Timeline ----

    /// <summary>
    /// Returns chronological timeline events for a company including creation, updates, and linked contacts.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(List<TimelineEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(company.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<TimelineEntryDto>();

        // Entity creation
        entries.Add(new TimelineEntryDto
        {
            Id = Guid.NewGuid(),
            Type = "created",
            Title = "Company created",
            Description = $"Company '{company.Name}' was created.",
            Timestamp = company.CreatedAt,
            UserId = company.OwnerId,
            UserName = company.Owner != null
                ? $"{company.Owner.FirstName} {company.Owner.LastName}".Trim()
                : null
        });

        // Entity update (if UpdatedAt differs from CreatedAt)
        if (company.UpdatedAt > company.CreatedAt.AddSeconds(1))
        {
            entries.Add(new TimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "updated",
                Title = "Company updated",
                Description = $"Company '{company.Name}' was updated.",
                Timestamp = company.UpdatedAt
            });
        }

        // Linked contacts
        var contacts = await _contactRepository.GetByCompanyIdAsync(id);
        foreach (var contact in contacts)
        {
            entries.Add(new TimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "contact_linked",
                Title = $"Contact {contact.FullName} linked",
                Description = $"Contact '{contact.FullName}' was linked to this company.",
                Timestamp = contact.CreatedAt,
                UserId = contact.OwnerId,
                UserName = contact.Owner != null
                    ? $"{contact.Owner.FirstName} {contact.Owner.LastName}".Trim()
                    : null
            });
        }

        // Notes on this entity
        var noteEntries = await _noteRepository.GetEntityNotesForTimelineAsync("Company", id);
        foreach (var note in noteEntries)
        {
            entries.Add(new TimelineEntryDto
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
    /// Returns aggregated summary data for a company including key properties,
    /// association counts, recent/upcoming activities, notes preview, attachment count,
    /// last contacted date, and deal pipeline summary in a single batched request.
    /// </summary>
    [HttpGet("{id:guid}/summary")]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(CompanySummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSummary(Guid id)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(company.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var now = DateTimeOffset.UtcNow;

        // Parallel queries via Task.WhenAll
        var recentActivitiesTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Company" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new CompanySummaryActivityDto
            {
                Id = a.Id,
                Subject = a.Subject,
                Type = a.Type.ToString(),
                Status = a.Status.ToString(),
                DueDate = a.DueDate,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        var upcomingActivitiesTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Company" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .Where(a => a.Status != ActivityStatus.Done && a.DueDate != null && a.DueDate >= now)
            .OrderBy(a => a.DueDate)
            .Take(5)
            .Select(a => new CompanySummaryActivityDto
            {
                Id = a.Id,
                Subject = a.Subject,
                Type = a.Type.ToString(),
                Status = a.Status.ToString(),
                DueDate = a.DueDate,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        var recentNotesTask = _db.Notes
            .Where(n => n.EntityType == "Company" && n.EntityId == id)
            .OrderByDescending(n => n.CreatedAt)
            .Take(3)
            .Select(n => new CompanySummaryNoteDto
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

        var contactCountTask = _db.Contacts.CountAsync(c => c.CompanyId == id);
        var dealCountTask = _db.Deals.CountAsync(d => d.CompanyId == id);
        var activityCountTask = _db.ActivityLinks.CountAsync(al => al.EntityType == "Company" && al.EntityId == id);
        var quoteCountTask = _db.Quotes.CountAsync(q => q.CompanyId == id);
        var requestCountTask = _db.Requests.CountAsync(r => r.CompanyId == id);
        var attachmentCountTask = _db.Attachments.CountAsync(a => a.EntityType == "Company" && a.EntityId == id);

        var lastActivityDateTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Company" && al.EntityId == id)
            .Join(_db.Activities.Where(a => a.Status == ActivityStatus.Done), al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => (DateTimeOffset?)a.CreatedAt)
            .FirstOrDefaultAsync();

        var lastEmailDateTask = _db.EmailMessages
            .Where(e => e.LinkedCompanyId == id)
            .OrderByDescending(e => e.SentAt)
            .Select(e => (DateTimeOffset?)e.SentAt)
            .FirstOrDefaultAsync();

        var dealPipelineTask = _db.Deals
            .Where(d => d.CompanyId == id)
            .GroupBy(d => new { d.PipelineStageId, d.Stage!.Name, d.Stage.Color })
            .Select(g => new CompanyDealStageSummaryDto
            {
                StageName = g.Key.Name,
                Color = g.Key.Color,
                Count = g.Count(),
                Value = g.Sum(d => d.Value ?? 0)
            })
            .ToListAsync();

        var totalDealsForWinRateTask = _db.Deals
            .Where(d => d.CompanyId == id)
            .Select(d => new { d.Stage!.IsWon, d.Stage.IsLost, d.Value })
            .ToListAsync();

        await Task.WhenAll(
            recentActivitiesTask, upcomingActivitiesTask, recentNotesTask,
            contactCountTask, dealCountTask, activityCountTask, quoteCountTask, requestCountTask,
            attachmentCountTask, lastActivityDateTask, lastEmailDateTask,
            dealPipelineTask, totalDealsForWinRateTask);

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

        // Compute win rate
        var winRateDeals = totalDealsForWinRateTask.Result;
        var wonCount = winRateDeals.Count(d => d.IsWon);
        var closedCount = winRateDeals.Count(d => d.IsWon || d.IsLost);
        var winRate = closedCount > 0 ? (decimal)wonCount / closedCount : 0m;
        var totalValue = winRateDeals.Sum(d => d.Value ?? 0);

        var associations = new List<CompanySummaryAssociationDto>
        {
            new() { EntityType = "Contact", Label = "Contacts", Icon = "people", Count = contactCountTask.Result },
            new() { EntityType = "Deal", Label = "Deals", Icon = "handshake", Count = dealCountTask.Result },
            new() { EntityType = "Activity", Label = "Activities", Icon = "event", Count = activityCountTask.Result },
            new() { EntityType = "Quote", Label = "Quotes", Icon = "request_quote", Count = quoteCountTask.Result },
            new() { EntityType = "Request", Label = "Requests", Icon = "support_agent", Count = requestCountTask.Result },
        };

        var location = new[] { company.City, company.Country }
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToArray();

        var dto = new CompanySummaryDto
        {
            Id = company.Id,
            Name = company.Name,
            Industry = company.Industry,
            Phone = company.Phone,
            Email = company.Email,
            Website = company.Website,
            OwnerName = company.Owner != null
                ? $"{company.Owner.FirstName} {company.Owner.LastName}".Trim()
                : null,
            Location = location.Length > 0 ? string.Join(", ", location) : null,
            Size = company.Size,
            Associations = associations,
            RecentActivities = recentActivitiesTask.Result,
            UpcomingActivities = upcomingActivitiesTask.Result,
            RecentNotes = recentNotesTask.Result,
            AttachmentCount = attachmentCountTask.Result,
            LastContacted = lastContacted,
            DealPipeline = new CompanyDealPipelineSummaryDto
            {
                TotalValue = totalValue,
                TotalDeals = winRateDeals.Count,
                WinRate = winRate,
                DealsByStage = dealPipelineTask.Result
            }
        };

        return Ok(dto);
    }

    // ---- Company Contacts ----

    /// <summary>
    /// Returns contacts linked to a specific company (for the company detail Contacts tab).
    /// </summary>
    [HttpGet("{id:guid}/contacts")]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(List<ContactListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCompanyContacts(Guid id)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found." });

        var contacts = await _contactRepository.GetByCompanyIdAsync(id);
        var dtos = contacts.Select(ContactListDto.FromEntity).ToList();

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

        // Get all team IDs the user belongs to
        var userTeamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        if (userTeamIds.Count == 0)
            return new List<Guid>();

        // Get all member user IDs from those teams
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
/// Summary DTO for company list views.
/// </summary>
public record CompanyListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public string? Website { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public string? OwnerName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static CompanyListDto FromEntity(Company entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Industry = entity.Industry,
        Website = entity.Website,
        Phone = entity.Phone,
        Email = entity.Email,
        City = entity.City,
        State = entity.State,
        Country = entity.Country,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for company detail view including custom fields and contact count.
/// </summary>
public record CompanyDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public string? Website { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public string? PostalCode { get; init; }
    public string? Size { get; init; }
    public string? Description { get; init; }
    public string? OwnerName { get; init; }
    public Guid? OwnerId { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public int ContactCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static CompanyDetailDto FromEntity(Company entity, int contactCount, Dictionary<string, object?>? enrichedCustomFields = null) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Industry = entity.Industry,
        Website = entity.Website,
        Phone = entity.Phone,
        Email = entity.Email,
        Address = entity.Address,
        City = entity.City,
        State = entity.State,
        Country = entity.Country,
        PostalCode = entity.PostalCode,
        Size = entity.Size,
        Description = entity.Description,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        OwnerId = entity.OwnerId,
        CustomFields = enrichedCustomFields ?? entity.CustomFields,
        ContactCount = contactCount,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Timeline entry DTO for company and contact timelines.
/// </summary>
public record TimelineEntryDto
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
/// Request body for creating a company.
/// </summary>
public record CreateCompanyRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public string? Website { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public string? PostalCode { get; init; }
    public string? Size { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a company.
/// </summary>
public record UpdateCompanyRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public string? Website { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public string? PostalCode { get; init; }
    public string? Size { get; init; }
    public string? Description { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateCompanyRequest.
/// </summary>
public class CreateCompanyRequestValidator : AbstractValidator<CreateCompanyRequest>
{
    public CreateCompanyRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Company name is required.")
            .MaximumLength(200).WithMessage("Company name must be at most 200 characters.");
    }
}

// ---- Summary DTOs ----

/// <summary>
/// Aggregated summary DTO for the company detail summary tab.
/// </summary>
public record CompanySummaryDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Website { get; init; }
    public string? OwnerName { get; init; }
    public string? Location { get; init; }
    public string? Size { get; init; }
    public List<CompanySummaryAssociationDto> Associations { get; init; } = new();
    public List<CompanySummaryActivityDto> RecentActivities { get; init; } = new();
    public List<CompanySummaryActivityDto> UpcomingActivities { get; init; } = new();
    public List<CompanySummaryNoteDto> RecentNotes { get; init; } = new();
    public int AttachmentCount { get; init; }
    public DateTimeOffset? LastContacted { get; init; }
    public CompanyDealPipelineSummaryDto? DealPipeline { get; init; }
}

public record CompanySummaryActivityDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record CompanySummaryNoteDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Preview { get; init; }
    public string? AuthorName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record CompanySummaryAssociationDto
{
    public string EntityType { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Icon { get; init; } = string.Empty;
    public int Count { get; init; }
}

public record CompanyDealPipelineSummaryDto
{
    public decimal TotalValue { get; init; }
    public int TotalDeals { get; init; }
    public decimal WinRate { get; init; }
    public List<CompanyDealStageSummaryDto> DealsByStage { get; init; } = new();
}

public record CompanyDealStageSummaryDto
{
    public string StageName { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int Count { get; init; }
    public decimal Value { get; init; }
}
