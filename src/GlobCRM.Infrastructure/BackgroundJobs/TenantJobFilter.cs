using GlobCRM.Domain.Interfaces;
using Hangfire.Client;
using Hangfire.Common;
using Hangfire.Server;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.BackgroundJobs;

/// <summary>
/// Hangfire job filter that propagates tenant context from the enqueuing HTTP request
/// into the background job execution context.
///
/// OnCreating: reads tenant ID from ITenantProvider and stores as job parameter "TenantId".
/// OnPerforming: reads "TenantId" job parameter and sets TenantScope.CurrentTenantId.
/// OnPerformed: clears TenantScope.CurrentTenantId to prevent tenant context leakage.
/// </summary>
public class TenantJobFilter : IClientFilter, IServerFilter
{
    /// <summary>
    /// Before job creation: capture the current tenant ID from the request context
    /// and store it as a job parameter so it survives serialization.
    /// </summary>
    public void OnCreating(CreatingContext context)
    {
        var tenantProvider = context.GetJobParameter<string>("TenantId");
        if (tenantProvider != null) return; // Already set (e.g., retry)

        // Try to resolve ITenantProvider from the service provider
        // During HTTP request context, this will return the current tenant
        var serviceProvider = context.InitialState?.GetType()
            .GetProperty("ServiceProvider")?.GetValue(context.InitialState) as IServiceProvider;

        if (serviceProvider != null)
        {
            var provider = serviceProvider.GetService<ITenantProvider>();
            var tenantId = provider?.GetTenantId();
            if (tenantId.HasValue)
            {
                context.SetJobParameter("TenantId", tenantId.Value.ToString());
                return;
            }
        }

        // Fallback: check TenantScope (if enqueuing from another background job)
        if (TenantScope.CurrentTenantId.HasValue)
        {
            context.SetJobParameter("TenantId", TenantScope.CurrentTenantId.Value.ToString());
        }
    }

    /// <summary>
    /// No-op after job creation.
    /// </summary>
    public void OnCreated(CreatedContext context)
    {
        // No action needed after job is created
    }

    /// <summary>
    /// Before job execution: restore tenant context from the serialized job parameter
    /// into the AsyncLocal TenantScope so TenantProvider can resolve the tenant.
    /// </summary>
    public void OnPerforming(PerformingContext context)
    {
        var tenantIdStr = context.GetJobParameter<string>("TenantId");
        if (!string.IsNullOrEmpty(tenantIdStr) && Guid.TryParse(tenantIdStr, out var tenantId))
        {
            TenantScope.SetCurrentTenant(tenantId);
        }
    }

    /// <summary>
    /// After job execution: clear tenant context to prevent leakage between jobs
    /// when Hangfire reuses threads.
    /// </summary>
    public void OnPerformed(PerformedContext context)
    {
        TenantScope.ClearCurrentTenant();
    }
}
