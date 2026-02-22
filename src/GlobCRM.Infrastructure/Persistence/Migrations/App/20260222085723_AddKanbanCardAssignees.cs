using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddKanbanCardAssignees : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create the new join table
            migrationBuilder.CreateTable(
                name: "kanban_card_assignees",
                columns: table => new
                {
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kanban_card_assignees", x => new { x.card_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_kanban_card_assignees_AspNetUsers_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_kanban_card_assignees_kanban_cards_card_id",
                        column: x => x.card_id,
                        principalTable: "kanban_cards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_kanban_card_assignees_user_id",
                table: "kanban_card_assignees",
                column: "user_id");

            // 2. Migrate existing assignee_id data into the join table
            migrationBuilder.Sql(
                "INSERT INTO kanban_card_assignees (card_id, user_id) " +
                "SELECT id, assignee_id FROM kanban_cards WHERE assignee_id IS NOT NULL");

            // 3. Drop old FK, index, and column
            migrationBuilder.DropForeignKey(
                name: "FK_kanban_cards_AspNetUsers_assignee_id",
                table: "kanban_cards");

            migrationBuilder.DropIndex(
                name: "IX_kanban_cards_assignee_id",
                table: "kanban_cards");

            migrationBuilder.DropColumn(
                name: "assignee_id",
                table: "kanban_cards");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "assignee_id",
                table: "kanban_cards",
                type: "uuid",
                nullable: true);

            // Migrate data back: pick one assignee per card
            migrationBuilder.Sql(
                "UPDATE kanban_cards SET assignee_id = ca.user_id " +
                "FROM (SELECT DISTINCT ON (card_id) card_id, user_id FROM kanban_card_assignees) ca " +
                "WHERE kanban_cards.id = ca.card_id");

            migrationBuilder.DropTable(
                name: "kanban_card_assignees");

            migrationBuilder.CreateIndex(
                name: "IX_kanban_cards_assignee_id",
                table: "kanban_cards",
                column: "assignee_id");

            migrationBuilder.AddForeignKey(
                name: "FK_kanban_cards_AspNetUsers_assignee_id",
                table: "kanban_cards",
                column: "assignee_id",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
