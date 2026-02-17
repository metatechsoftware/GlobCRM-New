using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Gmail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for email operations: list, detail, thread view, send, entity-scoped
/// queries (by-contact, by-company), and read/star state management.
/// Follows ActivitiesController pattern for CRUD structure.
/// All endpoints require authentication.
/// </summary>
[ApiController]
[Route("api/emails")]
[Authorize]
public class EmailsController : ControllerBase
{
    private readonly IEmailMessageRepository _emailMessageRepository;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly GmailSendService _sendService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<EmailsController> _logger;

    public EmailsController(
        IEmailMessageRepository emailMessageRepository,
        IEmailAccountRepository emailAccountRepository,
        GmailSendService sendService,
        ITenantProvider tenantProvider,
        ILogger<EmailsController> logger)
    {
        _emailMessageRepository = emailMessageRepository;
        _emailAccountRepository = emailAccountRepository;
        _sendService = sendService;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- List / Detail / Thread ----

    /// <summary>
    /// Lists email messages with server-side filtering, sorting, and pagination.
    /// Default sort: SentAt descending (most recent first).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<EmailListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var pagedResult = await _emailMessageRepository.GetPagedAsync(queryParams);

        var dtoResult = new PagedResult<EmailListDto>
        {
            Items = pagedResult.Items.Select(EmailListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single email message by ID with full details.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmailDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var message = await _emailMessageRepository.GetByIdAsync(id);
        if (message is null)
            return NotFound(new { error = "Email not found." });

        return Ok(EmailDetailDto.FromEntity(message));
    }

    /// <summary>
    /// Gets all messages in a thread by Gmail thread ID, ordered chronologically.
    /// Returns thread metadata with an array of email detail DTOs.
    /// </summary>
    [HttpGet("thread/{gmailThreadId}")]
    [ProducesResponseType(typeof(EmailThreadDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetThread(string gmailThreadId)
    {
        var messages = await _emailMessageRepository.GetByThreadIdAsync(gmailThreadId);

        var threadDto = new EmailThreadDto
        {
            ThreadId = gmailThreadId,
            Subject = messages.FirstOrDefault()?.Subject ?? string.Empty,
            MessageCount = messages.Count,
            Messages = messages.Select(EmailDetailDto.FromEntity).ToList()
        };

        return Ok(threadDto);
    }

    // ---- Send ----

    /// <summary>
    /// Sends an email via the current user's connected Gmail account.
    /// Requires a connected Gmail account. Optionally threads the reply.
    /// </summary>
    [HttpPost("send")]
    [ProducesResponseType(typeof(EmailDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Send([FromBody] SendEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.To))
            return BadRequest(new { error = "Recipient email address is required." });

        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest(new { error = "Subject is required." });

        if (string.IsNullOrWhiteSpace(request.HtmlBody))
            return BadRequest(new { error = "Email body is required." });

        var userId = GetCurrentUserId();
        var account = await _emailAccountRepository.GetByUserIdAsync(userId);

        if (account is null)
            return BadRequest(new { error = "No Gmail account connected. Please connect your Gmail account first." });

        try
        {
            var sentMessage = await _sendService.SendEmailAsync(
                account, request.To, request.Subject, request.HtmlBody, request.ReplyToThreadId);

            // Reload with navigations for DTO
            var reloaded = await _emailMessageRepository.GetByIdAsync(sentMessage.Id);

            _logger.LogInformation("Email sent by user {UserId} to {To}", userId, request.To);

            return StatusCode(StatusCodes.Status201Created, EmailDetailDto.FromEntity(reloaded ?? sentMessage));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email for user {UserId}", userId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = "Failed to send email: " + ex.Message });
        }
    }

    // ---- Entity-Scoped Endpoints ----

    /// <summary>
    /// Gets emails linked to a specific contact for the contact detail Emails tab.
    /// </summary>
    [HttpGet("by-contact/{contactId:guid}")]
    [ProducesResponseType(typeof(PagedResult<EmailListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByContact(Guid contactId, [FromQuery] EntityQueryParams queryParams)
    {
        var pagedResult = await _emailMessageRepository.GetByContactIdAsync(contactId, queryParams);

        var dtoResult = new PagedResult<EmailListDto>
        {
            Items = pagedResult.Items.Select(EmailListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets emails linked to a specific company for the company detail Emails tab.
    /// </summary>
    [HttpGet("by-company/{companyId:guid}")]
    [ProducesResponseType(typeof(PagedResult<EmailListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByCompany(Guid companyId, [FromQuery] EntityQueryParams queryParams)
    {
        var pagedResult = await _emailMessageRepository.GetByCompanyIdAsync(companyId, queryParams);

        var dtoResult = new PagedResult<EmailListDto>
        {
            Items = pagedResult.Items.Select(EmailListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    // ---- Read / Star State ----

    /// <summary>
    /// Marks an email as read (sets IsRead = true).
    /// </summary>
    [HttpPatch("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var message = await _emailMessageRepository.GetByIdAsync(id);
        if (message is null)
            return NotFound(new { error = "Email not found." });

        message.IsRead = true;
        await _emailMessageRepository.UpdateAsync(message);

        return NoContent();
    }

    /// <summary>
    /// Toggles the IsStarred state of an email.
    /// Returns the updated email detail with the new star state.
    /// </summary>
    [HttpPatch("{id:guid}/star")]
    [ProducesResponseType(typeof(EmailDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleStar(Guid id)
    {
        var message = await _emailMessageRepository.GetByIdAsync(id);
        if (message is null)
            return NotFound(new { error = "Email not found." });

        message.IsStarred = !message.IsStarred;
        await _emailMessageRepository.UpdateAsync(message);

        return Ok(EmailDetailDto.FromEntity(message));
    }

    // ---- Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for email list views.
/// </summary>
public record EmailListDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string FromAddress { get; init; } = string.Empty;
    public string FromName { get; init; } = string.Empty;
    public List<string> ToAddresses { get; init; } = new();
    public string? BodyPreview { get; init; }
    public DateTimeOffset SentAt { get; init; }
    public bool IsInbound { get; init; }
    public bool IsRead { get; init; }
    public bool IsStarred { get; init; }
    public bool HasAttachments { get; init; }
    public string GmailThreadId { get; init; } = string.Empty;
    public string? LinkedContactName { get; init; }
    public string? LinkedCompanyName { get; init; }

    public static EmailListDto FromEntity(EmailMessage entity) => new()
    {
        Id = entity.Id,
        Subject = entity.Subject,
        FromAddress = entity.FromAddress,
        FromName = entity.FromName,
        ToAddresses = ParseJsonArray(entity.ToAddresses),
        BodyPreview = entity.BodyPreview,
        SentAt = entity.SentAt,
        IsInbound = entity.IsInbound,
        IsRead = entity.IsRead,
        IsStarred = entity.IsStarred,
        HasAttachments = entity.HasAttachments,
        GmailThreadId = entity.GmailThreadId,
        LinkedContactName = entity.LinkedContact?.FullName,
        LinkedCompanyName = entity.LinkedCompany?.Name
    };

    private static List<string> ParseJsonArray(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }
}

/// <summary>
/// Detailed DTO for email detail view with full body and all metadata.
/// </summary>
public record EmailDetailDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string FromAddress { get; init; } = string.Empty;
    public string FromName { get; init; } = string.Empty;
    public List<string> ToAddresses { get; init; } = new();
    public List<string>? CcAddresses { get; init; }
    public List<string>? BccAddresses { get; init; }
    public string? BodyPreview { get; init; }
    public string? BodyHtml { get; init; }
    public string? BodyText { get; init; }
    public DateTimeOffset SentAt { get; init; }
    public bool IsInbound { get; init; }
    public bool IsRead { get; init; }
    public bool IsStarred { get; init; }
    public bool HasAttachments { get; init; }
    public string GmailMessageId { get; init; } = string.Empty;
    public string GmailThreadId { get; init; } = string.Empty;
    public Guid? LinkedContactId { get; init; }
    public string? LinkedContactName { get; init; }
    public Guid? LinkedCompanyId { get; init; }
    public string? LinkedCompanyName { get; init; }
    public Guid EmailAccountId { get; init; }
    public DateTimeOffset SyncedAt { get; init; }

    public static EmailDetailDto FromEntity(EmailMessage entity) => new()
    {
        Id = entity.Id,
        Subject = entity.Subject,
        FromAddress = entity.FromAddress,
        FromName = entity.FromName,
        ToAddresses = ParseJsonArray(entity.ToAddresses),
        CcAddresses = entity.CcAddresses != null ? ParseJsonArray(entity.CcAddresses) : null,
        BccAddresses = entity.BccAddresses != null ? ParseJsonArray(entity.BccAddresses) : null,
        BodyPreview = entity.BodyPreview,
        BodyHtml = entity.BodyHtml,
        BodyText = entity.BodyText,
        SentAt = entity.SentAt,
        IsInbound = entity.IsInbound,
        IsRead = entity.IsRead,
        IsStarred = entity.IsStarred,
        HasAttachments = entity.HasAttachments,
        GmailMessageId = entity.GmailMessageId,
        GmailThreadId = entity.GmailThreadId,
        LinkedContactId = entity.LinkedContactId,
        LinkedContactName = entity.LinkedContact?.FullName,
        LinkedCompanyId = entity.LinkedCompanyId,
        LinkedCompanyName = entity.LinkedCompany?.Name,
        EmailAccountId = entity.EmailAccountId,
        SyncedAt = entity.SyncedAt
    };

    private static List<string> ParseJsonArray(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }
}

/// <summary>
/// Thread DTO containing all messages in a conversation thread.
/// </summary>
public record EmailThreadDto
{
    public string ThreadId { get; init; } = string.Empty;
    public string Subject { get; init; } = string.Empty;
    public int MessageCount { get; init; }
    public List<EmailDetailDto> Messages { get; init; } = new();
}

/// <summary>
/// Request body for sending an email.
/// </summary>
public record SendEmailRequest
{
    public string To { get; init; } = string.Empty;
    public string Subject { get; init; } = string.Empty;
    public string HtmlBody { get; init; } = string.Empty;
    public string? ReplyToThreadId { get; init; }
}
