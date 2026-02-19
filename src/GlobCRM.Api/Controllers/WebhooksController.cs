using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Webhooks;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Admin endpoints for webhook subscription management, delivery log viewing,
/// testing, secret regeneration, and manual retry.
/// All endpoints require the Admin role.
/// </summary>
[ApiController]
[Route("api/webhooks")]
[Authorize(Roles = "Admin")]
public class WebhooksController : ControllerBase
{
    private readonly IWebhookRepository _webhookRepository;
    private readonly WebhookDeliveryService _deliveryService;
    private readonly WebhookPayloadBuilder _payloadBuilder;
    private readonly WebhookSsrfValidator _ssrfValidator;
    private readonly WebhookDomainEventHandler _domainEventHandler;
    private readonly ITenantProvider _tenantProvider;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        IWebhookRepository webhookRepository,
        WebhookDeliveryService deliveryService,
        WebhookPayloadBuilder payloadBuilder,
        WebhookSsrfValidator ssrfValidator,
        WebhookDomainEventHandler domainEventHandler,
        ITenantProvider tenantProvider,
        IBackgroundJobClient jobClient,
        ILogger<WebhooksController> logger)
    {
        _webhookRepository = webhookRepository;
        _deliveryService = deliveryService;
        _payloadBuilder = payloadBuilder;
        _ssrfValidator = ssrfValidator;
        _domainEventHandler = domainEventHandler;
        _tenantProvider = tenantProvider;
        _jobClient = jobClient;
        _logger = logger;
    }

    // ---- Subscription CRUD Endpoints ----

    /// <summary>
    /// List all webhook subscriptions for the current tenant (secrets masked).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<WebhookSubscriptionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var subscriptions = await _webhookRepository.GetAllSubscriptionsAsync(CancellationToken.None);
        var dtos = subscriptions.Select(WebhookSubscriptionDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get a single webhook subscription by ID (secret masked).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WebhookSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var subscription = await _webhookRepository.GetSubscriptionByIdAsync(id, CancellationToken.None);
        if (subscription is null)
            return NotFound(new { error = "Webhook subscription not found." });

        return Ok(WebhookSubscriptionDto.FromEntity(subscription));
    }

    /// <summary>
    /// Create a new webhook subscription. Returns the full secret (shown once only).
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(WebhookSubscriptionCreateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateWebhookRequest request)
    {
        var validator = new CreateWebhookRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // SSRF validate the URL
        var (isValid, ssrfError) = await _ssrfValidator.ValidateUrlAsync(request.Url);
        if (!isValid)
            return BadRequest(new { error = $"URL validation failed: {ssrfError}" });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var secret = WebhookDeliveryService.GenerateSecret();

        var subscription = new WebhookSubscription
        {
            TenantId = tenantId,
            Name = request.Name,
            Url = request.Url,
            Secret = secret,
            EventSubscriptions = request.EventSubscriptions,
            IncludeCustomFields = request.IncludeCustomFields,
            IsActive = true,
            CreatedByUserId = GetCurrentUserId()
        };

        await _webhookRepository.CreateSubscriptionAsync(subscription, CancellationToken.None);

        // Invalidate subscription cache
        _domainEventHandler.InvalidateCache(tenantId);

        _logger.LogInformation(
            "Webhook subscription created: {SubscriptionId} ({SubscriptionName}) for tenant {TenantId}",
            subscription.Id, subscription.Name, tenantId);

        return CreatedAtAction(
            nameof(GetById),
            new { id = subscription.Id },
            WebhookSubscriptionCreateDto.FromEntity(subscription));
    }

    /// <summary>
    /// Update an existing webhook subscription. Partial update — only provided fields are changed.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(WebhookSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWebhookRequest request)
    {
        var validator = new UpdateWebhookRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var subscription = await _webhookRepository.GetSubscriptionByIdAsync(id, CancellationToken.None);
        if (subscription is null)
            return NotFound(new { error = "Webhook subscription not found." });

        // Apply partial updates
        if (request.Name is not null)
            subscription.Name = request.Name;

        if (request.Url is not null)
        {
            // SSRF validate new URL
            var (isValid, ssrfError) = await _ssrfValidator.ValidateUrlAsync(request.Url);
            if (!isValid)
                return BadRequest(new { error = $"URL validation failed: {ssrfError}" });

            subscription.Url = request.Url;
        }

        if (request.EventSubscriptions is not null)
            subscription.EventSubscriptions = request.EventSubscriptions;

        if (request.IncludeCustomFields.HasValue)
            subscription.IncludeCustomFields = request.IncludeCustomFields.Value;

        if (request.IsActive.HasValue)
            subscription.IsActive = request.IsActive.Value;

        await _webhookRepository.UpdateSubscriptionAsync(subscription, CancellationToken.None);

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        _domainEventHandler.InvalidateCache(tenantId);

        _logger.LogInformation(
            "Webhook subscription updated: {SubscriptionId} ({SubscriptionName})",
            subscription.Id, subscription.Name);

        return Ok(WebhookSubscriptionDto.FromEntity(subscription));
    }

    /// <summary>
    /// Delete a webhook subscription and all its delivery logs (cascade).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var subscription = await _webhookRepository.GetSubscriptionByIdAsync(id, CancellationToken.None);
        if (subscription is null)
            return NotFound(new { error = "Webhook subscription not found." });

        await _webhookRepository.DeleteSubscriptionAsync(id, CancellationToken.None);

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        _domainEventHandler.InvalidateCache(tenantId);

        _logger.LogInformation(
            "Webhook subscription deleted: {SubscriptionId} ({SubscriptionName})",
            id, subscription.Name);

        return NoContent();
    }

    /// <summary>
    /// Regenerate the HMAC secret for a subscription. Old secret immediately invalidated.
    /// Returns the full new secret (shown once only).
    /// </summary>
    [HttpPost("{id:guid}/regenerate-secret")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegenerateSecret(Guid id)
    {
        var subscription = await _webhookRepository.GetSubscriptionByIdAsync(id, CancellationToken.None);
        if (subscription is null)
            return NotFound(new { error = "Webhook subscription not found." });

        var newSecret = WebhookDeliveryService.GenerateSecret();
        await _webhookRepository.RegenerateSecretAsync(id, newSecret, CancellationToken.None);

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        _domainEventHandler.InvalidateCache(tenantId);

        _logger.LogInformation(
            "Webhook subscription secret regenerated: {SubscriptionId} ({SubscriptionName})",
            id, subscription.Name);

        return Ok(new { secret = newSecret });
    }

    /// <summary>
    /// Toggle a subscription's active state. When re-enabling a previously auto-disabled subscription,
    /// also clears the disabled state, failure counter, and disabled metadata.
    /// </summary>
    [HttpPost("{id:guid}/toggle")]
    [ProducesResponseType(typeof(WebhookSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Toggle(Guid id)
    {
        var subscription = await _webhookRepository.GetSubscriptionByIdAsync(id, CancellationToken.None);
        if (subscription is null)
            return NotFound(new { error = "Webhook subscription not found." });

        subscription.IsActive = !subscription.IsActive;

        // When re-enabling, also clear auto-disabled state
        if (subscription.IsActive && subscription.IsDisabled)
        {
            subscription.IsDisabled = false;
            subscription.ConsecutiveFailureCount = 0;
            subscription.DisabledAt = null;
            subscription.DisabledReason = null;
        }

        await _webhookRepository.UpdateSubscriptionAsync(subscription, CancellationToken.None);

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        _domainEventHandler.InvalidateCache(tenantId);

        _logger.LogInformation(
            "Webhook subscription toggled: {SubscriptionId} ({SubscriptionName}) IsActive={IsActive}",
            id, subscription.Name, subscription.IsActive);

        return Ok(WebhookSubscriptionDto.FromEntity(subscription));
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }
}

// ---- DTOs ----

/// <summary>
/// Read DTO for webhook subscriptions. Secret is always masked.
/// </summary>
public record WebhookSubscriptionDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public string SecretMask { get; init; } = string.Empty;
    public List<string> EventSubscriptions { get; init; } = new();
    public bool IncludeCustomFields { get; init; }
    public bool IsActive { get; init; }
    public bool IsDisabled { get; init; }
    public int ConsecutiveFailureCount { get; init; }
    public DateTimeOffset? LastDeliveryAt { get; init; }
    public DateTimeOffset? DisabledAt { get; init; }
    public string? DisabledReason { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static WebhookSubscriptionDto FromEntity(WebhookSubscription entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Url = entity.Url,
        SecretMask = MaskSecret(entity.Secret),
        EventSubscriptions = entity.EventSubscriptions,
        IncludeCustomFields = entity.IncludeCustomFields,
        IsActive = entity.IsActive,
        IsDisabled = entity.IsDisabled,
        ConsecutiveFailureCount = entity.ConsecutiveFailureCount,
        LastDeliveryAt = entity.LastDeliveryAt,
        DisabledAt = entity.DisabledAt,
        DisabledReason = entity.DisabledReason,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };

    /// <summary>
    /// Masks the secret to "whsec_****...{last4}" format.
    /// </summary>
    private static string MaskSecret(string secret)
    {
        if (string.IsNullOrEmpty(secret) || secret.Length < 10)
            return "whsec_****";

        var last4 = secret[^4..];
        return $"whsec_****...{last4}";
    }
}

/// <summary>
/// DTO returned on subscription creation — includes the full secret (shown once only).
/// </summary>
public record WebhookSubscriptionCreateDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public string Secret { get; init; } = string.Empty;
    public string SecretMask { get; init; } = string.Empty;
    public List<string> EventSubscriptions { get; init; } = new();
    public bool IncludeCustomFields { get; init; }
    public bool IsActive { get; init; }
    public bool IsDisabled { get; init; }
    public int ConsecutiveFailureCount { get; init; }
    public DateTimeOffset? LastDeliveryAt { get; init; }
    public DateTimeOffset? DisabledAt { get; init; }
    public string? DisabledReason { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static WebhookSubscriptionCreateDto FromEntity(WebhookSubscription entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Url = entity.Url,
        Secret = entity.Secret,
        SecretMask = $"whsec_****...{entity.Secret[^4..]}",
        EventSubscriptions = entity.EventSubscriptions,
        IncludeCustomFields = entity.IncludeCustomFields,
        IsActive = entity.IsActive,
        IsDisabled = entity.IsDisabled,
        ConsecutiveFailureCount = entity.ConsecutiveFailureCount,
        LastDeliveryAt = entity.LastDeliveryAt,
        DisabledAt = entity.DisabledAt,
        DisabledReason = entity.DisabledReason,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for webhook delivery log entries.
/// </summary>
public record WebhookDeliveryLogDto
{
    public Guid Id { get; init; }
    public Guid SubscriptionId { get; init; }
    public string SubscriptionName { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string EntityId { get; init; } = string.Empty;
    public int AttemptNumber { get; init; }
    public bool Success { get; init; }
    public int? HttpStatusCode { get; init; }
    public string? ResponseBody { get; init; }
    public string? ErrorMessage { get; init; }
    public string RequestPayload { get; init; } = string.Empty;
    public long DurationMs { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static WebhookDeliveryLogDto FromEntity(WebhookDeliveryLog entity) => new()
    {
        Id = entity.Id,
        SubscriptionId = entity.SubscriptionId,
        SubscriptionName = entity.Subscription?.Name ?? string.Empty,
        EventType = entity.EventType,
        EntityId = entity.EntityId,
        AttemptNumber = entity.AttemptNumber,
        Success = entity.Success,
        HttpStatusCode = entity.HttpStatusCode,
        ResponseBody = entity.ResponseBody,
        ErrorMessage = entity.ErrorMessage,
        RequestPayload = entity.RequestPayload,
        DurationMs = entity.DurationMs,
        CreatedAt = entity.CreatedAt
    };
}

/// <summary>
/// Response for test webhook preview.
/// </summary>
public record WebhookTestPreviewResponse
{
    public string SamplePayload { get; init; } = string.Empty;
}

/// <summary>
/// Paginated response for delivery logs.
/// </summary>
public record PagedDeliveryLogResponse
{
    public List<WebhookDeliveryLogDto> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a webhook subscription.
/// </summary>
public record CreateWebhookRequest
{
    public string Name { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public List<string> EventSubscriptions { get; init; } = new();
    public bool IncludeCustomFields { get; init; } = false;
}

/// <summary>
/// Request body for updating a webhook subscription. All fields optional (partial update).
/// </summary>
public record UpdateWebhookRequest
{
    public string? Name { get; init; }
    public string? Url { get; init; }
    public List<string>? EventSubscriptions { get; init; }
    public bool? IncludeCustomFields { get; init; }
    public bool? IsActive { get; init; }
}

/// <summary>
/// Request body for test webhook endpoint.
/// </summary>
public record WebhookTestRequest
{
    public bool Preview { get; init; } = false;
}

// ---- FluentValidation ----

/// <summary>
/// Validates CreateWebhookRequest: name required, HTTPS URL required, event subscriptions format validated.
/// </summary>
public class CreateWebhookRequestValidator : AbstractValidator<CreateWebhookRequest>
{
    private static readonly HashSet<string> ValidEntities = new(StringComparer.OrdinalIgnoreCase)
    {
        "Contact", "Company", "Deal", "Lead", "Activity"
    };

    private static readonly HashSet<string> ValidEvents = new(StringComparer.OrdinalIgnoreCase)
    {
        "Created", "Updated", "Deleted"
    };

    private static readonly Regex EventPattern = new(@"^[A-Za-z]+\.[A-Za-z]+$", RegexOptions.Compiled);

    public CreateWebhookRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer.");

        RuleFor(x => x.Url)
            .NotEmpty().WithMessage("URL is required.")
            .MaximumLength(2048).WithMessage("URL must be 2048 characters or fewer.")
            .Must(url => url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            .WithMessage("URL must start with https://.");

        RuleFor(x => x.EventSubscriptions)
            .NotEmpty().WithMessage("At least one event subscription is required.");

        RuleForEach(x => x.EventSubscriptions)
            .Must(BeValidEventSubscription)
            .WithMessage("Each event subscription must be in '{Entity}.{Event}' format where Entity is Contact, Company, Deal, Lead, or Activity and Event is Created, Updated, or Deleted.");
    }

    private static bool BeValidEventSubscription(string eventSub)
    {
        if (string.IsNullOrWhiteSpace(eventSub))
            return false;

        if (!EventPattern.IsMatch(eventSub))
            return false;

        var parts = eventSub.Split('.');
        if (parts.Length != 2)
            return false;

        return ValidEntities.Contains(parts[0]) && ValidEvents.Contains(parts[1]);
    }
}

/// <summary>
/// Validates UpdateWebhookRequest: same rules as create but all fields are optional.
/// Only validates fields that are provided.
/// </summary>
public class UpdateWebhookRequestValidator : AbstractValidator<UpdateWebhookRequest>
{
    private static readonly HashSet<string> ValidEntities = new(StringComparer.OrdinalIgnoreCase)
    {
        "Contact", "Company", "Deal", "Lead", "Activity"
    };

    private static readonly HashSet<string> ValidEvents = new(StringComparer.OrdinalIgnoreCase)
    {
        "Created", "Updated", "Deleted"
    };

    private static readonly Regex EventPattern = new(@"^[A-Za-z]+\.[A-Za-z]+$", RegexOptions.Compiled);

    public UpdateWebhookRequestValidator()
    {
        RuleFor(x => x.Name)
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer.")
            .When(x => x.Name is not null);

        RuleFor(x => x.Url)
            .MaximumLength(2048).WithMessage("URL must be 2048 characters or fewer.")
            .Must(url => url!.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            .WithMessage("URL must start with https://.")
            .When(x => x.Url is not null);

        RuleFor(x => x.EventSubscriptions)
            .NotEmpty().WithMessage("Event subscriptions list cannot be empty when provided.")
            .When(x => x.EventSubscriptions is not null);

        RuleForEach(x => x.EventSubscriptions)
            .Must(BeValidEventSubscription)
            .WithMessage("Each event subscription must be in '{Entity}.{Event}' format where Entity is Contact, Company, Deal, Lead, or Activity and Event is Created, Updated, or Deleted.")
            .When(x => x.EventSubscriptions is not null);
    }

    private static bool BeValidEventSubscription(string eventSub)
    {
        if (string.IsNullOrWhiteSpace(eventSub))
            return false;

        if (!EventPattern.IsMatch(eventSub))
            return false;

        var parts = eventSub.Split('.');
        if (parts.Length != 2)
            return false;

        return ValidEntities.Contains(parts[0]) && ValidEvents.Contains(parts[1]);
    }
}
