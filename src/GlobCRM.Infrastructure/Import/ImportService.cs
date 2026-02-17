using System.Globalization;
using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
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

    private const int BatchSize = 100;

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

    /// <summary>
    /// Step 1: Upload and parse a CSV file. Saves the file to storage, parses headers
    /// and sample rows, creates an ImportJob with Pending status.
    /// </summary>
    public async Task<(ImportJob Job, CsvParseResult ParseResult)> UploadAndParseAsync(
        Stream fileStream,
        string fileName,
        ImportEntityType entityType,
        Guid userId,
        Guid tenantId)
    {
        var jobId = Guid.NewGuid();

        // Read the file into memory for both storage and parsing
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        var fileData = memoryStream.ToArray();

        // Save CSV to storage
        var storedPath = await _fileStorage.SaveFileAsync(
            tenantId.ToString(), $"imports/{jobId}", fileName, fileData);

        // Parse headers + sample rows
        memoryStream.Position = 0;
        var parseResult = await _csvParser.ParseHeadersAndSampleAsync(memoryStream);

        // Create ImportJob
        var job = new ImportJob
        {
            Id = jobId,
            TenantId = tenantId,
            UserId = userId,
            EntityType = entityType,
            Status = ImportStatus.Pending,
            OriginalFileName = fileName,
            StoredFilePath = storedPath,
            TotalRows = parseResult.TotalRowCount
        };

        await _importRepository.CreateAsync(job);

        _logger.LogInformation(
            "Import job created: {JobId}, File: {FileName}, Rows: {TotalRows}",
            job.Id, fileName, parseResult.TotalRowCount);

        return (job, parseResult);
    }

    /// <summary>
    /// Step 2: Save field mapping and duplicate strategy for an import job.
    /// </summary>
    public async Task SaveMappingAsync(Guid importJobId, List<ImportFieldMapping> mappings, string duplicateStrategy)
    {
        var job = await _importRepository.GetByIdAsync(importJobId)
            ?? throw new InvalidOperationException($"Import job {importJobId} not found.");

        job.Mappings = mappings;
        job.DuplicateStrategy = duplicateStrategy;
        job.Status = ImportStatus.Mapping;

        await _importRepository.UpdateAsync(job);

        _logger.LogInformation("Import job {JobId} mapping saved: {MappingCount} fields, strategy: {Strategy}",
            importJobId, mappings.Count, duplicateStrategy);
    }

    /// <summary>
    /// Step 3: Preview import with validation and duplicate detection.
    /// Re-reads CSV sample, applies field mappings, validates required fields and
    /// custom field types, and runs duplicate detection.
    /// </summary>
    public async Task<ImportPreviewResult> PreviewAsync(Guid importJobId)
    {
        var job = await _importRepository.GetByIdAsync(importJobId)
            ?? throw new InvalidOperationException($"Import job {importJobId} not found.");

        // Re-read CSV sample
        var fileData = await _fileStorage.GetFileAsync(job.StoredFilePath)
            ?? throw new InvalidOperationException("Import file not found in storage.");

        using var stream = new MemoryStream(fileData);
        var parseResult = await _csvParser.ParseHeadersAndSampleAsync(stream);

        var errors = new List<PreviewError>();
        var validCount = 0;
        var invalidCount = 0;

        // Validate each sample row
        for (var rowIndex = 0; rowIndex < parseResult.SampleRows.Count; rowIndex++)
        {
            var row = parseResult.SampleRows[rowIndex];
            var rowErrors = ValidateRow(job.EntityType, row, job.Mappings);

            if (rowErrors.Count > 0)
            {
                invalidCount++;
                errors.AddRange(rowErrors.Select(e => new PreviewError(rowIndex, e.Field, e.Message)));
            }
            else
            {
                validCount++;
            }
        }

        // Validate custom fields if any mapped
        var customFieldMappings = job.Mappings.Where(m => m.IsCustomField).ToList();
        if (customFieldMappings.Count > 0)
        {
            var entityTypeName = job.EntityType.ToString();
            var fieldDefs = await _customFieldRepository.GetFieldsByEntityTypeAsync(entityTypeName);
            var fieldDefMap = fieldDefs.ToDictionary(f => f.Id.ToString(), f => f);

            for (var rowIndex = 0; rowIndex < parseResult.SampleRows.Count; rowIndex++)
            {
                var row = parseResult.SampleRows[rowIndex];
                foreach (var mapping in customFieldMappings)
                {
                    if (!row.TryGetValue(mapping.CsvColumn, out var csvValue) || string.IsNullOrWhiteSpace(csvValue))
                        continue;

                    if (!fieldDefMap.TryGetValue(mapping.EntityField, out var fieldDef))
                    {
                        errors.Add(new PreviewError(rowIndex, mapping.CsvColumn, $"Custom field '{mapping.EntityField}' not found."));
                        continue;
                    }

                    var typeError = ValidateCustomFieldValue(fieldDef, csvValue);
                    if (typeError != null)
                    {
                        errors.Add(new PreviewError(rowIndex, mapping.CsvColumn, typeError));
                    }
                }
            }
        }

        // Run duplicate detection on sample rows
        var duplicates = await _duplicateDetector.DetectDuplicatesAsync(
            job.EntityType, parseResult.SampleRows, job.Mappings);

        // Update job status
        job.Status = ImportStatus.Previewing;
        await _importRepository.UpdateAsync(job);

        return new ImportPreviewResult(
            validCount,
            invalidCount,
            duplicates.Count,
            errors,
            duplicates);
    }

    /// <summary>
    /// Step 4: Execute the import in background. Streams CSV rows in batches,
    /// creates entities with proper tenant context, handles duplicates per strategy,
    /// and sends SignalR progress updates.
    /// </summary>
    public async Task ExecuteAsync(Guid importJobId, Guid userId)
    {
        var job = await _importRepository.GetByIdAsync(importJobId)
            ?? throw new InvalidOperationException($"Import job {importJobId} not found.");

        job.Status = ImportStatus.Processing;
        job.StartedAt = DateTimeOffset.UtcNow;
        await _importRepository.UpdateAsync(job);

        // Fire-and-forget background execution
        _ = Task.Run(async () =>
        {
            try
            {
                await ExecuteImportInternalAsync(job, userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Import job {JobId} failed unexpectedly", importJobId);

                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var repo = scope.ServiceProvider.GetRequiredService<IImportRepository>();
                    var failedJob = await repo.GetByIdAsync(importJobId);
                    if (failedJob != null)
                    {
                        failedJob.Status = ImportStatus.Failed;
                        failedJob.CompletedAt = DateTimeOffset.UtcNow;
                        await repo.UpdateAsync(failedJob);
                    }

                    await SendProgressAsync(userId, importJobId, job.ProcessedRows, job.TotalRows,
                        job.SuccessCount, job.ErrorCount, ImportStatus.Failed);
                }
                catch (Exception innerEx)
                {
                    _logger.LogError(innerEx, "Failed to update failed import job status {JobId}", importJobId);
                }
            }
        });
    }

    private async Task ExecuteImportInternalAsync(ImportJob job, Guid userId)
    {
        // Read CSV file from storage
        var fileData = await _fileStorage.GetFileAsync(job.StoredFilePath)
            ?? throw new InvalidOperationException("Import file not found in storage.");

        using var stream = new MemoryStream(fileData);

        var processed = 0;
        var successCount = 0;
        var errorCount = 0;
        var duplicateCount = 0;
        var batch = new List<Dictionary<string, string>>();

        await foreach (var row in _csvParser.StreamRowsAsync(stream))
        {
            batch.Add(row);

            if (batch.Count >= BatchSize)
            {
                var batchResult = await ProcessBatchAsync(job, batch, userId);
                successCount += batchResult.Success;
                errorCount += batchResult.Errors;
                duplicateCount += batchResult.Duplicates;
                processed += batch.Count;
                batch.Clear();

                // Update progress in a fresh scope
                await UpdateJobProgressAsync(job.Id, processed, successCount, errorCount, duplicateCount);
                await SendProgressAsync(userId, job.Id, processed, job.TotalRows,
                    successCount, errorCount, ImportStatus.Processing);
            }
        }

        // Process remaining rows
        if (batch.Count > 0)
        {
            var batchResult = await ProcessBatchAsync(job, batch, userId);
            successCount += batchResult.Success;
            errorCount += batchResult.Errors;
            duplicateCount += batchResult.Duplicates;
            processed += batch.Count;
        }

        // Final update
        using var finalScope = _scopeFactory.CreateScope();
        var finalRepo = finalScope.ServiceProvider.GetRequiredService<IImportRepository>();
        var completedJob = await finalRepo.GetByIdAsync(job.Id);
        if (completedJob != null)
        {
            completedJob.Status = ImportStatus.Completed;
            completedJob.ProcessedRows = processed;
            completedJob.SuccessCount = successCount;
            completedJob.ErrorCount = errorCount;
            completedJob.DuplicateCount = duplicateCount;
            completedJob.CompletedAt = DateTimeOffset.UtcNow;
            await finalRepo.UpdateAsync(completedJob);
        }

        await SendProgressAsync(userId, job.Id, processed, job.TotalRows,
            successCount, errorCount, ImportStatus.Completed);

        _logger.LogInformation(
            "Import job {JobId} completed: {Success} succeeded, {Errors} failed, {Duplicates} duplicates",
            job.Id, successCount, errorCount, duplicateCount);
    }

    private async Task<BatchResult> ProcessBatchAsync(
        ImportJob job,
        List<Dictionary<string, string>> batch,
        Guid userId)
    {
        var success = 0;
        var errors = 0;
        var duplicates = 0;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Detect duplicates in batch
        var duplicateDetector = scope.ServiceProvider.GetRequiredService<DuplicateDetector>();
        var batchDuplicates = await duplicateDetector.DetectDuplicatesAsync(
            job.EntityType, batch, job.Mappings);
        var duplicateRowIndices = batchDuplicates.Select(d => d.RowIndex).ToHashSet();

        for (var i = 0; i < batch.Count; i++)
        {
            var row = batch[i];

            try
            {
                // Handle duplicates based on strategy
                if (duplicateRowIndices.Contains(i))
                {
                    var match = batchDuplicates.First(d => d.RowIndex == i);
                    duplicates++;

                    switch (job.DuplicateStrategy.ToLowerInvariant())
                    {
                        case "skip":
                            continue;

                        case "overwrite":
                            await UpdateExistingEntityAsync(db, job, row, match.ExistingEntityId);
                            success++;
                            continue;

                        case "merge":
                            await MergeEntityAsync(db, job, row, match.ExistingEntityId);
                            success++;
                            continue;

                        default:
                            continue; // Unknown strategy -> skip
                    }
                }

                // Validate row
                var rowErrors = ValidateRow(job.EntityType, row, job.Mappings);
                if (rowErrors.Count > 0)
                {
                    errors++;
                    foreach (var error in rowErrors)
                    {
                        db.ImportJobErrors.Add(new ImportJobError
                        {
                            ImportJobId = job.Id,
                            RowNumber = job.ProcessedRows + i + 1,
                            FieldName = error.Field,
                            ErrorMessage = error.Message,
                            RawValue = row.TryGetValue(error.Field, out var rawVal) ? rawVal : null
                        });
                    }
                    continue;
                }

                // Create entity
                await CreateEntityFromRowAsync(db, job, row, userId);
                success++;
            }
            catch (Exception ex)
            {
                errors++;
                _logger.LogWarning(ex, "Error processing row {RowIndex} in import {JobId}", i, job.Id);
                db.ImportJobErrors.Add(new ImportJobError
                {
                    ImportJobId = job.Id,
                    RowNumber = job.ProcessedRows + i + 1,
                    FieldName = "General",
                    ErrorMessage = ex.Message
                });
            }
        }

        await db.SaveChangesAsync();

        return new BatchResult(success, errors, duplicates);
    }

    private async Task CreateEntityFromRowAsync(
        ApplicationDbContext db,
        ImportJob job,
        Dictionary<string, string> row,
        Guid userId)
    {
        switch (job.EntityType)
        {
            case ImportEntityType.Contact:
                var contact = new Contact
                {
                    TenantId = job.TenantId,
                    OwnerId = userId
                };
                ApplyContactMappings(contact, row, job.Mappings);
                db.Contacts.Add(contact);
                break;

            case ImportEntityType.Company:
                var company = new Company
                {
                    TenantId = job.TenantId,
                    OwnerId = userId
                };
                ApplyCompanyMappings(company, row, job.Mappings);
                db.Companies.Add(company);
                break;

            case ImportEntityType.Deal:
                var deal = new Deal
                {
                    TenantId = job.TenantId,
                    OwnerId = userId
                };
                await ApplyDealMappingsAsync(db, deal, row, job.Mappings);
                db.Deals.Add(deal);
                break;
        }
    }

    private async Task UpdateExistingEntityAsync(
        ApplicationDbContext db,
        ImportJob job,
        Dictionary<string, string> row,
        Guid existingEntityId)
    {
        switch (job.EntityType)
        {
            case ImportEntityType.Contact:
                var contact = await db.Contacts.FindAsync(existingEntityId);
                if (contact != null)
                {
                    ApplyContactMappings(contact, row, job.Mappings);
                    contact.UpdatedAt = DateTimeOffset.UtcNow;
                }
                break;

            case ImportEntityType.Company:
                var company = await db.Companies.FindAsync(existingEntityId);
                if (company != null)
                {
                    ApplyCompanyMappings(company, row, job.Mappings);
                    company.UpdatedAt = DateTimeOffset.UtcNow;
                }
                break;

            case ImportEntityType.Deal:
                var deal = await db.Deals.FindAsync(existingEntityId);
                if (deal != null)
                {
                    await ApplyDealMappingsAsync(db, deal, row, job.Mappings);
                    deal.UpdatedAt = DateTimeOffset.UtcNow;
                }
                break;
        }
    }

    private async Task MergeEntityAsync(
        ApplicationDbContext db,
        ImportJob job,
        Dictionary<string, string> row,
        Guid existingEntityId)
    {
        // Merge: only update non-null/non-empty fields on the existing entity
        switch (job.EntityType)
        {
            case ImportEntityType.Contact:
                var contact = await db.Contacts.FindAsync(existingEntityId);
                if (contact != null)
                {
                    ApplyContactMappings(contact, row, job.Mappings, mergeMode: true);
                    contact.UpdatedAt = DateTimeOffset.UtcNow;
                }
                break;

            case ImportEntityType.Company:
                var company = await db.Companies.FindAsync(existingEntityId);
                if (company != null)
                {
                    ApplyCompanyMappings(company, row, job.Mappings, mergeMode: true);
                    company.UpdatedAt = DateTimeOffset.UtcNow;
                }
                break;

            case ImportEntityType.Deal:
                var deal = await db.Deals.FindAsync(existingEntityId);
                if (deal != null)
                {
                    await ApplyDealMappingsAsync(db, deal, row, job.Mappings, mergeMode: true);
                    deal.UpdatedAt = DateTimeOffset.UtcNow;
                }
                break;
        }
    }

    // ---- Field Mapping Application ----

    private static void ApplyContactMappings(
        Contact contact,
        Dictionary<string, string> row,
        List<ImportFieldMapping> mappings,
        bool mergeMode = false)
    {
        foreach (var mapping in mappings.Where(m => !m.IsCustomField))
        {
            if (!row.TryGetValue(mapping.CsvColumn, out var value) || string.IsNullOrWhiteSpace(value))
                continue;

            var trimmed = value.Trim();

            switch (mapping.EntityField.ToLowerInvariant())
            {
                case "firstname":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.FirstName))
                        contact.FirstName = trimmed;
                    break;
                case "lastname":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.LastName))
                        contact.LastName = trimmed;
                    break;
                case "email":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.Email))
                        contact.Email = trimmed;
                    break;
                case "phone":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.Phone))
                        contact.Phone = trimmed;
                    break;
                case "mobilephone":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.MobilePhone))
                        contact.MobilePhone = trimmed;
                    break;
                case "jobtitle":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.JobTitle))
                        contact.JobTitle = trimmed;
                    break;
                case "department":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.Department))
                        contact.Department = trimmed;
                    break;
                case "address":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.Address))
                        contact.Address = trimmed;
                    break;
                case "city":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.City))
                        contact.City = trimmed;
                    break;
                case "state":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.State))
                        contact.State = trimmed;
                    break;
                case "country":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.Country))
                        contact.Country = trimmed;
                    break;
                case "postalcode":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.PostalCode))
                        contact.PostalCode = trimmed;
                    break;
                case "description":
                    if (!mergeMode || string.IsNullOrWhiteSpace(contact.Description))
                        contact.Description = trimmed;
                    break;
            }
        }

        // Apply custom field mappings
        ApplyCustomFieldMappings(contact.CustomFields, row, mappings.Where(m => m.IsCustomField));
    }

    private static void ApplyCompanyMappings(
        Company company,
        Dictionary<string, string> row,
        List<ImportFieldMapping> mappings,
        bool mergeMode = false)
    {
        foreach (var mapping in mappings.Where(m => !m.IsCustomField))
        {
            if (!row.TryGetValue(mapping.CsvColumn, out var value) || string.IsNullOrWhiteSpace(value))
                continue;

            var trimmed = value.Trim();

            switch (mapping.EntityField.ToLowerInvariant())
            {
                case "name":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Name))
                        company.Name = trimmed;
                    break;
                case "industry":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Industry))
                        company.Industry = trimmed;
                    break;
                case "website":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Website))
                        company.Website = trimmed;
                    break;
                case "phone":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Phone))
                        company.Phone = trimmed;
                    break;
                case "email":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Email))
                        company.Email = trimmed;
                    break;
                case "address":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Address))
                        company.Address = trimmed;
                    break;
                case "city":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.City))
                        company.City = trimmed;
                    break;
                case "state":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.State))
                        company.State = trimmed;
                    break;
                case "country":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Country))
                        company.Country = trimmed;
                    break;
                case "postalcode":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.PostalCode))
                        company.PostalCode = trimmed;
                    break;
                case "size":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Size))
                        company.Size = trimmed;
                    break;
                case "description":
                    if (!mergeMode || string.IsNullOrWhiteSpace(company.Description))
                        company.Description = trimmed;
                    break;
            }
        }

        ApplyCustomFieldMappings(company.CustomFields, row, mappings.Where(m => m.IsCustomField));
    }

    private static async Task ApplyDealMappingsAsync(
        ApplicationDbContext db,
        Deal deal,
        Dictionary<string, string> row,
        List<ImportFieldMapping> mappings,
        bool mergeMode = false)
    {
        foreach (var mapping in mappings.Where(m => !m.IsCustomField))
        {
            if (!row.TryGetValue(mapping.CsvColumn, out var value) || string.IsNullOrWhiteSpace(value))
                continue;

            var trimmed = value.Trim();

            switch (mapping.EntityField.ToLowerInvariant())
            {
                case "title":
                    if (!mergeMode || string.IsNullOrWhiteSpace(deal.Title))
                        deal.Title = trimmed;
                    break;
                case "value":
                    if (decimal.TryParse(trimmed, NumberStyles.Any, CultureInfo.InvariantCulture, out var dealValue))
                    {
                        if (!mergeMode || !deal.Value.HasValue)
                            deal.Value = dealValue;
                    }
                    break;
                case "probability":
                    if (decimal.TryParse(trimmed, NumberStyles.Any, CultureInfo.InvariantCulture, out var prob))
                    {
                        // Accept 0-100 and convert to 0-1, or accept 0-1 directly
                        if (prob > 1) prob /= 100m;
                        if (!mergeMode || !deal.Probability.HasValue)
                            deal.Probability = prob;
                    }
                    break;
                case "expectedclosedate":
                    if (DateOnly.TryParse(trimmed, out var closeDate))
                    {
                        if (!mergeMode || !deal.ExpectedCloseDate.HasValue)
                            deal.ExpectedCloseDate = closeDate;
                    }
                    break;
                case "description":
                    if (!mergeMode || string.IsNullOrWhiteSpace(deal.Description))
                        deal.Description = trimmed;
                    break;
                case "pipeline":
                    // Resolve pipeline name to ID
                    var pipeline = await db.Pipelines
                        .FirstOrDefaultAsync(p => p.Name.ToLower() == trimmed.ToLower());
                    if (pipeline != null && (!mergeMode || deal.PipelineId == Guid.Empty))
                    {
                        deal.PipelineId = pipeline.Id;
                        // Set default stage if not already set
                        if (deal.PipelineStageId == Guid.Empty)
                        {
                            var firstStage = await db.PipelineStages
                                .Where(s => s.PipelineId == pipeline.Id)
                                .OrderBy(s => s.SortOrder)
                                .FirstOrDefaultAsync();
                            if (firstStage != null)
                                deal.PipelineStageId = firstStage.Id;
                        }
                    }
                    break;
                case "stage":
                    // Resolve stage name to ID (requires pipeline to be set)
                    if (deal.PipelineId != Guid.Empty)
                    {
                        var stage = await db.PipelineStages
                            .FirstOrDefaultAsync(s => s.PipelineId == deal.PipelineId &&
                                                      s.Name.ToLower() == trimmed.ToLower());
                        if (stage != null && (!mergeMode || deal.PipelineStageId == Guid.Empty))
                            deal.PipelineStageId = stage.Id;
                    }
                    break;
            }
        }

        // If pipeline/stage still not set, use default pipeline and first stage
        if (deal.PipelineId == Guid.Empty)
        {
            var defaultPipeline = await db.Pipelines
                .FirstOrDefaultAsync(p => p.IsDefault);
            if (defaultPipeline != null)
            {
                deal.PipelineId = defaultPipeline.Id;
                if (deal.PipelineStageId == Guid.Empty)
                {
                    var firstStage = await db.PipelineStages
                        .Where(s => s.PipelineId == defaultPipeline.Id)
                        .OrderBy(s => s.SortOrder)
                        .FirstOrDefaultAsync();
                    if (firstStage != null)
                        deal.PipelineStageId = firstStage.Id;
                }
            }
        }

        ApplyCustomFieldMappings(deal.CustomFields, row, mappings.Where(m => m.IsCustomField));
    }

    private static void ApplyCustomFieldMappings(
        Dictionary<string, object?> customFields,
        Dictionary<string, string> row,
        IEnumerable<ImportFieldMapping> customMappings)
    {
        foreach (var mapping in customMappings)
        {
            if (!row.TryGetValue(mapping.CsvColumn, out var value) || string.IsNullOrWhiteSpace(value))
                continue;

            // Store as the raw string value -- custom field definitions handle type interpretation
            customFields[mapping.EntityField] = value.Trim();
        }
    }

    // ---- Validation ----

    private static List<RowError> ValidateRow(
        ImportEntityType entityType,
        Dictionary<string, string> row,
        List<ImportFieldMapping> mappings)
    {
        var errors = new List<RowError>();

        switch (entityType)
        {
            case ImportEntityType.Contact:
                var firstNameMapping = mappings.FirstOrDefault(m => m.EntityField.Equals("FirstName", StringComparison.OrdinalIgnoreCase));
                var lastNameMapping = mappings.FirstOrDefault(m => m.EntityField.Equals("LastName", StringComparison.OrdinalIgnoreCase));

                if (firstNameMapping == null || !row.TryGetValue(firstNameMapping.CsvColumn, out var fn) || string.IsNullOrWhiteSpace(fn))
                    errors.Add(new RowError("FirstName", "First name is required."));

                if (lastNameMapping == null || !row.TryGetValue(lastNameMapping.CsvColumn, out var ln) || string.IsNullOrWhiteSpace(ln))
                    errors.Add(new RowError("LastName", "Last name is required."));
                break;

            case ImportEntityType.Company:
                var nameMapping = mappings.FirstOrDefault(m => m.EntityField.Equals("Name", StringComparison.OrdinalIgnoreCase));

                if (nameMapping == null || !row.TryGetValue(nameMapping.CsvColumn, out var name) || string.IsNullOrWhiteSpace(name))
                    errors.Add(new RowError("Name", "Company name is required."));
                break;

            case ImportEntityType.Deal:
                var titleMapping = mappings.FirstOrDefault(m => m.EntityField.Equals("Title", StringComparison.OrdinalIgnoreCase));

                if (titleMapping == null || !row.TryGetValue(titleMapping.CsvColumn, out var title) || string.IsNullOrWhiteSpace(title))
                    errors.Add(new RowError("Title", "Deal title is required."));
                break;
        }

        return errors;
    }

    private static string? ValidateCustomFieldValue(CustomFieldDefinition fieldDef, string csvValue)
    {
        return fieldDef.FieldType switch
        {
            CustomFieldType.Number or CustomFieldType.Currency =>
                !decimal.TryParse(csvValue, NumberStyles.Any, CultureInfo.InvariantCulture, out _)
                    ? $"'{fieldDef.Label}' must be a numeric value."
                    : null,

            CustomFieldType.Date =>
                !DateTimeOffset.TryParse(csvValue, out _)
                    ? $"'{fieldDef.Label}' must be a valid date."
                    : null,

            CustomFieldType.Checkbox =>
                !IsValidBooleanString(csvValue)
                    ? $"'{fieldDef.Label}' must be true/false/yes/no/1/0."
                    : null,

            CustomFieldType.Dropdown =>
                fieldDef.Options != null && !fieldDef.Options.Any(o => o.Value.Equals(csvValue, StringComparison.OrdinalIgnoreCase))
                    ? $"'{fieldDef.Label}' must be one of the defined options."
                    : null,

            _ => null // Text, MultiSelect (semicolons), File, Relation handled at import time
        };
    }

    private static bool IsValidBooleanString(string value)
    {
        var lower = value.Trim().ToLowerInvariant();
        return lower is "true" or "false" or "yes" or "no" or "1" or "0";
    }

    // ---- Progress ----

    private async Task UpdateJobProgressAsync(Guid jobId, int processed, int success, int errors, int duplicates)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IImportRepository>();
        var job = await repo.GetByIdAsync(jobId);
        if (job != null)
        {
            job.ProcessedRows = processed;
            job.SuccessCount = success;
            job.ErrorCount = errors;
            job.DuplicateCount = duplicates;
            await repo.UpdateAsync(job);
        }
    }

    private async Task SendProgressAsync(
        Guid userId, Guid importJobId, int processed, int total,
        int successCount, int errorCount, ImportStatus status)
    {
        try
        {
            await _hubContext.Clients.User(userId.ToString()).SendAsync("ImportProgress", new
            {
                ImportJobId = importJobId,
                ProcessedRows = processed,
                TotalRows = total,
                SuccessCount = successCount,
                ErrorCount = errorCount,
                Status = status.ToString()
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send import progress via SignalR for job {JobId}", importJobId);
        }
    }

    private record RowError(string Field, string Message);
    private record BatchResult(int Success, int Errors, int Duplicates);
}

/// <summary>
/// Result of import preview with validation and duplicate detection.
/// </summary>
public record ImportPreviewResult(
    int ValidCount,
    int InvalidCount,
    int DuplicateCount,
    List<PreviewError> Errors,
    List<DuplicateMatch> Duplicates);

/// <summary>
/// A validation error found during import preview for a specific row and field.
/// </summary>
public record PreviewError(int RowIndex, string FieldName, string ErrorMessage);
