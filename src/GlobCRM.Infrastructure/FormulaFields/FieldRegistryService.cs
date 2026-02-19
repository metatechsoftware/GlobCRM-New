using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Infrastructure.FormulaFields;

/// <summary>
/// Provides system field definitions per entity type and extracts entity values
/// for formula evaluation parameters. Similar pattern to MergeFieldService but
/// focused on formula field references rather than email template merge tags.
/// </summary>
public class FieldRegistryService
{
    /// <summary>
    /// Metadata about a single field available for formula references.
    /// </summary>
    /// <param name="Name">Internal reference key (camelCase for system, snake_case for custom).</param>
    /// <param name="Label">Display label shown in autocomplete.</param>
    /// <param name="DataType">Data type: "number", "text", "date", or "boolean".</param>
    /// <param name="Category">Category: "System", "Custom", or "Formula".</param>
    public record FieldInfo(string Name, string Label, string DataType, string Category);

    /// <summary>
    /// Returns all available fields for a given entity type, including system fields,
    /// custom fields, and existing formula fields from the provided definitions list.
    /// </summary>
    public List<FieldInfo> GetAvailableFields(string entityType, List<CustomFieldDefinition> customFields)
    {
        var fields = new List<FieldInfo>();

        // System fields per entity type
        fields.AddRange(GetSystemFields(entityType));

        // Custom fields (non-formula)
        foreach (var cf in customFields.Where(f => f.FieldType != CustomFieldType.Formula))
        {
            var dataType = MapFieldTypeToDataType(cf.FieldType);
            fields.Add(new FieldInfo(cf.Name, cf.Label, dataType, "Custom"));
        }

        // Formula fields
        foreach (var ff in customFields.Where(f => f.FieldType == CustomFieldType.Formula))
        {
            var dataType = ff.FormulaResultType ?? "text";
            fields.Add(new FieldInfo(ff.Name, ff.Label, dataType, "Formula"));
        }

        return fields;
    }

    /// <summary>
    /// Extracts system field values from a domain entity into a dictionary
    /// with camelCase keys matching the field registry.
    /// </summary>
    public Dictionary<string, object?> ExtractEntityValues(string entityType, object entity)
    {
        return entityType switch
        {
            "Deal" => ExtractDealValues(entity),
            "Contact" => ExtractContactValues(entity),
            "Company" => ExtractCompanyValues(entity),
            "Lead" => ExtractLeadValues(entity),
            "Activity" => ExtractActivityValues(entity),
            "Quote" => ExtractQuoteValues(entity),
            "Request" => ExtractRequestValues(entity),
            "Product" => ExtractProductValues(entity),
            _ => new Dictionary<string, object?>()
        };
    }

    /// <summary>
    /// Returns a dictionary of placeholder values per data type for formula preview.
    /// </summary>
    public Dictionary<string, object?> GetPlaceholderValues(string entityType, List<CustomFieldDefinition> customFields)
    {
        var result = new Dictionary<string, object?>();

        foreach (var field in GetAvailableFields(entityType, customFields))
        {
            result[field.Name] = field.DataType switch
            {
                "number" => 0m,
                "date" => DateTime.UtcNow,
                "boolean" => false,
                _ => "sample"
            };
        }

        return result;
    }

    private static List<FieldInfo> GetSystemFields(string entityType) => entityType switch
    {
        "Deal" => new()
        {
            new("title", "Title", "text", "System"),
            new("value", "Value", "number", "System"),
            new("probability", "Probability", "number", "System"),
            new("expectedCloseDate", "Expected Close Date", "date", "System"),
            new("status", "Status", "text", "System"),
            new("description", "Description", "text", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Contact" => new()
        {
            new("firstName", "First Name", "text", "System"),
            new("lastName", "Last Name", "text", "System"),
            new("email", "Email", "text", "System"),
            new("phone", "Phone", "text", "System"),
            new("jobTitle", "Job Title", "text", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Company" => new()
        {
            new("name", "Name", "text", "System"),
            new("industry", "Industry", "text", "System"),
            new("website", "Website", "text", "System"),
            new("phone", "Phone", "text", "System"),
            new("address", "Address", "text", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Lead" => new()
        {
            new("firstName", "First Name", "text", "System"),
            new("lastName", "Last Name", "text", "System"),
            new("email", "Email", "text", "System"),
            new("phone", "Phone", "text", "System"),
            new("companyName", "Company Name", "text", "System"),
            new("jobTitle", "Job Title", "text", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Activity" => new()
        {
            new("subject", "Subject", "text", "System"),
            new("description", "Description", "text", "System"),
            new("type", "Type", "text", "System"),
            new("status", "Status", "text", "System"),
            new("priority", "Priority", "text", "System"),
            new("dueDate", "Due Date", "date", "System"),
            new("completedAt", "Completed At", "date", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Quote" => new()
        {
            new("quoteNumber", "Quote Number", "text", "System"),
            new("title", "Title", "text", "System"),
            new("description", "Description", "text", "System"),
            new("status", "Status", "text", "System"),
            new("issueDate", "Issue Date", "date", "System"),
            new("expiryDate", "Expiry Date", "date", "System"),
            new("subtotal", "Subtotal", "number", "System"),
            new("discountTotal", "Discount Total", "number", "System"),
            new("taxTotal", "Tax Total", "number", "System"),
            new("grandTotal", "Grand Total", "number", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Request" => new()
        {
            new("subject", "Subject", "text", "System"),
            new("description", "Description", "text", "System"),
            new("status", "Status", "text", "System"),
            new("priority", "Priority", "text", "System"),
            new("category", "Category", "text", "System"),
            new("resolvedAt", "Resolved At", "date", "System"),
            new("closedAt", "Closed At", "date", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        "Product" => new()
        {
            new("name", "Name", "text", "System"),
            new("description", "Description", "text", "System"),
            new("unitPrice", "Unit Price", "number", "System"),
            new("sku", "SKU", "text", "System"),
            new("category", "Category", "text", "System"),
            new("isActive", "Is Active", "boolean", "System"),
            new("createdAt", "Created At", "date", "System"),
            new("updatedAt", "Updated At", "date", "System"),
        },
        _ => new()
    };

    private static string MapFieldTypeToDataType(CustomFieldType fieldType) => fieldType switch
    {
        CustomFieldType.Text => "text",
        CustomFieldType.Dropdown => "text",
        CustomFieldType.MultiSelect => "text",
        CustomFieldType.Number => "number",
        CustomFieldType.Currency => "number",
        CustomFieldType.Date => "date",
        CustomFieldType.Checkbox => "boolean",
        _ => "text"
    };

    private static Dictionary<string, object?> ExtractDealValues(object entity)
    {
        if (entity is not Deal deal) return new();
        return new Dictionary<string, object?>
        {
            ["title"] = deal.Title,
            ["value"] = deal.Value ?? 0m,
            ["probability"] = deal.Probability ?? 0m,
            ["expectedCloseDate"] = deal.ExpectedCloseDate?.ToDateTime(TimeOnly.MinValue),
            ["status"] = deal.Stage?.Name,
            ["description"] = deal.Description ?? "",
            ["createdAt"] = deal.CreatedAt.UtcDateTime,
            ["updatedAt"] = deal.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractContactValues(object entity)
    {
        if (entity is not Contact contact) return new();
        return new Dictionary<string, object?>
        {
            ["firstName"] = contact.FirstName,
            ["lastName"] = contact.LastName,
            ["email"] = contact.Email ?? "",
            ["phone"] = contact.Phone ?? "",
            ["jobTitle"] = contact.JobTitle ?? "",
            ["createdAt"] = contact.CreatedAt.UtcDateTime,
            ["updatedAt"] = contact.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractCompanyValues(object entity)
    {
        if (entity is not Company company) return new();
        return new Dictionary<string, object?>
        {
            ["name"] = company.Name,
            ["industry"] = company.Industry ?? "",
            ["website"] = company.Website ?? "",
            ["phone"] = company.Phone ?? "",
            ["address"] = company.Address ?? "",
            ["createdAt"] = company.CreatedAt.UtcDateTime,
            ["updatedAt"] = company.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractLeadValues(object entity)
    {
        if (entity is not Lead lead) return new();
        return new Dictionary<string, object?>
        {
            ["firstName"] = lead.FirstName,
            ["lastName"] = lead.LastName,
            ["email"] = lead.Email ?? "",
            ["phone"] = lead.Phone ?? "",
            ["companyName"] = lead.CompanyName ?? "",
            ["jobTitle"] = lead.JobTitle ?? "",
            ["createdAt"] = lead.CreatedAt.UtcDateTime,
            ["updatedAt"] = lead.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractActivityValues(object entity)
    {
        if (entity is not Activity activity) return new();
        return new Dictionary<string, object?>
        {
            ["subject"] = activity.Subject,
            ["description"] = activity.Description ?? "",
            ["type"] = activity.Type.ToString(),
            ["status"] = activity.Status.ToString(),
            ["priority"] = activity.Priority.ToString(),
            ["dueDate"] = activity.DueDate?.UtcDateTime,
            ["completedAt"] = activity.CompletedAt?.UtcDateTime,
            ["createdAt"] = activity.CreatedAt.UtcDateTime,
            ["updatedAt"] = activity.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractQuoteValues(object entity)
    {
        if (entity is not Quote quote) return new();
        return new Dictionary<string, object?>
        {
            ["quoteNumber"] = quote.QuoteNumber,
            ["title"] = quote.Title,
            ["description"] = quote.Description ?? "",
            ["status"] = quote.Status.ToString(),
            ["issueDate"] = quote.IssueDate.ToDateTime(TimeOnly.MinValue),
            ["expiryDate"] = quote.ExpiryDate?.ToDateTime(TimeOnly.MinValue),
            ["subtotal"] = quote.Subtotal,
            ["discountTotal"] = quote.DiscountTotal,
            ["taxTotal"] = quote.TaxTotal,
            ["grandTotal"] = quote.GrandTotal,
            ["createdAt"] = quote.CreatedAt.UtcDateTime,
            ["updatedAt"] = quote.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractRequestValues(object entity)
    {
        if (entity is not Request request) return new();
        return new Dictionary<string, object?>
        {
            ["subject"] = request.Subject,
            ["description"] = request.Description ?? "",
            ["status"] = request.Status.ToString(),
            ["priority"] = request.Priority.ToString(),
            ["category"] = request.Category ?? "",
            ["resolvedAt"] = request.ResolvedAt?.UtcDateTime,
            ["closedAt"] = request.ClosedAt?.UtcDateTime,
            ["createdAt"] = request.CreatedAt.UtcDateTime,
            ["updatedAt"] = request.UpdatedAt.UtcDateTime,
        };
    }

    private static Dictionary<string, object?> ExtractProductValues(object entity)
    {
        if (entity is not Product product) return new();
        return new Dictionary<string, object?>
        {
            ["name"] = product.Name,
            ["description"] = product.Description ?? "",
            ["unitPrice"] = product.UnitPrice,
            ["sku"] = product.SKU ?? "",
            ["category"] = product.Category ?? "",
            ["isActive"] = product.IsActive,
            ["createdAt"] = product.CreatedAt.UtcDateTime,
            ["updatedAt"] = product.UpdatedAt.UtcDateTime,
        };
    }
}
