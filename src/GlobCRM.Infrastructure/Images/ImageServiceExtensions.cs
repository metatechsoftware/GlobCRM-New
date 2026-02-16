using GlobCRM.Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Images;

/// <summary>
/// Extension methods for registering image processing and file storage services.
/// </summary>
public static class ImageServiceExtensions
{
    /// <summary>
    /// Registers AvatarService (scoped) and IFileStorageService (singleton) in DI.
    /// </summary>
    public static IServiceCollection AddImageServices(this IServiceCollection services)
    {
        services.AddSingleton<IFileStorageService, LocalFileStorageService>();
        services.AddScoped<AvatarService>();

        return services;
    }
}
