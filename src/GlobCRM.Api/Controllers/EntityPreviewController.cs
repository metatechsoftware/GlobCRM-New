using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Single polymorphic preview endpoint for all 6 entity types.
/// Returns entity-appropriate slim DTOs with RBAC scope checking,
/// association summaries, pipeline stage info, pinned custom fields,
/// and the last 3 recent activities.
/// </summary>
[ApiController]
[Route("api/entities")]
[Authorize]
public class EntityPreviewController : ControllerBase
{
    private readonly IContactRepository _contactRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IDealRepository _dealRepository;
    private readonly ILeadRepository _leadRepository;
    private readonly IActivityRepository _activityRepository;
    private readonly IProductRepository _productRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<EntityPreviewController> _logger;

    public EntityPreviewController(
        IContactRepository contactRepository,
        ICompanyRepository companyRepository,
        IDealRepository dealRepository,
        ILeadRepository leadRepository,
        IActivityRepository activityRepository,
        IProductRepository productRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        ApplicationDbContext db,
        ILogger<EntityPreviewController> logger)
    {
        _contactRepository = contactRepository;
        _companyRepository = companyRepository;
        _dealRepository = dealRepository;
        _leadRepository = leadRepository;
        _activityRepository = activityRepository;
        _productRepository = productRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Returns a preview DTO for any supported entity type.
    /// Per-type RBAC scope checking is done internally (not via blanket policy attribute)
    /// so that a user with Deal:View but not Contact:View can still preview deals.
    /// </summary>
    [HttpGet("{type}/{id:guid}/preview")]
    [ProducesResponseType(typeof(EntityPreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPreview(string type, Guid id)
    {
        var userId = GetCurrentUserId();

        return type.ToLower() switch
        {
            "contact" => await GetContactPreview(id, userId),
            "company" => await GetCompanyPreview(id, userId),
            "deal" => await GetDealPreview(id, userId),
            "lead" => await GetLeadPreview(id, userId),
            "activity" => await GetActivityPreview(id, userId),
            "product" => await GetProductPreview(id, userId),
            _ => BadRequest(new { error = $"Unknown entity type: {type}" }),
        };
    }

    // ---- Per-Type Preview Methods ----

    private async Task<IActionResult> GetContactPreview(Guid id, Guid userId)
    {
        var contact = await _contactRepository.GetByIdAsync(id);
        if (contact is null)
            return NotFound(new { error = "This Contact was not found. It may have been deleted or merged." });

        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Contact", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
        if (!IsWithinScope(contact.OwnerId, permission.Scope, userId, teamMemberIds))
            return StatusCode(403, new { error = "You don't have permission to view this Contact." });

        var pinnedFields = await GetPinnedCustomFields("Contact", contact.CustomFields);
        var associations = await GetContactAssociations(id);
        var recentActivities = await GetRecentActivities("Contact", id);
        var owner = contact.OwnerId.HasValue ? await GetOwnerInfo(contact.OwnerId.Value) : null;

        return Ok(new EntityPreviewDto
        {
            Id = contact.Id,
            EntityType = "Contact",
            Name = contact.FullName,
            OwnerName = owner?.Name,
            OwnerAvatarUrl = owner?.AvatarUrl,
            OwnerId = contact.OwnerId,
            Fields = new Dictionary<string, object?>
            {
                ["email"] = contact.Email,
                ["phone"] = contact.Phone,
                ["jobTitle"] = contact.JobTitle,
                ["companyName"] = contact.Company?.Name,
                ["city"] = contact.City,
            },
            PinnedCustomFields = pinnedFields,
            Associations = associations,
            RecentActivities = recentActivities,
        });
    }

    private async Task<IActionResult> GetCompanyPreview(Guid id, Guid userId)
    {
        var company = await _companyRepository.GetByIdAsync(id);
        if (company is null)
            return NotFound(new { error = "This Company was not found. It may have been deleted or merged." });

        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
        if (!IsWithinScope(company.OwnerId, permission.Scope, userId, teamMemberIds))
            return StatusCode(403, new { error = "You don't have permission to view this Company." });

        var pinnedFields = await GetPinnedCustomFields("Company", company.CustomFields);
        var associations = await GetCompanyAssociations(id);
        var recentActivities = await GetRecentActivities("Company", id);
        var owner = company.OwnerId.HasValue ? await GetOwnerInfo(company.OwnerId.Value) : null;

        return Ok(new EntityPreviewDto
        {
            Id = company.Id,
            EntityType = "Company",
            Name = company.Name,
            OwnerName = owner?.Name,
            OwnerAvatarUrl = owner?.AvatarUrl,
            OwnerId = company.OwnerId,
            Fields = new Dictionary<string, object?>
            {
                ["industry"] = company.Industry,
                ["phone"] = company.Phone,
                ["website"] = company.Website,
                ["size"] = company.Size,
                ["city"] = company.City,
                ["country"] = company.Country,
            },
            PinnedCustomFields = pinnedFields,
            Associations = associations,
            RecentActivities = recentActivities,
        });
    }

    private async Task<IActionResult> GetDealPreview(Guid id, Guid userId)
    {
        var deal = await _dealRepository.GetByIdWithLinksAsync(id);
        if (deal is null)
            return NotFound(new { error = "This Deal was not found. It may have been deleted." });

        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
        if (!IsWithinScope(deal.OwnerId, permission.Scope, userId, teamMemberIds))
            return StatusCode(403, new { error = "You don't have permission to view this Deal." });

        var pinnedFields = await GetPinnedCustomFields("Deal", deal.CustomFields);
        var associations = await GetDealAssociations(id);
        var recentActivities = await GetRecentActivities("Deal", id);
        var pipelineStage = await GetDealPipelineStage(deal);
        var owner = deal.OwnerId.HasValue ? await GetOwnerInfo(deal.OwnerId.Value) : null;

        return Ok(new EntityPreviewDto
        {
            Id = deal.Id,
            EntityType = "Deal",
            Name = deal.Title,
            OwnerName = owner?.Name,
            OwnerAvatarUrl = owner?.AvatarUrl,
            OwnerId = deal.OwnerId,
            Fields = new Dictionary<string, object?>
            {
                ["value"] = deal.Value,
                ["probability"] = deal.Probability,
                ["expectedCloseDate"] = deal.ExpectedCloseDate,
                ["stageName"] = deal.Stage?.Name,
                ["companyName"] = deal.Company?.Name,
                ["pipelineName"] = deal.Pipeline?.Name,
                ["currency"] = "USD",
            },
            PinnedCustomFields = pinnedFields,
            Associations = associations,
            PipelineStage = pipelineStage,
            RecentActivities = recentActivities,
        });
    }

    private async Task<IActionResult> GetLeadPreview(Guid id, Guid userId)
    {
        var lead = await _leadRepository.GetByIdWithDetailsAsync(id);
        if (lead is null)
            return NotFound(new { error = "This Lead was not found. It may have been deleted." });

        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Lead", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
        if (!IsWithinScope(lead.OwnerId, permission.Scope, userId, teamMemberIds))
            return StatusCode(403, new { error = "You don't have permission to view this Lead." });

        var pinnedFields = await GetPinnedCustomFields("Lead", lead.CustomFields);
        var associations = await GetLeadAssociations(id);
        var recentActivities = await GetRecentActivities("Lead", id);
        var pipelineStage = await GetLeadPipelineStage(lead);
        var owner = lead.OwnerId.HasValue ? await GetOwnerInfo(lead.OwnerId.Value) : null;

        return Ok(new EntityPreviewDto
        {
            Id = lead.Id,
            EntityType = "Lead",
            Name = lead.FullName,
            OwnerName = owner?.Name,
            OwnerAvatarUrl = owner?.AvatarUrl,
            OwnerId = lead.OwnerId,
            Fields = new Dictionary<string, object?>
            {
                ["email"] = lead.Email,
                ["phone"] = lead.Phone,
                ["companyName"] = lead.CompanyName,
                ["temperature"] = lead.Temperature.ToString(),
                ["source"] = lead.Source?.Name,
                ["stageName"] = lead.Stage?.Name,
                ["city"] = null, // Leads don't have a city field
            },
            PinnedCustomFields = pinnedFields,
            Associations = associations,
            PipelineStage = pipelineStage,
            RecentActivities = recentActivities,
        });
    }

    private async Task<IActionResult> GetActivityPreview(Guid id, Guid userId)
    {
        var activity = await _activityRepository.GetByIdWithDetailsAsync(id);
        if (activity is null)
            return NotFound(new { error = "This Activity was not found. It may have been deleted." });

        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
        if (!IsWithinActivityScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return StatusCode(403, new { error = "You don't have permission to view this Activity." });

        var pinnedFields = await GetPinnedCustomFields("Activity", activity.CustomFields);
        var associations = await GetActivityAssociations(id);
        var owner = activity.OwnerId.HasValue ? await GetOwnerInfo(activity.OwnerId.Value) : null;

        // Build related entity info from activity links
        var relatedEntityInfo = activity.Links.FirstOrDefault() is { } link
            ? $"{link.EntityType}: {link.EntityName ?? link.EntityId.ToString()}"
            : null;

        return Ok(new EntityPreviewDto
        {
            Id = activity.Id,
            EntityType = "Activity",
            Name = activity.Subject,
            OwnerName = owner?.Name,
            OwnerAvatarUrl = owner?.AvatarUrl,
            OwnerId = activity.OwnerId,
            Fields = new Dictionary<string, object?>
            {
                ["type"] = activity.Type.ToString(),
                ["status"] = activity.Status.ToString(),
                ["priority"] = activity.Priority.ToString(),
                ["dueDate"] = activity.DueDate,
                ["relatedEntityInfo"] = relatedEntityInfo,
            },
            PinnedCustomFields = pinnedFields,
            Associations = associations,
            // Activities don't have recent activities sub-list
            RecentActivities = new List<RecentActivityDto>(),
        });
    }

    private async Task<IActionResult> GetProductPreview(Guid id, Guid userId)
    {
        // Product has no OwnerId -- products are shared tenant resources.
        // Just verify the product exists.
        var product = await _productRepository.GetByIdAsync(id);
        if (product is null)
            return NotFound(new { error = "This Product was not found. It may have been deleted." });

        var pinnedFields = await GetPinnedCustomFields("Product", product.CustomFields);
        var associations = await GetProductAssociations(id);

        return Ok(new EntityPreviewDto
        {
            Id = product.Id,
            EntityType = "Product",
            Name = product.Name,
            Fields = new Dictionary<string, object?>
            {
                ["unitPrice"] = product.UnitPrice,
                ["sku"] = product.SKU,
                ["category"] = product.Category,
                ["description"] = product.Description,
            },
            PinnedCustomFields = pinnedFields,
            Associations = associations,
            RecentActivities = new List<RecentActivityDto>(),
        });
    }

    // ---- Association Queries ----

    private async Task<List<AssociationChipDto>> GetContactAssociations(Guid contactId)
    {
        var associations = new List<AssociationChipDto>();

        // Companies (via CompanyId -- a contact belongs to one company, but show it as a chip)
        var contact = await _db.Contacts.Where(c => c.Id == contactId).Select(c => new { c.CompanyId }).FirstOrDefaultAsync();
        if (contact?.CompanyId.HasValue == true)
        {
            var company = await _db.Companies.Where(c => c.Id == contact.CompanyId.Value).Select(c => new { c.Id, c.Name }).FirstOrDefaultAsync();
            if (company is not null)
            {
                associations.Add(new AssociationChipDto
                {
                    EntityType = "Company",
                    Count = 1,
                    Items = new List<AssociationItemDto> { new() { Id = company.Id, Name = company.Name } }
                });
            }
        }

        // Deals (via DealContacts)
        var dealCount = await _db.DealContacts.CountAsync(dc => dc.ContactId == contactId);
        if (dealCount > 0)
        {
            var dealItems = await _db.DealContacts
                .Where(dc => dc.ContactId == contactId)
                .OrderByDescending(dc => dc.LinkedAt)
                .Take(3)
                .Select(dc => new AssociationItemDto { Id = dc.DealId, Name = dc.Deal.Title })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Deal", Count = dealCount, Items = dealItems });
        }

        // Activities (via ActivityLinks)
        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Contact" && al.EntityId == contactId);
        if (activityCount > 0)
        {
            var activityItems = await _db.ActivityLinks
                .Where(al => al.EntityType == "Contact" && al.EntityId == contactId)
                .OrderByDescending(al => al.LinkedAt)
                .Take(3)
                .Select(al => new AssociationItemDto { Id = al.ActivityId, Name = al.Activity.Subject })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Activity", Count = activityCount, Items = activityItems });
        }

        return associations;
    }

    private async Task<List<AssociationChipDto>> GetCompanyAssociations(Guid companyId)
    {
        var associations = new List<AssociationChipDto>();

        // Contacts
        var contactCount = await _db.Contacts.CountAsync(c => c.CompanyId == companyId);
        if (contactCount > 0)
        {
            var contactItems = await _db.Contacts
                .Where(c => c.CompanyId == companyId)
                .OrderByDescending(c => c.CreatedAt)
                .Take(3)
                .Select(c => new AssociationItemDto { Id = c.Id, Name = c.FirstName + " " + c.LastName })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Contact", Count = contactCount, Items = contactItems });
        }

        // Deals
        var dealCount = await _db.Deals.CountAsync(d => d.CompanyId == companyId);
        if (dealCount > 0)
        {
            var dealItems = await _db.Deals
                .Where(d => d.CompanyId == companyId)
                .OrderByDescending(d => d.CreatedAt)
                .Take(3)
                .Select(d => new AssociationItemDto { Id = d.Id, Name = d.Title })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Deal", Count = dealCount, Items = dealItems });
        }

        // Activities (via ActivityLinks)
        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Company" && al.EntityId == companyId);
        if (activityCount > 0)
        {
            var activityItems = await _db.ActivityLinks
                .Where(al => al.EntityType == "Company" && al.EntityId == companyId)
                .OrderByDescending(al => al.LinkedAt)
                .Take(3)
                .Select(al => new AssociationItemDto { Id = al.ActivityId, Name = al.Activity.Subject })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Activity", Count = activityCount, Items = activityItems });
        }

        return associations;
    }

    private async Task<List<AssociationChipDto>> GetDealAssociations(Guid dealId)
    {
        var associations = new List<AssociationChipDto>();

        // Contacts (via DealContacts)
        var contactCount = await _db.DealContacts.CountAsync(dc => dc.DealId == dealId);
        if (contactCount > 0)
        {
            var contactItems = await _db.DealContacts
                .Where(dc => dc.DealId == dealId)
                .OrderByDescending(dc => dc.LinkedAt)
                .Take(3)
                .Select(dc => new AssociationItemDto { Id = dc.ContactId, Name = dc.Contact.FirstName + " " + dc.Contact.LastName })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Contact", Count = contactCount, Items = contactItems });
        }

        // Products (via DealProducts)
        var productCount = await _db.DealProducts.CountAsync(dp => dp.DealId == dealId);
        if (productCount > 0)
        {
            var productItems = await _db.DealProducts
                .Where(dp => dp.DealId == dealId)
                .OrderByDescending(dp => dp.LinkedAt)
                .Take(3)
                .Select(dp => new AssociationItemDto { Id = dp.ProductId, Name = dp.Product.Name })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Product", Count = productCount, Items = productItems });
        }

        // Activities (via ActivityLinks)
        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Deal" && al.EntityId == dealId);
        if (activityCount > 0)
        {
            var activityItems = await _db.ActivityLinks
                .Where(al => al.EntityType == "Deal" && al.EntityId == dealId)
                .OrderByDescending(al => al.LinkedAt)
                .Take(3)
                .Select(al => new AssociationItemDto { Id = al.ActivityId, Name = al.Activity.Subject })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Activity", Count = activityCount, Items = activityItems });
        }

        return associations;
    }

    private async Task<List<AssociationChipDto>> GetLeadAssociations(Guid leadId)
    {
        var associations = new List<AssociationChipDto>();

        // Activities (via ActivityLinks)
        var activityCount = await _db.ActivityLinks.CountAsync(al => al.EntityType == "Lead" && al.EntityId == leadId);
        if (activityCount > 0)
        {
            var activityItems = await _db.ActivityLinks
                .Where(al => al.EntityType == "Lead" && al.EntityId == leadId)
                .OrderByDescending(al => al.LinkedAt)
                .Take(3)
                .Select(al => new AssociationItemDto { Id = al.ActivityId, Name = al.Activity.Subject })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Activity", Count = activityCount, Items = activityItems });
        }

        return associations;
    }

    private async Task<List<AssociationChipDto>> GetActivityAssociations(Guid activityId)
    {
        var associations = new List<AssociationChipDto>();

        // Entity links by type (Contacts, Companies, Deals)
        var links = await _db.ActivityLinks
            .Where(al => al.ActivityId == activityId)
            .ToListAsync();

        var grouped = links.GroupBy(l => l.EntityType);
        foreach (var group in grouped)
        {
            associations.Add(new AssociationChipDto
            {
                EntityType = group.Key,
                Count = group.Count(),
                Items = group.Take(3).Select(l => new AssociationItemDto
                {
                    Id = l.EntityId,
                    Name = l.EntityName ?? l.EntityId.ToString()
                }).ToList()
            });
        }

        return associations;
    }

    private async Task<List<AssociationChipDto>> GetProductAssociations(Guid productId)
    {
        var associations = new List<AssociationChipDto>();

        // Deals (via DealProducts)
        var dealCount = await _db.DealProducts.CountAsync(dp => dp.ProductId == productId);
        if (dealCount > 0)
        {
            var dealItems = await _db.DealProducts
                .Where(dp => dp.ProductId == productId)
                .OrderByDescending(dp => dp.LinkedAt)
                .Take(3)
                .Select(dp => new AssociationItemDto { Id = dp.DealId, Name = dp.Deal.Title })
                .ToListAsync();

            associations.Add(new AssociationChipDto { EntityType = "Deal", Count = dealCount, Items = dealItems });
        }

        return associations;
    }

    // ---- Pipeline Stage Info ----

    private async Task<PipelineStagePreviewDto?> GetDealPipelineStage(Deal deal)
    {
        var stages = await _db.PipelineStages
            .Where(s => s.PipelineId == deal.PipelineId)
            .OrderBy(s => s.SortOrder)
            .Select(s => new StageInfoDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Color = s.Color,
            })
            .ToListAsync();

        var currentStage = stages.FirstOrDefault(s => s.Id == deal.PipelineStageId);

        return new PipelineStagePreviewDto
        {
            PipelineName = deal.Pipeline?.Name ?? string.Empty,
            CurrentStageId = deal.PipelineStageId,
            CurrentStageName = currentStage?.Name ?? string.Empty,
            CurrentSortOrder = currentStage?.SortOrder ?? 0,
            AllStages = stages,
        };
    }

    private async Task<PipelineStagePreviewDto?> GetLeadPipelineStage(Lead lead)
    {
        var stages = await _db.LeadStages
            .OrderBy(s => s.SortOrder)
            .Select(s => new StageInfoDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Color = s.Color,
            })
            .ToListAsync();

        var currentStage = stages.FirstOrDefault(s => s.Id == lead.LeadStageId);

        return new PipelineStagePreviewDto
        {
            PipelineName = "Lead Pipeline",
            CurrentStageId = lead.LeadStageId,
            CurrentStageName = currentStage?.Name ?? string.Empty,
            CurrentSortOrder = currentStage?.SortOrder ?? 0,
            AllStages = stages,
        };
    }

    // ---- Recent Activities ----

    private async Task<List<RecentActivityDto>> GetRecentActivities(string entityType, Guid entityId)
    {
        // Use ActivityLinks to find activities linked to this entity
        var recentActivities = await _db.ActivityLinks
            .Where(al => al.EntityType == entityType && al.EntityId == entityId)
            .OrderByDescending(al => al.Activity.CreatedAt)
            .Take(3)
            .Select(al => new RecentActivityDto
            {
                Id = al.ActivityId,
                Subject = al.Activity.Subject,
                Type = al.Activity.Type.ToString(),
                Status = al.Activity.Status.ToString(),
                CreatedAt = al.Activity.CreatedAt,
            })
            .ToListAsync();

        return recentActivities;
    }

    // ---- Pinned Custom Fields ----

    private async Task<List<CustomFieldPreviewDto>> GetPinnedCustomFields(
        string entityType, Dictionary<string, object?> customFields)
    {
        var pinnedDefinitions = await GetPinnedForPreviewAsync(entityType);

        var result = new List<CustomFieldPreviewDto>();
        foreach (var def in pinnedDefinitions)
        {
            customFields.TryGetValue(def.Name, out var value);
            result.Add(new CustomFieldPreviewDto
            {
                Label = def.Label,
                FieldType = def.FieldType.ToString(),
                Value = value,
            });
        }

        return result;
    }

    private async Task<List<CustomFieldDefinition>> GetPinnedForPreviewAsync(string entityType)
    {
        return await _db.CustomFieldDefinitions
            .Where(c => c.EntityType == entityType && c.ShowInPreview && !c.IsDeleted)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();
    }

    // ---- Owner Info ----

    private async Task<OwnerInfo?> GetOwnerInfo(Guid ownerId)
    {
        var user = await _db.Users
            .Where(u => u.Id == ownerId)
            .Select(u => new OwnerInfo
            {
                Name = (u.FirstName + " " + u.LastName).Trim(),
                AvatarUrl = u.AvatarUrl,
            })
            .FirstOrDefaultAsync();

        return user;
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

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
    /// Activity-specific scope check: checks both OwnerId AND AssignedToId.
    /// </summary>
    private static bool IsWithinActivityScope(
        Guid? ownerId,
        Guid? assignedToId,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => true,
            PermissionScope.Team =>
                ownerId == userId ||
                assignedToId == userId ||
                (ownerId.HasValue && teamMemberIds is not null && teamMemberIds.Contains(ownerId.Value)) ||
                (assignedToId.HasValue && teamMemberIds is not null && teamMemberIds.Contains(assignedToId.Value)),
            PermissionScope.Own =>
                ownerId == userId || assignedToId == userId,
            PermissionScope.None => false,
            _ => false
        };
    }

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
}

// ---- Internal Helper Records ----

internal record OwnerInfo
{
    public string Name { get; init; } = string.Empty;
    public string? AvatarUrl { get; init; }
}

// ---- DTOs (co-located per project convention) ----

/// <summary>
/// Polymorphic preview DTO returned by the entity preview endpoint.
/// Contains common fields (Id, EntityType, Name, Owner) plus per-type data
/// in the Fields dictionary, associations, pipeline stage, custom fields, and recent activities.
/// </summary>
public record EntityPreviewDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? OwnerName { get; init; }
    public string? OwnerAvatarUrl { get; init; }
    public Guid? OwnerId { get; init; }

    /// <summary>
    /// Per-entity-type key fields (flattened, nullable -- frontend renders based on EntityType).
    /// </summary>
    public Dictionary<string, object?> Fields { get; init; } = new();

    /// <summary>
    /// Pinned custom fields (ShowInPreview = true).
    /// </summary>
    public List<CustomFieldPreviewDto> PinnedCustomFields { get; init; } = new();

    /// <summary>
    /// Association summaries (related entity counts and first 3 named items).
    /// </summary>
    public List<AssociationChipDto> Associations { get; init; } = new();

    /// <summary>
    /// Pipeline stage info (Deal and Lead only). Null for other entity types.
    /// </summary>
    public PipelineStagePreviewDto? PipelineStage { get; init; }

    /// <summary>
    /// Last 3 recent activities linked to this entity.
    /// </summary>
    public List<RecentActivityDto> RecentActivities { get; init; } = new();
}

/// <summary>
/// A pinned custom field with its label, type, and value from the entity.
/// </summary>
public record CustomFieldPreviewDto
{
    public string Label { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public object? Value { get; init; }
}

/// <summary>
/// Association summary chip showing related entity count and first 3 named items.
/// </summary>
public record AssociationChipDto
{
    public string EntityType { get; init; } = string.Empty;
    public int Count { get; init; }
    public List<AssociationItemDto> Items { get; init; } = new();
}

/// <summary>
/// A single associated entity with ID and name for display.
/// </summary>
public record AssociationItemDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
}

/// <summary>
/// Pipeline stage info for the mini progress bar (Deal and Lead previews).
/// Contains all stages so the frontend can render a visual progress indicator.
/// </summary>
public record PipelineStagePreviewDto
{
    public string PipelineName { get; init; } = string.Empty;
    public Guid CurrentStageId { get; init; }
    public string CurrentStageName { get; init; } = string.Empty;
    public int CurrentSortOrder { get; init; }
    public List<StageInfoDto> AllStages { get; init; } = new();
}

/// <summary>
/// Info about a single pipeline/lead stage for the progress bar.
/// </summary>
public record StageInfoDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string? Color { get; init; }
}

/// <summary>
/// Recent activity linked to the preview entity.
/// </summary>
public record RecentActivityDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; }
}
