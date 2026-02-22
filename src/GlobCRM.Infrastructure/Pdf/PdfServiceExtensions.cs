using GlobCRM.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using QuestPDF.Infrastructure;

namespace GlobCRM.Infrastructure.Pdf;

/// <summary>
/// DI extension methods for PDF generation services.
/// Configures QuestPDF community license and registers PlaywrightPdfService at startup.
/// </summary>
public static class PdfServiceExtensions
{
    /// <summary>
    /// Registers PDF-related services and configures QuestPDF license.
    /// PlaywrightPdfService is registered as singleton for custom template PDF generation.
    /// QuestPDF is kept for the built-in default template (backward compatibility).
    /// Call from Program.cs at startup.
    /// </summary>
    public static IServiceCollection AddPdfServices(this IServiceCollection services)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        // Playwright-based PDF generation for custom quote templates (singleton browser instance)
        services.AddSingleton<PlaywrightPdfService>();

        return services;
    }
}
