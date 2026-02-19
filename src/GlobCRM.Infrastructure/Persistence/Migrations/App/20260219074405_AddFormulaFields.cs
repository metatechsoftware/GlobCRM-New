using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddFormulaFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "depends_on_field_ids",
                table: "custom_field_definitions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "formula_expression",
                table: "custom_field_definitions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "formula_result_type",
                table: "custom_field_definitions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "depends_on_field_ids",
                table: "custom_field_definitions");

            migrationBuilder.DropColumn(
                name: "formula_expression",
                table: "custom_field_definitions");

            migrationBuilder.DropColumn(
                name: "formula_result_type",
                table: "custom_field_definitions");
        }
    }
}
