using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Sequences;

/// <summary>
/// Extension methods for registering sequence execution infrastructure services.
/// Configures the execution engine, email sender, tracking service, and reply detector.
/// </summary>
public static class SequenceServiceExtensions
{
    /// <summary>
    /// Registers all sequence execution services in the DI container.
    /// Note: Sequence repositories (IEmailSequenceRepository, ISequenceEnrollmentRepository)
    /// are registered separately in DependencyInjection.cs from 18-01.
    /// </summary>
    public static IServiceCollection AddSequenceServices(this IServiceCollection services)
    {
        // Execution engine (Hangfire job service)
        services.AddScoped<SequenceExecutionService>();

        // Email sender (Gmail with custom headers + SendGrid fallback)
        services.AddScoped<SequenceEmailSender>();

        // Tracking service (pixel injection, link wrapping, event recording)
        services.AddScoped<EmailTrackingService>();

        // Reply detection (called from GmailSyncService on inbound messages)
        services.AddScoped<SequenceReplyDetector>();

        return services;
    }
}
