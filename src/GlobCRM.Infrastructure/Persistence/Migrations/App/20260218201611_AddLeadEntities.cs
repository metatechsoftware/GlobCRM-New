using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddLeadEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lead_sources",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_sources", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lead_stages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    is_converted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_lost = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_stages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "leads",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    first_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    last_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    mobile_phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    job_title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    company_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    lead_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lead_source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    temperature = table.Column<int>(type: "integer", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_converted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    converted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    converted_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    converted_contact_id = table.Column<Guid>(type: "uuid", nullable: true),
                    converted_company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    converted_deal_id = table.Column<Guid>(type: "uuid", nullable: true),
                    custom_fields = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    description = table.Column<string>(type: "text", nullable: true),
                    search_vector = table.Column<NpgsqlTsVector>(type: "tsvector", nullable: false)
                        .Annotation("Npgsql:TsVectorConfig", "english")
                        .Annotation("Npgsql:TsVectorProperties", new[] { "first_name", "last_name", "email", "company_name" }),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leads", x => x.id);
                    table.ForeignKey(
                        name: "FK_leads_AspNetUsers_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_leads_lead_sources_lead_source_id",
                        column: x => x.lead_source_id,
                        principalTable: "lead_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_leads_lead_stages_lead_stage_id",
                        column: x => x.lead_stage_id,
                        principalTable: "lead_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lead_conversions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    lead_id = table.Column<Guid>(type: "uuid", nullable: false),
                    contact_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deal_id = table.Column<Guid>(type: "uuid", nullable: true),
                    converted_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    converted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_conversions", x => x.id);
                    table.ForeignKey(
                        name: "FK_lead_conversions_AspNetUsers_converted_by_user_id",
                        column: x => x.converted_by_user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lead_conversions_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_lead_conversions_contacts_contact_id",
                        column: x => x.contact_id,
                        principalTable: "contacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lead_conversions_deals_deal_id",
                        column: x => x.deal_id,
                        principalTable: "deals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_lead_conversions_leads_lead_id",
                        column: x => x.lead_id,
                        principalTable: "leads",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "lead_stage_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    lead_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_stage_id = table.Column<Guid>(type: "uuid", nullable: true),
                    to_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    changed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_stage_histories", x => x.id);
                    table.ForeignKey(
                        name: "FK_lead_stage_histories_AspNetUsers_changed_by_user_id",
                        column: x => x.changed_by_user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_lead_stage_histories_lead_stages_from_stage_id",
                        column: x => x.from_stage_id,
                        principalTable: "lead_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_lead_stage_histories_lead_stages_to_stage_id",
                        column: x => x.to_stage_id,
                        principalTable: "lead_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lead_stage_histories_leads_lead_id",
                        column: x => x.lead_id,
                        principalTable: "leads",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_lead_conversions_lead_id",
                table: "lead_conversions",
                column: "lead_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lead_conversions_company_id",
                table: "lead_conversions",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_lead_conversions_contact_id",
                table: "lead_conversions",
                column: "contact_id");

            migrationBuilder.CreateIndex(
                name: "IX_lead_conversions_converted_by_user_id",
                table: "lead_conversions",
                column: "converted_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_lead_conversions_deal_id",
                table: "lead_conversions",
                column: "deal_id");

            migrationBuilder.CreateIndex(
                name: "idx_lead_sources_tenant_sort_order",
                table: "lead_sources",
                columns: new[] { "tenant_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "idx_lead_stage_histories_changed_at",
                table: "lead_stage_histories",
                column: "changed_at");

            migrationBuilder.CreateIndex(
                name: "idx_lead_stage_histories_lead",
                table: "lead_stage_histories",
                column: "lead_id");

            migrationBuilder.CreateIndex(
                name: "IX_lead_stage_histories_changed_by_user_id",
                table: "lead_stage_histories",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_lead_stage_histories_from_stage_id",
                table: "lead_stage_histories",
                column: "from_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_lead_stage_histories_to_stage_id",
                table: "lead_stage_histories",
                column: "to_stage_id");

            migrationBuilder.CreateIndex(
                name: "idx_lead_stages_tenant_sort_order",
                table: "lead_stages",
                columns: new[] { "tenant_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "idx_leads_custom_fields_gin",
                table: "leads",
                column: "custom_fields")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "idx_leads_is_converted",
                table: "leads",
                column: "is_converted");

            migrationBuilder.CreateIndex(
                name: "idx_leads_owner_id",
                table: "leads",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "idx_leads_search_vector",
                table: "leads",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "idx_leads_source_id",
                table: "leads",
                column: "lead_source_id");

            migrationBuilder.CreateIndex(
                name: "idx_leads_stage_id",
                table: "leads",
                column: "lead_stage_id");

            migrationBuilder.CreateIndex(
                name: "idx_leads_tenant_id",
                table: "leads",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lead_conversions");

            migrationBuilder.DropTable(
                name: "lead_stage_histories");

            migrationBuilder.DropTable(
                name: "leads");

            migrationBuilder.DropTable(
                name: "lead_sources");

            migrationBuilder.DropTable(
                name: "lead_stages");
        }
    }
}
