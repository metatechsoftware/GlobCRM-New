using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Notifications;

/// <summary>
/// SignalR hub for real-time CRM notifications and feed updates.
/// Server-push only for v1 -- no client-to-server methods.
/// Connected clients are added to tenant and user groups for targeted delivery.
/// Located in Infrastructure (not Api) to enable IHubContext injection by NotificationDispatcher
/// without circular project references.
/// </summary>
[Authorize]
public class CrmHub : Hub
{
    private readonly ILogger<CrmHub> _logger;

    public CrmHub(ILogger<CrmHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// On connection: add the client to tenant and user groups for targeted message delivery.
    /// Groups are automatically cleaned up on disconnect by SignalR.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var tenantId = Context.User?.FindFirst("organizationId")?.Value;
        var userId = Context.UserIdentifier;

        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
        }

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        _logger.LogInformation(
            "SignalR connected: ConnectionId={ConnectionId}, UserId={UserId}, TenantId={TenantId}",
            Context.ConnectionId, userId, tenantId);

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// On disconnection: groups are auto-cleaned by SignalR. Log for observability.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "SignalR disconnected: ConnectionId={ConnectionId}, Exception={Exception}",
            Context.ConnectionId, exception?.Message);

        await base.OnDisconnectedAsync(exception);
    }
}
