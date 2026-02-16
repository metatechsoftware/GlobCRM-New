using RazorLight;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Email;

/// <summary>
/// Renders .cshtml Razor templates to HTML strings for email content.
/// Uses RazorLight for standalone Razor rendering (no MVC dependency).
/// Registered as a singleton since the RazorLight engine caches compiled templates.
/// </summary>
public class RazorEmailRenderer
{
    private readonly RazorLightEngine _engine;
    private readonly ILogger<RazorEmailRenderer> _logger;

    public RazorEmailRenderer(ILogger<RazorEmailRenderer> logger)
    {
        _logger = logger;

        var templatePath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            "EmailTemplates");

        _engine = new RazorLightEngineBuilder()
            .UseFileSystemProject(templatePath)
            .UseMemoryCachingProvider()
            .Build();
    }

    /// <summary>
    /// Renders a Razor template with the given model.
    /// Each template is self-contained with full HTML layout for email client compatibility.
    /// </summary>
    /// <typeparam name="T">The model type.</typeparam>
    /// <param name="templateName">Template filename (e.g., "VerificationEmailTemplate.cshtml").</param>
    /// <param name="model">The model to pass to the template.</param>
    /// <returns>Rendered HTML string.</returns>
    public async Task<string> RenderAsync<T>(string templateName, T model) where T : class
    {
        try
        {
            var result = await _engine.CompileRenderAsync(templateName, model);
            _logger.LogDebug("Rendered email template {TemplateName} successfully", templateName);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to render email template {TemplateName}", templateName);
            throw;
        }
    }
}
