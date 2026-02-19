using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddEntityNameAndShowInPreview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "entity_name",
                table: "feed_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            // Backfill entity_name from source entities
            migrationBuilder.Sql(@"
                UPDATE feed_items fi SET entity_name = c.first_name || ' ' || c.last_name
                FROM contacts c WHERE fi.entity_type = 'Contact' AND fi.entity_id = c.id AND fi.entity_name IS NULL;

                UPDATE feed_items fi SET entity_name = co.name
                FROM companies co WHERE fi.entity_type = 'Company' AND fi.entity_id = co.id AND fi.entity_name IS NULL;

                UPDATE feed_items fi SET entity_name = d.title
                FROM deals d WHERE fi.entity_type = 'Deal' AND fi.entity_id = d.id AND fi.entity_name IS NULL;

                UPDATE feed_items fi SET entity_name = l.first_name || ' ' || l.last_name
                FROM leads l WHERE fi.entity_type = 'Lead' AND fi.entity_id = l.id AND fi.entity_name IS NULL;

                UPDATE feed_items fi SET entity_name = a.subject
                FROM activities a WHERE fi.entity_type = 'Activity' AND fi.entity_id = a.id AND fi.entity_name IS NULL;
            ");

            migrationBuilder.AddColumn<bool>(
                name: "show_in_preview",
                table: "custom_field_definitions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "entity_name",
                table: "feed_items");

            migrationBuilder.DropColumn(
                name: "show_in_preview",
                table: "custom_field_definitions");
        }
    }
}
