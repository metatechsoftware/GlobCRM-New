using System.Text.Json;
using System.Text.Json.Serialization;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;

namespace GlobCRM.Infrastructure.Webhooks;

/// <summary>
/// Builds webhook payload JSON strings from domain events.
/// Creates a stable API contract envelope with entity data and change tracking.
/// NOT reusing existing DTOs — webhook payloads should be stable contracts independent of internal DTOs.
///
/// This runs inside the domain event handler while the entity is still in memory (before DbContext disposal).
/// The returned string is passed directly to the Hangfire delivery job.
/// </summary>
public class WebhookPayloadBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    /// <summary>
    /// Builds a complete webhook payload envelope as a JSON string.
    /// </summary>
    /// <param name="domainEvent">The domain event containing entity data and change information.</param>
    /// <param name="subscription">The webhook subscription (used for custom fields opt-in).</param>
    /// <param name="tenantId">The tenant ID for the envelope.</param>
    /// <returns>Serialized JSON payload string ready for HMAC signing and delivery.</returns>
    public string BuildPayload(DomainEvent domainEvent, WebhookSubscription subscription, Guid tenantId)
    {
        var envelope = new Dictionary<string, object?>
        {
            ["id"] = Guid.NewGuid().ToString(),
            ["timestamp"] = DateTimeOffset.UtcNow.ToString("o"),
            ["version"] = "1.0",
            ["tenantId"] = tenantId.ToString(),
            ["event"] = $"{domainEvent.EntityName.ToLowerInvariant()}.{domainEvent.EventType.ToLowerInvariant()}",
            ["data"] = SerializeEntity(domainEvent.Entity, domainEvent.EntityName, subscription.IncludeCustomFields)
        };

        // For update events, include the changes object with old/new values
        if (domainEvent.EventType == "Updated" && domainEvent.ChangedProperties != null)
        {
            var changes = new Dictionary<string, object?>();
            foreach (var (key, newValue) in domainEvent.ChangedProperties)
            {
                var camelKey = ToCamelCase(key);
                var oldValue = domainEvent.OldPropertyValues?.GetValueOrDefault(key);
                changes[camelKey] = new Dictionary<string, object?>
                {
                    ["old"] = oldValue,
                    ["new"] = newValue
                };
            }
            envelope["changes"] = changes;
        }

        return JsonSerializer.Serialize(envelope, JsonOptions);
    }

    /// <summary>
    /// Serializes an entity to a dictionary based on its type.
    /// Uses explicit property mapping per entity type for a stable API contract.
    /// Falls back to reflection for unknown entity types (future-proofing).
    /// </summary>
    private static Dictionary<string, object?> SerializeEntity(
        object entity, string entityName, bool includeCustomFields)
    {
        var data = entityName switch
        {
            "Contact" => SerializeContact((Contact)entity),
            "Company" => SerializeCompany((Company)entity),
            "Deal" => SerializeDeal((Deal)entity),
            "Lead" => SerializeLead((Lead)entity),
            "Activity" => SerializeActivity((Activity)entity),
            _ => SerializeViaReflection(entity)
        };

        // Include custom fields only if subscription opts in
        if (includeCustomFields)
        {
            var customFieldsProp = entity.GetType().GetProperty("CustomFields");
            if (customFieldsProp?.GetValue(entity) is Dictionary<string, object?> customFields && customFields.Count > 0)
            {
                data["customFields"] = customFields;
            }
        }

        return data;
    }

    private static Dictionary<string, object?> SerializeContact(Contact contact)
    {
        return new Dictionary<string, object?>
        {
            ["id"] = contact.Id.ToString(),
            ["firstName"] = contact.FirstName,
            ["lastName"] = contact.LastName,
            ["email"] = contact.Email,
            ["phone"] = contact.Phone,
            ["mobilePhone"] = contact.MobilePhone,
            ["jobTitle"] = contact.JobTitle,
            ["department"] = contact.Department,
            ["address"] = contact.Address,
            ["city"] = contact.City,
            ["state"] = contact.State,
            ["country"] = contact.Country,
            ["postalCode"] = contact.PostalCode,
            ["description"] = contact.Description,
            ["companyId"] = contact.CompanyId?.ToString(),
            ["ownerId"] = contact.OwnerId?.ToString(),
            ["createdAt"] = contact.CreatedAt.ToString("o"),
            ["updatedAt"] = contact.UpdatedAt.ToString("o")
        };
    }

    private static Dictionary<string, object?> SerializeCompany(Company company)
    {
        return new Dictionary<string, object?>
        {
            ["id"] = company.Id.ToString(),
            ["name"] = company.Name,
            ["industry"] = company.Industry,
            ["website"] = company.Website,
            ["phone"] = company.Phone,
            ["email"] = company.Email,
            ["address"] = company.Address,
            ["city"] = company.City,
            ["state"] = company.State,
            ["country"] = company.Country,
            ["postalCode"] = company.PostalCode,
            ["size"] = company.Size,
            ["description"] = company.Description,
            ["ownerId"] = company.OwnerId?.ToString(),
            ["createdAt"] = company.CreatedAt.ToString("o"),
            ["updatedAt"] = company.UpdatedAt.ToString("o")
        };
    }

    private static Dictionary<string, object?> SerializeDeal(Deal deal)
    {
        return new Dictionary<string, object?>
        {
            ["id"] = deal.Id.ToString(),
            ["title"] = deal.Title,
            ["value"] = deal.Value,
            ["probability"] = deal.Probability,
            ["expectedCloseDate"] = deal.ExpectedCloseDate?.ToString("yyyy-MM-dd"),
            ["actualCloseDate"] = deal.ActualCloseDate?.ToString("yyyy-MM-dd"),
            ["pipelineId"] = deal.PipelineId.ToString(),
            ["pipelineStageId"] = deal.PipelineStageId.ToString(),
            ["companyId"] = deal.CompanyId?.ToString(),
            ["ownerId"] = deal.OwnerId?.ToString(),
            ["description"] = deal.Description,
            ["createdAt"] = deal.CreatedAt.ToString("o"),
            ["updatedAt"] = deal.UpdatedAt.ToString("o")
        };
    }

    private static Dictionary<string, object?> SerializeLead(Lead lead)
    {
        return new Dictionary<string, object?>
        {
            ["id"] = lead.Id.ToString(),
            ["firstName"] = lead.FirstName,
            ["lastName"] = lead.LastName,
            ["email"] = lead.Email,
            ["phone"] = lead.Phone,
            ["mobilePhone"] = lead.MobilePhone,
            ["jobTitle"] = lead.JobTitle,
            ["companyName"] = lead.CompanyName,
            ["leadStageId"] = lead.LeadStageId.ToString(),
            ["leadSourceId"] = lead.LeadSourceId?.ToString(),
            ["temperature"] = lead.Temperature.ToString(),
            ["ownerId"] = lead.OwnerId?.ToString(),
            ["isConverted"] = lead.IsConverted,
            ["convertedAt"] = lead.ConvertedAt?.ToString("o"),
            ["description"] = lead.Description,
            ["createdAt"] = lead.CreatedAt.ToString("o"),
            ["updatedAt"] = lead.UpdatedAt.ToString("o")
        };
    }

    private static Dictionary<string, object?> SerializeActivity(Activity activity)
    {
        return new Dictionary<string, object?>
        {
            ["id"] = activity.Id.ToString(),
            ["subject"] = activity.Subject,
            ["description"] = activity.Description,
            ["type"] = activity.Type.ToString(),
            ["status"] = activity.Status.ToString(),
            ["priority"] = activity.Priority.ToString(),
            ["dueDate"] = activity.DueDate?.ToString("o"),
            ["completedAt"] = activity.CompletedAt?.ToString("o"),
            ["ownerId"] = activity.OwnerId?.ToString(),
            ["assignedToId"] = activity.AssignedToId?.ToString(),
            ["createdAt"] = activity.CreatedAt.ToString("o"),
            ["updatedAt"] = activity.UpdatedAt.ToString("o")
        };
    }

    /// <summary>
    /// Reflection-based fallback serializer for unknown entity types.
    /// Extracts scalar properties (no navigation/collection properties) for future-proofing.
    /// </summary>
    private static Dictionary<string, object?> SerializeViaReflection(object entity)
    {
        var data = new Dictionary<string, object?>();
        var type = entity.GetType();

        foreach (var prop in type.GetProperties())
        {
            // Skip navigation properties, collections, and computed tsvector
            if (prop.PropertyType.IsGenericType &&
                (prop.PropertyType.GetGenericTypeDefinition() == typeof(ICollection<>) ||
                 prop.PropertyType.GetGenericTypeDefinition() == typeof(List<>)))
                continue;

            if (prop.PropertyType.Namespace?.StartsWith("GlobCRM.Domain") == true)
                continue;

            if (prop.PropertyType.FullName?.Contains("NpgsqlTsVector") == true)
                continue;

            try
            {
                var value = prop.GetValue(entity);
                data[ToCamelCase(prop.Name)] = value;
            }
            catch
            {
                // Skip properties that throw during read
            }
        }

        return data;
    }

    /// <summary>
    /// Converts a PascalCase property name to camelCase.
    /// </summary>
    private static string ToCamelCase(string name)
    {
        if (string.IsNullOrEmpty(name) || char.IsLower(name[0]))
            return name;

        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
