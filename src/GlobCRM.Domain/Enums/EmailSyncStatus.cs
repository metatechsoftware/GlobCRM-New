namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the sync states of a connected email account.
/// Active = syncing normally, Paused = user paused, Error = sync failure, Disconnected = OAuth revoked.
/// </summary>
public enum EmailSyncStatus
{
    Active,
    Paused,
    Error,
    Disconnected
}
