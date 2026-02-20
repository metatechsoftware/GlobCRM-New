using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.FormulaFields;
using GlobCRM.Infrastructure.Pdf;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Quote CRUD, PDF generation, versioning, status transitions,
/// and timeline. Ownership scope enforcement follows the DealsController pattern
/// with per-endpoint permission policies.
/// </summary>
[ApiController]
[Route("api/quotes")]
[Authorize]
public class QuotesController : ControllerBase
{
    private readonly IQuoteRepository _quoteRepository;
    private readonly INoteRepository _noteRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly FormulaEvaluationService _formulaEvaluator;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<QuotesController> _logger;

    public QuotesController(
        IQuoteRepository quoteRepository,
        INoteRepository noteRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        FormulaEvaluationService formulaEvaluator,
        ApplicationDbContext db,
        ILogger<QuotesController> logger)
    {
        _quoteRepository = quoteRepository;
        _noteRepository = noteRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _formulaEvaluator = formulaEvaluator;
        _db = db;
        _logger = logger;
    }

    // ---- Core CRUD Endpoints ----

    /// <summary>
    /// Lists quotes with server-side filtering, sorting, pagination, and ownership scope.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(PagedResult<QuoteListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _quoteRepository.GetPagedAsync(
            queryParams, permission.Scope, userId, teamMemberIds);

        var dtoResult = new PagedResult<QuoteListDto>
        {
            Items = pagedResult.Items.Select(QuoteListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single quote by ID with line items, status history, and version info.
    /// Ownership scope verified.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(QuoteDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var quote = await _quoteRepository.GetByIdWithLineItemsAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Get versions for this quote chain
        var originalId = quote.OriginalQuoteId ?? quote.Id;
        var versions = await _quoteRepository.GetVersionsAsync(originalId);

        var enriched = await _formulaEvaluator.EvaluateFormulasForEntityAsync("Quote", quote, quote.CustomFields);
        var dto = QuoteDetailDto.FromEntity(quote, versions, enriched);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new quote with line items. All line item and quote totals are
    /// recalculated server-side. Status starts as Draft, VersionNumber = 1.
    /// QuoteNumber is auto-generated.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Quote:Create")]
    [ProducesResponseType(typeof(QuoteDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateQuoteRequest request)
    {
        var validator = new CreateQuoteRequestValidator();
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
            var cfErrors = await _customFieldValidator.ValidateAsync("Quote", request.CustomFields);
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

        // Auto-generate quote number
        var quoteNumber = await GenerateQuoteNumberAsync(tenantId);

        // Build quote entity
        var quote = new Quote
        {
            TenantId = tenantId,
            QuoteNumber = quoteNumber,
            Title = request.Title,
            Description = request.Description,
            Status = QuoteStatus.Draft,
            IssueDate = request.IssueDate,
            ExpiryDate = request.ExpiryDate,
            VersionNumber = 1,
            DealId = request.DealId,
            ContactId = request.ContactId,
            CompanyId = request.CompanyId,
            OwnerId = userId,
            Notes = request.Notes,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        // Build and calculate line items
        var sortOrder = 0;
        foreach (var li in request.LineItems)
        {
            var lineItem = new QuoteLineItem
            {
                QuoteId = quote.Id,
                ProductId = li.ProductId,
                Description = li.Description,
                SortOrder = sortOrder++,
                Quantity = li.Quantity,
                UnitPrice = li.UnitPrice,
                DiscountPercent = li.DiscountPercent,
                TaxPercent = li.TaxPercent,
            };

            QuoteCalculator.CalculateLineItem(lineItem);
            quote.LineItems.Add(lineItem);
        }

        // Calculate quote totals
        QuoteCalculator.CalculateQuoteTotals(quote);

        var created = await _quoteRepository.CreateAsync(quote);

        _logger.LogInformation("Quote created: {QuoteNumber} ({QuoteId})", created.QuoteNumber, created.Id);

        // Reload with navigations for DTO
        var reloaded = await _quoteRepository.GetByIdWithLineItemsAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            QuoteDetailDto.FromEntity(reloaded!, new List<Quote> { reloaded! }));
    }

    /// <summary>
    /// Updates a quote header and replaces all line items (batch replacement).
    /// All totals recalculated server-side. Does NOT allow status change via PUT.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateQuoteRequest request)
    {
        var quote = await _quoteRepository.GetByIdWithLineItemsAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Quote", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Update header fields (NOT status -- use PATCH /status)
        quote.Title = request.Title;
        quote.Description = request.Description;
        quote.IssueDate = request.IssueDate;
        quote.ExpiryDate = request.ExpiryDate;
        quote.DealId = request.DealId;
        quote.ContactId = request.ContactId;
        quote.CompanyId = request.CompanyId;
        quote.Notes = request.Notes;

        if (request.CustomFields is not null)
            quote.CustomFields = request.CustomFields;

        // Batch replacement: delete old line items, insert new
        _db.Set<QuoteLineItem>().RemoveRange(quote.LineItems);

        var sortOrder = 0;
        quote.LineItems.Clear();
        foreach (var li in request.LineItems)
        {
            var lineItem = new QuoteLineItem
            {
                QuoteId = quote.Id,
                ProductId = li.ProductId,
                Description = li.Description,
                SortOrder = sortOrder++,
                Quantity = li.Quantity,
                UnitPrice = li.UnitPrice,
                DiscountPercent = li.DiscountPercent,
                TaxPercent = li.TaxPercent,
            };

            QuoteCalculator.CalculateLineItem(lineItem);
            quote.LineItems.Add(lineItem);
        }

        // Recalculate quote totals
        QuoteCalculator.CalculateQuoteTotals(quote);

        await _quoteRepository.UpdateAsync(quote);

        _logger.LogInformation("Quote updated: {QuoteId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a quote with ownership scope verification.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var quote = await _quoteRepository.GetByIdAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _quoteRepository.DeleteAsync(id);

        _logger.LogInformation("Quote deleted: {QuoteId}", id);

        return NoContent();
    }

    // ---- Status Transition ----

    /// <summary>
    /// Changes quote status using the QuoteWorkflow transition rules.
    /// Creates a QuoteStatusHistory audit record.
    /// Transitions: Draft->[Sent], Sent->[Accepted,Rejected,Expired,Draft],
    /// Accepted->[], Rejected->[Draft], Expired->[Draft].
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Permission:Quote:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateQuoteStatusRequest request)
    {
        var quote = await _quoteRepository.GetByIdAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Parse target status
        if (!Enum.TryParse<QuoteStatus>(request.Status, true, out var newStatus))
            return BadRequest(new { error = $"Invalid status: {request.Status}. Must be one of: Draft, Sent, Accepted, Rejected, Expired." });

        var currentStatus = quote.Status;

        // Validate transition via workflow
        if (!QuoteWorkflow.CanTransition(currentStatus, newStatus))
            return BadRequest(new { error = $"Cannot transition from {currentStatus} to {newStatus}." });

        // Create status history audit record
        var history = new QuoteStatusHistory
        {
            QuoteId = quote.Id,
            FromStatus = currentStatus,
            ToStatus = newStatus,
            ChangedById = userId,
        };
        _db.Set<QuoteStatusHistory>().Add(history);

        // Update status
        quote.Status = newStatus;
        await _quoteRepository.UpdateAsync(quote);

        _logger.LogInformation("Quote {QuoteId} status changed from {From} to {To}", id, currentStatus, newStatus);

        return NoContent();
    }

    // ---- PDF Generation ----

    /// <summary>
    /// Generates a PDF for the quote on-demand.
    /// Returns application/pdf with filename Quote-{number}-v{version}.pdf.
    /// </summary>
    [HttpGet("{id:guid}/pdf")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GeneratePdf(Guid id)
    {
        var quote = await _quoteRepository.GetByIdWithLineItemsAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Get the organization name from the tenant provider
        var org = await _tenantProvider.GetCurrentOrganizationAsync();
        var orgName = org?.Name ?? "Organization";

        // Build PDF model
        var pdfModel = new QuotePdfModel
        {
            OrganizationName = orgName,
            QuoteNumber = quote.QuoteNumber,
            VersionNumber = quote.VersionNumber,
            Title = quote.Title,
            Description = quote.Description,
            ContactName = quote.Contact != null ? quote.Contact.FullName : null,
            CompanyName = quote.Company?.Name,
            IssueDate = quote.IssueDate,
            ExpiryDate = quote.ExpiryDate,
            LineItems = quote.LineItems.OrderBy(li => li.SortOrder).Select(li => new QuotePdfLineItem
            {
                Description = li.Description,
                Quantity = li.Quantity,
                UnitPrice = li.UnitPrice,
                DiscountPercent = li.DiscountPercent,
                TaxPercent = li.TaxPercent,
                NetTotal = li.NetTotal,
            }).ToList(),
            Subtotal = quote.Subtotal,
            DiscountTotal = quote.DiscountTotal,
            TaxTotal = quote.TaxTotal,
            GrandTotal = quote.GrandTotal,
            Notes = quote.Notes,
            Status = quote.Status.ToString(),
        };

        var document = new QuotePdfDocument(pdfModel);
        var pdfBytes = document.GeneratePdf();

        var filename = $"Quote-{quote.QuoteNumber}-v{quote.VersionNumber}.pdf";

        _logger.LogInformation("PDF generated for quote {QuoteId}: {Filename}", id, filename);

        return File(pdfBytes, "application/pdf", filename);
    }

    // ---- Versioning ----

    /// <summary>
    /// Creates a new version from an existing quote by deep-cloning the header
    /// and all line items. Increments VersionNumber, sets OriginalQuoteId to
    /// the root quote, resets status to Draft, sets IssueDate to today.
    /// </summary>
    [HttpPost("{id:guid}/new-version")]
    [Authorize(Policy = "Permission:Quote:Create")]
    [ProducesResponseType(typeof(QuoteDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateNewVersion(Guid id)
    {
        var original = await _quoteRepository.GetByIdWithLineItemsAsync(id);
        if (original is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "Create");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(original.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var newVersion = new Quote
        {
            TenantId = original.TenantId,
            QuoteNumber = original.QuoteNumber,
            Title = original.Title,
            Description = original.Description,
            Status = QuoteStatus.Draft,
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ExpiryDate = original.ExpiryDate,
            VersionNumber = original.VersionNumber + 1,
            OriginalQuoteId = original.OriginalQuoteId ?? original.Id,
            DealId = original.DealId,
            ContactId = original.ContactId,
            CompanyId = original.CompanyId,
            OwnerId = userId,
            Notes = original.Notes,
            CustomFields = new Dictionary<string, object?>(original.CustomFields),
        };

        // Deep clone line items
        foreach (var item in original.LineItems.OrderBy(li => li.SortOrder))
        {
            newVersion.LineItems.Add(new QuoteLineItem
            {
                QuoteId = newVersion.Id,
                ProductId = item.ProductId,
                Description = item.Description,
                SortOrder = item.SortOrder,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                DiscountPercent = item.DiscountPercent,
                TaxPercent = item.TaxPercent,
                LineTotal = item.LineTotal,
                DiscountAmount = item.DiscountAmount,
                TaxAmount = item.TaxAmount,
                NetTotal = item.NetTotal,
            });
        }

        // Copy totals
        newVersion.Subtotal = original.Subtotal;
        newVersion.DiscountTotal = original.DiscountTotal;
        newVersion.TaxTotal = original.TaxTotal;
        newVersion.GrandTotal = original.GrandTotal;

        var created = await _quoteRepository.CreateAsync(newVersion);

        _logger.LogInformation("New version created for quote {QuoteNumber}: v{Version} ({NewQuoteId})",
            created.QuoteNumber, created.VersionNumber, created.Id);

        // Reload with navigations for DTO
        var reloaded = await _quoteRepository.GetByIdWithLineItemsAsync(created.Id);
        var originalId = reloaded!.OriginalQuoteId ?? reloaded.Id;
        var versions = await _quoteRepository.GetVersionsAsync(originalId);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            QuoteDetailDto.FromEntity(reloaded!, versions));
    }

    // ---- Timeline ----

    /// <summary>
    /// Returns chronological timeline for a quote: creation event + status changes
    /// from QuoteStatusHistory, ordered by date descending.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(List<QuoteTimelineEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var quote = await _quoteRepository.GetByIdWithLineItemsAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<QuoteTimelineEntryDto>();

        // 1. Entity creation event
        entries.Add(new QuoteTimelineEntryDto
        {
            Id = Guid.NewGuid(),
            Type = "created",
            Title = "Quote created",
            Description = $"Quote '{quote.Title}' (#{quote.QuoteNumber} v{quote.VersionNumber}) was created.",
            Timestamp = quote.CreatedAt,
            UserId = quote.OwnerId,
            UserName = quote.Owner != null
                ? $"{quote.Owner.FirstName} {quote.Owner.LastName}".Trim()
                : null
        });

        // 2. Status changes from QuoteStatusHistory
        var statusHistory = await _db.Set<QuoteStatusHistory>()
            .Include(h => h.ChangedBy)
            .Where(h => h.QuoteId == id)
            .OrderBy(h => h.ChangedAt)
            .ToListAsync();

        foreach (var history in statusHistory)
        {
            entries.Add(new QuoteTimelineEntryDto
            {
                Id = history.Id,
                Type = "status_changed",
                Title = $"Status changed: {history.FromStatus} -> {history.ToStatus}",
                Description = $"Quote status moved from '{history.FromStatus}' to '{history.ToStatus}'.",
                Timestamp = history.ChangedAt,
                UserId = history.ChangedById,
                UserName = history.ChangedBy != null
                    ? $"{history.ChangedBy.FirstName} {history.ChangedBy.LastName}".Trim()
                    : null
            });
        }

        // 3. Notes on this entity
        var noteEntries = await _noteRepository.GetEntityNotesForTimelineAsync("Quote", id);
        foreach (var note in noteEntries)
        {
            entries.Add(new QuoteTimelineEntryDto
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
    /// Returns aggregated summary data for a quote including key properties,
    /// recent/upcoming activities, notes preview, attachment count, last contacted date,
    /// and line item count.
    /// </summary>
    [HttpGet("{id:guid}/summary")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(QuoteSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSummary(Guid id)
    {
        var quote = await _quoteRepository.GetByIdWithLineItemsAsync(id);
        if (quote is null)
            return NotFound(new { error = "Quote not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Quote", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(quote.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var now = DateTimeOffset.UtcNow;

        // Parallel queries via Task.WhenAll
        // Note: Activity Type/Status are enums with HasConversion<string>().
        // EF Core cannot translate .ToString() on value-converted enums in server-side
        // LINQ projections, so we select raw enum values first, then map to DTOs in memory.
        var recentActivitiesRawTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Quote" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.DueDate, a.CreatedAt })
            .ToListAsync();

        var upcomingActivitiesRawTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Quote" && al.EntityId == id)
            .Join(_db.Activities, al => al.ActivityId, a => a.Id, (al, a) => a)
            .Where(a => a.Status != ActivityStatus.Done && a.DueDate != null && a.DueDate >= now)
            .OrderBy(a => a.DueDate)
            .Take(5)
            .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.DueDate, a.CreatedAt })
            .ToListAsync();

        var recentNotesTask = _db.Notes
            .Where(n => n.EntityType == "Quote" && n.EntityId == id)
            .OrderByDescending(n => n.CreatedAt)
            .Take(3)
            .Select(n => new QuoteSummaryNoteDto
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

        var activityCountTask = _db.ActivityLinks.CountAsync(al => al.EntityType == "Quote" && al.EntityId == id);
        var lineItemCountTask = _db.QuoteLineItems.CountAsync(li => li.QuoteId == id);
        var attachmentCountTask = _db.Attachments.CountAsync(a => a.EntityType == "Quote" && a.EntityId == id);

        var lastActivityDateTask = _db.ActivityLinks
            .Where(al => al.EntityType == "Quote" && al.EntityId == id)
            .Join(_db.Activities.Where(a => a.Status == ActivityStatus.Done), al => al.ActivityId, a => a.Id, (al, a) => a)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => (DateTimeOffset?)a.CreatedAt)
            .FirstOrDefaultAsync();

        // Last email related to the quote's contact
        var lastEmailDateTask = quote.ContactId.HasValue
            ? _db.EmailMessages
                .Where(e => e.LinkedContactId == quote.ContactId)
                .OrderByDescending(e => e.SentAt)
                .Select(e => (DateTimeOffset?)e.SentAt)
                .FirstOrDefaultAsync()
            : Task.FromResult<DateTimeOffset?>(null);

        await Task.WhenAll(
            recentActivitiesRawTask, upcomingActivitiesRawTask, recentNotesTask,
            activityCountTask, lineItemCountTask, attachmentCountTask,
            lastActivityDateTask, lastEmailDateTask);

        // Map raw activity data to DTOs (ToString() on enums must happen in memory)
        var recentActivities = recentActivitiesRawTask.Result
            .Select(a => new QuoteSummaryActivityDto
            {
                Id = a.Id, Subject = a.Subject, Type = a.Type.ToString(),
                Status = a.Status.ToString(), DueDate = a.DueDate, CreatedAt = a.CreatedAt
            }).ToList();

        var upcomingActivities = upcomingActivitiesRawTask.Result
            .Select(a => new QuoteSummaryActivityDto
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

        var associations = new List<QuoteSummaryAssociationDto>
        {
            new() { EntityType = "Activity", Label = "Activities", Icon = "event", Count = activityCountTask.Result },
            new() { EntityType = "LineItem", Label = "Line Items", Icon = "receipt_long", Count = lineItemCountTask.Result },
        };

        var dto = new QuoteSummaryDto
        {
            Id = quote.Id,
            QuoteNumber = quote.QuoteNumber,
            Title = quote.Title,
            Status = quote.Status.ToString(),
            GrandTotal = quote.GrandTotal,
            ContactName = quote.Contact?.FullName,
            CompanyName = quote.Company?.Name,
            IssueDate = quote.IssueDate,
            ExpiryDate = quote.ExpiryDate,
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
    /// Generates a unique quote number for the tenant.
    /// Format: Q-{4-digit padded number}. Uses MAX of existing numbers + 1.
    /// </summary>
    private async Task<string> GenerateQuoteNumberAsync(Guid tenantId)
    {
        var maxNumber = await _db.Set<Quote>()
            .Where(q => q.TenantId == tenantId)
            .Select(q => q.QuoteNumber)
            .ToListAsync();

        var nextNum = 1;
        if (maxNumber.Count > 0)
        {
            nextNum = maxNumber
                .Where(n => n.StartsWith("Q-"))
                .Select(n =>
                {
                    var numPart = n[2..];
                    return int.TryParse(numPart, out var val) ? val : 0;
                })
                .DefaultIfEmpty(0)
                .Max() + 1;
        }

        return $"Q-{nextNum:D4}";
    }
}

// ---- Quote Workflow ----

/// <summary>
/// Static workflow transition validation for quote status changes.
/// Draft->[Sent], Sent->[Accepted,Rejected,Expired,Draft],
/// Accepted->[] (terminal), Rejected->[Draft], Expired->[Draft].
/// </summary>
public static class QuoteWorkflow
{
    private static readonly Dictionary<QuoteStatus, QuoteStatus[]> AllowedTransitions = new()
    {
        [QuoteStatus.Draft] = [QuoteStatus.Sent],
        [QuoteStatus.Sent] = [QuoteStatus.Accepted, QuoteStatus.Rejected, QuoteStatus.Expired, QuoteStatus.Draft],
        [QuoteStatus.Accepted] = [],
        [QuoteStatus.Rejected] = [QuoteStatus.Draft],
        [QuoteStatus.Expired] = [QuoteStatus.Draft],
    };

    public static bool CanTransition(QuoteStatus from, QuoteStatus to)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }

    public static QuoteStatus[] GetAllowedTransitions(QuoteStatus from)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) ? allowed : [];
    }
}

// ---- Quote Calculator ----

/// <summary>
/// Server-side calculation of line item and quote totals.
/// Uses Math.Round(value, 2) for monetary amounts.
/// </summary>
public static class QuoteCalculator
{
    /// <summary>
    /// Calculates a single line item's computed amounts.
    /// </summary>
    public static void CalculateLineItem(QuoteLineItem item)
    {
        item.LineTotal = Math.Round(item.Quantity * item.UnitPrice, 2);
        item.DiscountAmount = Math.Round(item.LineTotal * item.DiscountPercent / 100m, 2);
        item.TaxAmount = Math.Round((item.LineTotal - item.DiscountAmount) * item.TaxPercent / 100m, 2);
        item.NetTotal = Math.Round(item.LineTotal - item.DiscountAmount + item.TaxAmount, 2);
    }

    /// <summary>
    /// Calculates the quote-level totals from its line items.
    /// </summary>
    public static void CalculateQuoteTotals(Quote quote)
    {
        quote.Subtotal = Math.Round(quote.LineItems.Sum(li => li.LineTotal), 2);
        quote.DiscountTotal = Math.Round(quote.LineItems.Sum(li => li.DiscountAmount), 2);
        quote.TaxTotal = Math.Round(quote.LineItems.Sum(li => li.TaxAmount), 2);
        quote.GrandTotal = Math.Round(quote.Subtotal - quote.DiscountTotal + quote.TaxTotal, 2);
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for quote list views.
/// </summary>
public record QuoteListDto
{
    public Guid Id { get; init; }
    public string QuoteNumber { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public decimal GrandTotal { get; init; }
    public string? ContactName { get; init; }
    public string? CompanyName { get; init; }
    public string? DealTitle { get; init; }
    public string? OwnerName { get; init; }
    public int VersionNumber { get; init; }
    public DateOnly IssueDate { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static QuoteListDto FromEntity(Quote entity) => new()
    {
        Id = entity.Id,
        QuoteNumber = entity.QuoteNumber,
        Title = entity.Title,
        Status = entity.Status.ToString(),
        GrandTotal = entity.GrandTotal,
        ContactName = entity.Contact?.FullName,
        CompanyName = entity.Company?.Name,
        DealTitle = entity.Deal?.Title,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        VersionNumber = entity.VersionNumber,
        IssueDate = entity.IssueDate,
        CreatedAt = entity.CreatedAt,
    };
}

/// <summary>
/// Detailed DTO for quote detail view including line items and versions.
/// </summary>
public record QuoteDetailDto
{
    public Guid Id { get; init; }
    public string QuoteNumber { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateOnly IssueDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public int VersionNumber { get; init; }
    public Guid? OriginalQuoteId { get; init; }
    public Guid? DealId { get; init; }
    public string? DealTitle { get; init; }
    public Guid? ContactId { get; init; }
    public string? ContactName { get; init; }
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public decimal Subtotal { get; init; }
    public decimal DiscountTotal { get; init; }
    public decimal TaxTotal { get; init; }
    public decimal GrandTotal { get; init; }
    public string? Notes { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public List<QuoteLineItemDto> LineItems { get; init; } = new();
    public List<QuoteVersionDto> Versions { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static QuoteDetailDto FromEntity(Quote entity, List<Quote> versions, Dictionary<string, object?>? enrichedCustomFields = null) => new()
    {
        Id = entity.Id,
        QuoteNumber = entity.QuoteNumber,
        Title = entity.Title,
        Description = entity.Description,
        Status = entity.Status.ToString(),
        IssueDate = entity.IssueDate,
        ExpiryDate = entity.ExpiryDate,
        VersionNumber = entity.VersionNumber,
        OriginalQuoteId = entity.OriginalQuoteId,
        DealId = entity.DealId,
        DealTitle = entity.Deal?.Title,
        ContactId = entity.ContactId,
        ContactName = entity.Contact?.FullName,
        CompanyId = entity.CompanyId,
        CompanyName = entity.Company?.Name,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        Subtotal = entity.Subtotal,
        DiscountTotal = entity.DiscountTotal,
        TaxTotal = entity.TaxTotal,
        GrandTotal = entity.GrandTotal,
        Notes = entity.Notes,
        CustomFields = enrichedCustomFields ?? entity.CustomFields,
        LineItems = entity.LineItems.OrderBy(li => li.SortOrder).Select(li => new QuoteLineItemDto
        {
            Id = li.Id,
            ProductId = li.ProductId,
            ProductName = li.Product?.Name,
            Description = li.Description,
            SortOrder = li.SortOrder,
            Quantity = li.Quantity,
            UnitPrice = li.UnitPrice,
            DiscountPercent = li.DiscountPercent,
            TaxPercent = li.TaxPercent,
            LineTotal = li.LineTotal,
            DiscountAmount = li.DiscountAmount,
            TaxAmount = li.TaxAmount,
            NetTotal = li.NetTotal,
        }).ToList(),
        Versions = versions.Select(v => new QuoteVersionDto
        {
            Id = v.Id,
            VersionNumber = v.VersionNumber,
            Status = v.Status.ToString(),
            GrandTotal = v.GrandTotal,
            CreatedAt = v.CreatedAt,
        }).ToList(),
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt,
    };
}

/// <summary>
/// DTO for quote line items.
/// </summary>
public record QuoteLineItemDto
{
    public Guid Id { get; init; }
    public Guid? ProductId { get; init; }
    public string? ProductName { get; init; }
    public string Description { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal DiscountPercent { get; init; }
    public decimal TaxPercent { get; init; }
    public decimal LineTotal { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal TaxAmount { get; init; }
    public decimal NetTotal { get; init; }
}

/// <summary>
/// DTO for a quote version in the version list.
/// </summary>
public record QuoteVersionDto
{
    public Guid Id { get; init; }
    public int VersionNumber { get; init; }
    public string Status { get; init; } = string.Empty;
    public decimal GrandTotal { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Quote timeline entry DTO.
/// </summary>
public record QuoteTimelineEntryDto
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
/// Request body for creating a quote with line items.
/// </summary>
public record CreateQuoteRequest
{
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? DealId { get; init; }
    public Guid? ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public DateOnly IssueDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public string? Notes { get; init; }
    public List<CreateQuoteLineItemRequest> LineItems { get; init; } = new();
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for creating a single quote line item.
/// </summary>
public record CreateQuoteLineItemRequest
{
    public Guid? ProductId { get; init; }
    public string Description { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal DiscountPercent { get; init; }
    public decimal TaxPercent { get; init; }
}

/// <summary>
/// Request body for updating a quote header and replacing all line items.
/// </summary>
public record UpdateQuoteRequest
{
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? DealId { get; init; }
    public Guid? ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public DateOnly IssueDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public string? Notes { get; init; }
    public List<UpdateQuoteLineItemRequest> LineItems { get; init; } = new();
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a single quote line item.
/// </summary>
public record UpdateQuoteLineItemRequest
{
    public Guid? ProductId { get; init; }
    public string Description { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal DiscountPercent { get; init; }
    public decimal TaxPercent { get; init; }
}

/// <summary>
/// Request body for changing a quote's status.
/// </summary>
public record UpdateQuoteStatusRequest
{
    public string Status { get; init; } = string.Empty;
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateQuoteRequest.
/// Validates title (3-500 chars), at least 1 line item,
/// and line item constraints (quantity > 0, unitPrice >= 0).
/// </summary>
public class CreateQuoteRequestValidator : AbstractValidator<CreateQuoteRequest>
{
    public CreateQuoteRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Quote title is required.")
            .MinimumLength(3).WithMessage("Quote title must be at least 3 characters.")
            .MaximumLength(500).WithMessage("Quote title must be at most 500 characters.");

        RuleFor(x => x.LineItems)
            .NotEmpty().WithMessage("At least one line item is required.")
            .Must(items => items.Count > 0).WithMessage("At least one line item is required.");

        RuleForEach(x => x.LineItems).ChildRules(lineItem =>
        {
            lineItem.RuleFor(li => li.Description)
                .NotEmpty().WithMessage("Line item description is required.");

            lineItem.RuleFor(li => li.Quantity)
                .GreaterThan(0).WithMessage("Line item quantity must be greater than 0.");

            lineItem.RuleFor(li => li.UnitPrice)
                .GreaterThanOrEqualTo(0).WithMessage("Line item unit price must be >= 0.");

            lineItem.RuleFor(li => li.DiscountPercent)
                .InclusiveBetween(0, 100).WithMessage("Discount percent must be between 0 and 100.");

            lineItem.RuleFor(li => li.TaxPercent)
                .InclusiveBetween(0, 100).WithMessage("Tax percent must be between 0 and 100.");
        });
    }
}

// ---- Summary DTOs ----

/// <summary>
/// Aggregated summary DTO for the quote detail summary tab.
/// </summary>
public record QuoteSummaryDto
{
    public Guid Id { get; init; }
    public string QuoteNumber { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public decimal GrandTotal { get; init; }
    public string? ContactName { get; init; }
    public string? CompanyName { get; init; }
    public DateOnly IssueDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public List<QuoteSummaryAssociationDto> Associations { get; init; } = new();
    public List<QuoteSummaryActivityDto> RecentActivities { get; init; } = new();
    public List<QuoteSummaryActivityDto> UpcomingActivities { get; init; } = new();
    public List<QuoteSummaryNoteDto> RecentNotes { get; init; } = new();
    public int AttachmentCount { get; init; }
    public DateTimeOffset? LastContacted { get; init; }
}

public record QuoteSummaryActivityDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record QuoteSummaryNoteDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Preview { get; init; }
    public string? AuthorName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record QuoteSummaryAssociationDto
{
    public string EntityType { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Icon { get; init; } = string.Empty;
    public int Count { get; init; }
}
