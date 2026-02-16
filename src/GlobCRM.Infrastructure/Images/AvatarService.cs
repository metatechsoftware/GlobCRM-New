using GlobCRM.Infrastructure.Storage;
using SkiaSharp;

namespace GlobCRM.Infrastructure.Images;

/// <summary>
/// Processes avatar images using SkiaSharp (MIT license, free).
/// Resizes to 256x256 (full) and 64x64 (thumbnail), encodes as WebP.
/// </summary>
public class AvatarService
{
    private readonly IFileStorageService _fileStorage;

    private const int FullSize = 256;
    private const int ThumbSize = 64;
    private const int WebPQuality = 85;

    public AvatarService(IFileStorageService fileStorage)
    {
        _fileStorage = fileStorage;
    }

    /// <summary>
    /// Processes an uploaded avatar image: resizes to full and thumbnail sizes,
    /// encodes as WebP, and saves via file storage.
    /// </summary>
    /// <param name="tenantId">Tenant identifier for storage partitioning.</param>
    /// <param name="userId">User ID used as the base filename.</param>
    /// <param name="imageStream">Uploaded image stream.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Tuple of (fullPath, thumbPath) relative paths.</returns>
    public async Task<(string fullPath, string thumbPath)> ProcessAndSaveAvatarAsync(
        string tenantId,
        Guid userId,
        Stream imageStream,
        CancellationToken ct = default)
    {
        using var original = SKBitmap.Decode(imageStream)
            ?? throw new ArgumentException("Unable to decode image stream.");

        // Process full-size avatar (256x256 max, maintain aspect ratio)
        var fullBytes = ResizeAndEncode(original, FullSize);
        var fullPath = await _fileStorage.SaveFileAsync(
            tenantId, "avatars", $"{userId}.webp", fullBytes, ct);

        // Process thumbnail (64x64 max, maintain aspect ratio)
        var thumbBytes = ResizeAndEncode(original, ThumbSize);
        var thumbPath = await _fileStorage.SaveFileAsync(
            tenantId, "avatars", $"{userId}_thumb.webp", thumbBytes, ct);

        return (fullPath, thumbPath);
    }

    /// <summary>
    /// Resizes the bitmap to fit within the target size (maintaining aspect ratio)
    /// and encodes as WebP.
    /// </summary>
    private static byte[] ResizeAndEncode(SKBitmap source, int targetSize)
    {
        // Calculate dimensions maintaining aspect ratio
        var (newWidth, newHeight) = CalculateDimensions(source.Width, source.Height, targetSize);

        using var resized = source.Resize(new SKImageInfo(newWidth, newHeight), SKSamplingOptions.Default);
        if (resized == null)
            throw new InvalidOperationException("Failed to resize image.");

        using var image = SKImage.FromBitmap(resized);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, WebPQuality);

        return encoded.ToArray();
    }

    /// <summary>
    /// Calculates new dimensions that fit within targetSize while maintaining aspect ratio.
    /// </summary>
    private static (int width, int height) CalculateDimensions(int originalWidth, int originalHeight, int targetSize)
    {
        if (originalWidth <= targetSize && originalHeight <= targetSize)
            return (originalWidth, originalHeight);

        var ratio = (double)originalWidth / originalHeight;

        if (originalWidth > originalHeight)
        {
            return (targetSize, (int)(targetSize / ratio));
        }
        else
        {
            return ((int)(targetSize * ratio), targetSize);
        }
    }
}
