using System.Text;
using System.Text.Json;
using GlobCRM.Infrastructure.Webhooks;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Workflow action that fires an HTTP webhook to an external URL.
/// Reuses the WebhookSsrfValidator for SSRF protection and the named "WebhookDelivery"
/// HttpClient already registered by WebhookServiceExtensions.
/// Does NOT retry — the workflow's ContinueOnError flag handles failure.
/// </summary>
public class FireWebhookAction
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly WebhookSsrfValidator _ssrfValidator;
    private readonly ILogger<FireWebhookAction> _logger;

    public FireWebhookAction(
        IHttpClientFactory httpClientFactory,
        WebhookSsrfValidator ssrfValidator,
        ILogger<FireWebhookAction> logger)
    {
        _httpClientFactory = httpClientFactory;
        _ssrfValidator = ssrfValidator;
        _logger = logger;
    }

    /// <summary>
    /// Executes the fire webhook action.
    /// </summary>
    /// <param name="configJson">JSON config: { Url, Headers, PayloadTemplate }</param>
    /// <param name="entityData">Current entity data for payload construction.</param>
    /// <param name="context">Trigger context with entity information.</param>
    public async Task ExecuteAsync(
        string configJson,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var config = JsonSerializer.Deserialize<FireWebhookConfig>(configJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (config is null || string.IsNullOrEmpty(config.Url))
            throw new InvalidOperationException("FireWebhook action requires Url in config");

        // SSRF validate the URL
        var (isValid, ssrfError) = await _ssrfValidator.ValidateUrlAsync(config.Url);
        if (!isValid)
            throw new InvalidOperationException($"Webhook URL failed SSRF validation: {ssrfError}");

        // Build payload
        string payload;
        if (!string.IsNullOrEmpty(config.PayloadTemplate))
        {
            // Resolve merge fields in the template
            payload = config.PayloadTemplate;
            foreach (var kvp in entityData)
            {
                if (kvp.Value is not null && kvp.Value is not Dictionary<string, object?>)
                {
                    payload = payload.Replace($"{{{{{kvp.Key}}}}}", kvp.Value.ToString(),
                        StringComparison.OrdinalIgnoreCase);
                }
            }
        }
        else
        {
            // Default: serialize entity data as JSON
            payload = JsonSerializer.Serialize(new
            {
                @event = $"{context.EntityType}.WorkflowAction",
                entity_type = context.EntityType,
                entity_id = context.EntityId,
                tenant_id = context.TenantId,
                trigger_type = context.TriggerType,
                data = entityData
            });
        }

        // Create HTTP request
        var httpClient = _httpClientFactory.CreateClient("WebhookDelivery");
        var request = new HttpRequestMessage(HttpMethod.Post, config.Url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };

        // Add custom headers
        if (config.Headers is not null)
        {
            foreach (var header in config.Headers)
            {
                request.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        // Send the request
        var response = await httpClient.SendAsync(request, CancellationToken.None);

        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            _logger.LogWarning(
                "FireWebhook action: HTTP {StatusCode} from {Url}: {ResponseBody}",
                (int)response.StatusCode, config.Url,
                responseBody.Length > 200 ? responseBody[..200] : responseBody);

            throw new InvalidOperationException(
                $"Webhook returned HTTP {(int)response.StatusCode}: {response.ReasonPhrase}");
        }

        _logger.LogDebug(
            "FireWebhook action: HTTP {StatusCode} to {Url}",
            (int)response.StatusCode, config.Url);
    }

    private class FireWebhookConfig
    {
        public string Url { get; set; } = string.Empty;
        public Dictionary<string, string>? Headers { get; set; }
        public string? PayloadTemplate { get; set; }
    }
}
