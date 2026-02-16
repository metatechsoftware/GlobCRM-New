using Finbuckle.MultiTenant.AspNetCore.Extensions;
using GlobCRM.Api.Middleware;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure;
using GlobCRM.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
builder.Host.UseSerilog((context, loggerConfiguration) =>
    loggerConfiguration.ReadFrom.Configuration(context.Configuration));

// Add services to the container.
builder.Services.AddControllers();

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

var app = builder.Build();

// Seed default roles on startup
await SeedRolesAsync(app.Services);

// Configure the HTTP request pipeline.
app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

app.UseCors("AllowAngularDev");

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

// Logout is client-side (clear tokens) -- this endpoint is for future token blacklisting
app.MapPost("/api/auth/logout", () => Results.Ok(new { message = "Logged out successfully" }))
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
