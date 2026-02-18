using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for generic entity attachment operations (upload, list, download, delete).
/// Attachments are polymorphic — any CRM entity type can have attachments via EntityType + EntityId.
/// Uses IFileStorageService for tenant-partitioned file storage.
/// </summary>
[ApiController]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private static readonly string[] AllowedEntityTypes =
        { "company", "contact", "deal", "quote", "activity", "request", "note" };

    private static readonly string[] DangerousExtensions =
        { ".exe", ".bat", ".cmd", ".ps1", ".sh" };

    private readonly IFileStorageService _fileStorageService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AttachmentsController> _logger;

    public AttachmentsController(
        IFileStorageService fileStorageService,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<AttachmentsController> logger)
    {
        _fileStorageService = fileStorageService;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Uploads a file attachment to any entity.
    /// Max file size: 25MB. Dangerous extensions (.exe, .bat, .cmd, .ps1, .sh) rejected.
    /// </summary>
    [HttpPost("api/{entityType}/{entityId:guid}/attachments")]
    [RequestSizeLimit(26_214_400)] // 25MB + overhead
    [ProducesResponseType(typeof(AttachmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upload(string entityType, Guid entityId, IFormFile file)
    {
        // Validate entity type
        if (!AllowedEntityTypes.Contains(entityType.ToLowerInvariant()))
            return BadRequest(new { error = $"Invalid entity type '{entityType}'. Must be one of: {string.Join(", ", AllowedEntityTypes)}." });

        // Validate file
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is required." });

        const long maxFileSize = 25 * 1024 * 1024; // 25MB
        if (file.Length > maxFileSize)
            return BadRequest(new { error = "File size exceeds the 25MB limit." });

        // Reject dangerous extensions
        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
        if (DangerousExtensions.Contains(extension))
            return BadRequest(new { error = $"File type '{extension}' is not allowed." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        // Build storage path: {tenantId}/attachments/{entityType}/{entityId}/{guid}_{originalFileName}
        var storageName = $"{Guid.NewGuid()}_{file.FileName}";
        var category = $"attachments/{entityType.ToLowerInvariant()}/{entityId}";

        // Read file data
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var fileData = memoryStream.ToArray();

        var storagePath = await _fileStorageService.SaveFileAsync(
            tenantId.ToString(), category, storageName, fileData);

        // Normalize entity type to PascalCase for consistent storage
        var normalizedEntityType = char.ToUpper(entityType[0]) + entityType[1..].ToLowerInvariant();

        var attachment = new Attachment
        {
            TenantId = tenantId,
            EntityType = normalizedEntityType,
            EntityId = entityId,
            FileName = file.FileName,
            StoragePath = storagePath,
            ContentType = file.ContentType,
            FileSizeBytes = file.Length,
            UploadedById = userId
        };

        _db.Attachments.Add(attachment);
        await _db.SaveChangesAsync();

        // Resolve uploader name
        var uploaderName = await _db.Users
            .Where(u => u.Id == userId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync();

        var dto = new AttachmentDto
        {
            Id = attachment.Id,
            FileName = attachment.FileName,
            ContentType = attachment.ContentType,
            FileSizeBytes = attachment.FileSizeBytes,
            UploadedByName = uploaderName,
            UploadedAt = attachment.UploadedAt
        };

        _logger.LogInformation("Attachment '{FileName}' uploaded to {EntityType}/{EntityId}",
            file.FileName, normalizedEntityType, entityId);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    /// <summary>
    /// Lists attachments for an entity.
    /// </summary>
    [HttpGet("api/{entityType}/{entityId:guid}/attachments")]
    [ProducesResponseType(typeof(List<AttachmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListForEntity(string entityType, Guid entityId)
    {
        // Validate entity type
        if (!AllowedEntityTypes.Contains(entityType.ToLowerInvariant()))
            return BadRequest(new { error = $"Invalid entity type '{entityType}'." });

        var normalizedEntityType = char.ToUpper(entityType[0]) + entityType[1..].ToLowerInvariant();

        var attachments = await _db.Attachments
            .Include(a => a.UploadedBy)
            .Where(a => a.EntityType == normalizedEntityType && a.EntityId == entityId)
            .OrderByDescending(a => a.UploadedAt)
            .Select(a => new AttachmentDto
            {
                Id = a.Id,
                FileName = a.FileName,
                ContentType = a.ContentType,
                FileSizeBytes = a.FileSizeBytes,
                UploadedByName = a.UploadedBy != null
                    ? (a.UploadedBy.FirstName + " " + a.UploadedBy.LastName).Trim()
                    : null,
                UploadedAt = a.UploadedAt
            })
            .ToListAsync();

        return Ok(attachments);
    }

    /// <summary>
    /// Downloads a single attachment by ID.
    /// Returns the file with correct content type and Content-Disposition header.
    /// </summary>
    [HttpGet("api/attachments/{id:guid}/download")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(Guid id)
    {
        var attachment = await _db.Attachments.FirstOrDefaultAsync(a => a.Id == id);
        if (attachment is null)
            return NotFound(new { error = "Attachment not found." });

        var fileData = await _fileStorageService.GetFileAsync(attachment.StoragePath);
        if (fileData is null)
            return NotFound(new { error = "Attachment file not found in storage." });

        return File(fileData, attachment.ContentType, attachment.FileName);
    }

    /// <summary>
    /// Deletes an attachment. Author-only or admin.
    /// Removes both the file from storage and the database record.
    /// </summary>
    [HttpDelete("api/attachments/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var attachment = await _db.Attachments.FirstOrDefaultAsync(a => a.Id == id);
        if (attachment is null)
            return NotFound(new { error = "Attachment not found." });

        var userId = GetCurrentUserId();

        // Author-only or admin
        var isAdmin = User.IsInRole("Admin");
        if (attachment.UploadedById != userId && !isAdmin)
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "Only the uploader or admin can delete this attachment." });

        // Delete file from storage first, then remove record
        await _fileStorageService.DeleteFileAsync(attachment.StoragePath);

        _db.Attachments.Remove(attachment);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Attachment {AttachmentId} deleted from {EntityType}/{EntityId}",
            id, attachment.EntityType, attachment.EntityId);

        return NoContent();
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
/// DTO for attachment list/detail responses.
/// </summary>
public record AttachmentDto
{
    public Guid Id { get; init; }
    public string FileName { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public long FileSizeBytes { get; init; }
    public string? UploadedByName { get; init; }
    public DateTimeOffset UploadedAt { get; init; }
}
