using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.EmailTemplates;

/// <summary>
/// Provides merge field definitions and entity data resolution for email template rendering.
/// Returns available merge fields grouped by entity type, including custom field definitions.
/// Resolves actual entity data into a dictionary suitable for Fluid template rendering.
/// </summary>
public class MergeFieldService
{
    private readonly ApplicationDbContext _db;

    public MergeFieldService(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Gets all available merge fields grouped by entity type.
    /// Includes both hardcoded core fields and dynamic custom field definitions from the database.
    /// </summary>
    public async Task<Dictionary<string, List<MergeFieldDefinition>>> GetAvailableFieldsAsync(
        CancellationToken ct = default)
    {
        var fields = new Dictionary<string, List<MergeFieldDefinition>>
        {
            ["contact"] = new List<MergeFieldDefinition>
            {
                new("contact.first_name", "First Name", "Contact", false),
                new("contact.last_name", "Last Name", "Contact", false),
                new("contact.email", "Email", "Contact", false),
                new("contact.phone", "Phone", "Contact", false),
                new("contact.job_title", "Job Title", "Contact", false),
                new("contact.company.name", "Company Name", "Contact", false),
            },
            ["company"] = new List<MergeFieldDefinition>
            {
                new("company.name", "Name", "Company", false),
                new("company.industry", "Industry", "Company", false),
                new("company.website", "Website", "Company", false),
                new("company.phone", "Phone", "Company", false),
                new("company.address", "Address", "Company", false),
            },
            ["deal"] = new List<MergeFieldDefinition>
            {
                new("deal.title", "Title", "Deal", false),
                new("deal.value", "Value", "Deal", false),
                new("deal.stage", "Stage", "Deal", false),
                new("deal.probability", "Probability", "Deal", false),
                new("deal.close_date", "Close Date", "Deal", false),
                new("deal.description", "Description", "Deal", false),
                new("deal.company.name", "Company Name", "Deal", false),
            },
            ["lead"] = new List<MergeFieldDefinition>
            {
                new("lead.first_name", "First Name", "Lead", false),
                new("lead.last_name", "Last Name", "Lead", false),
                new("lead.email", "Email", "Lead", false),
                new("lead.phone", "Phone", "Lead", false),
                new("lead.company_name", "Company Name", "Lead", false),
                new("lead.title", "Job Title", "Lead", false),
                new("lead.source.name", "Source Name", "Lead", false),
            },
            ["quote"] = new List<MergeFieldDefinition>
            {
                new("quote.number", "Quote Number", "Quote", false),
                new("quote.title", "Title", "Quote", false),
                new("quote.description", "Description", "Quote", false),
                new("quote.status", "Status", "Quote", false),
                new("quote.issue_date", "Issue Date", "Quote", false),
                new("quote.expiry_date", "Expiry Date", "Quote", false),
                new("quote.subtotal", "Subtotal", "Quote", false),
                new("quote.discount_total", "Discount Total", "Quote", false),
                new("quote.tax_total", "Tax Total", "Quote", false),
                new("quote.grand_total", "Grand Total", "Quote", false),
                new("quote.notes", "Notes", "Quote", false),
                new("quote.version", "Version", "Quote", false),
            },
            ["organization"] = new List<MergeFieldDefinition>
            {
                new("organization.name", "Name", "Organization", false),
                new("organization.logo_url", "Logo URL", "Organization", false),
                new("organization.address", "Address", "Organization", false),
                new("organization.phone", "Phone", "Organization", false),
                new("organization.email", "Email", "Organization", false),
                new("organization.website", "Website", "Organization", false),
            }
        };

        // Load custom field definitions from DB for supported entity types
        var customFieldEntityTypes = new[]
        {
            EntityType.Contact.ToString(),
            EntityType.Company.ToString(),
            EntityType.Deal.ToString(),
            EntityType.Lead.ToString()
        };

        var customFields = await _db.CustomFieldDefinitions
            .Where(f => customFieldEntityTypes.Contains(f.EntityType))
            .Select(f => new { f.EntityType, f.Name, f.Label })
            .ToListAsync(ct);

        foreach (var cf in customFields)
        {
            var groupKey = cf.EntityType.ToLower();
            if (!fields.ContainsKey(groupKey))
                continue;

            fields[groupKey].Add(new MergeFieldDefinition(
                Key: $"{groupKey}.custom.{cf.Name}",
                Label: cf.Label,
                Group: cf.EntityType,
                IsCustomField: true));
        }

        return fields;
    }

    /// <summary>
    /// Resolves actual entity data into a flat dictionary for template rendering.
    /// Loads the entity by type and ID with one level of related entity includes.
    /// Custom fields from JSONB are included under "custom" sub-key.
    /// </summary>
    public async Task<Dictionary<string, object?>> ResolveEntityDataAsync(
        string entityType,
        Guid entityId,
        CancellationToken ct = default)
    {
        return entityType.ToLower() switch
        {
            "contact" => await ResolveContactDataAsync(entityId, ct),
            "company" => await ResolveCompanyDataAsync(entityId, ct),
            "deal" => await ResolveDealDataAsync(entityId, ct),
            "lead" => await ResolveLeadDataAsync(entityId, ct),
            _ => new Dictionary<string, object?>()
        };
    }

    private async Task<Dictionary<string, object?>> ResolveContactDataAsync(
        Guid entityId, CancellationToken ct)
    {
        var entity = await _db.Contacts
            .Include(c => c.Company)
            .FirstOrDefaultAsync(c => c.Id == entityId, ct);

        if (entity == null) return new Dictionary<string, object?>();

        var data = new Dictionary<string, object?>
        {
            ["first_name"] = entity.FirstName,
            ["last_name"] = entity.LastName,
            ["email"] = entity.Email,
            ["phone"] = entity.Phone,
            ["job_title"] = entity.JobTitle,
            ["company"] = entity.Company != null ? new Dictionary<string, object?>
            {
                ["name"] = entity.Company.Name
            } : null,
            ["custom"] = BuildCustomFieldsDictionary(entity.CustomFields)
        };

        return data;
    }

    private async Task<Dictionary<string, object?>> ResolveCompanyDataAsync(
        Guid entityId, CancellationToken ct)
    {
        var entity = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == entityId, ct);

        if (entity == null) return new Dictionary<string, object?>();

        var data = new Dictionary<string, object?>
        {
            ["name"] = entity.Name,
            ["industry"] = entity.Industry,
            ["website"] = entity.Website,
            ["phone"] = entity.Phone,
            ["address"] = entity.Address,
            ["custom"] = BuildCustomFieldsDictionary(entity.CustomFields)
        };

        return data;
    }

    private async Task<Dictionary<string, object?>> ResolveDealDataAsync(
        Guid entityId, CancellationToken ct)
    {
        var entity = await _db.Deals
            .Include(d => d.Company)
            .Include(d => d.Stage)
            .FirstOrDefaultAsync(d => d.Id == entityId, ct);

        if (entity == null) return new Dictionary<string, object?>();

        var data = new Dictionary<string, object?>
        {
            ["title"] = entity.Title,
            ["value"] = entity.Value,
            ["stage"] = entity.Stage?.Name,
            ["probability"] = entity.Stage?.DefaultProbability,
            ["close_date"] = entity.ExpectedCloseDate?.ToString("yyyy-MM-dd"),
            ["description"] = entity.Description,
            ["company"] = entity.Company != null ? new Dictionary<string, object?>
            {
                ["name"] = entity.Company.Name
            } : null,
            ["custom"] = BuildCustomFieldsDictionary(entity.CustomFields)
        };

        return data;
    }

    private async Task<Dictionary<string, object?>> ResolveLeadDataAsync(
        Guid entityId, CancellationToken ct)
    {
        var entity = await _db.Leads
            .Include(l => l.Source)
            .FirstOrDefaultAsync(l => l.Id == entityId, ct);

        if (entity == null) return new Dictionary<string, object?>();

        var data = new Dictionary<string, object?>
        {
            ["first_name"] = entity.FirstName,
            ["last_name"] = entity.LastName,
            ["email"] = entity.Email,
            ["phone"] = entity.Phone,
            ["company_name"] = entity.CompanyName,
            ["title"] = entity.JobTitle,
            ["source"] = entity.Source != null ? new Dictionary<string, object?>
            {
                ["name"] = entity.Source.Name
            } : null,
            ["custom"] = BuildCustomFieldsDictionary(entity.CustomFields)
        };

        return data;
    }

    /// <summary>
    /// Converts the JSONB CustomFields dictionary into a simple string-keyed dictionary
    /// suitable for Liquid template rendering.
    /// </summary>
    private static Dictionary<string, object?> BuildCustomFieldsDictionary(
        Dictionary<string, object?> customFields)
    {
        var result = new Dictionary<string, object?>();
        foreach (var kvp in customFields)
        {
            result[kvp.Key] = kvp.Value;
        }
        return result;
    }

    /// <summary>
    /// Represents a single merge field definition with its key, display label, group, and custom flag.
    /// </summary>
    public record MergeFieldDefinition(string Key, string Label, string Group, bool IsCustomField);
}
