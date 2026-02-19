using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Sequences;
using Hangfire;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Workflow action that enrolls a contact in an email sequence.
/// Reuses the sequence enrollment repository and execution service from Phase 18.
/// Only applicable to Contact entities — throws if entity type is different.
/// Follows the same enrollment pattern as manual enrollment in SequencesController.
/// </summary>
public class EnrollInSequenceAction
{
    private readonly ISequenceEnrollmentRepository _enrollmentRepository;
    private readonly IEmailSequenceRepository _sequenceRepository;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<EnrollInSequenceAction> _logger;

    public EnrollInSequenceAction(
        ISequenceEnrollmentRepository enrollmentRepository,
        IEmailSequenceRepository sequenceRepository,
        IBackgroundJobClient jobClient,
        ILogger<EnrollInSequenceAction> logger)
    {
        _enrollmentRepository = enrollmentRepository;
        _sequenceRepository = sequenceRepository;
        _jobClient = jobClient;
        _logger = logger;
    }

    /// <summary>
    /// Executes the enroll in sequence action.
    /// </summary>
    /// <param name="configJson">JSON config: { SequenceId }</param>
    /// <param name="entityData">Current entity data (unused, but required by interface).</param>
    /// <param name="context">Trigger context — must be a Contact entity.</param>
    public async Task ExecuteAsync(
        string configJson,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var config = JsonSerializer.Deserialize<EnrollInSequenceConfig>(configJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (config is null || config.SequenceId == Guid.Empty)
            throw new InvalidOperationException("EnrollInSequence action requires SequenceId in config");

        // Only contacts can be enrolled in sequences
        if (context.EntityType != "Contact")
            throw new InvalidOperationException(
                $"EnrollInSequence action only supports Contact entities, got {context.EntityType}");

        // Check if contact is already enrolled in this sequence
        var existingEnrollment = await _enrollmentRepository
            .GetActiveByContactAndSequenceAsync(context.EntityId, config.SequenceId);

        if (existingEnrollment is not null)
        {
            _logger.LogDebug(
                "EnrollInSequence action: contact {ContactId} already enrolled in sequence {SequenceId} — skipping",
                context.EntityId, config.SequenceId);
            return;
        }

        // Verify the sequence exists
        var sequence = await _sequenceRepository.GetByIdAsync(config.SequenceId);
        if (sequence is null)
        {
            _logger.LogWarning(
                "EnrollInSequence action: sequence {SequenceId} not found — skipping",
                config.SequenceId);
            return;
        }

        // Create enrollment
        var enrollment = new SequenceEnrollment
        {
            TenantId = context.TenantId,
            SequenceId = config.SequenceId,
            ContactId = context.EntityId,
            Status = EnrollmentStatus.Active,
            CurrentStepNumber = 0,
            StartFromStep = 1,
            CreatedByUserId = Guid.Empty // System-initiated via workflow
        };

        await _enrollmentRepository.CreateAsync(enrollment);

        // Schedule first step execution via Hangfire (same pattern as SequencesController)
        var firstStep = await _sequenceRepository.GetStepAsync(config.SequenceId, 1);
        if (firstStep is not null)
        {
            var delay = SequenceExecutionService.CalculateDelay(
                firstStep.DelayDays, firstStep.PreferredSendTime);

            var jobId = _jobClient.Schedule<SequenceExecutionService>(
                SequenceExecutionService.QueueName,
                svc => svc.ExecuteStepAsync(enrollment.Id, 1, context.TenantId),
                delay);

            enrollment.HangfireJobId = jobId;
            await _enrollmentRepository.UpdateAsync(enrollment);
        }

        _logger.LogDebug(
            "EnrollInSequence action: enrolled contact {ContactId} in sequence {SequenceId}",
            context.EntityId, config.SequenceId);
    }

    private class EnrollInSequenceConfig
    {
        public Guid SequenceId { get; set; }
    }
}
