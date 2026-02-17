using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Gmail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Handles the Gmail OAuth 2.0 lifecycle: connect, callback, disconnect, status, and manual sync.
/// The connect endpoint returns an authorization URL; callback receives Google's redirect after consent;
/// disconnect revokes the token and deletes the account; sync triggers an on-demand sync cycle.
/// </summary>
[ApiController]
[Route("api/email-accounts")]
[Authorize]
public class EmailAccountsController : ControllerBase
{
    private readonly GmailOAuthService _oauthService;
    private readonly TokenEncryptionService _tokenEncryption;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly GmailServiceFactory _serviceFactory;
    private readonly GmailSyncService _syncService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<EmailAccountsController> _logger;

    public EmailAccountsController(
        GmailOAuthService oauthService,
        TokenEncryptionService tokenEncryption,
        IEmailAccountRepository emailAccountRepository,
        GmailServiceFactory serviceFactory,
        GmailSyncService syncService,
        ITenantProvider tenantProvider,
        ILogger<EmailAccountsController> logger)
    {
        _oauthService = oauthService;
        _tokenEncryption = tokenEncryption;
        _emailAccountRepository = emailAccountRepository;
        _serviceFactory = serviceFactory;
        _syncService = syncService;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// Returns the current user's email account connection status.
    /// If no account exists: { connected: false }.
    /// If connected: { connected: true, gmailAddress, lastSyncAt, syncStatus, errorMessage }.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(EmailAccountStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStatus()
    {
        var userId = GetCurrentUserId();
        var account = await _emailAccountRepository.GetByUserIdAsync(userId);

        if (account is null)
        {
            return Ok(new EmailAccountStatusDto { Connected = false });
        }

        return Ok(new EmailAccountStatusDto
        {
            Connected = true,
            GmailAddress = account.GmailAddress,
            LastSyncAt = account.LastSyncAt,
            SyncStatus = account.SyncStatus.ToString(),
            ErrorMessage = account.ErrorMessage
        });
    }

    /// <summary>
    /// Generates a Google OAuth authorization URL and returns it.
    /// The frontend redirects the user's browser to this URL for consent.
    /// Uses a random state parameter for CSRF protection with the userId encoded.
    /// </summary>
    [HttpGet("connect")]
    [ProducesResponseType(typeof(ConnectResponseDto), StatusCodes.Status200OK)]
    public IActionResult Connect()
    {
        var userId = GetCurrentUserId();

        // Generate state parameter: userId + random nonce for CSRF protection
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var state = $"{userId}|{nonce}";

        var authorizationUrl = _oauthService.GetAuthorizationUrl(state);

        _logger.LogInformation("Gmail OAuth connect initiated for user {UserId}", userId);

        return Ok(new ConnectResponseDto { AuthorizationUrl = authorizationUrl });
    }

    /// <summary>
    /// OAuth callback endpoint. Google redirects here after user consents.
    /// Exchanges the authorization code for tokens, encrypts them, creates/updates EmailAccount,
    /// and redirects the browser back to the Angular settings page.
    /// NOTE: This is a GET endpoint that returns a Redirect (not JSON).
    /// </summary>
    [HttpGet("callback")]
    [AllowAnonymous] // OAuth redirect comes from Google, not the SPA
    public async Task<IActionResult> Callback(
        [FromQuery] string code,
        [FromQuery] string state,
        [FromQuery] string? error = null)
    {
        // Handle Google OAuth errors
        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("Gmail OAuth error: {Error}", error);
            return Redirect("/settings/email-accounts?error=" + Uri.EscapeDataString(error));
        }

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
        {
            return Redirect("/settings/email-accounts?error=invalid_callback");
        }

        // Parse state to extract userId
        var stateParts = state.Split('|', 2);
        if (stateParts.Length != 2 || !Guid.TryParse(stateParts[0], out var userId))
        {
            _logger.LogWarning("Invalid OAuth state parameter: {State}", state);
            return Redirect("/settings/email-accounts?error=invalid_state");
        }

        try
        {
            // Exchange authorization code for tokens
            var tokenResponse = await _oauthService.ExchangeCodeAsync(code);

            // Encrypt tokens for secure storage
            var encryptedAccessToken = _tokenEncryption.Encrypt(tokenResponse.AccessToken);
            var encryptedRefreshToken = _tokenEncryption.Encrypt(tokenResponse.RefreshToken);

            // Get Gmail address from the user's profile
            var tempAccount = new EmailAccount
            {
                EncryptedAccessToken = encryptedAccessToken,
                EncryptedRefreshToken = encryptedRefreshToken,
                TokenIssuedAt = tokenResponse.IssuedUtc != default
                    ? new DateTimeOffset(tokenResponse.IssuedUtc, TimeSpan.Zero)
                    : DateTimeOffset.UtcNow
            };
            var gmail = await _serviceFactory.CreateForAccountAsync(tempAccount);
            var profile = await gmail.Users.GetProfile("me").ExecuteAsync();
            var gmailAddress = profile.EmailAddress;

            // Get tenant ID -- look up the user's tenant from the database
            // In OAuth callback context, tenant may not be resolved from subdomain,
            // so we query the user's organization membership
            var tenantId = await ResolveTenantIdForUserAsync(userId);

            // Create or update EmailAccount
            var existingAccount = await _emailAccountRepository.GetByUserIdAsync(userId);
            if (existingAccount is not null)
            {
                existingAccount.GmailAddress = gmailAddress;
                existingAccount.EncryptedAccessToken = encryptedAccessToken;
                existingAccount.EncryptedRefreshToken = encryptedRefreshToken;
                existingAccount.TokenIssuedAt = tempAccount.TokenIssuedAt;
                existingAccount.TokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresInSeconds ?? 3600);
                existingAccount.SyncStatus = EmailSyncStatus.Active;
                existingAccount.ErrorMessage = null;
                await _emailAccountRepository.UpdateAsync(existingAccount);
            }
            else
            {
                var newAccount = new EmailAccount
                {
                    TenantId = tenantId,
                    UserId = userId,
                    GmailAddress = gmailAddress,
                    EncryptedAccessToken = encryptedAccessToken,
                    EncryptedRefreshToken = encryptedRefreshToken,
                    TokenIssuedAt = tempAccount.TokenIssuedAt,
                    TokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresInSeconds ?? 3600),
                    SyncStatus = EmailSyncStatus.Active
                };
                await _emailAccountRepository.CreateAsync(newAccount);
            }

            _logger.LogInformation("Gmail account connected for user {UserId}: {GmailAddress}", userId, gmailAddress);

            return Redirect("/settings/email-accounts?connected=true");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gmail OAuth callback failed for user {UserId}", userId);
            return Redirect("/settings/email-accounts?error=" + Uri.EscapeDataString(ex.Message));
        }
    }

    /// <summary>
    /// Disconnects the current user's Gmail account.
    /// Revokes the token at Google and deletes the EmailAccount entity
    /// (cascade deletes all EmailMessages).
    /// </summary>
    [HttpPost("disconnect")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Disconnect()
    {
        var userId = GetCurrentUserId();
        var account = await _emailAccountRepository.GetByUserIdAsync(userId);

        if (account is null)
            return NotFound(new { error = "No Gmail account connected." });

        // Revoke token at Google (best-effort -- do not fail disconnect on revocation error)
        try
        {
            var refreshToken = _tokenEncryption.Decrypt(account.EncryptedRefreshToken);
            await _oauthService.RevokeTokenAsync(refreshToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to revoke Gmail token for user {UserId}, proceeding with disconnect", userId);
        }

        // Delete account (cascade deletes messages)
        await _emailAccountRepository.DeleteAsync(account.Id);

        _logger.LogInformation("Gmail account disconnected for user {UserId}", userId);

        return NoContent();
    }

    /// <summary>
    /// Triggers an on-demand sync for the current user's Gmail account.
    /// Does not wait for the background service timer.
    /// </summary>
    [HttpPost("sync")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TriggerSync()
    {
        var userId = GetCurrentUserId();
        var account = await _emailAccountRepository.GetByUserIdAsync(userId);

        if (account is null)
            return NotFound(new { error = "No Gmail account connected." });

        if (account.SyncStatus == EmailSyncStatus.Disconnected)
            return BadRequest(new { error = "Gmail account is disconnected." });

        try
        {
            await _syncService.SyncAccountAsync(account, CancellationToken.None);

            return Ok(new
            {
                message = "Sync completed successfully.",
                lastSyncAt = account.LastSyncAt,
                syncStatus = account.SyncStatus.ToString()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual sync failed for user {UserId}", userId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = "Sync failed: " + ex.Message });
        }
    }

    // ---- Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Resolves the tenant ID for a user during OAuth callback context where
    /// tenant middleware may not have resolved the tenant from the subdomain.
    /// Falls back to the tenant provider if available, otherwise queries the database.
    /// </summary>
    private async Task<Guid> ResolveTenantIdForUserAsync(Guid userId)
    {
        // Try tenant provider first (works when subdomain/header resolved)
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId.HasValue)
            return tenantId.Value;

        // Fallback: look up the user's organization membership from the database
        // This handles the case where the OAuth callback comes from Google without tenant context
        _logger.LogWarning("Tenant context not available during OAuth callback for user {UserId}, using fallback lookup", userId);

        // Resolve from DI -- we need ApplicationDbContext for this fallback
        var dbContext = HttpContext.RequestServices
            .GetRequiredService<GlobCRM.Infrastructure.Persistence.ApplicationDbContext>();

        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == userId)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync();

        if (user is null || user.OrganizationId == Guid.Empty)
            throw new InvalidOperationException($"Cannot resolve tenant for user {userId}");

        return user.OrganizationId;
    }
}

// ---- DTOs ----

/// <summary>
/// Status DTO for the email account connection.
/// </summary>
public record EmailAccountStatusDto
{
    public bool Connected { get; init; }
    public string? GmailAddress { get; init; }
    public DateTimeOffset? LastSyncAt { get; init; }
    public string? SyncStatus { get; init; }
    public string? ErrorMessage { get; init; }
}

/// <summary>
/// Response DTO from the connect endpoint containing the OAuth authorization URL.
/// </summary>
public record ConnectResponseDto
{
    public string AuthorizationUrl { get; init; } = string.Empty;
}
