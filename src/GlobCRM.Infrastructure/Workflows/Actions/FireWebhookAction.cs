using GlobCRM.Domain.Entities;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Stub for FireWebhook workflow action. Will be fully implemented by 19-02 plan.
/// </summary>
public class FireWebhookAction
{
    public Task ExecuteAsync(string config, Dictionary<string, object?> entityData, WorkflowTriggerContext context)
    {
        // Stub — full implementation provided by plan 19-02
        return Task.CompletedTask;
    }
}
