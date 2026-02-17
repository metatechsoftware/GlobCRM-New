using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for DealContact.
/// Maps to "deal_contacts" table with composite PK on (DealId, ContactId)
/// and cascade delete from both sides.
/// </summary>
public class DealContactConfiguration : IEntityTypeConfiguration<DealContact>
{
    public void Configure(EntityTypeBuilder<DealContact> builder)
    {
        builder.ToTable("deal_contacts");

        // Composite primary key
        builder.HasKey(dc => new { dc.DealId, dc.ContactId });

        builder.Property(dc => dc.DealId)
            .HasColumnName("deal_id");

        builder.Property(dc => dc.ContactId)
            .HasColumnName("contact_id");

        builder.Property(dc => dc.LinkedAt)
            .HasColumnName("linked_at")
            .IsRequired();

        // Relationships
        builder.HasOne(dc => dc.Contact)
            .WithMany()
            .HasForeignKey(dc => dc.ContactId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(dc => dc.ContactId)
            .HasDatabaseName("idx_deal_contacts_contact");
    }
}
