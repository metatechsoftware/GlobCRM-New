using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Workflows.Actions;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Extension methods for registering workflow automation services.
/// Configures the domain event handler, execution engine, condition evaluator,
/// action executor, all 6 action implementations, loop guard, date trigger scanner,
/// and the workflow repository.
/// </summary>
public static class WorkflowServiceExtensions
{
    /// <summary>
    /// Registers all workflow-related services in the DI container.
    /// </summary>
    public static IServiceCollection AddWorkflowServices(this IServiceCollection services)
    {
        // Domain event handler — registered as IDomainEventHandler so DomainEventDispatcher resolves it
        // Sits alongside WebhookDomainEventHandler (both implement IDomainEventHandler)
        services.AddScoped<IDomainEventHandler, WorkflowDomainEventHandler>();

        // Core execution pipeline
        services.AddScoped<WorkflowExecutionService>();
        services.AddScoped<WorkflowConditionEvaluator>();
        services.AddScoped<WorkflowActionExecutor>();
        services.AddScoped<WorkflowLoopGuard>();

        // 6 action implementations
        services.AddScoped<UpdateFieldAction>();
        services.AddScoped<SendNotificationAction>();
        services.AddScoped<CreateActivityAction>();
        services.AddScoped<SendEmailAction>();
        services.AddScoped<FireWebhookAction>();
        services.AddScoped<EnrollInSequenceAction>();

        // Date trigger scanner (registered as recurring Hangfire job in Program.cs)
        services.AddScoped<DateTriggerScanService>();

        // Repository (moved from DependencyInjection.cs to centralize workflow registrations)
        services.AddScoped<IWorkflowRepository, WorkflowRepository>();

        return services;
    }
}
