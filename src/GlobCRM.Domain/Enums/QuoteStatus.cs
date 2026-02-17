namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the lifecycle states of a quote.
/// Draft -> Sent -> Accepted/Rejected/Expired.
/// </summary>
public enum QuoteStatus
{
    Draft,
    Sent,
    Accepted,
    Rejected,
    Expired
}
