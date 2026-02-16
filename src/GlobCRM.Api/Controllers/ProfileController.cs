using System.Security.Claims;
using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Images;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

// ---- DTOs ----

/// <summary>
/// Full profile representation returned from the API.
/// </summary>
public record ProfileDto
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string? JobTitle { get; init; }
    public string? Department { get; init; }
    public string? Timezone { get; init; }
    public string? Language { get; init; }
    public string? Bio { get; init; }
    public string? AvatarUrl { get; init; }
    public string? AvatarColor { get; init; }
    public Dictionary<string, string>? SocialLinks { get; init; }
    public WorkSchedule? WorkSchedule { get; init; }
    public Guid? ReportingManagerId { get; init; }
    public string? ReportingManagerName { get; init; }
    public List<string>? Skills { get; init; }
    public PreferencesDto? Preferences { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static ProfileDto FromUser(ApplicationUser user, bool includePreferences = true)
    {
        return new ProfileDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Phone = user.Phone,
            JobTitle = user.JobTitle,
            Department = user.Department,
            Timezone = user.Timezone,
            Language = user.Language,
            Bio = user.Bio,
            AvatarUrl = user.AvatarUrl,
            AvatarColor = user.AvatarColor,
            SocialLinks = user.SocialLinks,
            WorkSchedule = user.WorkSchedule,
            ReportingManagerId = user.ReportingManagerId,
            ReportingManagerName = user.ReportingManager?.FullName,
            Skills = user.Skills,
            Preferences = includePreferences ? PreferencesDto.FromData(user.Preferences) : null,
            CreatedAt = user.CreatedAt
        };
    }
}

/// <summary>
/// User preferences DTO (theme, locale, notifications).
/// </summary>
public record PreferencesDto
{
    public string Theme { get; init; } = "light";
    public string Language { get; init; } = "en";
    public string Timezone { get; init; } = "UTC";
    public string DateFormat { get; init; } = "MM/dd/yyyy";
    public Dictionary<string, bool> EmailNotifications { get; init; } = new();

    public static PreferencesDto FromData(UserPreferencesData data)
    {
        return new PreferencesDto
        {
            Theme = data.Theme,
            Language = data.Language,
            Timezone = data.Timezone,
            DateFormat = data.DateFormat,
            EmailNotifications = data.EmailNotifications
        };
    }
}

/// <summary>
/// Request body for updating profile information.
/// </summary>
public record UpdateProfileRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string? JobTitle { get; init; }
    public string? Department { get; init; }
    public string? Timezone { get; init; }
    public string? Language { get; init; }
    public string? Bio { get; init; }
    public Dictionary<string, string>? SocialLinks { get; init; }
    public WorkSchedule? WorkSchedule { get; init; }
    public Guid? ReportingManagerId { get; init; }
    public List<string>? Skills { get; init; }
}

/// <summary>
/// FluentValidation validator for UpdateProfileRequest.
/// </summary>
public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(50).WithMessage("First name cannot exceed 50 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(50).WithMessage("Last name cannot exceed 50 characters.");

        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters.")
            .When(x => x.Phone != null);

        RuleFor(x => x.JobTitle)
            .MaximumLength(100).WithMessage("Job title cannot exceed 100 characters.")
            .When(x => x.JobTitle != null);

        RuleFor(x => x.Department)
            .MaximumLength(100).WithMessage("Department cannot exceed 100 characters.")
            .When(x => x.Department != null);

        RuleFor(x => x.Bio)
            .MaximumLength(1000).WithMessage("Bio cannot exceed 1000 characters.")
            .When(x => x.Bio != null);
    }
}

/// <summary>
/// Request body for updating preferences. All fields optional (partial merge).
/// </summary>
public record UpdatePreferencesRequest
{
    public string? Theme { get; init; }
    public string? Language { get; init; }
    public string? Timezone { get; init; }
    public string? DateFormat { get; init; }
    public Dictionary<string, bool>? EmailNotifications { get; init; }
}

// ---- Controller ----

/// <summary>
/// REST endpoints for user profile management, avatar upload, and preferences.
/// GET    /api/profile                 - Get current user's profile
/// GET    /api/profile/{userId}        - Get a user's public profile
/// PUT    /api/profile                 - Update current user's profile
/// POST   /api/profile/avatar          - Upload avatar image
/// DELETE /api/profile/avatar          - Remove avatar
/// GET    /api/profile/preferences     - Get current user's preferences
/// PUT    /api/profile/preferences     - Update user preferences (partial merge)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AvatarService _avatarService;
    private readonly IFileStorageService _fileStorage;
    private readonly ITenantProvider _tenantProvider;
    private readonly IValidator<UpdateProfileRequest> _profileValidator;
    private readonly ILogger<ProfileController> _logger;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/webp"
    };

    private const long MaxAvatarSize = 5 * 1024 * 1024; // 5 MB

    public ProfileController(
        UserManager<ApplicationUser> userManager,
        AvatarService avatarService,
        IFileStorageService fileStorage,
        ITenantProvider tenantProvider,
        IValidator<UpdateProfileRequest> profileValidator,
        ILogger<ProfileController> logger)
    {
        _userManager = userManager;
        _avatarService = avatarService;
        _fileStorage = fileStorage;
        _tenantProvider = tenantProvider;
        _profileValidator = profileValidator;
        _logger = logger;
    }

    /// <summary>
    /// Gets the current user's full profile including preferences.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetProfile()
    {
        var user = await GetCurrentUserWithManagerAsync();
        if (user == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        return Ok(ProfileDto.FromUser(user, includePreferences: true));
    }

    /// <summary>
    /// Gets a user's public profile (excludes private preferences).
    /// Verifies the target user is in the same organization (tenant isolation).
    /// </summary>
    [HttpGet("{userId:guid}")]
    [ProducesResponseType(typeof(ProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetPublicProfile(Guid userId)
    {
        var currentUser = await GetCurrentUserAsync();
        if (currentUser == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        var targetUser = await _userManager.FindByIdAsync(userId.ToString());
        if (targetUser == null || targetUser.OrganizationId != currentUser.OrganizationId)
        {
            return NotFound(new { error = "User not found." });
        }

        // If requesting own profile, include preferences
        var isSelf = targetUser.Id == currentUser.Id;
        return Ok(ProfileDto.FromUser(targetUser, includePreferences: isSelf));
    }

    /// <summary>
    /// Updates the current user's profile information.
    /// Does NOT allow changing Email (separate flow).
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var validationResult = await _profileValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        // Update properties
        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.Phone = request.Phone;
        user.JobTitle = request.JobTitle;
        user.Department = request.Department;
        user.Timezone = request.Timezone;
        user.Language = request.Language;
        user.Bio = request.Bio;
        user.SocialLinks = request.SocialLinks;
        user.WorkSchedule = request.WorkSchedule;
        user.ReportingManagerId = request.ReportingManagerId;
        user.Skills = request.Skills;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                errors = result.Errors.Select(e => new { field = e.Code, message = e.Description })
            });
        }

        _logger.LogInformation("Profile updated for user {UserId}", user.Id);

        return Ok(ProfileDto.FromUser(user, includePreferences: true));
    }

    /// <summary>
    /// Uploads an avatar image. Accepts multipart/form-data with a single file named "avatar".
    /// Validates file type (png, jpeg, webp) and size (max 5MB).
    /// Processes to 256px (full) and 64px (thumb) WebP via AvatarService.
    /// </summary>
    [HttpPost("avatar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [RequestSizeLimit(MaxAvatarSize + 1024)] // Allow small overhead for multipart headers
    public async Task<IActionResult> UploadAvatar(
        IFormFile avatar,
        CancellationToken cancellationToken)
    {
        if (avatar == null || avatar.Length == 0)
        {
            return BadRequest(new { error = "No avatar file provided." });
        }

        if (avatar.Length > MaxAvatarSize)
        {
            return BadRequest(new { error = "Avatar file must be 5MB or smaller." });
        }

        if (!AllowedContentTypes.Contains(avatar.ContentType))
        {
            return BadRequest(new { error = "Avatar must be PNG, JPEG, or WebP format." });
        }

        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
        {
            return BadRequest(new { error = "Tenant context not established." });
        }

        using var stream = avatar.OpenReadStream();
        var (fullPath, _) = await _avatarService.ProcessAndSaveAvatarAsync(
            tenantId.Value.ToString(), user.Id, stream, cancellationToken);

        user.AvatarUrl = fullPath;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("Avatar uploaded for user {UserId}", user.Id);

        return Ok(new { avatarUrl = fullPath });
    }

    /// <summary>
    /// Removes the current user's avatar image.
    /// Deletes the file from storage and clears the AvatarUrl field.
    /// </summary>
    [HttpDelete("avatar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteAvatar(CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        // Delete existing avatar files if present
        if (!string.IsNullOrEmpty(user.AvatarUrl))
        {
            await _fileStorage.DeleteFileAsync(user.AvatarUrl, cancellationToken);

            // Also delete thumbnail (replace .webp with _thumb.webp)
            var thumbPath = user.AvatarUrl.Replace(".webp", "_thumb.webp");
            await _fileStorage.DeleteFileAsync(thumbPath, cancellationToken);
        }

        user.AvatarUrl = null;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("Avatar deleted for user {UserId}", user.Id);

        return NoContent();
    }

    /// <summary>
    /// Gets the current user's preferences.
    /// </summary>
    [HttpGet("preferences")]
    [ProducesResponseType(typeof(PreferencesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetPreferences()
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        return Ok(PreferencesDto.FromData(user.Preferences));
    }

    /// <summary>
    /// Updates the current user's preferences. Merges partial updates --
    /// only provided fields are overwritten, unset fields retain existing values.
    /// </summary>
    [HttpPut("preferences")]
    [ProducesResponseType(typeof(PreferencesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdatePreferences(
        [FromBody] UpdatePreferencesRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized(new { error = "User not found." });
        }

        var prefs = user.Preferences;

        // Merge: only overwrite fields that were explicitly provided
        if (request.Theme != null)
            prefs.Theme = request.Theme;

        if (request.Language != null)
            prefs.Language = request.Language;

        if (request.Timezone != null)
            prefs.Timezone = request.Timezone;

        if (request.DateFormat != null)
            prefs.DateFormat = request.DateFormat;

        if (request.EmailNotifications != null)
        {
            // Merge notification settings: update existing keys, add new ones
            foreach (var kvp in request.EmailNotifications)
            {
                prefs.EmailNotifications[kvp.Key] = kvp.Value;
            }
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                errors = result.Errors.Select(e => new { field = e.Code, message = e.Description })
            });
        }

        _logger.LogInformation("Preferences updated for user {UserId}", user.Id);

        return Ok(PreferencesDto.FromData(prefs));
    }

    // ---- Private Helpers ----

    /// <summary>
    /// Gets the current authenticated user from UserManager.
    /// </summary>
    private async Task<ApplicationUser?> GetCurrentUserAsync()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return null;

        return await _userManager.FindByIdAsync(userId.Value.ToString());
    }

    /// <summary>
    /// Gets the current authenticated user with ReportingManager navigation loaded.
    /// </summary>
    private async Task<ApplicationUser?> GetCurrentUserWithManagerAsync()
    {
        // UserManager doesn't support Include, so we find normally.
        // ReportingManagerName will be resolved separately if needed.
        var user = await GetCurrentUserAsync();
        if (user?.ReportingManagerId != null)
        {
            var manager = await _userManager.FindByIdAsync(user.ReportingManagerId.Value.ToString());
            if (manager != null)
            {
                // Set navigation property for DTO mapping
                user.ReportingManager = manager;
            }
        }
        return user;
    }

    /// <summary>
    /// Extracts the current user's ID from JWT claims.
    /// </summary>
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        return null;
    }
}
