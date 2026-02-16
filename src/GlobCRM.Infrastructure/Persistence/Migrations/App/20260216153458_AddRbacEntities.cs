using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddRbacEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "preferences",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: false,
                oldClrType: typeof(UserPreferencesData),
                oldType: "jsonb",
                oldDefaultValueSql: "'{}'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<UserPreferencesData>(
                name: "preferences",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb",
                oldClrType: typeof(string),
                oldType: "jsonb");
        }
    }
}
