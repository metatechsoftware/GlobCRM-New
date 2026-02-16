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

// Identity, Finbuckle, and JWT authentication will be configured in Plan 03

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

app.UseCors("AllowAngularDev");

// Authentication and authorization middleware will be added in Plan 03
// app.UseAuthentication();
// app.UseAuthorization();

app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { Status = "Healthy", Timestamp = DateTimeOffset.UtcNow }));

app.Run();
