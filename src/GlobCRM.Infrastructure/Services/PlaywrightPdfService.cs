using Microsoft.Extensions.Logging;
using Microsoft.Playwright;

namespace GlobCRM.Infrastructure.Services;

/// <summary>
/// Singleton service for HTML-to-PDF and PNG thumbnail generation using Playwright Chromium.
/// Maintains a single browser instance across the application lifetime for performance.
/// Each operation creates a new browser context (cheap, ~5ms) which is disposed after use.
/// </summary>
public class PlaywrightPdfService : IAsyncDisposable
{
    private readonly ILogger<PlaywrightPdfService> _logger;
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public PlaywrightPdfService(ILogger<PlaywrightPdfService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Lazy-initializes the Playwright instance and Chromium browser with double-check locking.
    /// </summary>
    private async Task<IBrowser> GetBrowserAsync()
    {
        if (_browser != null) return _browser;

        await _initLock.WaitAsync();
        try
        {
            if (_browser != null) return _browser;

            _logger.LogInformation("Initializing Playwright Chromium browser for PDF generation");
            _playwright = await Playwright.CreateAsync();
            _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = true
            });
            _logger.LogInformation("Playwright Chromium browser initialized successfully");

            return _browser;
        }
        finally
        {
            _initLock.Release();
        }
    }

    /// <summary>
    /// Generates a PDF from HTML content using the specified options.
    /// Creates a new browser context per call for isolation and disposes it after use.
    /// </summary>
    /// <param name="html">The HTML content to render as PDF.</param>
    /// <param name="options">PDF generation options (page size, orientation, margins).</param>
    /// <returns>PDF file content as byte array.</returns>
    public async Task<byte[]> GeneratePdfAsync(string html, PdfGenerationOptions options)
    {
        var browser = await GetBrowserAsync();
        var context = await browser.NewContextAsync();

        try
        {
            var page = await context.NewPageAsync();
            await page.SetContentAsync(html, new PageSetContentOptions
            {
                WaitUntil = WaitUntilState.NetworkIdle
            });

            var pdfOptions = new PagePdfOptions
            {
                PrintBackground = true,
                Margin = new Margin
                {
                    Top = options.MarginTop,
                    Right = options.MarginRight,
                    Bottom = options.MarginBottom,
                    Left = options.MarginLeft
                }
            };

            // Map page size to Playwright format
            if (options.Landscape)
            {
                pdfOptions.Landscape = true;
            }

            // Playwright accepts "A4", "Letter", etc. as format strings
            pdfOptions.Format = options.PageSize;

            return await page.PdfAsync(pdfOptions);
        }
        finally
        {
            await context.CloseAsync();
        }
    }

    /// <summary>
    /// Generates a PNG thumbnail screenshot of the HTML content.
    /// Uses a viewport matching the desired thumbnail dimensions for first-page capture.
    /// </summary>
    /// <param name="html">The HTML content to screenshot.</param>
    /// <param name="width">Viewport width in pixels (default 400).</param>
    /// <param name="height">Viewport height in pixels (default 566, A4 aspect ratio).</param>
    /// <returns>PNG image content as byte array.</returns>
    public async Task<byte[]> GenerateThumbnailAsync(string html, int width = 400, int height = 566)
    {
        var browser = await GetBrowserAsync();
        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            ViewportSize = new ViewportSize { Width = width, Height = height }
        });

        try
        {
            var page = await context.NewPageAsync();
            await page.SetContentAsync(html, new PageSetContentOptions
            {
                WaitUntil = WaitUntilState.NetworkIdle
            });

            return await page.ScreenshotAsync(new PageScreenshotOptions
            {
                Type = ScreenshotType.Png,
                FullPage = false // Capture only viewport (first page)
            });
        }
        finally
        {
            await context.CloseAsync();
        }
    }

    /// <summary>
    /// Disposes the Playwright browser and instance on application shutdown.
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_browser != null)
            {
                await _browser.CloseAsync();
                _browser = null;
            }

            if (_playwright != null)
            {
                _playwright.Dispose();
                _playwright = null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error disposing Playwright browser resources");
        }
    }
}

/// <summary>
/// Options for PDF generation specifying page layout and margins.
/// </summary>
/// <param name="PageSize">Page size format: "A4" or "Letter".</param>
/// <param name="Landscape">Whether to use landscape orientation.</param>
/// <param name="MarginTop">Top margin (e.g., "20mm").</param>
/// <param name="MarginRight">Right margin (e.g., "15mm").</param>
/// <param name="MarginBottom">Bottom margin (e.g., "20mm").</param>
/// <param name="MarginLeft">Left margin (e.g., "15mm").</param>
public record PdfGenerationOptions(
    string PageSize = "A4",
    bool Landscape = false,
    string MarginTop = "20mm",
    string MarginRight = "15mm",
    string MarginBottom = "20mm",
    string MarginLeft = "15mm"
);
