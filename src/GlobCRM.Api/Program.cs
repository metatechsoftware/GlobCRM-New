using Finbuckle.MultiTenant.AspNetCore.Extensions;
using GlobCRM.Api.Middleware;
using GlobCRM.Infrastructure;
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

// Register Infrastructure services (Finbuckle, DbContexts, interceptors, tenant provider)
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();

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

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { Status = "Healthy", Timestamp = DateTimeOffset.UtcNow }));

app.Run();
