using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddQuoteTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "quote_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    design_json = table.Column<string>(type: "jsonb", nullable: false),
                    html_body = table.Column<string>(type: "text", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    page_size = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "A4"),
                    page_orientation = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "portrait"),
                    page_margin_top = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    page_margin_right = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    page_margin_bottom = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    page_margin_left = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    thumbnail_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quote_templates", x => x.id);
                    table.ForeignKey(
                        name: "FK_quote_templates_AspNetUsers_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "idx_quote_templates_owner",
                table: "quote_templates",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "idx_quote_templates_tenant",
                table: "quote_templates",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "idx_quote_templates_tenant_default",
                table: "quote_templates",
                columns: new[] { "tenant_id", "is_default" },
                unique: true,
                filter: "is_default = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "quote_templates");
        }
    }
}
