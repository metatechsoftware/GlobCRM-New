using System.Text.Json;
using GlobCRM.Application.Common;
using GlobCRM.Infrastructure.EmailTemplates;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Workflow action that sends an email using an email template.
/// Reuses TemplateRenderService and MergeFieldService from Phase 14.
/// Follows the same merge data resolution pattern as the email template preview endpoint.
/// </summary>
public class SendEmailAction
{
    private readonly TemplateRenderService _renderService;
    private readonly MergeFieldService _mergeFieldService;
    private readonly IEmailService _emailService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SendEmailAction> _logger;

    public SendEmailAction(
        TemplateRenderService renderService,
        MergeFieldService mergeFieldService,
        IEmailService emailService,
        ApplicationDbContext db,
        ILogger<SendEmailAction> logger)
    {
        _renderService = renderService;
        _mergeFieldService = mergeFieldService;
        _emailService = emailService;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Executes the send email action.
    /// </summary>
    /// <param name="configJson">JSON config: { EmailTemplateId, RecipientField }</param>
    /// <param name="entityData">Current entity data for merge field resolution.</param>
    /// <param name="context">Trigger context with entity type and ID.</param>
    public async Task ExecuteAsync(
        string configJson,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var config = JsonSerializer.Deserialize<SendEmailConfig>(configJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (config is null || config.EmailTemplateId == Guid.Empty)
            throw new InvalidOperationException("SendEmail action requires EmailTemplateId in config");

        // Load email template
        var template = await _db.EmailTemplates
            .FirstOrDefaultAsync(t => t.Id == config.EmailTemplateId);

        if (template is null)
        {
            _logger.LogWarning(
                "SendEmail action: template {TemplateId} not found — skipping",
                config.EmailTemplateId);
            return;
        }

        // Resolve merge data for the entity (same as Phase 14 preview endpoint)
        var mergeData = await _mergeFieldService.ResolveEntityDataAsync(
            context.EntityType.ToLower(), context.EntityId);

        var templateData = new Dictionary<string, object?>
        {
            [context.EntityType.ToLower()] = mergeData
        };

        // Render template body and subject
        var renderedHtml = await _renderService.RenderAsync(template.HtmlBody, templateData);
        var renderedSubject = await _renderService.RenderAsync(
            template.Subject ?? "No Subject", templateData);

        // Resolve recipient email from entity data
        var recipientField = config.RecipientField ?? "email";
        var recipientEmail = WorkflowConditionEvaluator.GetFieldValue(recipientField, entityData)?.ToString();

        if (string.IsNullOrEmpty(recipientEmail))
        {
            _logger.LogWarning(
                "SendEmail action: no email found in field {RecipientField} for {EntityType}/{EntityId}",
                recipientField, context.EntityType, context.EntityId);
            return;
        }

        // Send via IEmailService
        await _emailService.SendRawEmailAsync(recipientEmail, renderedSubject, renderedHtml);

        _logger.LogDebug(
            "SendEmail action: sent template {TemplateId} to {Email}",
            config.EmailTemplateId, recipientEmail);
    }

    private class SendEmailConfig
    {
        public Guid EmailTemplateId { get; set; }
        public string? RecipientField { get; set; }
    }
}
