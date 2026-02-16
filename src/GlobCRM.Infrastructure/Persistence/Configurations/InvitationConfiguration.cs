using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Invitation.
/// Invitations are tenant-scoped and use cryptographically random tokens.
/// </summary>
public class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("invitations");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(i => i.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(i => i.Email)
            .HasColumnName("email")
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(i => i.Role)
            .HasColumnName("role")
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("Member");

        builder.Property(i => i.InvitedByUserId)
            .HasColumnName("invited_by_user_id")
            .IsRequired();

        builder.Property(i => i.Token)
            .HasColumnName("token")
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(i => i.ExpiresAt)
            .HasColumnName("expires_at")
            .IsRequired();

        builder.Property(i => i.AcceptedAt)
            .HasColumnName("accepted_at");

        builder.Property(i => i.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // Ignore computed properties
        builder.Ignore(i => i.IsExpired);
        builder.Ignore(i => i.IsAccepted);
        builder.Ignore(i => i.IsValid);

        // Unique index on Token for fast lookup and uniqueness enforcement
        builder.HasIndex(i => i.Token)
            .IsUnique()
            .HasDatabaseName("idx_invitations_token");

        // Composite index on TenantId + Email for efficient queries
        builder.HasIndex(i => new { i.TenantId, i.Email })
            .HasDatabaseName("idx_invitations_tenant_email");

        // Foreign key to Organization (via TenantId)
        builder.HasOne<Organization>()
            .WithMany(o => o.Invitations)
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        // Foreign key to ApplicationUser (inviter)
        builder.HasOne(i => i.InvitedByUser)
            .WithMany()
            .HasForeignKey(i => i.InvitedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
