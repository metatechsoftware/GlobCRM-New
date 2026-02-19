using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.BackgroundJobs;
using GlobCRM.Infrastructure.EmailTemplates;
using GlobCRM.Infrastructure.Persistence;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Sequences;

/// <summary>
/// Hangfire job service that executes sequence steps: loads enrollment, renders template
/// with merge data, injects tracking, sends email, and schedules the next step.
/// Follows the WebhookDeliveryService pattern for Hangfire job structure.
///
/// Critical guards:
/// - Re-checks enrollment status at job start (defense against pause/unenroll race condition)
/// - Null-safe for template deletion (logs warning, schedules next step anyway)
/// - Only primitive IDs passed as job arguments (avoids Hangfire serialization pitfalls)
/// </summary>
public class SequenceExecutionService
{
    /// <summary>
    /// Hangfire queue name for sequence email delivery jobs.
    /// </summary>
    public const string QueueName = "emails";

    private readonly ISequenceEnrollmentRepository _enrollmentRepository;
    private readonly IEmailSequenceRepository _sequenceRepository;
    private readonly ApplicationDbContext _db;
    private readonly TemplateRenderService _renderService;
    private readonly MergeFieldService _mergeFieldService;
    private readonly EmailTrackingService _trackingService;
    private readonly SequenceEmailSender _emailSender;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<SequenceExecutionService> _logger;

    public SequenceExecutionService(
        ISequenceEnrollmentRepository enrollmentRepository,
        IEmailSequenceRepository sequenceRepository,
        ApplicationDbContext db,
        TemplateRenderService renderService,
        MergeFieldService mergeFieldService,
        EmailTrackingService trackingService,
        SequenceEmailSender emailSender,
        IBackgroundJobClient jobClient,
        ILogger<SequenceExecutionService> logger)
    {
        _enrollmentRepository = enrollmentRepository;
        _sequenceRepository = sequenceRepository;
        _db = db;
        _renderService = renderService;
        _mergeFieldService = mergeFieldService;
        _trackingService = trackingService;
        _emailSender = emailSender;
        _jobClient = jobClient;
        _logger = logger;
    }

    /// <summary>
    /// Executes a single sequence step for an enrollment.
    /// Called by Hangfire on the "emails" queue.
    /// </summary>
    /// <param name="enrollmentId">The enrollment to advance.</param>
    /// <param name="stepNumber">The step number to execute (1-based).</param>
    /// <param name="tenantId">Tenant ID for setting background job context.</param>
    [Queue(QueueName)]
    [AutomaticRetry(Attempts = 3)]
    public async Task ExecuteStepAsync(Guid enrollmentId, int stepNumber, Guid tenantId)
    {
        // Set tenant context for DbContext global query filters in Hangfire job
        TenantScope.SetCurrentTenant(tenantId);

        _logger.LogInformation(
            "Executing sequence step: enrollment {EnrollmentId} step {StepNumber}",
            enrollmentId, stepNumber);

        // Critical guard: re-check enrollment status (handles pause/unenroll race condition)
        var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
        if (enrollment is null || enrollment.Status != EnrollmentStatus.Active)
        {
            _logger.LogInformation(
                "Sequence step skipped: enrollment {EnrollmentId} is {Status}",
                enrollmentId, enrollment?.Status.ToString() ?? "not found");
            return;
        }

        // Load the step definition
        var step = await _sequenceRepository.GetStepAsync(enrollment.SequenceId, stepNumber);
        if (step is null)
        {
            _logger.LogWarning(
                "Sequence step not found: sequence {SequenceId} step {StepNumber}",
                enrollment.SequenceId, stepNumber);
            return;
        }

        // Load contact with Company include for merge data
        var contact = await _db.Contacts
            .Include(c => c.Company)
            .FirstOrDefaultAsync(c => c.Id == enrollment.ContactId);

        if (contact?.Email is null)
        {
            _logger.LogWarning(
                "Skipping step: contact {ContactId} has no email address",
                enrollment.ContactId);
            await ScheduleNextStepOrComplete(enrollment, stepNumber, tenantId);
            return;
        }

        // Resolve merge data for template rendering
        var mergeData = await _mergeFieldService.ResolveEntityDataAsync(
            "contact", enrollment.ContactId);

        // Load email template
        var template = await _db.EmailTemplates
            .FirstOrDefaultAsync(t => t.Id == step.EmailTemplateId);

        if (template is null)
        {
            _logger.LogWarning(
                "Template {TemplateId} not found for step {StepNumber} -- skipping send, scheduling next step",
                step.EmailTemplateId, stepNumber);
            await ScheduleNextStepOrComplete(enrollment, stepNumber, tenantId);
            return;
        }

        // Render HTML body with merge data
        var renderedHtml = await _renderService.RenderAsync(
            template.HtmlBody,
            new Dictionary<string, object?> { ["contact"] = mergeData });

        // Render subject (step override > template subject > fallback)
        var subjectTemplate = step.SubjectOverride ?? template.Subject ?? "No Subject";
        var renderedSubject = await _renderService.RenderAsync(
            subjectTemplate,
            new Dictionary<string, object?> { ["contact"] = mergeData });

        // Inject tracking pixel and link wrapping
        var trackedHtml = _trackingService.InjectTracking(renderedHtml, enrollment.Id, stepNumber);

        // Send the email
        await _emailSender.SendSequenceEmailAsync(
            contact.Email,
            renderedSubject,
            trackedHtml,
            enrollment.Id,
            stepNumber,
            enrollment.SequenceId,
            enrollment.CreatedByUserId,
            tenantId);

        // Update enrollment progress
        enrollment.CurrentStepNumber = stepNumber;
        enrollment.LastStepSentAt = DateTimeOffset.UtcNow;
        enrollment.StepsSent++;

        // Schedule next step or mark as completed
        await ScheduleNextStepOrComplete(enrollment, stepNumber, tenantId);

        _logger.LogInformation(
            "Sequence step executed: enrollment {EnrollmentId} step {StepNumber} sent to {Email}",
            enrollmentId, stepNumber, contact.Email);
    }

    /// <summary>
    /// Checks for the next step and either schedules it or marks the enrollment as completed.
    /// </summary>
    private async Task ScheduleNextStepOrComplete(
        SequenceEnrollment enrollment, int currentStepNumber, Guid tenantId)
    {
        var nextStep = await _sequenceRepository.GetStepAsync(
            enrollment.SequenceId, currentStepNumber + 1);

        if (nextStep is not null)
        {
            var delay = CalculateDelay(nextStep.DelayDays, nextStep.PreferredSendTime);
            var jobId = _jobClient.Schedule<SequenceExecutionService>(
                QueueName,
                svc => svc.ExecuteStepAsync(enrollment.Id, currentStepNumber + 1, tenantId),
                delay);

            enrollment.HangfireJobId = jobId;
        }
        else
        {
            // No more steps -- enrollment is complete
            enrollment.Status = EnrollmentStatus.Completed;
            enrollment.CompletedAt = DateTimeOffset.UtcNow;
        }

        await _enrollmentRepository.UpdateAsync(enrollment);
    }

    /// <summary>
    /// Calculates the delay before executing the next step.
    /// Uses DelayDays and optional PreferredSendTime (UTC for v1 simplicity).
    /// If DelayDays is 0, executes immediately (or at preferred time today/tomorrow).
    /// </summary>
    internal static TimeSpan CalculateDelay(int delayDays, TimeOnly? preferredSendTime)
    {
        if (delayDays == 0 && preferredSendTime is null)
        {
            // Execute immediately
            return TimeSpan.Zero;
        }

        var now = DateTimeOffset.UtcNow;
        var targetDate = now.AddDays(delayDays);

        if (preferredSendTime is not null)
        {
            // Set the target to the preferred time on the target date
            var targetDateTime = new DateTimeOffset(
                targetDate.Year, targetDate.Month, targetDate.Day,
                preferredSendTime.Value.Hour, preferredSendTime.Value.Minute, 0,
                TimeSpan.Zero);

            // If the target time is in the past (same day, time already passed), push to next day
            if (targetDateTime <= now)
            {
                targetDateTime = targetDateTime.AddDays(1);
            }

            var delay = targetDateTime - now;
            return delay > TimeSpan.Zero ? delay : TimeSpan.Zero;
        }

        // No preferred time -- just delay by the number of days
        var simpleDelay = targetDate - now;
        return simpleDelay > TimeSpan.Zero ? simpleDelay : TimeSpan.Zero;
    }
}
