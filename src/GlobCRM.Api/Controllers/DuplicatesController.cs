using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Duplicates;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for duplicate detection, scanning, merge preview, comparison,
/// and merge execution for contacts and companies. Uses the two-tier pg_trgm +
/// FuzzySharp detection service and single-transaction merge services.
/// </summary>
[ApiController]
[Route("api/duplicates")]
[Authorize]
public class DuplicatesController : ControllerBase
{
    private readonly IDuplicateDetectionService _detectionService;
    private readonly ContactMergeService _contactMergeService;
    private readonly CompanyMergeService _companyMergeService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<DuplicatesController> _logger;

    public DuplicatesController(
        IDuplicateDetectionService detectionService,
        ContactMergeService contactMergeService,
        CompanyMergeService companyMergeService,
        ApplicationDbContext db,
        ILogger<DuplicatesController> logger)
    {
        _detectionService = detectionService;
        _contactMergeService = contactMergeService;
        _companyMergeService = companyMergeService;
        _db = db;
        _logger = logger;
    }

    // ---- Check Endpoints (Real-time create form warnings) ----

    /// <summary>
    /// Real-time duplicate check for contact create forms.
    /// Returns scored duplicate matches if auto-detection is enabled.
    /// </summary>
    [HttpPost("check/contacts")]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(List<ContactDuplicateMatchDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckContactDuplicates([FromBody] CheckContactDuplicatesRequest request)
    {
        // Load matching config for Contact entity type
        var config = await _db.DuplicateMatchingConfigs
            .FirstOrDefaultAsync(c => c.EntityType == "Contact");

        // If auto-detection is disabled, return empty array
        if (config is not null && !config.AutoDetectionEnabled)
            return Ok(Array.Empty<ContactDuplicateMatchDto>());

        var threshold = config?.SimilarityThreshold ?? 70;

        var matches = await _detectionService.FindContactDuplicatesAsync(
            request.FirstName, request.LastName, request.Email,
            threshold);

        // Enrich matches with phone and company name
        var matchIds = matches.Select(m => m.EntityId).ToList();
        var contactDetails = await _db.Contacts
            .Where(c => matchIds.Contains(c.Id))
            .Include(c => c.Company)
            .Select(c => new { c.Id, c.Phone, CompanyName = c.Company != null ? c.Company.Name : null })
            .ToDictionaryAsync(c => c.Id);

        var dtos = matches.Select(m =>
        {
            contactDetails.TryGetValue(m.EntityId, out var details);
            return new ContactDuplicateMatchDto
            {
                Id = m.EntityId,
                FullName = m.FullName,
                Email = m.Email,
                Phone = details?.Phone,
                CompanyName = details?.CompanyName,
                Score = m.Score,
                UpdatedAt = m.UpdatedAt
            };
        }).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Real-time duplicate check for company create forms.
    /// Returns scored duplicate matches if auto-detection is enabled.
    /// </summary>
    [HttpPost("check/companies")]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(List<CompanyDuplicateMatchDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckCompanyDuplicates([FromBody] CheckCompanyDuplicatesRequest request)
    {
        var config = await _db.DuplicateMatchingConfigs
            .FirstOrDefaultAsync(c => c.EntityType == "Company");

        if (config is not null && !config.AutoDetectionEnabled)
            return Ok(Array.Empty<CompanyDuplicateMatchDto>());

        var threshold = config?.SimilarityThreshold ?? 70;

        var matches = await _detectionService.FindCompanyDuplicatesAsync(
            request.Name, request.Website,
            threshold);

        // Enrich matches with email and phone
        var matchIds = matches.Select(m => m.EntityId).ToList();
        var companyDetails = await _db.Companies
            .Where(c => matchIds.Contains(c.Id))
            .Select(c => new { c.Id, c.Email, c.Phone })
            .ToDictionaryAsync(c => c.Id);

        var dtos = matches.Select(m =>
        {
            companyDetails.TryGetValue(m.EntityId, out var details);
            return new CompanyDuplicateMatchDto
            {
                Id = m.EntityId,
                Name = m.FullName,
                Website = m.SecondaryField,
                Email = details?.Email,
                Phone = details?.Phone,
                Score = m.Score,
                UpdatedAt = m.UpdatedAt
            };
        }).ToList();

        return Ok(dtos);
    }

    // ---- Scan Endpoints (On-demand batch scanning) ----

    /// <summary>
    /// On-demand duplicate scan for contacts. Returns paginated duplicate pairs
    /// sorted by confidence score descending.
    /// </summary>
    [HttpGet("scan/contacts")]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(DuplicateScanResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ScanContactDuplicates(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var config = await _db.DuplicateMatchingConfigs
            .FirstOrDefaultAsync(c => c.EntityType == "Contact");

        var threshold = config?.SimilarityThreshold ?? 70;

        var pairs = await _detectionService.ScanContactDuplicatesAsync(threshold, page, pageSize);

        // Enrich pairs with phone and company name
        var allIds = pairs
            .SelectMany(p => new[] { p.RecordA.EntityId, p.RecordB.EntityId })
            .Distinct()
            .ToList();

        var contactDetails = await _db.Contacts
            .Where(c => allIds.Contains(c.Id))
            .Include(c => c.Company)
            .Select(c => new { c.Id, c.Phone, CompanyName = c.Company != null ? c.Company.Name : null })
            .ToDictionaryAsync(c => c.Id);

        ContactDuplicateMatchDto EnrichContact(DuplicateMatch m)
        {
            contactDetails.TryGetValue(m.EntityId, out var d);
            return new ContactDuplicateMatchDto
            {
                Id = m.EntityId, FullName = m.FullName, Email = m.Email,
                Phone = d?.Phone, CompanyName = d?.CompanyName,
                Score = m.Score, UpdatedAt = m.UpdatedAt
            };
        }

        var dtos = pairs.Select(p => new DuplicatePairDto
        {
            RecordA = EnrichContact(p.RecordA),
            RecordB = EnrichContact(p.RecordB),
            Score = p.Score
        }).ToList();

        // Get total count for pagination (re-scan without pagination)
        var totalPairs = await _detectionService.ScanContactDuplicatesAsync(threshold, 1, int.MaxValue);

        return Ok(new DuplicateScanResultDto
        {
            Items = dtos,
            TotalCount = totalPairs.Count,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// On-demand duplicate scan for companies. Returns paginated duplicate pairs
    /// sorted by confidence score descending.
    /// </summary>
    [HttpGet("scan/companies")]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(DuplicateScanResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ScanCompanyDuplicates(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var config = await _db.DuplicateMatchingConfigs
            .FirstOrDefaultAsync(c => c.EntityType == "Company");

        var threshold = config?.SimilarityThreshold ?? 70;

        var pairs = await _detectionService.ScanCompanyDuplicatesAsync(threshold, page, pageSize);

        var allIds = pairs
            .SelectMany(p => new[] { p.RecordA.EntityId, p.RecordB.EntityId })
            .Distinct()
            .ToList();

        var companyDetails = await _db.Companies
            .Where(c => allIds.Contains(c.Id))
            .Select(c => new { c.Id, c.Email, c.Phone })
            .ToDictionaryAsync(c => c.Id);

        CompanyDuplicateMatchDto EnrichCompany(DuplicateMatch m)
        {
            companyDetails.TryGetValue(m.EntityId, out var d);
            return new CompanyDuplicateMatchDto
            {
                Id = m.EntityId, Name = m.FullName,
                Website = m.SecondaryField,
                Email = d?.Email, Phone = d?.Phone,
                Score = m.Score, UpdatedAt = m.UpdatedAt
            };
        }

        var dtos = pairs.Select(p => new DuplicatePairDto
        {
            RecordA = EnrichCompany(p.RecordA),
            RecordB = EnrichCompany(p.RecordB),
            Score = p.Score
        }).ToList();

        var totalPairs = await _detectionService.ScanCompanyDuplicatesAsync(threshold, 1, int.MaxValue);

        return Ok(new DuplicateScanResultDto
        {
            Items = dtos,
            TotalCount = totalPairs.Count,
            Page = page,
            PageSize = pageSize
        });
    }

    // ---- Merge Preview Endpoints ----

    /// <summary>
    /// Contact merge confirmation preview. Returns counts of all relationships
    /// that will be transferred from loser to survivor.
    /// </summary>
    [HttpGet("merge-preview/contacts")]
    [Authorize(Policy = "Permission:Contact:Edit")]
    [ProducesResponseType(typeof(MergePreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ContactMergePreview(
        [FromQuery] Guid survivorId, [FromQuery] Guid loserId)
    {
        if (survivorId == loserId)
            return BadRequest(new { error = "Survivor and loser must be different records." });

        // Verify both contacts exist
        var survivor = await _db.Contacts.FindAsync(survivorId);
        if (survivor is null)
            return BadRequest(new { error = "Survivor contact not found." });

        var loser = await _db.Contacts.FindAsync(loserId);
        if (loser is null)
            return BadRequest(new { error = "Loser contact not found." });

        // Count all relationships on the loser
        var dealCount = await _db.DealContacts.CountAsync(dc => dc.ContactId == loserId);
        var quoteCount = await _db.Quotes.CountAsync(q => q.ContactId == loserId);
        var requestCount = await _db.Requests.CountAsync(r => r.ContactId == loserId);
        var emailCount = await _db.EmailMessages.CountAsync(e => e.LinkedContactId == loserId)
            + await _db.EmailThreads.CountAsync(e => e.LinkedContactId == loserId);
        var noteCount = await _db.Notes.CountAsync(n => n.EntityType == "Contact" && n.EntityId == loserId);
        var attachmentCount = await _db.Attachments.CountAsync(a => a.EntityType == "Contact" && a.EntityId == loserId);
        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Contact" && al.EntityId == loserId);
        var feedItemCount = await _db.FeedItems.CountAsync(f => f.EntityType == "Contact" && f.EntityId == loserId);
        var notificationCount = await _db.Notifications.CountAsync(n => n.EntityType == "Contact" && n.EntityId == loserId);
        var leadCount = await _db.Leads.IgnoreQueryFilters().CountAsync(l => l.ConvertedContactId == loserId)
            + await _db.LeadConversions.IgnoreQueryFilters().CountAsync(lc => lc.ContactId == loserId);

        var totalCount = dealCount + quoteCount + requestCount + emailCount + noteCount
            + attachmentCount + activityCount + feedItemCount + notificationCount + leadCount;

        return Ok(new MergePreviewDto
        {
            DealCount = dealCount,
            QuoteCount = quoteCount,
            RequestCount = requestCount,
            NoteCount = noteCount,
            AttachmentCount = attachmentCount,
            ActivityCount = activityCount,
            EmailCount = emailCount,
            FeedItemCount = feedItemCount,
            NotificationCount = notificationCount,
            LeadCount = leadCount,
            TotalCount = totalCount
        });
    }

    /// <summary>
    /// Company merge confirmation preview. Returns counts of all relationships
    /// that will be transferred from loser to survivor.
    /// </summary>
    [HttpGet("merge-preview/companies")]
    [Authorize(Policy = "Permission:Company:Edit")]
    [ProducesResponseType(typeof(MergePreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CompanyMergePreview(
        [FromQuery] Guid survivorId, [FromQuery] Guid loserId)
    {
        if (survivorId == loserId)
            return BadRequest(new { error = "Survivor and loser must be different records." });

        var survivor = await _db.Companies.FindAsync(survivorId);
        if (survivor is null)
            return BadRequest(new { error = "Survivor company not found." });

        var loser = await _db.Companies.FindAsync(loserId);
        if (loser is null)
            return BadRequest(new { error = "Loser company not found." });

        // Count all relationships on the loser
        var contactCount = await _db.Contacts.IgnoreQueryFilters()
            .CountAsync(c => c.CompanyId == loserId && c.MergedIntoId == null);
        var dealCount = await _db.Deals.CountAsync(d => d.CompanyId == loserId);
        var quoteCount = await _db.Quotes.CountAsync(q => q.CompanyId == loserId);
        var requestCount = await _db.Requests.CountAsync(r => r.CompanyId == loserId);
        var emailCount = await _db.EmailMessages.CountAsync(e => e.LinkedCompanyId == loserId)
            + await _db.EmailThreads.CountAsync(e => e.LinkedCompanyId == loserId);
        var noteCount = await _db.Notes.CountAsync(n => n.EntityType == "Company" && n.EntityId == loserId);
        var attachmentCount = await _db.Attachments.CountAsync(a => a.EntityType == "Company" && a.EntityId == loserId);
        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Company" && al.EntityId == loserId);
        var feedItemCount = await _db.FeedItems.CountAsync(f => f.EntityType == "Company" && f.EntityId == loserId);
        var notificationCount = await _db.Notifications.CountAsync(n => n.EntityType == "Company" && n.EntityId == loserId);
        var leadCount = await _db.Leads.IgnoreQueryFilters().CountAsync(l => l.ConvertedCompanyId == loserId)
            + await _db.LeadConversions.IgnoreQueryFilters().CountAsync(lc => lc.CompanyId == loserId);

        var totalCount = contactCount + dealCount + quoteCount + requestCount + emailCount + noteCount
            + attachmentCount + activityCount + feedItemCount + notificationCount + leadCount;

        return Ok(new MergePreviewDto
        {
            ContactCount = contactCount,
            DealCount = dealCount,
            QuoteCount = quoteCount,
            RequestCount = requestCount,
            NoteCount = noteCount,
            AttachmentCount = attachmentCount,
            ActivityCount = activityCount,
            EmailCount = emailCount,
            FeedItemCount = feedItemCount,
            NotificationCount = notificationCount,
            LeadCount = leadCount,
            TotalCount = totalCount
        });
    }

    // ---- Merge Endpoints ----

    /// <summary>
    /// Execute contact merge. Transfers all relationships from loser to survivor
    /// in a single transaction.
    /// </summary>
    [HttpPost("merge/contacts")]
    [Authorize(Policy = "Permission:Contact:Edit")]
    [ProducesResponseType(typeof(MergeResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> MergeContacts([FromBody] MergeContactsRequest request)
    {
        var validator = new MergeContactsRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Verify both contacts exist
        var survivor = await _db.Contacts.FindAsync(request.SurvivorId);
        if (survivor is null)
            return BadRequest(new { error = "Survivor contact not found." });

        var loser = await _db.Contacts.FindAsync(request.LoserId);
        if (loser is null)
            return BadRequest(new { error = "Loser contact not found." });

        var userId = GetCurrentUserId();

        try
        {
            var transferCounts = await _contactMergeService.MergeAsync(
                request.SurvivorId, request.LoserId,
                request.FieldSelections ?? new Dictionary<string, object?>(),
                userId);

            _logger.LogInformation(
                "Contacts merged: {LoserId} into {SurvivorId} by {UserId}",
                request.LoserId, request.SurvivorId, userId);

            return Ok(new MergeResultDto
            {
                SurvivorId = request.SurvivorId,
                TransferCounts = transferCounts,
                MergedAt = DateTimeOffset.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Contact merge failed: {LoserId} into {SurvivorId}",
                request.LoserId, request.SurvivorId);
            return BadRequest(new { error = "Merge operation failed. Please try again." });
        }
    }

    /// <summary>
    /// Execute company merge. Transfers all relationships from loser to survivor
    /// in a single transaction.
    /// </summary>
    [HttpPost("merge/companies")]
    [Authorize(Policy = "Permission:Company:Edit")]
    [ProducesResponseType(typeof(MergeResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> MergeCompanies([FromBody] MergeCompaniesRequest request)
    {
        var validator = new MergeCompaniesRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var survivor = await _db.Companies.FindAsync(request.SurvivorId);
        if (survivor is null)
            return BadRequest(new { error = "Survivor company not found." });

        var loser = await _db.Companies.FindAsync(request.LoserId);
        if (loser is null)
            return BadRequest(new { error = "Loser company not found." });

        var userId = GetCurrentUserId();

        try
        {
            var transferCounts = await _companyMergeService.MergeAsync(
                request.SurvivorId, request.LoserId,
                request.FieldSelections ?? new Dictionary<string, object?>(),
                userId);

            _logger.LogInformation(
                "Companies merged: {LoserId} into {SurvivorId} by {UserId}",
                request.LoserId, request.SurvivorId, userId);

            return Ok(new MergeResultDto
            {
                SurvivorId = request.SurvivorId,
                TransferCounts = transferCounts,
                MergedAt = DateTimeOffset.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Company merge failed: {LoserId} into {SurvivorId}",
                request.LoserId, request.SurvivorId);
            return BadRequest(new { error = "Merge operation failed. Please try again." });
        }
    }

    // ---- Comparison Endpoints ----

    /// <summary>
    /// Get two contact records for side-by-side comparison in the merge UI.
    /// Uses IgnoreQueryFilters to also load recently merged records.
    /// </summary>
    [HttpGet("contacts/{id:guid}/comparison")]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(ContactComparisonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetContactComparison(Guid id, [FromQuery] Guid otherId)
    {
        // Use IgnoreQueryFilters to load even merged records
        var contactA = await _db.Contacts
            .IgnoreQueryFilters()
            .Include(c => c.Company)
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contactA is null)
            return BadRequest(new { error = "First contact not found." });

        var contactB = await _db.Contacts
            .IgnoreQueryFilters()
            .Include(c => c.Company)
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.Id == otherId);

        if (contactB is null)
            return BadRequest(new { error = "Second contact not found." });

        return Ok(new ContactComparisonDto
        {
            ContactA = ContactComparisonRecordDto.FromEntity(contactA),
            ContactB = ContactComparisonRecordDto.FromEntity(contactB)
        });
    }

    /// <summary>
    /// Get two company records for side-by-side comparison in the merge UI.
    /// Uses IgnoreQueryFilters to also load recently merged records.
    /// </summary>
    [HttpGet("companies/{id:guid}/comparison")]
    [Authorize(Policy = "Permission:Company:View")]
    [ProducesResponseType(typeof(CompanyComparisonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetCompanyComparison(Guid id, [FromQuery] Guid otherId)
    {
        var companyA = await _db.Companies
            .IgnoreQueryFilters()
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (companyA is null)
            return BadRequest(new { error = "First company not found." });

        var companyB = await _db.Companies
            .IgnoreQueryFilters()
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.Id == otherId);

        if (companyB is null)
            return BadRequest(new { error = "Second company not found." });

        return Ok(new CompanyComparisonDto
        {
            CompanyA = CompanyComparisonRecordDto.FromEntity(companyA),
            CompanyB = CompanyComparisonRecordDto.FromEntity(companyB)
        });
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

}

// ---- Request DTOs ----

/// <summary>
/// Request body for real-time contact duplicate check.
/// </summary>
public record CheckContactDuplicatesRequest
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? Email { get; init; }
}

/// <summary>
/// Request body for real-time company duplicate check.
/// </summary>
public record CheckCompanyDuplicatesRequest
{
    public string? Name { get; init; }
    public string? Website { get; init; }
}

/// <summary>
/// Request body for contact merge execution.
/// </summary>
public record MergeContactsRequest
{
    public Guid SurvivorId { get; init; }
    public Guid LoserId { get; init; }
    public Dictionary<string, object?>? FieldSelections { get; init; }
}

/// <summary>
/// Request body for company merge execution.
/// </summary>
public record MergeCompaniesRequest
{
    public Guid SurvivorId { get; init; }
    public Guid LoserId { get; init; }
    public Dictionary<string, object?>? FieldSelections { get; init; }
}

// ---- Response DTOs ----

/// <summary>
/// Duplicate match DTO for contact duplicate results.
/// </summary>
public record ContactDuplicateMatchDto
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? CompanyName { get; init; }
    public int Score { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
/// Duplicate match DTO for company duplicate results.
/// </summary>
public record CompanyDuplicateMatchDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Website { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public int Score { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
/// A pair of duplicate records found during batch scanning.
/// RecordA and RecordB are ContactDuplicateMatchDto or CompanyDuplicateMatchDto
/// depending on the scan entity type.
/// </summary>
public record DuplicatePairDto
{
    public object RecordA { get; init; } = null!;
    public object RecordB { get; init; } = null!;
    public int Score { get; init; }
}

/// <summary>
/// Paginated result for duplicate scan operations.
/// </summary>
public record DuplicateScanResultDto
{
    public List<DuplicatePairDto> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

/// <summary>
/// Merge preview DTO showing counts of relationships to be transferred.
/// </summary>
public record MergePreviewDto
{
    public int ContactCount { get; init; }
    public int DealCount { get; init; }
    public int QuoteCount { get; init; }
    public int RequestCount { get; init; }
    public int NoteCount { get; init; }
    public int AttachmentCount { get; init; }
    public int ActivityCount { get; init; }
    public int EmailCount { get; init; }
    public int FeedItemCount { get; init; }
    public int NotificationCount { get; init; }
    public int LeadCount { get; init; }
    public int TotalCount { get; init; }
}

/// <summary>
/// Result of a merge operation.
/// </summary>
public record MergeResultDto
{
    public Guid SurvivorId { get; init; }
    public Dictionary<string, int> TransferCounts { get; init; } = new();
    public DateTimeOffset MergedAt { get; init; }
}

/// <summary>
/// Side-by-side comparison of two contacts.
/// </summary>
public record ContactComparisonDto
{
    public ContactComparisonRecordDto ContactA { get; init; } = null!;
    public ContactComparisonRecordDto ContactB { get; init; } = null!;
}

/// <summary>
/// Full contact record for comparison UI.
/// </summary>
public record ContactComparisonRecordDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? MobilePhone { get; init; }
    public string? JobTitle { get; init; }
    public string? Department { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public string? PostalCode { get; init; }
    public string? Description { get; init; }
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ContactComparisonRecordDto FromEntity(Contact entity) => new()
    {
        Id = entity.Id,
        FirstName = entity.FirstName,
        LastName = entity.LastName,
        FullName = entity.FullName,
        Email = entity.Email,
        Phone = entity.Phone,
        MobilePhone = entity.MobilePhone,
        JobTitle = entity.JobTitle,
        Department = entity.Department,
        Address = entity.Address,
        City = entity.City,
        State = entity.State,
        Country = entity.Country,
        PostalCode = entity.PostalCode,
        Description = entity.Description,
        CompanyId = entity.CompanyId,
        CompanyName = entity.Company?.Name,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        CustomFields = entity.CustomFields,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Side-by-side comparison of two companies.
/// </summary>
public record CompanyComparisonDto
{
    public CompanyComparisonRecordDto CompanyA { get; init; } = null!;
    public CompanyComparisonRecordDto CompanyB { get; init; } = null!;
}

/// <summary>
/// Full company record for comparison UI.
/// </summary>
public record CompanyComparisonRecordDto
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
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static CompanyComparisonRecordDto FromEntity(Company entity) => new()
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
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        CustomFields = entity.CustomFields,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for MergeContactsRequest.
/// </summary>
public class MergeContactsRequestValidator : AbstractValidator<MergeContactsRequest>
{
    public MergeContactsRequestValidator()
    {
        RuleFor(x => x.SurvivorId)
            .NotEmpty().WithMessage("Survivor ID is required.");

        RuleFor(x => x.LoserId)
            .NotEmpty().WithMessage("Loser ID is required.");

        RuleFor(x => x.LoserId)
            .NotEqual(x => x.SurvivorId)
            .WithMessage("Survivor and loser must be different records.");
    }
}

/// <summary>
/// FluentValidation validator for MergeCompaniesRequest.
/// </summary>
public class MergeCompaniesRequestValidator : AbstractValidator<MergeCompaniesRequest>
{
    public MergeCompaniesRequestValidator()
    {
        RuleFor(x => x.SurvivorId)
            .NotEmpty().WithMessage("Survivor ID is required.");

        RuleFor(x => x.LoserId)
            .NotEmpty().WithMessage("Loser ID is required.");

        RuleFor(x => x.LoserId)
            .NotEqual(x => x.SurvivorId)
            .WithMessage("Survivor and loser must be different records.");
    }
}
