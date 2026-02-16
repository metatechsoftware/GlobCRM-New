using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "organizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    subdomain = table.Column<string>(type: "character varying(63)", maxLength: 63, nullable: false),
                    industry = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    company_size = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    user_limit = table.Column<int>(type: "integer", nullable: false, defaultValue: 10),
                    setup_completed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_info",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_info", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_organizations_subdomain",
                table: "organizations",
                column: "subdomain",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_info_Identifier",
                table: "tenant_info",
                column: "Identifier",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "organizations");

            migrationBuilder.DropTable(
                name: "tenant_info");
        }
    }
}
