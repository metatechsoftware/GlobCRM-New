using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddDealsAndPipelines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pipelines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    team_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pipelines", x => x.id);
                    table.ForeignKey(
                        name: "FK_pipelines_teams_team_id",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "pipeline_stages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pipeline_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false, defaultValue: "#1976d2"),
                    default_probability = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false),
                    is_won = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_lost = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    required_fields = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pipeline_stages", x => x.id);
                    table.ForeignKey(
                        name: "FK_pipeline_stages_pipelines_pipeline_id",
                        column: x => x.pipeline_id,
                        principalTable: "pipelines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "deals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    probability = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: true),
                    expected_close_date = table.Column<DateOnly>(type: "date", nullable: true),
                    actual_close_date = table.Column<DateOnly>(type: "date", nullable: true),
                    pipeline_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pipeline_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    custom_fields = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deals", x => x.id);
                    table.ForeignKey(
                        name: "FK_deals_AspNetUsers_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_deals_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_deals_pipeline_stages_pipeline_stage_id",
                        column: x => x.pipeline_stage_id,
                        principalTable: "pipeline_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deals_pipelines_pipeline_id",
                        column: x => x.pipeline_id,
                        principalTable: "pipelines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "deal_contacts",
                columns: table => new
                {
                    deal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    contact_id = table.Column<Guid>(type: "uuid", nullable: false),
                    linked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deal_contacts", x => new { x.deal_id, x.contact_id });
                    table.ForeignKey(
                        name: "FK_deal_contacts_contacts_contact_id",
                        column: x => x.contact_id,
                        principalTable: "contacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_deal_contacts_deals_deal_id",
                        column: x => x.deal_id,
                        principalTable: "deals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "deal_products",
                columns: table => new
                {
                    deal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    unit_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    linked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deal_products", x => new { x.deal_id, x.product_id });
                    table.ForeignKey(
                        name: "FK_deal_products_deals_deal_id",
                        column: x => x.deal_id,
                        principalTable: "deals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_deal_products_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "deal_stage_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    deal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_stage_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    changed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deal_stage_histories", x => x.id);
                    table.ForeignKey(
                        name: "FK_deal_stage_histories_AspNetUsers_changed_by_user_id",
                        column: x => x.changed_by_user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_deal_stage_histories_deals_deal_id",
                        column: x => x.deal_id,
                        principalTable: "deals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_deal_stage_histories_pipeline_stages_from_stage_id",
                        column: x => x.from_stage_id,
                        principalTable: "pipeline_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deal_stage_histories_pipeline_stages_to_stage_id",
                        column: x => x.to_stage_id,
                        principalTable: "pipeline_stages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_deal_contacts_contact",
                table: "deal_contacts",
                column: "contact_id");

            migrationBuilder.CreateIndex(
                name: "idx_deal_products_product",
                table: "deal_products",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "idx_deal_stage_histories_changed_at",
                table: "deal_stage_histories",
                column: "changed_at");

            migrationBuilder.CreateIndex(
                name: "idx_deal_stage_histories_deal",
                table: "deal_stage_histories",
                column: "deal_id");

            migrationBuilder.CreateIndex(
                name: "IX_deal_stage_histories_changed_by_user_id",
                table: "deal_stage_histories",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_deal_stage_histories_from_stage_id",
                table: "deal_stage_histories",
                column: "from_stage_id");

            migrationBuilder.CreateIndex(
                name: "IX_deal_stage_histories_to_stage_id",
                table: "deal_stage_histories",
                column: "to_stage_id");

            migrationBuilder.CreateIndex(
                name: "idx_deals_company",
                table: "deals",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "idx_deals_custom_fields_gin",
                table: "deals",
                column: "custom_fields")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "idx_deals_expected_close_date",
                table: "deals",
                column: "expected_close_date");

            migrationBuilder.CreateIndex(
                name: "idx_deals_owner",
                table: "deals",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "idx_deals_pipeline",
                table: "deals",
                column: "pipeline_id");

            migrationBuilder.CreateIndex(
                name: "idx_deals_tenant",
                table: "deals",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_deals_pipeline_stage_id",
                table: "deals",
                column: "pipeline_stage_id");

            migrationBuilder.CreateIndex(
                name: "idx_pipeline_stages_pipeline_sort",
                table: "pipeline_stages",
                columns: new[] { "pipeline_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "idx_pipelines_tenant",
                table: "pipelines",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_pipelines_team_id",
                table: "pipelines",
                column: "team_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deal_contacts");

            migrationBuilder.DropTable(
                name: "deal_products");

            migrationBuilder.DropTable(
                name: "deal_stage_histories");

            migrationBuilder.DropTable(
                name: "deals");

            migrationBuilder.DropTable(
                name: "pipeline_stages");

            migrationBuilder.DropTable(
                name: "pipelines");
        }
    }
}
