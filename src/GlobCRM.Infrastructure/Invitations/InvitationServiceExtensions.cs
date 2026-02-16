using FluentValidation;
using GlobCRM.Application.Invitations;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Invitations;

/// <summary>
/// Extension methods for registering invitation system services in the DI container.
/// Follows established pattern of separate extension methods per subsystem.
/// </summary>
public static class InvitationServiceExtensions
{
    /// <summary>
    /// Registers invitation system services: repository, command handlers, and validators.
    /// </summary>
    public static IServiceCollection AddInvitationServices(this IServiceCollection services)
    {
        // Repository
        services.AddScoped<IInvitationRepository, InvitationRepository>();

        // Command handlers
        services.AddScoped<SendInvitationCommandHandler>();
        services.AddScoped<AcceptInvitationCommandHandler>();
        services.AddScoped<ResendInvitationCommandHandler>();

        // Validators
        services.AddScoped<IValidator<SendInvitationRequest>, SendInvitationValidator>();

        return services;
    }
}
