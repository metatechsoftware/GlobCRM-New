using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddNotesAndAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "attachments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    storage_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    content_type = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    uploaded_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    uploaded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attachments", x => x.id);
                    table.ForeignKey(
                        name: "FK_attachments_AspNetUsers_uploaded_by_id",
                        column: x => x.uploaded_by_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "notes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    body = table.Column<string>(type: "text", nullable: false),
                    plain_text_body = table.Column<string>(type: "text", nullable: true),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    author_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notes", x => x.id);
                    table.ForeignKey(
                        name: "FK_notes_AspNetUsers_author_id",
                        column: x => x.author_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "idx_attachments_tenant_entity",
                table: "attachments",
                columns: new[] { "tenant_id", "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "IX_attachments_uploaded_by_id",
                table: "attachments",
                column: "uploaded_by_id");

            migrationBuilder.CreateIndex(
                name: "idx_notes_tenant_author",
                table: "notes",
                columns: new[] { "tenant_id", "author_id" });

            migrationBuilder.CreateIndex(
                name: "idx_notes_tenant_entity",
                table: "notes",
                columns: new[] { "tenant_id", "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "IX_notes_author_id",
                table: "notes",
                column: "author_id");

            // RLS policies for tenant isolation (Layer 3 of triple-layer defense)
            migrationBuilder.Sql(@"
                ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
                CREATE POLICY tenant_isolation_notes ON notes USING (tenant_id::text = current_setting('app.current_tenant', true));
                ALTER TABLE notes FORCE ROW LEVEL SECURITY;
            ");

            migrationBuilder.Sql(@"
                ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
                CREATE POLICY tenant_isolation_attachments ON attachments USING (tenant_id::text = current_setting('app.current_tenant', true));
                ALTER TABLE attachments FORCE ROW LEVEL SECURITY;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop RLS policies before dropping tables
            migrationBuilder.Sql("DROP POLICY IF EXISTS tenant_isolation_notes ON notes;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS tenant_isolation_attachments ON attachments;");

            migrationBuilder.DropTable(
                name: "attachments");

            migrationBuilder.DropTable(
                name: "notes");
        }
    }
}
