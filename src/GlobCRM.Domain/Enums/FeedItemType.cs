namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the types of activity feed items.
/// SystemEvent: auto-generated from CRM actions (deal moved, contact created, etc.)
/// SocialPost: user-authored posts for team communication within the feed.
/// </summary>
public enum FeedItemType
{
    SystemEvent,
    SocialPost
}
