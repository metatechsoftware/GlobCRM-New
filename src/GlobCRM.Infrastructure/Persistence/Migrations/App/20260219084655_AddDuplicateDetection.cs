using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddDuplicateDetection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "merged_at",
                table: "contacts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "merged_by_user_id",
                table: "contacts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "merged_into_id",
                table: "contacts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "merged_at",
                table: "companies",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "merged_by_user_id",
                table: "companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "merged_into_id",
                table: "companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "duplicate_matching_configs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    auto_detection_enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    similarity_threshold = table.Column<int>(type: "integer", nullable: false, defaultValue: 70),
                    matching_fields = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_duplicate_matching_configs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "merge_audit_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    survivor_id = table.Column<Guid>(type: "uuid", nullable: false),
                    loser_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merged_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    field_selections = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    transfer_counts = table.Column<Dictionary<string, int>>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    merged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_merge_audit_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_merge_audit_logs_AspNetUsers_merged_by_user_id",
                        column: x => x.merged_by_user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_contacts_merged_into",
                table: "contacts",
                column: "merged_into_id");

            migrationBuilder.CreateIndex(
                name: "idx_companies_merged_into",
                table: "companies",
                column: "merged_into_id");

            migrationBuilder.CreateIndex(
                name: "idx_dup_matching_configs_tenant",
                table: "duplicate_matching_configs",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "idx_dup_matching_configs_tenant_entity",
                table: "duplicate_matching_configs",
                columns: new[] { "tenant_id", "entity_type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_merge_audit_logs_loser",
                table: "merge_audit_logs",
                column: "loser_id");

            migrationBuilder.CreateIndex(
                name: "idx_merge_audit_logs_survivor",
                table: "merge_audit_logs",
                column: "survivor_id");

            migrationBuilder.CreateIndex(
                name: "idx_merge_audit_logs_tenant",
                table: "merge_audit_logs",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "idx_merge_audit_logs_tenant_entity",
                table: "merge_audit_logs",
                columns: new[] { "tenant_id", "entity_type" });

            migrationBuilder.CreateIndex(
                name: "IX_merge_audit_logs_merged_by_user_id",
                table: "merge_audit_logs",
                column: "merged_by_user_id");

            // Trigram GIN indexes for fuzzy duplicate detection
            migrationBuilder.Sql(
                "CREATE INDEX idx_contacts_name_trgm ON contacts USING gin ((first_name || ' ' || last_name) gin_trgm_ops);");

            migrationBuilder.Sql(
                "CREATE INDEX idx_contacts_email_trgm ON contacts USING gin (email gin_trgm_ops);");

            migrationBuilder.Sql(
                "CREATE INDEX idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);");

            migrationBuilder.Sql(
                "CREATE INDEX idx_companies_website_trgm ON companies USING gin (website gin_trgm_ops);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop trigram GIN indexes
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_contacts_name_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_contacts_email_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_companies_name_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_companies_website_trgm;");

            migrationBuilder.DropTable(
                name: "duplicate_matching_configs");

            migrationBuilder.DropTable(
                name: "merge_audit_logs");

            migrationBuilder.DropIndex(
                name: "idx_contacts_merged_into",
                table: "contacts");

            migrationBuilder.DropIndex(
                name: "idx_companies_merged_into",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "merged_at",
                table: "contacts");

            migrationBuilder.DropColumn(
                name: "merged_by_user_id",
                table: "contacts");

            migrationBuilder.DropColumn(
                name: "merged_into_id",
                table: "contacts");

            migrationBuilder.DropColumn(
                name: "merged_at",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "merged_by_user_id",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "merged_into_id",
                table: "companies");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,");
        }
    }
}
