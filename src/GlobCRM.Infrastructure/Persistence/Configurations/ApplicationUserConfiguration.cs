using System.Text.Json;
using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ApplicationUser.
/// Extends the default ASP.NET Core Identity user table with tenant and profile fields.
/// </summary>
public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        // ASP.NET Core Identity already configures the table name as "AspNetUsers"
        // and sets up the primary key, indexes, etc.

        builder.Property(u => u.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(u => u.FirstName)
            .HasColumnName("first_name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.LastName)
            .HasColumnName("last_name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.IsActive)
            .HasColumnName("is_active")
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(u => u.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(u => u.LastLoginAt)
            .HasColumnName("last_login_at");

        // ---- Rich profile fields (Phase 2, Plan 03) ----

        builder.Property(u => u.Phone)
            .HasColumnName("phone")
            .HasMaxLength(20);

        builder.Property(u => u.JobTitle)
            .HasColumnName("job_title")
            .HasMaxLength(100);

        builder.Property(u => u.Department)
            .HasColumnName("department")
            .HasMaxLength(100);

        builder.Property(u => u.Timezone)
            .HasColumnName("timezone")
            .HasMaxLength(50)
            .HasDefaultValue("UTC");

        builder.Property(u => u.Language)
            .HasColumnName("language")
            .HasMaxLength(10)
            .HasDefaultValue("en");

        builder.Property(u => u.Bio)
            .HasColumnName("bio")
            .HasMaxLength(1000);

        builder.Property(u => u.AvatarUrl)
            .HasColumnName("avatar_url")
            .HasMaxLength(500);

        builder.Property(u => u.AvatarColor)
            .HasColumnName("avatar_color")
            .HasMaxLength(7);

        builder.Property(u => u.SocialLinks)
            .HasColumnName("social_links")
            .HasColumnType("jsonb")
            .HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => v == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(v, JsonSerializerOptions.Default));

        builder.Property(u => u.ReportingManagerId)
            .HasColumnName("reporting_manager_id");

        builder.Property(u => u.Skills)
            .HasColumnName("skills")
            .HasColumnType("jsonb")
            .HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => v == null ? null : JsonSerializer.Deserialize<List<string>>(v, JsonSerializerOptions.Default));

        // Complex JSONB types -- use explicit JSON serialization value converters
        // because EF Core's OwnsOne().ToJson() cannot handle Dictionary<> properties
        builder.Property(u => u.WorkSchedule)
            .HasColumnName("work_schedule")
            .HasColumnType("jsonb")
            .HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => v == null ? null : JsonSerializer.Deserialize<WorkSchedule>(v, JsonSerializerOptions.Default));

        builder.Property(u => u.Preferences)
            .HasColumnName("preferences")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => v == null ? new UserPreferencesData() : JsonSerializer.Deserialize<UserPreferencesData>(v, JsonSerializerOptions.Default)!);

        // Self-referential FK: user -> reporting manager
        builder.HasOne(u => u.ReportingManager)
            .WithMany()
            .HasForeignKey(u => u.ReportingManagerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(u => u.ReportingManagerId)
            .HasDatabaseName("idx_users_reporting_manager");

        // Ignore computed property
        builder.Ignore(u => u.FullName);

        // Index on OrganizationId for efficient tenant-scoped queries
        builder.HasIndex(u => u.OrganizationId)
            .HasDatabaseName("idx_aspnetusers_organization_id");

        // Foreign key to Organization
        builder.HasOne(u => u.Organization)
            .WithMany(o => o.Users)
            .HasForeignKey(u => u.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
