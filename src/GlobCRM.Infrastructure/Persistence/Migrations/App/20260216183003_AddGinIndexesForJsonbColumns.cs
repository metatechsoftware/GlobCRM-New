using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddGinIndexesForJsonbColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // GIN indexes for custom_field_definitions JSONB columns
            migrationBuilder.Sql(
                "CREATE INDEX idx_custom_field_definitions_validation_gin ON custom_field_definitions USING GIN (validation);");
            migrationBuilder.Sql(
                "CREATE INDEX idx_custom_field_definitions_options_gin ON custom_field_definitions USING GIN (options);");

            // GIN indexes for saved_views JSONB columns
            migrationBuilder.Sql(
                "CREATE INDEX idx_saved_views_columns_gin ON saved_views USING GIN (columns);");
            migrationBuilder.Sql(
                "CREATE INDEX idx_saved_views_filters_gin ON saved_views USING GIN (filters);");
            migrationBuilder.Sql(
                "CREATE INDEX idx_saved_views_sorts_gin ON saved_views USING GIN (sorts);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_custom_field_definitions_validation_gin;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_custom_field_definitions_options_gin;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_saved_views_columns_gin;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_saved_views_filters_gin;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_saved_views_sorts_gin;");
        }
    }
}
