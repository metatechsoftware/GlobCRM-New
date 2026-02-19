namespace GlobCRM.Infrastructure.BackgroundJobs;

/// <summary>
/// Static class providing AsyncLocal tenant context for background job execution.
/// When Hangfire jobs run outside of an HTTP request, TenantProvider falls back
/// to this AsyncLocal to resolve the tenant ID.
/// </summary>
public static class TenantScope
{
    private static readonly AsyncLocal<Guid?> _currentTenantId = new();

    /// <summary>
    /// Gets the current tenant ID from the AsyncLocal context.
    /// Used as fallback by TenantProvider when no HTTP context is available.
    /// </summary>
    public static Guid? CurrentTenantId => _currentTenantId.Value;

    /// <summary>
    /// Sets the current tenant ID in the AsyncLocal context.
    /// Called by TenantJobFilter.OnPerforming before job execution.
    /// </summary>
    public static void SetCurrentTenant(Guid tenantId)
    {
        _currentTenantId.Value = tenantId;
    }

    /// <summary>
    /// Clears the current tenant ID from the AsyncLocal context.
    /// Called by TenantJobFilter.OnPerformed after job execution.
    /// </summary>
    public static void ClearCurrentTenant()
    {
        _currentTenantId.Value = null;
    }
}
