using System;
using System.Collections.Generic;
using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddCustomFieldsAndViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_color",
                table: "AspNetUsers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "avatar_url",
                table: "AspNetUsers",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bio",
                table: "AspNetUsers",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "department",
                table: "AspNetUsers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "job_title",
                table: "AspNetUsers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "language",
                table: "AspNetUsers",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "AspNetUsers",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<UserPreferencesData>(
                name: "preferences",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");

            migrationBuilder.AddColumn<Guid>(
                name: "reporting_manager_id",
                table: "AspNetUsers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "skills",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<Dictionary<string, string>>(
                name: "social_links",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "timezone",
                table: "AspNetUsers",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                defaultValue: "UTC");

            migrationBuilder.AddColumn<WorkSchedule>(
                name: "work_schedule",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "custom_field_sections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_collapsed_by_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_field_sections", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_system = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_template = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.id);
                    table.ForeignKey(
                        name: "FK_roles_organizations_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "saved_views",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_team_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    columns = table.Column<List<ViewColumn>>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    filters = table.Column<List<ViewFilter>>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    sorts = table.Column<List<ViewSort>>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    page_size = table.Column<int>(type: "integer", nullable: false, defaultValue: 25),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_saved_views", x => x.id);
                    table.ForeignKey(
                        name: "FK_saved_views_AspNetUsers_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "custom_field_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    field_type = table.Column<short>(type: "smallint", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    section_id = table.Column<Guid>(type: "uuid", nullable: true),
                    validation = table.Column<CustomFieldValidation>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    options = table.Column<List<FieldOption>>(type: "jsonb", nullable: true),
                    relation_entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_field_definitions", x => x.id);
                    table.ForeignKey(
                        name: "FK_custom_field_definitions_custom_field_sections_section_id",
                        column: x => x.section_id,
                        principalTable: "custom_field_sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "role_field_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    field_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    access_level = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)2)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_field_permissions", x => x.id);
                    table.ForeignKey(
                        name: "FK_role_field_permissions_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    operation = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    scope = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_permissions", x => x.id);
                    table.ForeignKey(
                        name: "FK_role_permissions_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "teams",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    default_role_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teams", x => x.id);
                    table.ForeignKey(
                        name: "FK_teams_organizations_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_teams_roles_default_role_id",
                        column: x => x.default_role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "user_role_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_role_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_role_assignments_AspNetUsers_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_role_assignments_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "team_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    team_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_team_members", x => x.id);
                    table.ForeignKey(
                        name: "FK_team_members_AspNetUsers_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_team_members_teams_team_id",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_aspnetusers_reporting_manager_id",
                table: "AspNetUsers",
                column: "reporting_manager_id");

            migrationBuilder.CreateIndex(
                name: "idx_custom_field_definitions_tenant_entity",
                table: "custom_field_definitions",
                columns: new[] { "tenant_id", "entity_type" },
                filter: "NOT is_deleted");

            migrationBuilder.CreateIndex(
                name: "idx_custom_field_definitions_tenant_entity_name",
                table: "custom_field_definitions",
                columns: new[] { "tenant_id", "entity_type", "name" },
                unique: true,
                filter: "NOT is_deleted");

            migrationBuilder.CreateIndex(
                name: "IX_custom_field_definitions_section_id",
                table: "custom_field_definitions",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "idx_custom_field_sections_tenant_entity",
                table: "custom_field_sections",
                columns: new[] { "tenant_id", "entity_type" });

            migrationBuilder.CreateIndex(
                name: "idx_custom_field_sections_tenant_entity_name",
                table: "custom_field_sections",
                columns: new[] { "tenant_id", "entity_type", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_field_permissions_role_id_entity_type_field_name",
                table: "role_field_permissions",
                columns: new[] { "role_id", "entity_type", "field_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_permissions_role_id_entity_type_operation",
                table: "role_permissions",
                columns: new[] { "role_id", "entity_type", "operation" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_roles_tenant",
                table: "roles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_roles_tenant_id_name",
                table: "roles",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_saved_views_owner",
                table: "saved_views",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "idx_saved_views_tenant_entity",
                table: "saved_views",
                columns: new[] { "tenant_id", "entity_type" });

            migrationBuilder.CreateIndex(
                name: "idx_team_members_user",
                table: "team_members",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_team_members_team_id_user_id",
                table: "team_members",
                columns: new[] { "team_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_teams_tenant",
                table: "teams",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_teams_default_role_id",
                table: "teams",
                column: "default_role_id");

            migrationBuilder.CreateIndex(
                name: "ix_teams_tenant_id_name",
                table: "teams",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_user_role_assignments_user",
                table: "user_role_assignments",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_role_assignments_role_id",
                table: "user_role_assignments",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_role_assignments_user_id_role_id",
                table: "user_role_assignments",
                columns: new[] { "user_id", "role_id" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_AspNetUsers_reporting_manager_id",
                table: "AspNetUsers",
                column: "reporting_manager_id",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_AspNetUsers_reporting_manager_id",
                table: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "custom_field_definitions");

            migrationBuilder.DropTable(
                name: "role_field_permissions");

            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "saved_views");

            migrationBuilder.DropTable(
                name: "team_members");

            migrationBuilder.DropTable(
                name: "user_role_assignments");

            migrationBuilder.DropTable(
                name: "custom_field_sections");

            migrationBuilder.DropTable(
                name: "teams");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropIndex(
                name: "idx_aspnetusers_reporting_manager_id",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "avatar_color",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "avatar_url",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "bio",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "department",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "job_title",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "language",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "preferences",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "reporting_manager_id",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "skills",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "social_links",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "timezone",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "work_schedule",
                table: "AspNetUsers");
        }
    }
}
