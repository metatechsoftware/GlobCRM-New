using Fluid;

namespace GlobCRM.Infrastructure.EmailTemplates;

/// <summary>
/// Renders Liquid merge fields in email templates using the Fluid library.
/// FluidParser is thread-safe and reusable, so this service is registered as singleton.
/// Supports Fluid's built-in `default` filter for fallback values:
///   {{ contact.first_name | default: 'there' }}
/// </summary>
public class TemplateRenderService
{
    private readonly FluidParser _parser = new();

    /// <summary>
    /// Renders a Liquid template string with the provided merge data.
    /// </summary>
    /// <param name="htmlTemplate">The template string containing Liquid merge fields.</param>
    /// <param name="mergeData">Dictionary of merge data keyed by entity type (e.g., "contact", "company").</param>
    /// <returns>The rendered HTML string with all merge fields resolved.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the template has syntax errors.</exception>
    public async Task<string> RenderAsync(string htmlTemplate, Dictionary<string, object?> mergeData)
    {
        if (string.IsNullOrEmpty(htmlTemplate))
            return string.Empty;

        if (!_parser.TryParse(htmlTemplate, out var template, out var error))
        {
            throw new InvalidOperationException($"Failed to parse Liquid template: {error}");
        }

        var context = new TemplateContext();

        foreach (var kvp in mergeData)
        {
            context.SetValue(kvp.Key, kvp.Value);
        }

        return await template.RenderAsync(context);
    }
}
