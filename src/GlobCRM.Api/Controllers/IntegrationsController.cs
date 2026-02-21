using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// API endpoints for the integration marketplace: list connections, connect, disconnect,
/// test connectivity, and view activity logs.
/// Credentials are encrypted at rest and never exposed in API responses — only masked values.
/// </summary>
[ApiController]
[Route("api/integrations")]
[Authorize]
public class IntegrationsController : ControllerBase
{
    private readonly IIntegrationRepository _integrationRepository;
    private readonly CredentialEncryptionService _encryptionService;
    private readonly ITenantProvider _tenantProvider;

    public IntegrationsController(
        IIntegrationRepository integrationRepository,
        CredentialEncryptionService encryptionService,
        ITenantProvider tenantProvider)
    {
        _integrationRepository = integrationRepository;
        _encryptionService = encryptionService;
        _tenantProvider = tenantProvider;
    }

    /// <summary>
    /// List all integrations for the current tenant with masked credentials.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<IntegrationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var integrations = await _integrationRepository.GetAllAsync();
        var dtos = integrations.Select(IntegrationDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Connect a third-party integration. Encrypts credentials before storage.
    /// Admin only — credentials are validated, encrypted, and stored with a masked display value.
    /// </summary>
    [HttpPost("connect")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IntegrationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Connect([FromBody] ConnectIntegrationRequest request)
    {
        var validator = new ConnectIntegrationValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Check if already connected by key
        var existing = await _integrationRepository.GetByKeyAsync(request.IntegrationKey);
        if (existing is not null && existing.Status == IntegrationStatus.Connected)
        {
            return Conflict(new { error = $"Integration '{request.IntegrationKey}' is already connected." });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        var (userId, userName) = GetCurrentUser();

        // Serialize and encrypt credentials
        var credentialsJson = JsonSerializer.Serialize(request.Credentials);
        var encrypted = _encryptionService.Encrypt(credentialsJson);
        var mask = MaskCredential(request.Credentials);

        Integration integration;

        if (existing is not null)
        {
            // Re-connect a previously disconnected integration
            existing.Status = IntegrationStatus.Connected;
            existing.EncryptedCredentials = encrypted;
            existing.CredentialMask = mask;
            existing.ConnectedByUserId = userId;
            existing.ConnectedAt = DateTimeOffset.UtcNow;
            existing.DisconnectedAt = null;
            integration = existing;
        }
        else
        {
            // Create new integration
            integration = new Integration
            {
                TenantId = tenantId,
                IntegrationKey = request.IntegrationKey,
                Status = IntegrationStatus.Connected,
                EncryptedCredentials = encrypted,
                CredentialMask = mask,
                ConnectedByUserId = userId,
                ConnectedAt = DateTimeOffset.UtcNow
            };
            await _integrationRepository.AddAsync(integration);
        }

        // Log activity
        await _integrationRepository.AddActivityLogAsync(new IntegrationActivityLog
        {
            TenantId = tenantId,
            IntegrationId = integration.Id,
            Action = IntegrationAction.Connected,
            PerformedByUserId = userId,
            PerformedByUserName = userName,
            Details = $"Connected integration '{request.IntegrationKey}'"
        });

        await _integrationRepository.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), IntegrationDto.FromEntity(integration));
    }

    /// <summary>
    /// Disconnect an integration. Clears encrypted credentials and mask for security.
    /// Admin only.
    /// </summary>
    [HttpPost("{id:guid}/disconnect")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IntegrationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Disconnect(Guid id)
    {
        var integration = await _integrationRepository.GetByIdAsync(id);
        if (integration is null)
            return NotFound(new { error = "Integration not found." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        var (userId, userName) = GetCurrentUser();

        integration.Status = IntegrationStatus.Disconnected;
        integration.EncryptedCredentials = null;
        integration.CredentialMask = null;
        integration.DisconnectedAt = DateTimeOffset.UtcNow;

        await _integrationRepository.AddActivityLogAsync(new IntegrationActivityLog
        {
            TenantId = tenantId,
            IntegrationId = integration.Id,
            Action = IntegrationAction.Disconnected,
            PerformedByUserId = userId,
            PerformedByUserName = userName,
            Details = $"Disconnected integration '{integration.IntegrationKey}'"
        });

        await _integrationRepository.SaveChangesAsync();

        return Ok(IntegrationDto.FromEntity(integration));
    }

    /// <summary>
    /// Test an integration's connection. Decrypts credentials and simulates validation.
    /// Admin only. Returns 400 if the integration is not currently connected.
    /// </summary>
    [HttpPost("{id:guid}/test")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Test(Guid id)
    {
        var integration = await _integrationRepository.GetByIdAsync(id);
        if (integration is null)
            return NotFound(new { error = "Integration not found." });

        if (integration.Status != IntegrationStatus.Connected)
            return BadRequest(new { error = "Integration is not connected. Connect it first before testing." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
        var (userId, userName) = GetCurrentUser();

        // Decrypt credentials to verify they are valid encrypted data
        // TODO: Replace simulated test with real API validation per integration type in future version
        _encryptionService.Decrypt(integration.EncryptedCredentials!);

        await _integrationRepository.AddActivityLogAsync(new IntegrationActivityLog
        {
            TenantId = tenantId,
            IntegrationId = integration.Id,
            Action = IntegrationAction.TestSuccess,
            PerformedByUserId = userId,
            PerformedByUserName = userName,
            Details = "Connection test passed (simulated)"
        });

        await _integrationRepository.SaveChangesAsync();

        return Ok(new { success = true, message = "Connection test passed" });
    }

    /// <summary>
    /// Get activity log entries for an integration, ordered by most recent first.
    /// Any authenticated user can view activity logs.
    /// </summary>
    [HttpGet("{id:guid}/activity")]
    [ProducesResponseType(typeof(List<IntegrationActivityLogDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetActivity(Guid id)
    {
        var integration = await _integrationRepository.GetByIdAsync(id);
        if (integration is null)
            return NotFound(new { error = "Integration not found." });

        var logs = await _integrationRepository.GetActivityLogsAsync(id, 50);
        var dtos = logs.Select(IntegrationActivityLogDto.FromEntity).ToList();
        return Ok(dtos);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    private (Guid UserId, string UserName) GetCurrentUser()
    {
        var userId = GetCurrentUserId();
        var firstName = User.FindFirstValue("firstName") ?? "";
        var lastName = User.FindFirstValue("lastName") ?? "";
        var userName = $"{firstName} {lastName}".Trim();
        if (string.IsNullOrEmpty(userName))
            userName = User.FindFirstValue(ClaimTypes.Email) ?? "Unknown";
        return (userId, userName);
    }

    /// <summary>
    /// Masks credentials for safe display. Takes the first value from the credentials dictionary
    /// and returns "........" + last 4 characters. If value is shorter than 4 chars, returns "........****".
    /// </summary>
    private static string MaskCredential(Dictionary<string, string> credentials)
    {
        if (credentials.Count == 0)
            return "........****";

        var firstValue = credentials.Values.First();
        if (string.IsNullOrEmpty(firstValue) || firstValue.Length < 4)
            return "........****";

        return $"........{firstValue[^4..]}";
    }
}

// ---- DTOs ----

/// <summary>
/// Read DTO for integrations. EncryptedCredentials is NEVER mapped — only the masked value is exposed.
/// </summary>
public record IntegrationDto
{
    public Guid Id { get; init; }
    public string IntegrationKey { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? CredentialMask { get; init; }
    public Guid? ConnectedByUserId { get; init; }
    public DateTimeOffset? ConnectedAt { get; init; }
    public DateTimeOffset? DisconnectedAt { get; init; }

    /// <summary>
    /// Maps entity to DTO. SECURITY: Explicitly excludes EncryptedCredentials.
    /// Only the pre-computed CredentialMask (e.g., "........a1b2") is included.
    /// </summary>
    public static IntegrationDto FromEntity(Integration entity) => new()
    {
        Id = entity.Id,
        IntegrationKey = entity.IntegrationKey,
        Status = entity.Status.ToString(),
        CredentialMask = entity.CredentialMask,
        ConnectedByUserId = entity.ConnectedByUserId == Guid.Empty ? null : entity.ConnectedByUserId,
        ConnectedAt = entity.ConnectedAt == default ? null : entity.ConnectedAt,
        DisconnectedAt = entity.DisconnectedAt
    };
}

/// <summary>
/// Read DTO for integration activity log entries.
/// </summary>
public record IntegrationActivityLogDto
{
    public Guid Id { get; init; }
    public string Action { get; init; } = string.Empty;
    public string PerformedByUserName { get; init; } = string.Empty;
    public string? Details { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static IntegrationActivityLogDto FromEntity(IntegrationActivityLog log) => new()
    {
        Id = log.Id,
        Action = log.Action.ToString(),
        PerformedByUserName = log.PerformedByUserName,
        Details = log.Details,
        CreatedAt = log.CreatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for connecting an integration.
/// </summary>
public record ConnectIntegrationRequest
{
    public string IntegrationKey { get; init; } = string.Empty;
    public Dictionary<string, string> Credentials { get; init; } = new();
}

// ---- FluentValidation ----

/// <summary>
/// Validates ConnectIntegrationRequest: integration key required, credentials non-empty.
/// </summary>
public class ConnectIntegrationValidator : AbstractValidator<ConnectIntegrationRequest>
{
    public ConnectIntegrationValidator()
    {
        RuleFor(x => x.IntegrationKey)
            .NotEmpty().WithMessage("Integration key is required.")
            .MaximumLength(50).WithMessage("Integration key must be 50 characters or fewer.");

        RuleFor(x => x.Credentials)
            .NotEmpty().WithMessage("At least one credential entry is required.")
            .Must(c => c.Count > 0).WithMessage("Credentials dictionary must contain at least one entry.");
    }
}
