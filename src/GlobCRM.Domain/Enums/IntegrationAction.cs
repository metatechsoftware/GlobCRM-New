namespace GlobCRM.Domain.Enums;

/// <summary>
/// Actions recorded in the integration activity log.
/// Tracks connect, disconnect, and connection-test outcomes.
/// </summary>
public enum IntegrationAction
{
    Connected,
    Disconnected,
    TestSuccess,
    TestFailed
}
