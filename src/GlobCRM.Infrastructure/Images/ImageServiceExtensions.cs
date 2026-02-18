using GlobCRM.Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Images;

/// <summary>
/// Extension methods for registering image processing and file storage services.
/// </summary>
public static class ImageServiceExtensions
{
    /// <summary>
    /// Registers AvatarService (scoped) and IFileStorageService in DI.
    /// IFileStorageService provider is selected based on FileStorage:Provider configuration:
    ///   - "Azure": AzureBlobStorageService (scoped, requires FileStorage:Azure:ConnectionString)
    ///   - "Local" (default): LocalFileStorageService (singleton, uses FileStorage:BasePath)
    /// </summary>
    public static IServiceCollection AddImageServices(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration["FileStorage:Provider"] ?? "Local";

        if (string.Equals(provider, "Azure", StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<IFileStorageService, AzureBlobStorageService>();
        }
        else
        {
            services.AddSingleton<IFileStorageService, LocalFileStorageService>();
        }

        services.AddScoped<AvatarService>();

        return services;
    }
}
