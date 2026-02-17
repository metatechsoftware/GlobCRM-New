using Finbuckle.MultiTenant.AspNetCore.Extensions;
using FluentValidation;
using GlobCRM.Api.Auth;
using GlobCRM.Api.Controllers;
using GlobCRM.Api.Middleware;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure;
using GlobCRM.Infrastructure.Authorization;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.Email;
using GlobCRM.Infrastructure.Identity;
using GlobCRM.Infrastructure.Invitations;
using GlobCRM.Infrastructure.CrmEntities;
using GlobCRM.Infrastructure.Organizations;
using GlobCRM.Infrastructure.Pdf;
using Microsoft.AspNetCore.Identity;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
builder.Host.UseSerilog((context, loggerConfiguration) =>
    loggerConfiguration.ReadFrom.Configuration(context.Configuration));

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
    });

// CORS policy for Angular dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularDev", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register Infrastructure services (Finbuckle, DbContexts, Identity, JWT, interceptors)
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

// Register subsystem services (email, organizations, invitations)
builder.Services.AddEmailServices();
builder.Services.AddOrganizationServices();
builder.Services.AddInvitationServices();
builder.Services.AddCustomFieldServices();
builder.Services.AddCrmEntityServices();
builder.Services.AddPdfServices();

// Register profile validators
builder.Services.AddScoped<IValidator<UpdateProfileRequest>, UpdateProfileRequestValidator>();

var app = builder.Build();

// Seed default roles on startup
await SeedRolesAsync(app.Services);

// Seed RBAC role templates for all existing tenants
await SeedRoleTemplatesAsync(app.Services);

// Configure the HTTP request pipeline.
app.UseSerilogRequestLogging();

app.UseCors("AllowAngularDev");

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Finbuckle tenant resolution -- MUST come before UseAuthentication
app.UseMultiTenant();

// Custom tenant validation middleware
app.UseTenantResolution();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Built-in Identity endpoints (register, confirm email, forgot password, 2FA, refresh)
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>();

// Custom login endpoint with JWT claims and rememberMe
app.MapPost("/api/auth/login-extended", CustomLoginEndpoint.HandleLogin)
    .AllowAnonymous();

// Logout endpoint with audit logging -- token invalidation is future enhancement
app.MapPost("/api/auth/logout", LogoutEndpoint.Handle)
    .RequireAuthorization();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { Status = "Healthy", Timestamp = DateTimeOffset.UtcNow }));

app.Run();

/// <summary>
/// Seeds default Admin and Member roles in the Identity role store on application startup.
/// Idempotent -- skips creation if roles already exist.
/// </summary>
static async Task SeedRolesAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

    foreach (var roleName in Roles.All)
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new IdentityRole<Guid> { Name = roleName });
        }
    }
}

/// <summary>
/// Seeds RBAC role templates (Admin, Manager, Sales Rep, Viewer) for all existing tenants.
/// Idempotent -- skips tenants that already have templates.
/// NOTE: For new organizations, the seeding should also be called from the
/// CreateOrganization handler (Plan 05 or Plan 07 will add that integration).
/// </summary>
static async Task SeedRoleTemplatesAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GlobCRM.Infrastructure.Persistence.ApplicationDbContext>();
    await RoleTemplateSeeder.SeedAllTenantsAsync(db);
}
