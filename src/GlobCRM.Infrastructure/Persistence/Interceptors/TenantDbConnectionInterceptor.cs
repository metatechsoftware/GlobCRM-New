using System.Data.Common;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace GlobCRM.Infrastructure.Persistence.Interceptors;

/// <summary>
/// EF Core DbConnectionInterceptor that sets the PostgreSQL session variable
/// 'app.current_tenant' on every database connection.
/// This is Layer 3 enabler of the triple-layer tenant isolation defense:
///   Layer 1: Finbuckle middleware (subdomain resolution)
///   Layer 2: EF Core global query filters (ApplicationDbContext)
///   Layer 3: PostgreSQL RLS policies reference app.current_tenant (this interceptor sets it)
/// </summary>
public class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ITenantProvider _tenantProvider;

    public TenantDbConnectionInterceptor(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    /// <summary>
    /// After a connection is opened asynchronously, sets the tenant session variable.
    /// Uses parameterized query to prevent SQL injection.
    /// </summary>
    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await SetTenantSessionVariable(connection, cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    /// <summary>
    /// After a connection is opened synchronously, sets the tenant session variable.
    /// </summary>
    public override void ConnectionOpened(
        DbConnection connection,
        ConnectionEndEventData eventData)
    {
        SetTenantSessionVariableSync(connection);
        base.ConnectionOpened(connection, eventData);
    }

    private async Task SetTenantSessionVariable(DbConnection connection, CancellationToken cancellationToken)
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
            return; // No tenant context -- tenant-agnostic operation (e.g., tenant catalog, migrations)

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_tenant', @tenantId, false)";
        var param = cmd.CreateParameter();
        param.ParameterName = "tenantId";
        param.Value = tenantId.Value.ToString();
        cmd.Parameters.Add(param);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private void SetTenantSessionVariableSync(DbConnection connection)
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
            return;

        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_tenant', @tenantId, false)";
        var param = cmd.CreateParameter();
        param.ParameterName = "tenantId";
        param.Value = tenantId.Value.ToString();
        cmd.Parameters.Add(param);
        cmd.ExecuteNonQuery();
    }
}
