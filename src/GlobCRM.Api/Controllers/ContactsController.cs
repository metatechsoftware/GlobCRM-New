using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Contact CRUD operations with permission enforcement,
/// ownership scope checking, custom field validation, and timeline generation.
/// Contacts can be optionally linked to a Company via CompanyId.
/// </summary>
[ApiController]
[Route("api/contacts")]
[Authorize]
public class ContactsController : ControllerBase
{
    private readonly IContactRepository _contactRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ContactsController> _logger;

    public ContactsController(
        IContactRepository contactRepository,
        ICompanyRepository companyRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<ContactsController> logger)
    {
        _contactRepository = contactRepository;
        _companyRepository = companyRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    // ---- CRUD Endpoints ----

    /// <summary>
    /// Lists contacts with server-side filtering, sorting, pagination, and ownership scope.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(PagedResult<ContactListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _contactRepository.GetPagedAsync(
            queryParams, permission.Scope, userId, teamMemberIds);

        var dtoResult = new PagedResult<ContactListDto>
        {
            Items = pagedResult.Items.Select(ContactListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single contact by ID with ownership scope verification.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(ContactDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var contact = await _contactRepository.GetByIdAsync(id);
        if (contact is null)
            return NotFound(new { error = "Contact not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(contact.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var dto = ContactDetailDto.FromEntity(contact);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new contact with custom field validation and optional company link.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Contact:Create")]
    [ProducesResponseType(typeof(ContactListDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateContactRequest request)
    {
        // Validate request
        var validator = new CreateContactRequestValidator();
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
            var cfErrors = await _customFieldValidator.ValidateAsync("Contact", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Validate CompanyId exists if provided
        if (request.CompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(request.CompanyId.Value);
            if (company is null)
                return BadRequest(new { error = "Company not found." });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var contact = new Contact
        {
            TenantId = tenantId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            MobilePhone = request.MobilePhone,
            JobTitle = request.JobTitle,
            Department = request.Department,
            Address = request.Address,
            City = request.City,
            State = request.State,
            Country = request.Country,
            PostalCode = request.PostalCode,
            Description = request.Description,
            CompanyId = request.CompanyId,
            OwnerId = userId,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _contactRepository.CreateAsync(contact);

        _logger.LogInformation(
            "Contact created: {ContactName} ({ContactId})", created.FullName, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            ContactListDto.FromEntity(created));
    }

    /// <summary>
    /// Updates an existing contact with ownership scope verification and custom field validation.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Contact:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateContactRequest request)
    {
        var contact = await _contactRepository.GetByIdAsync(id);
        if (contact is null)
            return NotFound(new { error = "Contact not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "Edit");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(contact.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Contact", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Validate CompanyId exists if provided
        if (request.CompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(request.CompanyId.Value);
            if (company is null)
                return BadRequest(new { error = "Company not found." });
        }

        // Update fields
        contact.FirstName = request.FirstName;
        contact.LastName = request.LastName;
        contact.Email = request.Email;
        contact.Phone = request.Phone;
        contact.MobilePhone = request.MobilePhone;
        contact.JobTitle = request.JobTitle;
        contact.Department = request.Department;
        contact.Address = request.Address;
        contact.City = request.City;
        contact.State = request.State;
        contact.Country = request.Country;
        contact.PostalCode = request.PostalCode;
        contact.Description = request.Description;
        contact.CompanyId = request.CompanyId;

        if (request.CustomFields is not null)
            contact.CustomFields = request.CustomFields;

        await _contactRepository.UpdateAsync(contact);

        _logger.LogInformation("Contact updated: {ContactId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a contact with ownership scope verification.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Contact:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var contact = await _contactRepository.GetByIdAsync(id);
        if (contact is null)
            return NotFound(new { error = "Contact not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(contact.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _contactRepository.DeleteAsync(id);

        _logger.LogInformation("Contact deleted: {ContactId}", id);

        return NoContent();
    }

    // ---- Timeline ----

    /// <summary>
    /// Returns chronological timeline events for a contact including creation, updates, and company link.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Contact:View")]
    [ProducesResponseType(typeof(List<TimelineEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var contact = await _contactRepository.GetByIdAsync(id);
        if (contact is null)
            return NotFound(new { error = "Contact not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(contact.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<TimelineEntryDto>();

        // Entity creation
        entries.Add(new TimelineEntryDto
        {
            Id = Guid.NewGuid(),
            Type = "created",
            Title = "Contact created",
            Description = $"Contact '{contact.FullName}' was created.",
            Timestamp = contact.CreatedAt,
            UserId = contact.OwnerId,
            UserName = contact.Owner != null
                ? $"{contact.Owner.FirstName} {contact.Owner.LastName}".Trim()
                : null
        });

        // Entity update (if UpdatedAt differs from CreatedAt)
        if (contact.UpdatedAt > contact.CreatedAt.AddSeconds(1))
        {
            entries.Add(new TimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "updated",
                Title = "Contact updated",
                Description = $"Contact '{contact.FullName}' was updated.",
                Timestamp = contact.UpdatedAt
            });
        }

        // Company link event
        if (contact.CompanyId.HasValue && contact.Company is not null)
        {
            entries.Add(new TimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "company_linked",
                Title = $"Linked to {contact.Company.Name}",
                Description = $"Contact was linked to company '{contact.Company.Name}'.",
                Timestamp = contact.CreatedAt
            });
        }

        // Sort by timestamp descending
        var sorted = entries.OrderByDescending(e => e.Timestamp).ToList();

        return Ok(sorted);
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
/// Summary DTO for contact list views.
/// </summary>
public record ContactListDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? JobTitle { get; init; }
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public string? OwnerName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ContactListDto FromEntity(Contact entity) => new()
    {
        Id = entity.Id,
        FirstName = entity.FirstName,
        LastName = entity.LastName,
        FullName = entity.FullName,
        Email = entity.Email,
        Phone = entity.Phone,
        JobTitle = entity.JobTitle,
        CompanyId = entity.CompanyId,
        CompanyName = entity.Company?.Name,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for contact detail view including custom fields.
/// </summary>
public record ContactDetailDto
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
    public string? OwnerName { get; init; }
    public Guid? OwnerId { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ContactDetailDto FromEntity(Contact entity) => new()
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
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        OwnerId = entity.OwnerId,
        CustomFields = entity.CustomFields,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a contact.
/// </summary>
public record CreateContactRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
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
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a contact.
/// </summary>
public record UpdateContactRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
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
    public Dictionary<string, object?>? CustomFields { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateContactRequest.
/// </summary>
public class CreateContactRequestValidator : AbstractValidator<CreateContactRequest>
{
    public CreateContactRequestValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name must be at most 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name must be at most 100 characters.");
    }
}
