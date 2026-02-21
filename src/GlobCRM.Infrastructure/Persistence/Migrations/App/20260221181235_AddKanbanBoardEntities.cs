using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddKanbanBoardEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "kanban_boards",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    visibility = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    creator_id = table.Column<Guid>(type: "uuid", nullable: true),
                    team_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_boards", x => x.id);
                    table.ForeignKey(
                        name: "FK_kanban_boards_AspNetUsers_creator_id",
                        column: x => x.creator_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_kanban_boards_teams_team_id",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "kanban_columns",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    board_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<double>(type: "double precision", nullable: false),
                    wip_limit = table.Column<int>(type: "integer", nullable: true),
                    color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    is_collapsed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_columns", x => x.id);
                    table.ForeignKey(
                        name: "FK_kanban_columns_kanban_boards_board_id",
                        column: x => x.board_id,
                        principalTable: "kanban_boards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "kanban_labels",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    board_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_labels", x => x.id);
                    table.ForeignKey(
                        name: "FK_kanban_labels_kanban_boards_board_id",
                        column: x => x.board_id,
                        principalTable: "kanban_boards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "kanban_cards",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    column_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    due_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    assignee_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sort_order = table.Column<double>(type: "double precision", nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    linked_entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    linked_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    linked_entity_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_cards", x => x.id);
                    table.ForeignKey(
                        name: "FK_kanban_cards_AspNetUsers_assignee_id",
                        column: x => x.assignee_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_kanban_cards_kanban_columns_column_id",
                        column: x => x.column_id,
                        principalTable: "kanban_columns",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "kanban_card_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: true),
                    parent_comment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_card_comments", x => x.id);
                    table.ForeignKey(
                        name: "FK_kanban_card_comments_AspNetUsers_author_id",
                        column: x => x.author_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_kanban_card_comments_kanban_card_comments_parent_comment_id",
                        column: x => x.parent_comment_id,
                        principalTable: "kanban_card_comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_kanban_card_comments_kanban_cards_card_id",
                        column: x => x.card_id,
                        principalTable: "kanban_cards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "kanban_card_labels",
                columns: table => new
                {
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_card_labels", x => new { x.card_id, x.label_id });
                    table.ForeignKey(
                        name: "FK_kanban_card_labels_kanban_cards_card_id",
                        column: x => x.card_id,
                        principalTable: "kanban_cards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_kanban_card_labels_kanban_labels_label_id",
                        column: x => x.label_id,
                        principalTable: "kanban_labels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "kanban_checklist_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_checked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    sort_order = table.Column<double>(type: "double precision", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_checklist_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_kanban_checklist_items_kanban_cards_card_id",
                        column: x => x.card_id,
                        principalTable: "kanban_cards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_boards_tenant_creator",
                table: "kanban_boards",
                columns: new[] { "tenant_id", "creator_id" });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_boards_tenant_name",
                table: "kanban_boards",
                columns: new[] { "tenant_id", "name" });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_boards_tenant_visibility",
                table: "kanban_boards",
                columns: new[] { "tenant_id", "visibility" });

            migrationBuilder.CreateIndex(
                name: "IX_kanban_boards_creator_id",
                table: "kanban_boards",
                column: "creator_id");

            migrationBuilder.CreateIndex(
                name: "IX_kanban_boards_team_id",
                table: "kanban_boards",
                column: "team_id");

            migrationBuilder.CreateIndex(
                name: "idx_kanban_card_comments_card_created",
                table: "kanban_card_comments",
                columns: new[] { "card_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_kanban_card_comments_author_id",
                table: "kanban_card_comments",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "IX_kanban_card_comments_parent_comment_id",
                table: "kanban_card_comments",
                column: "parent_comment_id");

            migrationBuilder.CreateIndex(
                name: "IX_kanban_card_labels_label_id",
                table: "kanban_card_labels",
                column: "label_id");

            migrationBuilder.CreateIndex(
                name: "idx_kanban_cards_column_archived",
                table: "kanban_cards",
                columns: new[] { "column_id", "is_archived" });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_cards_column_sort",
                table: "kanban_cards",
                columns: new[] { "column_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_cards_linked_entity",
                table: "kanban_cards",
                columns: new[] { "linked_entity_type", "linked_entity_id" });

            migrationBuilder.CreateIndex(
                name: "IX_kanban_cards_assignee_id",
                table: "kanban_cards",
                column: "assignee_id");

            migrationBuilder.CreateIndex(
                name: "idx_kanban_checklist_items_card_sort",
                table: "kanban_checklist_items",
                columns: new[] { "card_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_columns_board_sort",
                table: "kanban_columns",
                columns: new[] { "board_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "idx_kanban_labels_board",
                table: "kanban_labels",
                column: "board_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "kanban_card_comments");

            migrationBuilder.DropTable(
                name: "kanban_card_labels");

            migrationBuilder.DropTable(
                name: "kanban_checklist_items");

            migrationBuilder.DropTable(
                name: "kanban_labels");

            migrationBuilder.DropTable(
                name: "kanban_cards");

            migrationBuilder.DropTable(
                name: "kanban_columns");

            migrationBuilder.DropTable(
                name: "kanban_boards");
        }
    }
}
