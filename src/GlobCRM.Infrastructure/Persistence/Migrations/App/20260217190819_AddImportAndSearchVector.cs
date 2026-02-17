using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddImportAndSearchVector : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "search_vector",
                table: "deals",
                type: "tsvector",
                nullable: false)
                .Annotation("Npgsql:TsVectorConfig", "english")
                .Annotation("Npgsql:TsVectorProperties", new[] { "title", "description" });

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "search_vector",
                table: "contacts",
                type: "tsvector",
                nullable: false)
                .Annotation("Npgsql:TsVectorConfig", "english")
                .Annotation("Npgsql:TsVectorProperties", new[] { "first_name", "last_name", "email", "job_title" });

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "search_vector",
                table: "companies",
                type: "tsvector",
                nullable: false)
                .Annotation("Npgsql:TsVectorConfig", "english")
                .Annotation("Npgsql:TsVectorProperties", new[] { "name", "industry", "email", "city" });

            migrationBuilder.CreateTable(
                name: "import_jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    original_file_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    stored_file_path = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    total_rows = table.Column<int>(type: "integer", nullable: false),
                    processed_rows = table.Column<int>(type: "integer", nullable: false),
                    success_count = table.Column<int>(type: "integer", nullable: false),
                    error_count = table.Column<int>(type: "integer", nullable: false),
                    duplicate_count = table.Column<int>(type: "integer", nullable: false),
                    mappings = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    duplicate_strategy = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "skip"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_jobs", x => x.id);
                    table.ForeignKey(
                        name: "FK_import_jobs_AspNetUsers_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "import_job_errors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    import_job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    row_number = table.Column<int>(type: "integer", nullable: false),
                    field_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    error_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    raw_value = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_job_errors", x => x.id);
                    table.ForeignKey(
                        name: "FK_import_job_errors_import_jobs_import_job_id",
                        column: x => x.import_job_id,
                        principalTable: "import_jobs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_deals_search_vector",
                table: "deals",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "idx_contacts_search_vector",
                table: "contacts",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "idx_companies_search_vector",
                table: "companies",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "idx_import_job_errors_job",
                table: "import_job_errors",
                column: "import_job_id");

            migrationBuilder.CreateIndex(
                name: "idx_import_jobs_status",
                table: "import_jobs",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_import_jobs_tenant",
                table: "import_jobs",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "idx_import_jobs_tenant_user",
                table: "import_jobs",
                columns: new[] { "tenant_id", "user_id" });

            migrationBuilder.CreateIndex(
                name: "IX_import_jobs_user_id",
                table: "import_jobs",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "import_job_errors");

            migrationBuilder.DropTable(
                name: "import_jobs");

            migrationBuilder.DropIndex(
                name: "idx_deals_search_vector",
                table: "deals");

            migrationBuilder.DropIndex(
                name: "idx_contacts_search_vector",
                table: "contacts");

            migrationBuilder.DropIndex(
                name: "idx_companies_search_vector",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "search_vector",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "search_vector",
                table: "contacts");

            migrationBuilder.DropColumn(
                name: "search_vector",
                table: "companies");
        }
    }
}
