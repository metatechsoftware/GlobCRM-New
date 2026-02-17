using Microsoft.Extensions.DependencyInjection;
using QuestPDF.Infrastructure;

namespace GlobCRM.Infrastructure.Pdf;

/// <summary>
/// DI extension methods for PDF generation services.
/// Configures QuestPDF community license at startup.
/// </summary>
public static class PdfServiceExtensions
{
    /// <summary>
    /// Registers PDF-related services and configures QuestPDF license.
    /// Call from Program.cs at startup.
    /// </summary>
    public static IServiceCollection AddPdfServices(this IServiceCollection services)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        return services;
    }
}
