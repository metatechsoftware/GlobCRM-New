using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Sequences;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for email sequence CRUD, step management, enrollment (single + bulk),
/// pause/resume, and analytics. Co-located DTOs, request records, and validators.
/// Route: /api/sequences
/// </summary>
[ApiController]
[Route("api/sequences")]
[Authorize]
public class SequencesController : ControllerBase
{
    private readonly IEmailSequenceRepository _sequenceRepository;
    private readonly ISequenceEnrollmentRepository _enrollmentRepository;
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<SequencesController> _logger;

    public SequencesController(
        IEmailSequenceRepository sequenceRepository,
        ISequenceEnrollmentRepository enrollmentRepository,
        ApplicationDbContext db,
        ITenantProvider tenantProvider,
        IBackgroundJobClient jobClient,
        ILogger<SequencesController> logger)
    {
        _sequenceRepository = sequenceRepository;
        _enrollmentRepository = enrollmentRepository;
        _db = db;
        _tenantProvider = tenantProvider;
        _jobClient = jobClient;
        _logger = logger;
    }

    // ---- Sequence CRUD Endpoints ----

    /// <summary>
    /// Lists sequences with analytics summary per sequence.
    /// Key columns: Name, Status, Steps, Total Enrolled, Active, Completed, Reply Rate.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:EmailSequence:View")]
    [ProducesResponseType(typeof(List<SequenceListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var tenantId = GetTenantId();
        var sequences = await _sequenceRepository.GetAllAsync(tenantId);

        var dtos = new List<SequenceListItemDto>();
        foreach (var seq in sequences)
        {
            var analytics = await _enrollmentRepository.GetAnalyticsAsync(seq.Id);
            dtos.Add(SequenceListItemDto.FromEntity(seq, analytics));
        }

        return Ok(dtos);
    }

    /// <summary>
    /// Gets sequence detail with steps and template names.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:EmailSequence:View")]
    [ProducesResponseType(typeof(SequenceDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var sequence = await _sequenceRepository.GetByIdWithStepsAndTemplatesAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        return Ok(SequenceDetailDto.FromEntity(sequence));
    }

    /// <summary>
    /// Creates a new sequence in Draft status.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:EmailSequence:Create")]
    [ProducesResponseType(typeof(SequenceDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateSequenceRequest request)
    {
        var validator = new CreateSequenceRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        var sequence = new EmailSequence
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            Status = SequenceStatus.Draft,
            CreatedByUserId = userId
        };

        var created = await _sequenceRepository.CreateAsync(sequence);

        _logger.LogInformation("Email sequence created: {SequenceName} ({SequenceId})", created.Name, created.Id);

        // Re-fetch with includes for DTO mapping
        var fetched = await _sequenceRepository.GetByIdWithStepsAndTemplatesAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            SequenceDetailDto.FromEntity(fetched!));
    }

    /// <summary>
    /// Updates sequence name/description/status.
    /// When status changes to Active, validates all steps have valid template references.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(typeof(SequenceDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSequenceRequest request)
    {
        var validator = new UpdateSequenceRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var sequence = await _sequenceRepository.GetByIdWithStepsAndTemplatesAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        sequence.Name = request.Name ?? sequence.Name;
        sequence.Description = request.Description ?? sequence.Description;

        // Status change validation
        if (request.Status.HasValue && request.Status.Value != sequence.Status)
        {
            if (request.Status.Value == SequenceStatus.Active)
            {
                // Validate all steps have valid template references
                if (sequence.Steps.Count == 0)
                    return BadRequest(new { error = "Cannot activate a sequence with no steps." });

                foreach (var step in sequence.Steps)
                {
                    if (step.EmailTemplate is null)
                    {
                        return BadRequest(new { error = $"Step {step.StepNumber} references a template that no longer exists." });
                    }
                }
            }
            sequence.Status = request.Status.Value;
        }

        await _sequenceRepository.UpdateAsync(sequence);

        _logger.LogInformation("Email sequence updated: {SequenceId}", id);

        // Re-fetch for clean DTO mapping
        var fetched = await _sequenceRepository.GetByIdWithStepsAndTemplatesAsync(id);
        return Ok(SequenceDetailDto.FromEntity(fetched!));
    }

    /// <summary>
    /// Deletes a sequence. Fails with 409 if sequence has active enrollments.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:EmailSequence:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        // Check for active enrollments
        var hasActiveEnrollments = await _db.SequenceEnrollments
            .AnyAsync(e => e.SequenceId == id && e.Status == EnrollmentStatus.Active);

        if (hasActiveEnrollments)
            return Conflict(new { error = "Cannot delete a sequence with active enrollments. Pause or unenroll contacts first." });

        await _sequenceRepository.DeleteAsync(id);

        _logger.LogInformation("Email sequence deleted: {SequenceId}", id);

        return NoContent();
    }

    // ---- Step Management Endpoints ----

    /// <summary>
    /// Adds a step to a sequence. Auto-assigns StepNumber as max existing + 1.
    /// </summary>
    [HttpPost("{id:guid}/steps")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(typeof(SequenceStepDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddStep(Guid id, [FromBody] AddStepRequest request)
    {
        var validator = new AddStepRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        // Validate template exists
        var template = await _db.EmailTemplates.FindAsync(request.EmailTemplateId);
        if (template is null)
            return BadRequest(new { error = "Email template not found." });

        // Auto-assign step number
        var maxStepNumber = sequence.Steps.Count > 0
            ? sequence.Steps.Max(s => s.StepNumber)
            : 0;

        TimeOnly? preferredSendTime = null;
        if (!string.IsNullOrWhiteSpace(request.PreferredSendTime))
        {
            if (TimeOnly.TryParse(request.PreferredSendTime, out var parsed))
                preferredSendTime = parsed;
        }

        var step = new EmailSequenceStep
        {
            SequenceId = id,
            StepNumber = maxStepNumber + 1,
            EmailTemplateId = request.EmailTemplateId,
            SubjectOverride = request.SubjectOverride,
            DelayDays = request.DelayDays,
            PreferredSendTime = preferredSendTime
        };

        _db.EmailSequenceSteps.Add(step);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Step {StepNumber} added to sequence {SequenceId}", step.StepNumber, id);

        // Re-fetch with template for DTO
        var fetched = await _db.EmailSequenceSteps
            .Include(s => s.EmailTemplate)
            .FirstAsync(s => s.Id == step.Id);

        return Created($"/api/sequences/{id}/steps/{step.Id}", SequenceStepDto.FromEntity(fetched));
    }

    /// <summary>
    /// Updates step properties.
    /// </summary>
    [HttpPut("{id:guid}/steps/{stepId:guid}")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(typeof(SequenceStepDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStep(Guid id, Guid stepId, [FromBody] UpdateStepRequest request)
    {
        var step = await _db.EmailSequenceSteps
            .Include(s => s.EmailTemplate)
            .FirstOrDefaultAsync(s => s.Id == stepId && s.SequenceId == id);

        if (step is null)
            return NotFound(new { error = "Step not found." });

        if (request.EmailTemplateId.HasValue)
        {
            var template = await _db.EmailTemplates.FindAsync(request.EmailTemplateId.Value);
            if (template is null)
                return BadRequest(new { error = "Email template not found." });
            step.EmailTemplateId = request.EmailTemplateId.Value;
        }

        if (request.SubjectOverride is not null)
            step.SubjectOverride = request.SubjectOverride == "" ? null : request.SubjectOverride;

        if (request.DelayDays.HasValue)
            step.DelayDays = request.DelayDays.Value;

        if (request.PreferredSendTime is not null)
        {
            if (request.PreferredSendTime == "")
                step.PreferredSendTime = null;
            else if (TimeOnly.TryParse(request.PreferredSendTime, out var parsed))
                step.PreferredSendTime = parsed;
        }

        step.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Step {StepId} updated in sequence {SequenceId}", stepId, id);

        // Re-fetch with template for DTO
        var fetched = await _db.EmailSequenceSteps
            .Include(s => s.EmailTemplate)
            .FirstAsync(s => s.Id == step.Id);

        return Ok(SequenceStepDto.FromEntity(fetched));
    }

    /// <summary>
    /// Removes a step and renumbers remaining steps.
    /// </summary>
    [HttpDelete("{id:guid}/steps/{stepId:guid}")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteStep(Guid id, Guid stepId)
    {
        var step = await _db.EmailSequenceSteps
            .FirstOrDefaultAsync(s => s.Id == stepId && s.SequenceId == id);

        if (step is null)
            return NotFound(new { error = "Step not found." });

        _db.EmailSequenceSteps.Remove(step);
        await _db.SaveChangesAsync();

        // Renumber remaining steps
        var remainingSteps = await _db.EmailSequenceSteps
            .Where(s => s.SequenceId == id)
            .OrderBy(s => s.StepNumber)
            .ToListAsync();

        for (int i = 0; i < remainingSteps.Count; i++)
        {
            remainingSteps[i].StepNumber = i + 1;
            remainingSteps[i].UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Step {StepId} deleted from sequence {SequenceId}, remaining steps renumbered", stepId, id);

        return NoContent();
    }

    /// <summary>
    /// Reorders steps by providing ordered list of step IDs. Reassigns StepNumber values 1..N.
    /// </summary>
    [HttpPut("{id:guid}/steps/reorder")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderSteps(Guid id, [FromBody] ReorderStepsRequest request)
    {
        var validator = new ReorderStepsRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        // Load all steps for this sequence
        var steps = await _db.EmailSequenceSteps
            .Where(s => s.SequenceId == id)
            .ToListAsync();

        var stepDict = steps.ToDictionary(s => s.Id);

        // Validate all provided IDs exist in this sequence
        foreach (var stepId in request.StepIds)
        {
            if (!stepDict.ContainsKey(stepId))
                return BadRequest(new { error = $"Step ID {stepId} does not belong to this sequence." });
        }

        // Reassign step numbers
        for (int i = 0; i < request.StepIds.Count; i++)
        {
            var step = stepDict[request.StepIds[i]];
            step.StepNumber = i + 1;
            step.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Steps reordered for sequence {SequenceId}", id);

        return Ok(new { message = "Steps reordered successfully." });
    }

    // ---- Enrollment Management Endpoints ----

    /// <summary>
    /// Enrolls a single contact. Checks for existing active enrollment (skip with 200 + message).
    /// Warns if contact is in other sequences but doesn't block.
    /// Supports re-enrollment from a specific step via StartFromStep.
    /// Schedules first step via Hangfire.
    /// </summary>
    [HttpPost("{id:guid}/enrollments")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(typeof(EnrollmentListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EnrollContact(Guid id, [FromBody] EnrollContactRequest request)
    {
        var validator = new EnrollContactRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        if (sequence.Status != SequenceStatus.Active)
            return BadRequest(new { error = "Cannot enroll contacts in a sequence that is not active." });

        // Validate contact exists
        var contact = await _db.Contacts.FindAsync(request.ContactId);
        if (contact is null)
            return BadRequest(new { error = "Contact not found." });

        // Check for existing active enrollment in this sequence
        var existingEnrollment = await _enrollmentRepository.GetActiveByContactAndSequenceAsync(
            request.ContactId, id);

        if (existingEnrollment is not null)
            return Ok(new { message = "Contact is already actively enrolled in this sequence.", enrollment = EnrollmentListItemDto.FromEntity(existingEnrollment) });

        // Warn if contact is in other sequences (don't block)
        var otherEnrollments = await _enrollmentRepository.GetByContactIdAsync(request.ContactId);
        var otherActiveSequences = otherEnrollments
            .Where(e => e.Status == EnrollmentStatus.Active && e.SequenceId != id)
            .Select(e => e.Sequence?.Name ?? "Unknown")
            .ToList();

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();
        var startFromStep = request.StartFromStep ?? 1;

        var enrollment = new SequenceEnrollment
        {
            TenantId = tenantId,
            SequenceId = id,
            ContactId = request.ContactId,
            Status = EnrollmentStatus.Active,
            StartFromStep = startFromStep,
            CreatedByUserId = userId
        };

        var created = await _enrollmentRepository.CreateAsync(enrollment);

        // Schedule first step via Hangfire
        var jobId = _jobClient.Schedule<SequenceExecutionService>(
            SequenceExecutionService.QueueName,
            svc => svc.ExecuteStepAsync(created.Id, startFromStep, tenantId),
            TimeSpan.Zero);

        created.HangfireJobId = jobId;
        await _enrollmentRepository.UpdateAsync(created);

        _logger.LogInformation(
            "Contact {ContactId} enrolled in sequence {SequenceId} starting at step {StartFromStep}",
            request.ContactId, id, startFromStep);

        // Re-fetch with includes for DTO
        var fetched = await _enrollmentRepository.GetByIdAsync(created.Id);

        var response = new
        {
            enrollment = EnrollmentListItemDto.FromEntity(fetched!),
            warnings = otherActiveSequences.Count > 0
                ? new[] { $"Contact is also enrolled in: {string.Join(", ", otherActiveSequences)}" }
                : Array.Empty<string>()
        };

        return Created($"/api/sequences/{id}/enrollments/{created.Id}", response);
    }

    /// <summary>
    /// Bulk enrolls contacts. Skips already-enrolled contacts.
    /// Returns enrolled count, skipped count, and skipped contact IDs.
    /// </summary>
    [HttpPost("{id:guid}/enrollments/bulk")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BulkEnroll(Guid id, [FromBody] BulkEnrollRequest request)
    {
        var validator = new BulkEnrollRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        if (sequence.Status != SequenceStatus.Active)
            return BadRequest(new { error = "Cannot enroll contacts in a sequence that is not active." });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();
        var enrolled = 0;
        var skippedContactIds = new List<Guid>();

        var enrollmentsToCreate = new List<SequenceEnrollment>();

        foreach (var contactId in request.ContactIds)
        {
            // Check for existing active enrollment
            var existing = await _enrollmentRepository.GetActiveByContactAndSequenceAsync(contactId, id);
            if (existing is not null)
            {
                skippedContactIds.Add(contactId);
                continue;
            }

            // Validate contact exists
            var contactExists = await _db.Contacts.AnyAsync(c => c.Id == contactId);
            if (!contactExists)
            {
                skippedContactIds.Add(contactId);
                continue;
            }

            var enrollment = new SequenceEnrollment
            {
                TenantId = tenantId,
                SequenceId = id,
                ContactId = contactId,
                Status = EnrollmentStatus.Active,
                StartFromStep = 1,
                CreatedByUserId = userId
            };

            enrollmentsToCreate.Add(enrollment);
        }

        if (enrollmentsToCreate.Count > 0)
        {
            await _enrollmentRepository.CreateBulkAsync(enrollmentsToCreate);

            // Schedule first step for each enrollment
            foreach (var enrollment in enrollmentsToCreate)
            {
                var jobId = _jobClient.Schedule<SequenceExecutionService>(
                    SequenceExecutionService.QueueName,
                    svc => svc.ExecuteStepAsync(enrollment.Id, 1, tenantId),
                    TimeSpan.Zero);

                enrollment.HangfireJobId = jobId;
            }

            // Bulk update job IDs
            await _db.SaveChangesAsync();
            enrolled = enrollmentsToCreate.Count;
        }

        _logger.LogInformation(
            "Bulk enrollment for sequence {SequenceId}: {Enrolled} enrolled, {Skipped} skipped",
            id, enrolled, skippedContactIds.Count);

        return Ok(new
        {
            enrolled,
            skipped = skippedContactIds.Count,
            skippedContactIds
        });
    }

    /// <summary>
    /// Lists enrollments for a sequence with paging.
    /// </summary>
    [HttpGet("{id:guid}/enrollments")]
    [Authorize(Policy = "Permission:EmailSequence:View")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEnrollments(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        var (items, totalCount) = await _enrollmentRepository.GetBySequenceIdAsync(id, page, pageSize);

        return Ok(new
        {
            items = items.Select(EnrollmentListItemDto.FromEntity).ToList(),
            totalCount,
            page,
            pageSize
        });
    }

    /// <summary>
    /// Pauses an enrollment. Sets status to Paused, sets PausedAt, and deletes scheduled Hangfire job.
    /// </summary>
    [HttpPut("{id:guid}/enrollments/{enrollmentId:guid}/pause")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PauseEnrollment(Guid id, Guid enrollmentId)
    {
        var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
        if (enrollment is null || enrollment.SequenceId != id)
            return NotFound(new { error = "Enrollment not found." });

        if (enrollment.Status != EnrollmentStatus.Active)
            return BadRequest(new { error = "Only active enrollments can be paused." });

        enrollment.Status = EnrollmentStatus.Paused;
        enrollment.PausedAt = DateTimeOffset.UtcNow;

        // Delete scheduled Hangfire job if exists
        if (!string.IsNullOrEmpty(enrollment.HangfireJobId))
        {
            try { BackgroundJob.Delete(enrollment.HangfireJobId); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete Hangfire job {JobId}", enrollment.HangfireJobId); }
        }

        await _enrollmentRepository.UpdateAsync(enrollment);

        _logger.LogInformation("Enrollment {EnrollmentId} paused", enrollmentId);

        return Ok(new { message = "Enrollment paused." });
    }

    /// <summary>
    /// Resumes a paused enrollment. Sets status to Active, clears PausedAt, schedules next step.
    /// </summary>
    [HttpPut("{id:guid}/enrollments/{enrollmentId:guid}/resume")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResumeEnrollment(Guid id, Guid enrollmentId)
    {
        var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
        if (enrollment is null || enrollment.SequenceId != id)
            return NotFound(new { error = "Enrollment not found." });

        if (enrollment.Status != EnrollmentStatus.Paused)
            return BadRequest(new { error = "Only paused enrollments can be resumed." });

        enrollment.Status = EnrollmentStatus.Active;
        enrollment.PausedAt = null;

        // Schedule next step (CurrentStepNumber + 1)
        var nextStepNumber = enrollment.CurrentStepNumber + 1;
        var nextStep = await _sequenceRepository.GetStepAsync(id, nextStepNumber);

        if (nextStep is not null)
        {
            var tenantId = GetTenantId();
            var delay = SequenceExecutionService.CalculateDelay(nextStep.DelayDays, nextStep.PreferredSendTime);
            var jobId = _jobClient.Schedule<SequenceExecutionService>(
                SequenceExecutionService.QueueName,
                svc => svc.ExecuteStepAsync(enrollmentId, nextStepNumber, tenantId),
                delay);

            enrollment.HangfireJobId = jobId;
        }
        else
        {
            // No more steps, mark as completed
            enrollment.Status = EnrollmentStatus.Completed;
            enrollment.CompletedAt = DateTimeOffset.UtcNow;
        }

        await _enrollmentRepository.UpdateAsync(enrollment);

        _logger.LogInformation("Enrollment {EnrollmentId} resumed", enrollmentId);

        return Ok(new { message = "Enrollment resumed." });
    }

    /// <summary>
    /// Unenrolls a contact. Sets status to Unenrolled. Deletes scheduled Hangfire job.
    /// </summary>
    [HttpDelete("{id:guid}/enrollments/{enrollmentId:guid}")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnenrollContact(Guid id, Guid enrollmentId)
    {
        var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
        if (enrollment is null || enrollment.SequenceId != id)
            return NotFound(new { error = "Enrollment not found." });

        enrollment.Status = EnrollmentStatus.Unenrolled;

        // Delete scheduled Hangfire job if exists
        if (!string.IsNullOrEmpty(enrollment.HangfireJobId))
        {
            try { BackgroundJob.Delete(enrollment.HangfireJobId); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete Hangfire job {JobId}", enrollment.HangfireJobId); }
        }

        await _enrollmentRepository.UpdateAsync(enrollment);

        _logger.LogInformation("Enrollment {EnrollmentId} unenrolled", enrollmentId);

        return NoContent();
    }

    /// <summary>
    /// Bulk pauses specified enrollments.
    /// </summary>
    [HttpPut("{id:guid}/enrollments/bulk-pause")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkPause(Guid id, [FromBody] BulkEnrollmentActionRequest request)
    {
        var paused = 0;

        foreach (var enrollmentId in request.EnrollmentIds)
        {
            var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
            if (enrollment is null || enrollment.SequenceId != id || enrollment.Status != EnrollmentStatus.Active)
                continue;

            enrollment.Status = EnrollmentStatus.Paused;
            enrollment.PausedAt = DateTimeOffset.UtcNow;

            if (!string.IsNullOrEmpty(enrollment.HangfireJobId))
            {
                try { BackgroundJob.Delete(enrollment.HangfireJobId); }
                catch { /* best-effort cleanup */ }
            }

            await _enrollmentRepository.UpdateAsync(enrollment);
            paused++;
        }

        _logger.LogInformation("Bulk pause for sequence {SequenceId}: {Count} paused", id, paused);

        return Ok(new { paused });
    }

    /// <summary>
    /// Bulk resumes specified enrollments.
    /// </summary>
    [HttpPut("{id:guid}/enrollments/bulk-resume")]
    [Authorize(Policy = "Permission:EmailSequence:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkResume(Guid id, [FromBody] BulkEnrollmentActionRequest request)
    {
        var tenantId = GetTenantId();
        var resumed = 0;

        foreach (var enrollmentId in request.EnrollmentIds)
        {
            var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
            if (enrollment is null || enrollment.SequenceId != id || enrollment.Status != EnrollmentStatus.Paused)
                continue;

            enrollment.Status = EnrollmentStatus.Active;
            enrollment.PausedAt = null;

            // Schedule next step
            var nextStepNumber = enrollment.CurrentStepNumber + 1;
            var nextStep = await _sequenceRepository.GetStepAsync(id, nextStepNumber);

            if (nextStep is not null)
            {
                var delay = SequenceExecutionService.CalculateDelay(nextStep.DelayDays, nextStep.PreferredSendTime);
                var jobId = _jobClient.Schedule<SequenceExecutionService>(
                    SequenceExecutionService.QueueName,
                    svc => svc.ExecuteStepAsync(enrollmentId, nextStepNumber, tenantId),
                    delay);
                enrollment.HangfireJobId = jobId;
            }
            else
            {
                enrollment.Status = EnrollmentStatus.Completed;
                enrollment.CompletedAt = DateTimeOffset.UtcNow;
            }

            await _enrollmentRepository.UpdateAsync(enrollment);
            resumed++;
        }

        _logger.LogInformation("Bulk resume for sequence {SequenceId}: {Count} resumed", id, resumed);

        return Ok(new { resumed });
    }

    // ---- Analytics Endpoints ----

    /// <summary>
    /// Returns sequence-level analytics with enrollment status counts.
    /// </summary>
    [HttpGet("{id:guid}/analytics")]
    [Authorize(Policy = "Permission:EmailSequence:View")]
    [ProducesResponseType(typeof(SequenceAnalyticsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAnalytics(Guid id)
    {
        var sequence = await _sequenceRepository.GetByIdAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        var analytics = await _enrollmentRepository.GetAnalyticsAsync(id);

        return Ok(SequenceAnalyticsDto.FromDictionary(analytics));
    }

    /// <summary>
    /// Returns per-step metrics with sent/open/click counts and rates.
    /// </summary>
    [HttpGet("{id:guid}/analytics/steps")]
    [Authorize(Policy = "Permission:EmailSequence:View")]
    [ProducesResponseType(typeof(List<StepMetricsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStepMetrics(Guid id)
    {
        var sequence = await _sequenceRepository.GetByIdWithStepsAndTemplatesAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        var metrics = await _enrollmentRepository.GetStepMetricsAsync(id);

        // Build DTO list with template names from steps
        var stepTemplateNames = sequence.Steps
            .ToDictionary(s => s.StepNumber, s => s.EmailTemplate?.Name ?? "Unknown Template");

        var dtos = metrics.Select(m => StepMetricsDto.FromStepMetrics(m, stepTemplateNames.GetValueOrDefault(m.StepNumber, "Unknown Template")))
            .ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Returns funnel data showing contact count at each step for funnel visualization.
    /// </summary>
    [HttpGet("{id:guid}/analytics/funnel")]
    [Authorize(Policy = "Permission:EmailSequence:View")]
    [ProducesResponseType(typeof(List<FunnelDataDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFunnelData(Guid id)
    {
        var sequence = await _sequenceRepository.GetByIdWithStepsAndTemplatesAsync(id);
        if (sequence is null)
            return NotFound(new { error = "Email sequence not found." });

        // Get all enrollments for this sequence
        var enrollments = await _db.SequenceEnrollments
            .Where(e => e.SequenceId == id)
            .ToListAsync();

        // Count how many contacts reached each step
        var funnelData = sequence.Steps
            .OrderBy(s => s.StepNumber)
            .Select(step => new FunnelDataDto
            {
                StepNumber = step.StepNumber,
                StepName = $"Step {step.StepNumber}: {step.EmailTemplate?.Name ?? "Unknown"}",
                Count = enrollments.Count(e => e.CurrentStepNumber >= step.StepNumber || e.StepsSent >= step.StepNumber)
            })
            .ToList();

        return Ok(funnelData);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    private Guid GetTenantId()
    {
        return _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for sequence list views with inline analytics.
/// </summary>
public record SequenceListItemDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public SequenceStatus Status { get; init; }
    public int StepCount { get; init; }
    public int TotalEnrolled { get; init; }
    public int ActiveEnrollments { get; init; }
    public int CompletedEnrollments { get; init; }
    public decimal ReplyRate { get; init; }
    public string? CreatedByUserName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static SequenceListItemDto FromEntity(EmailSequence entity, Dictionary<string, int>? analytics) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Status = entity.Status,
        StepCount = entity.Steps.Count,
        TotalEnrolled = analytics?.Values.Sum() ?? 0,
        ActiveEnrollments = analytics?.GetValueOrDefault("Active", 0) ?? 0,
        CompletedEnrollments = analytics?.GetValueOrDefault("Completed", 0) ?? 0,
        ReplyRate = CalculateReplyRate(analytics),
        CreatedByUserName = entity.CreatedByUser != null
            ? $"{entity.CreatedByUser.FirstName} {entity.CreatedByUser.LastName}".Trim()
            : null,
        CreatedAt = entity.CreatedAt
    };

    private static decimal CalculateReplyRate(Dictionary<string, int>? analytics)
    {
        if (analytics is null) return 0m;
        var total = analytics.Values.Sum();
        if (total == 0) return 0m;
        var replied = analytics.GetValueOrDefault("Replied", 0);
        return Math.Round((decimal)replied / total * 100, 1);
    }
}

/// <summary>
/// Detailed DTO for sequence detail view with steps.
/// </summary>
public record SequenceDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public SequenceStatus Status { get; init; }
    public List<SequenceStepDto> Steps { get; init; } = [];
    public Guid CreatedByUserId { get; init; }
    public string? CreatedByUserName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static SequenceDetailDto FromEntity(EmailSequence entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Status = entity.Status,
        Steps = entity.Steps
            .OrderBy(s => s.StepNumber)
            .Select(SequenceStepDto.FromEntity)
            .ToList(),
        CreatedByUserId = entity.CreatedByUserId,
        CreatedByUserName = entity.CreatedByUser != null
            ? $"{entity.CreatedByUser.FirstName} {entity.CreatedByUser.LastName}".Trim()
            : null,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for individual sequence step.
/// </summary>
public record SequenceStepDto
{
    public Guid Id { get; init; }
    public int StepNumber { get; init; }
    public Guid EmailTemplateId { get; init; }
    public string? EmailTemplateName { get; init; }
    public string? SubjectOverride { get; init; }
    public int DelayDays { get; init; }
    public string? PreferredSendTime { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static SequenceStepDto FromEntity(EmailSequenceStep entity) => new()
    {
        Id = entity.Id,
        StepNumber = entity.StepNumber,
        EmailTemplateId = entity.EmailTemplateId,
        EmailTemplateName = entity.EmailTemplate?.Name,
        SubjectOverride = entity.SubjectOverride,
        DelayDays = entity.DelayDays,
        PreferredSendTime = entity.PreferredSendTime?.ToString("HH:mm"),
        CreatedAt = entity.CreatedAt
    };
}

/// <summary>
/// DTO for enrollment list items.
/// </summary>
public record EnrollmentListItemDto
{
    public Guid Id { get; init; }
    public Guid ContactId { get; init; }
    public string? ContactName { get; init; }
    public string? ContactEmail { get; init; }
    public EnrollmentStatus Status { get; init; }
    public int CurrentStepNumber { get; init; }
    public int StepsSent { get; init; }
    public int StartFromStep { get; init; }
    public DateTimeOffset? LastStepSentAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public DateTimeOffset? RepliedAt { get; init; }
    public int? ReplyStepNumber { get; init; }
    public DateTimeOffset? PausedAt { get; init; }
    public DateTimeOffset? BouncedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static EnrollmentListItemDto FromEntity(SequenceEnrollment entity) => new()
    {
        Id = entity.Id,
        ContactId = entity.ContactId,
        ContactName = entity.Contact != null
            ? $"{entity.Contact.FirstName} {entity.Contact.LastName}".Trim()
            : null,
        ContactEmail = entity.Contact?.Email,
        Status = entity.Status,
        CurrentStepNumber = entity.CurrentStepNumber,
        StepsSent = entity.StepsSent,
        StartFromStep = entity.StartFromStep,
        LastStepSentAt = entity.LastStepSentAt,
        CompletedAt = entity.CompletedAt,
        RepliedAt = entity.RepliedAt,
        ReplyStepNumber = entity.ReplyStepNumber,
        PausedAt = entity.PausedAt,
        BouncedAt = entity.BouncedAt,
        CreatedAt = entity.CreatedAt
    };
}

/// <summary>
/// Sequence-level analytics with enrollment status counts.
/// </summary>
public record SequenceAnalyticsDto
{
    public int TotalEnrolled { get; init; }
    public int Active { get; init; }
    public int Completed { get; init; }
    public int Replied { get; init; }
    public int Bounced { get; init; }
    public int Unenrolled { get; init; }
    public int Paused { get; init; }

    public static SequenceAnalyticsDto FromDictionary(Dictionary<string, int> analytics) => new()
    {
        TotalEnrolled = analytics.Values.Sum(),
        Active = analytics.GetValueOrDefault("Active", 0),
        Completed = analytics.GetValueOrDefault("Completed", 0),
        Replied = analytics.GetValueOrDefault("Replied", 0),
        Bounced = analytics.GetValueOrDefault("Bounced", 0),
        Unenrolled = analytics.GetValueOrDefault("Unenrolled", 0),
        Paused = analytics.GetValueOrDefault("Paused", 0)
    };
}

/// <summary>
/// Per-step tracking metrics.
/// </summary>
public record StepMetricsDto
{
    public int StepNumber { get; init; }
    public string TemplateName { get; init; } = string.Empty;
    public int Sent { get; init; }
    public int UniqueOpens { get; init; }
    public int UniqueClicks { get; init; }
    public decimal OpenRate { get; init; }
    public decimal ClickRate { get; init; }

    public static StepMetricsDto FromStepMetrics(StepMetrics metrics, string templateName) => new()
    {
        StepNumber = metrics.StepNumber,
        TemplateName = templateName,
        Sent = metrics.Sent,
        UniqueOpens = metrics.Opens,
        UniqueClicks = metrics.Clicks,
        OpenRate = metrics.Sent > 0 ? Math.Round((decimal)metrics.Opens / metrics.Sent * 100, 1) : 0m,
        ClickRate = metrics.Sent > 0 ? Math.Round((decimal)metrics.Clicks / metrics.Sent * 100, 1) : 0m
    };
}

/// <summary>
/// Funnel chart data point showing contacts at each step.
/// </summary>
public record FunnelDataDto
{
    public int StepNumber { get; init; }
    public string StepName { get; init; } = string.Empty;
    public int Count { get; init; }
}

// ---- Request Records ----

public record CreateSequenceRequest(string Name, string? Description);

public record UpdateSequenceRequest(string? Name, string? Description, SequenceStatus? Status);

public record AddStepRequest(Guid EmailTemplateId, string? SubjectOverride, int DelayDays, string? PreferredSendTime);

public record UpdateStepRequest(Guid? EmailTemplateId, string? SubjectOverride, int? DelayDays, string? PreferredSendTime);

public record ReorderStepsRequest(List<Guid> StepIds);

public record EnrollContactRequest(Guid ContactId, int? StartFromStep);

public record BulkEnrollRequest(List<Guid> ContactIds);

public record BulkEnrollmentActionRequest(List<Guid> EnrollmentIds);

// ---- Validators ----

public class CreateSequenceRequestValidator : AbstractValidator<CreateSequenceRequest>
{
    public CreateSequenceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public class UpdateSequenceRequestValidator : AbstractValidator<UpdateSequenceRequest>
{
    public UpdateSequenceRequestValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.Description).MaximumLength(1000).When(x => x.Description is not null);
    }
}

public class AddStepRequestValidator : AbstractValidator<AddStepRequest>
{
    public AddStepRequestValidator()
    {
        RuleFor(x => x.EmailTemplateId).NotEmpty();
        RuleFor(x => x.DelayDays).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PreferredSendTime)
            .Must(BeValidTimeFormat)
            .When(x => !string.IsNullOrWhiteSpace(x.PreferredSendTime))
            .WithMessage("PreferredSendTime must be in HH:mm format.");
    }

    private static bool BeValidTimeFormat(string? value)
    {
        return TimeOnly.TryParse(value, out _);
    }
}

public class ReorderStepsRequestValidator : AbstractValidator<ReorderStepsRequest>
{
    public ReorderStepsRequestValidator()
    {
        RuleFor(x => x.StepIds).NotEmpty().WithMessage("At least one step ID is required.");
    }
}

public class EnrollContactRequestValidator : AbstractValidator<EnrollContactRequest>
{
    public EnrollContactRequestValidator()
    {
        RuleFor(x => x.ContactId).NotEmpty();
        RuleFor(x => x.StartFromStep).GreaterThanOrEqualTo(1).When(x => x.StartFromStep.HasValue);
    }
}

public class BulkEnrollRequestValidator : AbstractValidator<BulkEnrollRequest>
{
    public BulkEnrollRequestValidator()
    {
        RuleFor(x => x.ContactIds).NotEmpty().WithMessage("At least one contact ID is required.");
        RuleFor(x => x.ContactIds.Count).LessThanOrEqualTo(1000).WithMessage("Maximum 1000 contacts per bulk enrollment.");
    }
}
