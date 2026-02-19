using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Webhooks;

/// <summary>
/// Extension methods for registering webhook infrastructure services.
/// Configures the named HttpClient for webhook delivery, domain event handler,
/// delivery service, SSRF validator, payload builder, and repository.
/// </summary>
public static class WebhookServiceExtensions
{
    /// <summary>
    /// Registers all webhook-related services in the DI container.
    /// </summary>
    public static IServiceCollection AddWebhookServices(this IServiceCollection services)
    {
        // Named HttpClient for webhook delivery with SSRF-safe configuration
        services.AddHttpClient("WebhookDelivery", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.Add("User-Agent", "GlobCRM-Webhook/1.0");
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = false, // Prevent redirect-based SSRF bypass
        });

        // Domain event handler — registered as IDomainEventHandler so DomainEventDispatcher resolves it
        services.AddScoped<IDomainEventHandler, WebhookDomainEventHandler>();

        // Delivery service (invoked by Hangfire)
        services.AddScoped<WebhookDeliveryService>();

        // SSRF validator
        services.AddScoped<WebhookSsrfValidator>();

        // Payload builder
        services.AddScoped<WebhookPayloadBuilder>();

        // Repository (EF Core implementation)
        services.AddScoped<IWebhookRepository, WebhookRepository>();

        return services;
    }
}
