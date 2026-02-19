namespace GlobCRM.Domain.Enums;

/// <summary>
/// Reference enum for webhook event types.
/// The actual storage uses string format "Entity.EventType" (e.g., "Contact.Created")
/// in WebhookSubscription.EventSubscriptions and WebhookDeliveryLog.EventType.
/// This enum exists for type-safe references in code and validation.
/// </summary>
public enum WebhookEventType
{
    Created,
    Updated,
    Deleted
}
