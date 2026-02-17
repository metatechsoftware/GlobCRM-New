using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Import;

/// <summary>
/// Core import service handling the full CSV import pipeline:
/// upload + parse -> field mapping -> preview with validation/duplicate detection ->
/// batch execution with SignalR progress -> error reporting.
///
/// Uses IServiceScopeFactory for fresh DbContext per batch to manage memory
/// and avoid long-lived change tracking during large imports.
/// </summary>
public class ImportService
{
    private readonly IImportRepository _importRepository;
    private readonly CsvParserService _csvParser;
    private readonly DuplicateDetector _duplicateDetector;
    private readonly IFileStorageService _fileStorage;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<CrmHub> _hubContext;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly ILogger<ImportService> _logger;

    public ImportService(
        IImportRepository importRepository,
        CsvParserService csvParser,
        DuplicateDetector duplicateDetector,
        IFileStorageService fileStorage,
        IServiceScopeFactory scopeFactory,
        IHubContext<CrmHub> hubContext,
        ICustomFieldRepository customFieldRepository,
        ILogger<ImportService> logger)
    {
        _importRepository = importRepository;
        _csvParser = csvParser;
        _duplicateDetector = duplicateDetector;
        _fileStorage = fileStorage;
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _customFieldRepository = customFieldRepository;
        _logger = logger;
    }
}
